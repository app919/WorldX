/** 街道家具与生活资产：路灯、长椅、消防栓、垃圾桶、共享单车、花箱、邮筒、公交站、健身器材、摊位、停放车辆、情诗墙诗牌 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, type Group } from 'three';
import { playerRuntime } from '../store/useTown';
import { DRAW_DIST } from './quality';
import { RoundedBox } from '@react-three/drei';
import type { PropDef } from '../world/types';
import { mats } from './materials';
import { signTex, streetPlateTex } from './textures';

/** 街道家具按 30×30 的区块分组，远离角色的区块不绘制 */
export function Props({ props }: { props: PropDef[] }) {
  const chunks = useMemo(() => {
    const m = new Map<string, { cx: number; cz: number; list: PropDef[] }>();
    for (const p of props) {
      if (p.kind === 'tree') continue;
      const k = `${Math.floor(p.p.x / 30)}:${Math.floor(p.p.z / 30)}`;
      if (!m.has(k)) m.set(k, { cx: Math.floor(p.p.x / 30) * 30 + 15, cz: Math.floor(p.p.z / 30) * 30 + 15, list: [] });
      m.get(k)!.list.push(p);
    }
    return [...m.values()];
  }, [props]);
  return <group>{chunks.map((c) => <Chunk key={`${c.cx}:${c.cz}`} {...c} />)}</group>;
}

function Chunk({ cx, cz, list }: { cx: number; cz: number; list: PropDef[] }) {
  const g = useRef<Group>(null);
  useFrame(() => { if (g.current) g.current.visible = Math.hypot(cx - playerRuntime.x, cz - playerRuntime.z) < DRAW_DIST + 15; });
  return (
    <group ref={g}>
      {list.map((p, i) => (
        <group key={i} position={[p.p.x, 0.16, p.p.z]} rotation-y={p.rot ?? 0}>
          <PropModel p={p} />
        </group>
      ))}
    </group>
  );
}

