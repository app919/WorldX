import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { ExtrudeGeometry, Shape } from 'three';
import { GAME_LANDMARKS, GAME_ROADS, type GameLandmark } from '../data/buildings';
import { M } from './materials';
import { useTown } from '../store/useTown';

/**
 * 重点建筑 Q 版模型（特征简化版，reviewStatus = pending_review）。
 * 只表达公认的体量特征，细节等待按实景照片校准。
 */
export function Landmarks() {
  const select = useTown((s) => s.select);
  return (
    <group>
      {GAME_LANDMARKS.map((b) => (
        <group
          key={b.id}
          position={[b.pos.x, 0, b.pos.z]}
          onClick={(e) => { e.stopPropagation(); select('building', b.id); }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <LandmarkModel b={b} />
        </group>
      ))}
    </group>
  );
}

function LandmarkModel({ b }: { b: GameLandmark }) {
  switch (b.model) {
    case 'wukang_mansion': return <WukangMansion b={b} />;
    case 'garden_villa': return <GardenVilla roof={M.roofGrey} wall={M.cream} />;
    case 'villa_red': return <GardenVilla roof={M.roofRed} wall={M.creamDeep} />;
    case 'lane_cluster': return <LaneCluster rot={b.rotation} />;
    case 'theatre': return <Theatre />;
  }
}

/** 武康大楼：熨斗形平面，锐角朝向路口；底层外廊；红砖 + 浅色饰面 */
function WukangMansion({ b }: { b: GameLandmark }) {
  const junction = GAME_ROADS.find((r) => r.id === 'wukang_rd')!.pts[0];
  const angle = Math.atan2(-(junction.z - b.pos.z), junction.x - b.pos.x);

  const { lower, upper, cornice, tip, back } = useMemo(() => {
    const tip = { x: 5.4, y: 0 };
    const back = { x: -3.6, y: 3.9 };
    const mk = (inset: number) => {
      const s = new Shape();
      const r = 0.9 - inset * 0.3; // 软萌圆角
      s.moveTo(tip.x - inset - r, -0.35 + inset * 0.1);
      s.quadraticCurveTo(tip.x - inset, 0, tip.x - inset - r, 0.35 - inset * 0.1);
      s.lineTo(back.x + inset + 0.6, back.y - inset);
      s.quadraticCurveTo(back.x + inset, back.y - inset, back.x + inset, back.y - inset - 0.6);
      s.lineTo(back.x + inset, -back.y + inset + 0.6);
      s.quadraticCurveTo(back.x + inset, -back.y + inset, back.x + inset + 0.6, -back.y + inset);
      s.closePath();
      return s;
    };
    const ex = (shape: Shape, depth: number) => {
      const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.18, bevelSegments: 3, curveSegments: 10 });
      g.rotateX(-Math.PI / 2);
      return g;
    };
    return { lower: ex(mk(0), 1.3), upper: ex(mk(0.25), 4.6), cornice: ex(mk(0.05), 0.35), tip, back };
  }, []);

  // 沿两条长立面摆放构件：A→B 为形状坐标系里的边，offset 为沿外法线的偏移
  const facade = (offset: number, count: number) => {
    const out: { x: number; z: number; rot: number }[] = [];
    for (const side of [1, -1]) {
      const A = { x: 4.5, y: 0.35 * side }, B = { x: back.x + 0.6, y: back.y * side };
      const ex = B.x - A.x, ey = B.y - A.y, len = Math.hypot(ex, ey);
      const nx = (side * ey) / len, ny = (-side * ex) / len; // 外法线（形状坐标）
      for (let k = 1; k < count; k++) {
        const t = k / count;
        const px = A.x + ex * t + nx * offset, py = A.y + ey * t + ny * offset;
        out.push({ x: px, z: -py, rot: Math.atan2(nx, -ny) });
      }
    }
    return out;
  };
  const windows = useMemo(() => facade(0.12, 8).flatMap((w) => [0, 1, 2, 3, 4].map((f) => ({ ...w, y: 1.85 + f * 0.85 }))), [back]);
  const arches = useMemo(() => facade(0.22, 7), [back]);
  void tip;

  return (
    <group rotation-y={angle}>
      <mesh geometry={lower} material={M.brick} castShadow receiveShadow />
      <mesh geometry={upper} material={M.creamDeep} position-y={1.3} castShadow receiveShadow />
      {/* 红砖腰线 */}
      {[2.9, 4.6].map((y) => (
        <mesh key={y} geometry={cornice} material={M.brick} position-y={y} scale={[0.97, 0.4, 0.97]} />
      ))}
      <mesh geometry={cornice} material={M.brickDeep} position-y={6.05} />
      {windows.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, w.z]} rotation-y={w.rot} material={M.window}>
          <boxGeometry args={[0.42, 0.5, 0.1]} />
        </mesh>
      ))}
      {arches.map((a, i) => (
        <mesh key={i} position={[a.x, 0.6, a.z]} rotation-y={a.rot} material={M.cream}>
          <boxGeometry args={[0.22, 1.1, 0.3]} />
        </mesh>
      ))}
      {/* 屋顶小阁楼 */}
      <RoundedBox args={[2.2, 0.8, 2.6]} radius={0.25} position={[-1.8, 6.6, 0]} material={M.brick} castShadow />
    </group>
  );
}

