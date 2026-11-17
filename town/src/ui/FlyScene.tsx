/**
 * 「打个飞的」穿云动画（独立的小 3D 场景，盖在城市画面上）：
 * - 追尾镜头跟着一架小飞机高速穿过云海：近处的云团呼啸掠过、远处的云缓慢移动（视差）；
 * - 飞机有机身、机翼、尾翼、发动机与旋转的螺旋桨，随气流倾斜、上下颠簸，翼尖拉出白色尾迹；
 * - 太阳逆光、速度线；下降阶段云层变薄、镜头俯冲穿出云底。
 * 云团是程序生成的柔和贴图（多层径向渐变），不需要加载任何图片。
 */
import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, Group, Mesh, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

let cloudTex: CanvasTexture | null = null;
/** 一朵柔软的积云：十几个大小不一的径向渐变叠在一起，底部略暗 */
function cloudTexture(): CanvasTexture {
  if (cloudTex) return cloudTex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let seed = 11; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // 先画底部的蓝灰阴影层，再画顶部受光的亮白层：云有了“体积”
  for (const layer of [0, 1]) {
    for (let i = 0; i < 18; i++) {
      const x = S * (0.2 + R() * 0.6), y = S * (layer ? 0.32 + R() * 0.3 : 0.48 + R() * 0.24), r = S * (0.1 + R() * 0.17);
      const grd = g.createRadialGradient(x - r * 0.25, y - r * 0.35, r * 0.05, x, y, r);
      if (layer) { grd.addColorStop(0, 'rgba(255,255,255,0.98)'); grd.addColorStop(0.6, 'rgba(250,252,255,0.85)'); grd.addColorStop(0.85, 'rgba(236,243,252,0.35)'); grd.addColorStop(1, 'rgba(236,243,252,0)'); }
      else { grd.addColorStop(0, 'rgba(196,210,230,0.9)'); grd.addColorStop(0.7, 'rgba(206,218,236,0.6)'); grd.addColorStop(1, 'rgba(210,222,238,0)'); }
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }
  cloudTex = new CanvasTexture(c);
  cloudTex.colorSpace = SRGBColorSpace;
  return cloudTex;
}

let glowTex: CanvasTexture | null = null;
function glowTexture(): CanvasTexture {
  if (glowTex) return glowTex;
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,250,225,1)'); grd.addColorStop(0.25, 'rgba(255,236,180,0.55)'); grd.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  glowTex = new CanvasTexture(c);
  return glowTex;
}

const SPEED = 140; // 镜头前进速度（单位 / 秒）：越快云层掠过感越强
const DEPTH = 420;

function Clouds({ phase }: { phase: 'up' | 'clouds' | 'down' }) {
  const group = useRef<Group>(null);
  const tex = useMemo(cloudTexture, []);
  const puffs = useMemo(() => {
    let seed = 5; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 130 }, () => {
      const layer = R();
      // 镜头周围留出一条“通道”，飞机从云团之间穿过；少数云团正好压过镜头制造穿云瞬间；下方是厚厚的云海
      const ang = R() * Math.PI * 2, rad = R() < 0.06 ? R() * 5 : 16 + R() * 70;
      const sea = R() < 0.35;
      return { x: sea ? (R() - 0.5) * 220 : Math.cos(ang) * rad, y: sea ? -26 - R() * 10 : Math.sin(ang) * rad * 0.5, z: -R() * DEPTH, s: sea ? 60 + layer * 50 : 16 + layer * 40, o: 0.8 + R() * 0.2, rot: R() * Math.PI };
    });
  }, []);
  const refs = useRef<Sprite[]>([]);
  const fade = useRef(phase === 'down' ? 1 : 0);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const target = phase === 'down' ? 0.15 : 1;
    fade.current += (target - fade.current) * Math.min(1, dt * (phase === 'down' ? 3.5 : 6));
    puffs.forEach((p, i) => {
      p.z += SPEED * dt * (0.85 + (p.s / 64) * 0.3);
      if (p.z > 8) p.z -= DEPTH;
      const s = refs.current[i];
      if (!s) return;
      s.position.set(p.x, p.y, p.z);
      // 离镜头很近时淡出，避免整屏糊白太久
      const near = Math.min(1, Math.max(0, (-p.z - 2) / 22));
      const far = Math.min(1, Math.max(0, (DEPTH + p.z) / 90)); // 远处淡入，不会“啪”地出现
      (s.material as SpriteMaterial).opacity = p.o * fade.current * (0.2 + 0.8 * near) * far;
    });
  });
  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <sprite key={i} ref={(el) => { if (el) refs.current[i] = el; }} scale={[p.s * 1.6, p.s, 1]} position={[p.x, p.y, p.z]}>
          <spriteMaterial map={tex} transparent depthWrite={false} fog={false} rotation={p.rot * 0.1} color="#ffffff" />
        </sprite>
      ))}
    </group>
  );
}