function PropModel({ p }: { p: PropDef }) {
  const M = mats();
  switch (p.kind) {
    case 'lamp':
      // 上海街道常见的弯臂路灯（萌化）
      return (
        <group>
          <mesh material={M.metal} position-y={0.12}><cylinderGeometry args={[0.16, 0.2, 0.24, 10]} /></mesh>
          <mesh material={M.metal} position-y={1.9} castShadow><cylinderGeometry args={[0.06, 0.09, 3.6, 8]} /></mesh>
          <mesh material={M.metal} position={[0, 3.62, 0.38]} rotation-x={Math.PI / 2}><torusGeometry args={[0.38, 0.045, 6, 12, Math.PI / 2]} /></mesh>
          <mesh material={M.metal} position={[0, 3.98, 0.78]}><cylinderGeometry args={[0.22, 0.3, 0.16, 12]} /></mesh>
          <mesh material={M.lampHead} position={[0, 3.86, 0.78]}><sphereGeometry args={[0.18, 12, 10]} /></mesh>
        </group>
      );
    case 'bench':
      return (
        <group>
          {[-0.75, 0.75].map((x) => <mesh key={x} material={M.metal} position={[x, 0.22, 0]}><boxGeometry args={[0.08, 0.44, 0.6]} /></mesh>)}
          <RoundedBox args={[2.0, 0.08, 0.6]} radius={0.03} position-y={0.46} material={M.wood} castShadow />
          <RoundedBox args={[2.0, 0.42, 0.07]} radius={0.03} position={[0, 0.74, -0.28]} rotation-x={-0.12} material={M.wood} castShadow />
        </group>
      );
    case 'hydrant':
      return (
        <group>
          <mesh material={M.red} position-y={0.3} castShadow><cylinderGeometry args={[0.16, 0.2, 0.6, 12]} /></mesh>
          <mesh material={M.red} position-y={0.64}><sphereGeometry args={[0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
          <mesh material={M.metalLight} position={[0.2, 0.38, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.07, 0.07, 0.14, 8]} /></mesh>
        </group>
      );
    case 'bin':
      return (
        <group>
          <RoundedBox args={[0.42, 0.7, 0.42]} radius={0.06} position={[-0.23, 0.35, 0]} castShadow><meshStandardMaterial color="#5E8C6A" roughness={0.6} /></RoundedBox>
          <RoundedBox args={[0.42, 0.7, 0.42]} radius={0.06} position={[0.23, 0.35, 0]} castShadow><meshStandardMaterial color="#7A6E66" roughness={0.6} /></RoundedBox>
        </group>
      );
    case 'bike':
      return <Bike color={p.color ?? '#F2D99B'} />;
    case 'planter':
      return (
        <group>
          <RoundedBox args={[0.8, 0.5, 2.2]} radius={0.08} position-y={0.25} material={M.stone} castShadow />
          {Array.from({ length: 7 }).map((_, i) => (
            <mesh key={i} position={[((i * 37) % 5) / 10 - 0.2, 0.62, -0.9 + i * 0.3]}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshStandardMaterial color={['#F0A9B4', '#F6D365', '#FFFFFF', '#E58B7A'][i % 4]} roughness={0.7} />
            </mesh>
          ))}
          <mesh position-y={0.52} material={M.hedge}><boxGeometry args={[0.7, 0.12, 2.1]} /></mesh>
        </group>
      );
    case 'pond': {
      const r = p.scale ?? 4;
      return (
        <group>
          <mesh position-y={0.13} rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[r + 0.6, 40]} /><meshStandardMaterial color="#B9AE9C" roughness={0.95} /></mesh>
          <mesh position-y={0.16} rotation-x={-Math.PI / 2}><circleGeometry args={[r, 40]} /><meshStandardMaterial color="#6FA3B8" roughness={0.15} metalness={0.1} /></mesh>
          {[0.2, 1.4, 2.6, 4.1, 5.3].map((a, i) => (
            <mesh key={i} position={[Math.cos(a) * r * 0.55, 0.18, Math.sin(a) * r * 0.55]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.35 + (i % 2) * 0.15, 12]} /><meshStandardMaterial color="#7FAF63" /></mesh>
          ))}
        </group>
      );
    }
    case 'park_sign':
      return <ParkSign text={p.text ?? '公园'} />;
    case 'mailbox':
      return (
        <group>
          <mesh material={M.metal} position-y={0.45}><cylinderGeometry args={[0.07, 0.07, 0.9, 8]} /></mesh>
          <RoundedBox args={[0.7, 0.9, 0.55]} radius={0.15} position-y={1.25} material={M.red} castShadow />
          <mesh material={M.red} position-y={1.72} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.28, 0.28, 0.7, 16, 1, false, 0, Math.PI]} /></mesh>
          {/* 爱心 */}
          <group position={[0, 1.3, 0.28]} scale={0.18}>
            <mesh position={[-0.45, 0.3, 0]}><sphereGeometry args={[0.6, 12, 10]} /><meshStandardMaterial color="#FFF2F2" /></mesh>
            <mesh position={[0.45, 0.3, 0]}><sphereGeometry args={[0.6, 12, 10]} /><meshStandardMaterial color="#FFF2F2" /></mesh>
            <mesh position={[0, -0.25, 0]} rotation-z={Math.PI / 4}><boxGeometry args={[1.05, 1.05, 0.5]} /><meshStandardMaterial color="#FFF2F2" /></mesh>
          </group>
        </group>
      );
    case 'bus_stop':
      return (
        <group>
          {[-1.9, 1.9].map((x) => <mesh key={x} material={M.metal} position={[x, 1.2, 0]}><boxGeometry args={[0.1, 2.4, 0.1]} /></mesh>)}
          <RoundedBox args={[4.4, 0.12, 1.4]} radius={0.05} position={[0, 2.45, 0.5]} material={M.metalLight} castShadow />
          <mesh material={M.shopGlass} position={[0, 1.3, -0.05]}><boxGeometry args={[3.6, 1.8, 0.05]} /></mesh>
          <RoundedBox args={[2.2, 0.08, 0.4]} radius={0.03} position={[0, 0.48, 0.3]} material={M.wood} />
          <mesh position={[-1.4, 1.5, 0.02]}><planeGeometry args={[0.9, 1.3]} /><meshStandardMaterial map={signTex('公交站', '#5E7D96', '#FFFFFF', 256, 128)} /></mesh>
        </group>
      );
    case 'fitness':
      return (
        <group>
          {[-0.6, 0.6].map((x) => <mesh key={x} position={[x, 0.8, 0]}><cylinderGeometry args={[0.06, 0.06, 1.6, 8]} /><meshStandardMaterial color="#F2B84B" metalness={0.3} roughness={0.4} /></mesh>)}
          <mesh position={[0, 1.55, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.05, 0.05, 1.3, 8]} /><meshStandardMaterial color="#5E9BC8" metalness={0.3} roughness={0.4} /></mesh>
          <mesh position={[0, 0.5, 0.3]} rotation-x={0.4}><torusGeometry args={[0.3, 0.05, 6, 16]} /><meshStandardMaterial color="#5E9BC8" /></mesh>
        </group>
      );
    case 'stall':
      return (
        <group>
          <RoundedBox args={[2.4, 0.9, 1.1]} radius={0.06} position-y={0.45} material={M.wood} castShadow />
          {[-1.1, 1.1].map((x) => <mesh key={x} material={M.metal} position={[x, 1.4, -0.4]}><cylinderGeometry args={[0.04, 0.04, 1.9, 6]} /></mesh>)}
          <mesh position={[0, 2.3, 0]} rotation-x={0.25} castShadow><boxGeometry args={[2.8, 0.06, 1.8]} /><meshStandardMaterial color="#E58B7A" roughness={0.8} /></mesh>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} position={[-0.9 + (i % 4) * 0.6, 0.98, -0.2 + Math.floor(i / 4) * 0.4]}>
              <sphereGeometry args={[0.17, 10, 8]} />
              <meshStandardMaterial color={['#E8A33D', '#9BC25B', '#D9534F', '#F2D45C'][i % 4]} roughness={0.6} />
            </mesh>
          ))}
        </group>
      );
    case 'car':
      return <Car color={p.color ?? '#F2D99B'} seed={Math.round(p.p.x * 7 + p.p.z * 3)} />;
    case 'street_sign':
      return <StreetSign text={p.text ?? ''} />;
    case 'manhole':
      return (
        <mesh position-y={-0.1 + 0.002} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.55, 20]} />
          <meshStandardMaterial color="#6E6A66" roughness={0.55} metalness={0.4} />
        </mesh>
      );
    case 'poem_wall':
      return <PoemPlaque text={p.text ?? ''} />;
    default:
      return null;
  }
}