function GardenVilla({ roof, wall }: { roof: typeof M.roofGrey; wall: typeof M.cream }) {
  return (
    <group>
      {/* 花园草坪 */}
      <RoundedBox args={[7, 0.3, 6]} radius={0.15} position-y={0.1} material={M.grass} receiveShadow />
      {/* 矮篱笆 */}
      <RoundedBox args={[7.2, 0.5, 0.25]} radius={0.12} position={[0, 0.4, 3]} material={M.sageDeep} />
      <RoundedBox args={[4.2, 2.6, 3.2]} radius={0.35} position={[0, 1.55, -0.8]} material={wall} castShadow receiveShadow />
      <mesh position={[0, 3.35, -0.8]} rotation-y={Math.PI / 4} scale={[1.6, 0.6, 1.25]} material={roof} castShadow>
        <coneGeometry args={[2.3, 2, 4]} />
      </mesh>
      {[-1.2, 0, 1.2].map((x) =>
        [1.0, 2.1].map((y) => (
          <mesh key={`${x}${y}`} position={[x, y, 0.82]} material={M.window}>
            <boxGeometry args={[0.55, 0.6, 0.1]} />
          </mesh>
        )),
      )}
      <RoundedBox args={[0.8, 1.1, 0.2]} radius={0.08} position={[0, 0.85, 0.82]} material={M.wood} />
      {/* 花园里的软软小树 */}
      {[[-2.6, 1.6], [2.5, 1.8], [2.8, -2.2]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={0.6} material={M.trunk}><cylinderGeometry args={[0.1, 0.14, 1, 8]} /></mesh>
          <mesh position-y={1.4} material={M.sageDeep} castShadow><sphereGeometry args={[0.7, 16, 12]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function LaneCluster({ rot }: { rot: number }) {
  return (
    <group rotation-y={rot}>
      <RoundedBox args={[8, 0.15, 7]} radius={0.07} position-y={0.05} material={M.sidewalk} receiveShadow />
      <RoundedBox args={[7.6, 2.4, 2]} radius={0.3} position={[0, 1.25, -2.4]} material={M.cream} castShadow />
      <RoundedBox args={[2.2, 2.0, 4]} radius={0.3} position={[-2.8, 1.05, 0.6]} material={M.brick} castShadow />
      <RoundedBox args={[2.2, 2.6, 4]} radius={0.3} position={[2.8, 1.35, 0.6]} material={M.creamDeep} castShadow />
      {[-2.5, -0.8, 0.8, 2.5].map((x) => (
        <mesh key={x} position={[x, 1.2, -1.36]} material={M.window}><boxGeometry args={[0.8, 0.9, 0.1]} /></mesh>
      ))}
      {/* 院子里的遮阳伞和小桌 */}
      {[[-0.6, 0.4, M.sakura], [0.9, 1.6, M.almond]].map(([x, z, mat], i) => (
        <group key={i} position={[x as number, 0, z as number]}>
          <mesh position-y={0.7} material={M.cocoa}><cylinderGeometry args={[0.04, 0.04, 1.4, 6]} /></mesh>
          <mesh position-y={1.45} material={mat as typeof M.sakura} castShadow><coneGeometry args={[0.9, 0.45, 12]} /></mesh>
          <mesh position-y={0.45} material={M.cream}><cylinderGeometry args={[0.35, 0.35, 0.06, 16]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Theatre() {
  return (
    <group>
      <RoundedBox args={[9, 4.2, 6]} radius={0.5} position-y={2.1} material={M.stone} castShadow receiveShadow />
      <RoundedBox args={[9.2, 0.6, 6.2]} radius={0.25} position-y={4.3} material={M.brick} />
      <RoundedBox args={[5, 2.2, 0.3]} radius={0.12} position={[0, 1.2, 3.0]} material={M.haze} />
      {/* 海报墙（示意，不含真实剧目） */}
      {[[-3.6, M.sakura], [-2.6, M.almond], [2.6, M.sage], [3.6, M.haze]].map(([x, mat], i) => (
        <RoundedBox key={i} args={[0.8, 1.2, 0.12]} radius={0.06} position={[x as number, 1.6, 3.05]} material={mat as typeof M.sage} />
      ))}
      {[-2.5, 0, 2.5].map((x) => (
        <mesh key={x} position={[x, 3.3, 3.02]} material={M.window}><boxGeometry args={[1.4, 0.6, 0.1]} /></mesh>
      ))}
    </group>
  );
}