function SpeedLines() {
  const lines = useMemo(() => {
    let seed = 3; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 40 }, () => ({ x: (R() - 0.5) * 50, y: (R() - 0.5) * 30, z: -R() * 160, l: 6 + R() * 14 }));
  }, []);
  const refs = useRef<Mesh[]>([]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    lines.forEach((l, i) => { l.z += SPEED * 1.8 * dt; if (l.z > 5) l.z -= 160; refs.current[i]?.position.set(l.x, l.y, l.z); });
  });
  return (
    <group>
      {lines.map((l, i) => (
        <mesh key={i} ref={(el) => { if (el) refs.current[i] = el; }} position={[l.x, l.y, l.z]}>
          <boxGeometry args={[0.025, 0.025, l.l]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** 小飞机：白色机身、蓝色涂装、双发、旋转螺旋桨；随气流倾斜与颠簸 */
function Plane({ phase }: { phase: 'up' | 'clouds' | 'down' }) {
  const g = useRef<Group>(null);
  const prop = useRef<Group>(null);
  const trails = useRef<Mesh[]>([]);
  const t0 = useRef(0);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    if (!t0.current) t0.current = t;
    const k = t - t0.current;
    if (!g.current) return;
    const climb = phase === 'up' ? 0.25 : phase === 'down' ? -0.32 : 0;
    g.current.position.set(Math.sin(k * 2.3) * 0.5, -1.4 + Math.sin(k * 5.1) * 0.12 + (phase === 'down' ? -k * 0.8 : 0), -9);
    g.current.rotation.set(climb + Math.sin(k * 3.7) * 0.03, Math.PI, Math.sin(k * 2.3) * 0.22 + Math.sin(k * 7) * 0.03);
    if (prop.current) prop.current.rotation.z += dt * 60;
    trails.current.forEach((m) => { if (m) (m.material as { opacity: number }).opacity = 0.22 + Math.sin(k * 20) * 0.06; });
  });
  const white = '#F7F9FC', blue = '#2F6FD6', dark = '#2A3140', glass = '#8FC3F2';
  return (
    <group ref={g}>
      {/* 机身 */}
      <mesh rotation-x={Math.PI / 2}><capsuleGeometry args={[0.42, 3.2, 8, 16]} /><meshStandardMaterial color={white} metalness={0.35} roughness={0.35} /></mesh>
      <mesh position={[0, -0.12, 0]} rotation-x={Math.PI / 2} scale={[1.01, 1.01, 1]}><cylinderGeometry args={[0.43, 0.43, 3.0, 16, 1, true, Math.PI * 0.85, Math.PI * 0.3]} /><meshStandardMaterial color={blue} side={DoubleSide} /></mesh>
      {/* 驾驶舱玻璃 */}
      <mesh position={[0, 0.22, 1.65]} rotation-x={-0.5}><sphereGeometry args={[0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={glass} metalness={0.6} roughness={0.08} /></mesh>
      {/* 机翼（后掠） */}
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 2.0, -0.08, 0.15]} rotation={[0, s * 0.28, s * 0.06]}><boxGeometry args={[3.6, 0.09, 0.95]} /><meshStandardMaterial color={white} metalness={0.3} roughness={0.35} /></mesh>
          <mesh position={[s * 3.75, -0.02, -0.35]} rotation={[0, s * 0.28, 0]}><boxGeometry args={[0.35, 0.1, 0.5]} /><meshStandardMaterial color={blue} /></mesh>
          {/* 发动机 */}
          <mesh position={[s * 1.4, -0.38, 0.55]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.24, 0.2, 0.95, 14]} /><meshStandardMaterial color={dark} metalness={0.7} roughness={0.25} /></mesh>
          {/* 翼尖尾迹 */}
          <mesh ref={(el) => { if (el) trails.current[s > 0 ? 0 : 1] = el; }} position={[s * 3.9, 0, -2.2]}><boxGeometry args={[0.02, 0.02, 3.6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} /></mesh>
        </group>
      ))}
      {/* 尾翼 */}
      <mesh position={[0, 0.65, -1.75]} rotation-x={-0.35}><boxGeometry args={[0.08, 1.1, 0.75]} /><meshStandardMaterial color={blue} /></mesh>
      {[1, -1].map((s) => <mesh key={s} position={[s * 0.75, 0.1, -1.8]}><boxGeometry args={[1.4, 0.07, 0.5]} /><meshStandardMaterial color={white} /></mesh>)}
      {/* 机头螺旋桨 */}
      <group ref={prop} position={[0, 0, 2.08]}>
        <mesh><coneGeometry args={[0.14, 0.3, 12]} /><meshStandardMaterial color={dark} metalness={0.6} /></mesh>
        {[0, 1].map((i) => <mesh key={i} rotation-z={(i * Math.PI) / 2}><boxGeometry args={[1.5, 0.1, 0.03]} /><meshStandardMaterial color={dark} transparent opacity={0.55} /></mesh>)}
      </group>
    </group>
  );
}

function Sun() {
  const tex = useMemo(glowTexture, []);
  return <sprite position={[18, 14, -80]} scale={[60, 60, 1]}><spriteMaterial map={tex} transparent blending={AdditiveBlending} depthWrite={false} /></sprite>;
}

function Rig({ phase }: { phase: 'up' | 'clouds' | 'down' }) {
  const { camera, scene } = useThree();
  useMemo(() => { scene.background = null; }, [scene]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    // 追尾镜头：轻微晃动 + 下降阶段往下俯冲
    camera.position.set(Math.sin(t * 1.7) * 0.35, Math.sin(t * 2.9) * 0.2 + (phase === 'down' ? -0.6 : 0), 0);
    camera.rotation.set(phase === 'down' ? -0.18 : phase === 'up' ? 0.08 : 0, 0, Math.sin(t * 2.3) * -0.05);
  });
  return null;
}

export function FlyScene({ phase }: { phase: 'up' | 'clouds' | 'down' }) {
  return (
    <Canvas className="!absolute inset-0" dpr={[1, 1.5]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 62, near: 0.1, far: 600 }}>
      <hemisphereLight args={[new Color('#ffffff'), new Color('#9DB6D8'), 1.1]} />
      <directionalLight position={[10, 14, 6]} intensity={2.2} color="#FFF4DD" />
      <Rig phase={phase} />
      <Sun />
      <Clouds phase={phase} />
      <SpeedLines />
      <Plane phase={phase} />
    </Canvas>
  );
}