export function Bike({ color }: { color: string }) {
  const M = mats();
  return (
    <group rotation-y={Math.PI / 2}>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.33, 0]} material={M.frameDark}><torusGeometry args={[0.3, 0.045, 6, 18]} /></mesh>
      ))}
      <mesh position={[0, 0.55, 0]} rotation-z={0.15}><boxGeometry args={[1.0, 0.07, 0.07]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
      <mesh position={[-0.15, 0.75, 0]}><boxGeometry args={[0.3, 0.06, 0.16]} /><meshStandardMaterial color="#4A4644" /></mesh>
      <mesh position={[0.48, 0.9, 0]}><boxGeometry args={[0.06, 0.06, 0.55]} /><meshStandardMaterial color="#4A4644" /></mesh>
      <mesh position={[0.6, 0.62, 0]}><boxGeometry args={[0.28, 0.2, 0.32]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
    </group>
  );
}

const carPaint = new Map<string, MeshStandardMaterial>();
const paintOf = (c: string) => {
  if (!carPaint.has(c)) carPaint.set(c, new MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.35, envMapIntensity: 1.2 }));
  return carPaint.get(c)!;
};

const PLATE_LETTERS = 'ABCDEFGHJKLMN';
const tailMat = new MeshStandardMaterial({ color: '#B8322B', emissive: '#E0473C', emissiveIntensity: 0.35, roughness: 0.4 });
const chrome = new MeshStandardMaterial({ color: '#D9DDE0', metalness: 0.85, roughness: 0.2 });
const tyre = new MeshStandardMaterial({ color: '#2C2B2A', roughness: 0.9 });
const rim = new MeshStandardMaterial({ color: '#BFC3C6', metalness: 0.7, roughness: 0.3 });

/**
 * 小汽车（局部 z 轴为车头方向）：车身、轮拱、四面车窗、前大灯与尾灯、后视镜、上海蓝色车牌（虚构号码）。
 * wheelSpin / brake 由交通系统驱动，让车轮转动、刹车灯亮起。
 */
export function Car({ color, seed = 1, wheelsRef, brakeRef }: { color: string; seed?: number; wheelsRef?: React.MutableRefObject<Group[]>; brakeRef?: React.MutableRefObject<MeshStandardMaterial | null> }) {
  const M = mats();
  const paint = paintOf(color);
  const plate = useMemo(() => signTex(`沪${PLATE_LETTERS[Math.abs(seed) % PLATE_LETTERS.length]}·${String(10000 + (Math.abs(seed * 7919) % 89999)).slice(0, 5)}`, '#1F4E8C', '#FFFFFF', 256, 80), [seed]);
  const tail = useMemo(() => (brakeRef ? tailMat.clone() : tailMat), [brakeRef]);
  if (brakeRef) brakeRef.current = tail;
  const W = 1.86, L = 4.2;
  return (
    <group>
      {/* 车身下半部 */}
      <RoundedBox args={[W, 0.62, L]} radius={0.22} smoothness={3} position-y={0.6} material={paint} castShadow receiveShadow />
      {/* 车舱：前窄后宽的斜面感用两个圆角块叠出 */}
      <RoundedBox args={[W - 0.22, 0.58, 2.2]} radius={0.24} smoothness={3} position={[0, 1.12, -0.2]} material={paint} castShadow />
      {/* 车窗：前挡、后挡、两侧 */}
      <mesh position={[0, 1.15, 0.92]} rotation-x={-0.5} material={M.glass}><planeGeometry args={[W - 0.42, 0.62]} /></mesh>
      <mesh position={[0, 1.15, -1.32]} rotation={[0.5, Math.PI, 0]} material={M.glass}><planeGeometry args={[W - 0.42, 0.55]} /></mesh>
      {[1, -1].map((sg) => (
        <mesh key={sg} position={[sg * (W / 2 - 0.1), 1.17, -0.2]} rotation-y={sg * Math.PI / 2} material={M.glass}><planeGeometry args={[1.9, 0.4]} /></mesh>
      ))}
      {/* 轮拱与车轮 */}
      {[[-1, 1.32], [1, 1.32], [-1, -1.32], [1, -1.32]].map(([sx, z], i) => (
        <group key={i} position={[sx * (W / 2 - 0.12), 0.34, z]}>
          <mesh rotation-z={Math.PI / 2} material={M.frameDark} position-x={sx * 0.03}><cylinderGeometry args={[0.42, 0.42, 0.2, 18, 1, true, 0, Math.PI]} /></mesh>
          <group ref={(g) => { if (g && wheelsRef) wheelsRef.current[i] = g; }}>
            <mesh rotation-z={Math.PI / 2} material={tyre} castShadow><cylinderGeometry args={[0.34, 0.34, 0.24, 18]} /></mesh>
            <mesh rotation-z={Math.PI / 2} position-x={sx * 0.125} material={rim}><cylinderGeometry args={[0.2, 0.2, 0.02, 12]} /></mesh>
            <mesh position={[sx * 0.13, 0.12, 0]} material={chrome}><boxGeometry args={[0.02, 0.08, 0.14]} /></mesh>
          </group>
        </group>
      ))}
      {/* 前大灯、格栅、尾灯 */}
      {[-0.62, 0.62].map((x) => <mesh key={x} position={[x, 0.72, L / 2 - 0.02]} material={M.lampHead}><boxGeometry args={[0.38, 0.16, 0.06]} /></mesh>)}
      <mesh position={[0, 0.58, L / 2 - 0.01]} material={chrome}><boxGeometry args={[0.7, 0.12, 0.04]} /></mesh>
      {[-0.66, 0.66].map((x) => <mesh key={x} position={[x, 0.76, -L / 2 + 0.01]} material={tail}><boxGeometry args={[0.34, 0.14, 0.05]} /></mesh>)}
      {/* 车牌 */}
      <mesh position={[0, 0.48, L / 2 + 0.02]}><planeGeometry args={[0.62, 0.2]} /><meshStandardMaterial map={plate} /></mesh>
      <mesh position={[0, 0.5, -L / 2 - 0.02]} rotation-y={Math.PI}><planeGeometry args={[0.62, 0.2]} /><meshStandardMaterial map={plate} /></mesh>
      {/* 后视镜 */}
      {[1, -1].map((sg) => <mesh key={sg} position={[sg * (W / 2 + 0.08), 1.0, 0.75]} material={paint}><boxGeometry args={[0.16, 0.12, 0.2]} /></mesh>)}
    </group>
  );
}

/** 公园入口名牌：石座 + 木牌（两面都有字） */
function ParkSign({ text }: { text: string }) {
  const tex = useMemo(() => signTex(text, '#5B4632', '#FFF3DA', 768, 128), [text]);
  const w = Math.min(5.2, 1.2 + text.length * 0.32);
  return (
    <group>
      <mesh position-y={0.35} castShadow><boxGeometry args={[w + 0.4, 0.7, 0.7]} /><meshStandardMaterial color="#A89F92" roughness={0.95} /></mesh>
      {[-1, 1].map((sg) => <mesh key={sg} position={[sg * (w / 2 - 0.1), 1.3, 0]} castShadow><boxGeometry args={[0.16, 1.4, 0.16]} /><meshStandardMaterial color="#5B4632" /></mesh>)}
      <mesh position-y={1.55}><boxGeometry args={[w, 0.75, 0.12]} /><meshStandardMaterial color="#5B4632" /></mesh>
      <mesh position={[0, 1.55, 0.065]}><planeGeometry args={[w - 0.1, 0.7]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <mesh position={[0, 1.55, -0.065]} rotation-y={Math.PI}><planeGeometry args={[w - 0.1, 0.7]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}

function PoemPlaque({ text }: { text: string }) {
  const tex = useMemo(() => signTex(text, '#FFF6EC', '#B5654E', 512, 96), [text]);
  return (
    <group position-y={0.95}>
      <mesh><planeGeometry args={[5.2, 0.95]} /><meshStandardMaterial map={tex} roughness={0.7} /></mesh>
    </group>
  );
}

/** 路名牌：立柱 + 两块互相垂直的蓝牌（正在过的路 / 脚下这条路），两面都能看 */
function StreetSign({ text }: { text: string }) {
  const M = mats();
  const [a, b] = text.split('|');
  const ta = useMemo(() => streetPlateTex(a), [a]);
  const tb = useMemo(() => (b ? streetPlateTex(b) : null), [b]);
  return (
    <group>
      <mesh material={M.metal} position-y={1.35} castShadow><cylinderGeometry args={[0.05, 0.06, 2.7, 8]} /></mesh>
      <mesh position={[0, 2.62, 0]}><boxGeometry args={[0.06, 0.6, 1.9]} /><meshStandardMaterial color="#1F4E8C" /></mesh>
      <mesh position={[0.035, 2.62, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[1.86, 0.58]} /><meshStandardMaterial map={ta} /></mesh>
      <mesh position={[-0.035, 2.62, 0]} rotation-y={-Math.PI / 2}><planeGeometry args={[1.86, 0.58]} /><meshStandardMaterial map={ta} /></mesh>
      {tb && (
        <group position-y={2.0}>
          <mesh><boxGeometry args={[1.9, 0.6, 0.06]} /><meshStandardMaterial color="#1F4E8C" /></mesh>
          <mesh position-z={0.035}><planeGeometry args={[1.86, 0.58]} /><meshStandardMaterial map={tb} /></mesh>
          <mesh position-z={-0.035} rotation-y={Math.PI}><planeGeometry args={[1.86, 0.58]} /><meshStandardMaterial map={tb} /></mesh>
        </group>
      )}
    </group>
  );
}
