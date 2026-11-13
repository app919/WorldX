/**
 * 建筑套件：保留真实建筑的结构特征，材质与细节萌化。
 *
 * - 武康大楼：船形圆角转角、红砖主体（3–7 层）、浅色石材基座与底层连续拱廊、白色窗框成对排列、顶层白色檐口与阳台栏杆。
 * - 花园洋房：灰泥墙、四坡红瓦屋顶、烟囱、百叶窗、门廊立柱。
 * - 石库门里弄：清水青砖、红砖腰线、石库门门框与弧形门楣、黑漆木门、坡屋顶与老虎窗。
 * - 近代装饰艺术（Art Deco）：竖向壁柱、阶梯式顶部、底层商铺。
 * - 骑楼：上层出挑覆盖人行道，柱廊下可以步行。
 * - 新村住宅：六层、成排阳台、空调外机、单元门。
 * - 菜场：大跨坡屋顶、开敞门面。  - 沿街小店：橱窗、遮阳棚、招牌。
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { RoundedBox } from '@react-three/drei';
import { ExtrudeGeometry, InstancedMesh, MeshStandardMaterial, Object3D, Shape, Vector2, type Material } from 'three';
import type { BuildingDef, DistrictDef } from '../world/types';
import type { V2 } from '../world/geom';
import { mats } from './materials';
import { extrudePolygon, worldBox } from './geo';
import { signTex } from './textures';
import { rng } from '../world/geom';
import { playerRuntime, useTown } from '../store/useTown';
import { DRAW_DIST } from './quality';
import { COUNTERPARTIES, SHOPS } from '../data/seed';

const FH = 1.35; // 层高（游戏单位）
const GF = 1.8; // 商铺底层层高

export interface WinSpec { x: number; y: number; z: number; ry: number; w: number; h: number }

/** 窗户：实例化的窗框 + 玻璃 + 窗台 */
export function Windows({ list, frame, glass }: { list: WinSpec[]; frame?: Material; glass?: Material }) {
  const M = mats();
  const fr = useRef<InstancedMesh>(null), gl = useRef<InstancedMesh>(null), sl = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D();
    list.forEach((w, i) => {
      o.position.set(w.x, w.y, w.z); o.rotation.set(0, w.ry, 0);
      o.scale.set(w.w + 0.12, w.h + 0.12, 1); o.updateMatrix(); fr.current!.setMatrixAt(i, o.matrix);
      o.translateZ(0.03); o.scale.set(w.w, w.h, 1); o.updateMatrix(); gl.current!.setMatrixAt(i, o.matrix);
      o.position.set(w.x, w.y - w.h / 2 - 0.07, w.z); o.translateZ(0.06); o.scale.set(w.w + 0.16, 1, 1); o.updateMatrix(); sl.current!.setMatrixAt(i, o.matrix);
    });
    [fr, gl, sl].forEach((r) => (r.current!.instanceMatrix.needsUpdate = true));
  }, [list]);
  if (!list.length) return null;
  return (
    <group>
      <instancedMesh ref={fr} args={[undefined, frame ?? M.frame, list.length]}><boxGeometry args={[1, 1, 0.08]} /></instancedMesh>
      <instancedMesh ref={gl} args={[undefined, glass ?? M.glass, list.length]}><boxGeometry args={[1, 1, 0.06]} /></instancedMesh>
      <instancedMesh ref={sl} args={[undefined, M.trim, list.length]} castShadow><boxGeometry args={[1, 0.08, 0.2]} /></instancedMesh>
    </group>
  );
}

export function Buildings({ def }: { def: DistrictDef }) {
  const myOpc = useTown((s) => s.myOpc);
  return (
    <group>
      {def.buildings.map((b) => {
        if (b.kind === 'wukang_mansion') {
          const c = b.polygon!.reduce((a, p) => ({ x: a.x + p.x / b.polygon!.length, z: a.z + p.z / b.polygon!.length }), { x: 0, z: 0 });
          return <Cutaway key={b.id} cx={c.x} cz={c.z} reach={14} height={12}><WukangMansion poly={b.polygon!} /></Cutaway>;
        }
        const o = b.box!;
        const signs = b.doors.map((d) => ({ ...d, sign: signFor(d.lotId, myOpc && myOpc.lotId === d.lotId ? myOpc.name : undefined) }));
        return (
          <Cutaway key={b.id} cx={o.cx} cz={o.cz} reach={Math.max(o.w, o.d) / 2} height={b.floors * FH + 2.5}>
            <group position={[o.cx, 0, o.cz]} rotation-y={o.rot}>
              <Model b={b} signs={signs} />
            </group>
          </Cutaway>
        );
      })}
    </group>
  );
}

/**
 * 距离剔除：远处的建筑不绘制（只在镜头视野之外发生，不会看到“闪烁”）。
 * 之前的“前景建筑自动压低”会在角色走过时让建筑反复升降，造成闪烁，已移除；
 * 被建筑挡住时，角色会以半透明轮廓显示（见 Player）。
 */
function Cutaway({ cx, cz, reach, children }: { cx: number; cz: number; reach: number; height?: number; children: React.ReactNode }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    if (!g.current) return;
    g.current.visible = Math.hypot(cx - playerRuntime.x, cz - playerRuntime.z) < DRAW_DIST + reach;
  });
  return <group ref={g}>{children}</group>;
}

function signFor(lotId?: string, mine?: string): { text: string; bg: string; fg: string; empty: boolean } | undefined {
  if (!lotId) return undefined;
  if (mine) return { text: mine, bg: '#E8C77A', fg: '#4A3426', empty: false };
  const shop = SHOPS.find((s) => s.lotId === lotId);
  if (shop) return { text: shop.name, bg: '#FBF6EC', fg: '#4A3426', empty: false };
  const ent = COUNTERPARTIES.find((c) => c.place.lotId === lotId);
  if (ent) return { text: ent.name.replace('（虚构）', '').replace('（示意）', ''), bg: '#F4EBDA', fg: '#7A5539', empty: false };
  return { text: '空铺 · 招租', bg: '#E9DCC3', fg: '#8D877F', empty: true };
}

type Signed = BuildingDef['doors'][number] & { sign?: ReturnType<typeof signFor> };

function Model({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  switch (b.kind) {
    case 'garden_villa': return <GardenVilla b={b} />;
    case 'shikumen_row': return <ShikumenRow b={b} signs={signs} />;
    case 'artdeco': return <ArtDeco b={b} signs={signs} />;
    case 'arcade': return <Arcade b={b} signs={signs} />;
    case 'workers_housing': return <WorkersHousing b={b} />;
    case 'market_hall': return <MarketHall b={b} signs={signs} />;
    case 'civic': return <Civic b={b} />;
    default: return <Shop b={b} signs={signs} />;
  }
}

const wallOf = (p: BuildingDef['palette']) => {
  const M = mats();
  return p === 'brick' ? M.brickWall : p === 'grey' ? M.stuccoGrey : p === 'white' ? M.stuccoWhite : p === 'pink' ? M.stuccoPink : p === 'blue' ? M.stuccoBlue : M.stuccoCream;
};

/** 正立面上一排排窗户（局部坐标，正立面在 +z） */
function facadeWindows(w: number, d: number, floors: number, y0: number, cols: number, ww = 0.75, wh = 0.85, skip?: (f: number, c: number) => boolean, sides = true): WinSpec[] {
  const out: WinSpec[] = [];
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    if (skip?.(f, c)) continue;
    const x = -w / 2 + (w / cols) * (c + 0.5);
    out.push({ x, y: y0 + f * FH + FH * 0.5, z: d / 2 + 0.02, ry: 0, w: ww, h: wh });
    if (sides && c === 0) {
      const sc = Math.max(1, Math.floor(d / 2.6));
      for (let k = 0; k < sc; k++) {
        const z = -d / 2 + (d / sc) * (k + 0.5);
        out.push({ x: -w / 2 - 0.02, y: y0 + f * FH + FH * 0.5, z, ry: -Math.PI / 2, w: ww * 0.9, h: wh });
        out.push({ x: w / 2 + 0.02, y: y0 + f * FH + FH * 0.5, z, ry: Math.PI / 2, w: ww * 0.9, h: wh });
      }
    }
  }
  return out;
}

function Box({ w, h, d, y = 0, x = 0, z = 0, mat, unit = 4, cast = true }: { w: number; h: number; d: number; y?: number; x?: number; z?: number; mat: Material; unit?: number; cast?: boolean }) {
  const g = useMemo(() => worldBox(w, h, d, unit), [w, h, d, unit]);
  return <mesh geometry={g} material={mat} position={[x, y + h / 2, z]} castShadow={cast} receiveShadow />;
}

function HipRoof({ w, d, y, h, mat }: { w: number; d: number; y: number; h: number; mat: Material }) {
  return (
    <mesh position={[0, y + h / 2, 0]} rotation-y={Math.PI / 4} scale={[w / Math.SQRT2, 1, d / Math.SQRT2]} material={mat} castShadow>
      <coneGeometry args={[1.08, h, 4, 1]} />
    </mesh>
  );
}


/** 双坡屋顶：屋脊沿 x 方向，三角形截面挤出 */
function Gable({ w, d, y, h, mat }: { w: number; d: number; y: number; h: number; mat: Material }) {
  const g = useMemo(() => {
    const sh = new Shape([new Vector2(-d / 2, 0), new Vector2(d / 2, 0), new Vector2(0, h)]);
    const geo = new ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    geo.rotateY(Math.PI / 2);
    const pos = geo.getAttribute('position'), uv = geo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, (pos.getY(i) + pos.getZ(i)) / 2);
    geo.computeVertexNormals();
    return geo;
  }, [w, d, h]);
  return <mesh geometry={g} material={mat} position-y={y} castShadow receiveShadow />;
}

function Door({ x, z, y = 0, w = 0.9, h = 1.5, mat }: { x: number; z: number; y?: number; w?: number; h?: number; mat?: Material }) {
  const M = mats();
  return (
    <group position={[x, y, z]}>
      <mesh material={M.trim} position-y={h / 2 + 0.05}><boxGeometry args={[w + 0.24, h + 0.18, 0.1]} /></mesh>
      <mesh material={mat ?? M.door} position={[0, h / 2, 0.05]}><boxGeometry args={[w, h, 0.06]} /></mesh>
      <mesh material={M.metalLight} position={[w * 0.32, h * 0.48, 0.1]}><sphereGeometry args={[0.04, 6, 6]} /></mesh>
    </group>
  );
}

/** 沿街商铺门面：橱窗 + 室内暖光 + 遮阳棚 + 招牌 */
function Storefront({ x, z, w, sign, awning }: { x: number; z: number; w: number; sign?: ReturnType<typeof signFor>; awning: string }) {
  const M = mats();
  const tex = useMemo(() => (sign ? signTex(sign.text, sign.bg, sign.fg) : null), [sign?.text, sign?.bg, sign?.fg]);
  const awnMat = useMemo(() => new MeshStandardMaterial({ color: awning, roughness: 0.8 }), [awning]);
  const n = Math.max(3, Math.round(w / 0.7));
  return (
    <group position={[x, 0, z]}>
      {/* 室内（暖色）+ 橱窗玻璃 */}
      <mesh material={M.interior} position={[-w * 0.18, 0.95, -0.12]}><boxGeometry args={[w * 0.55, 1.3, 0.05]} /></mesh>
      <mesh material={M.shopGlass} position={[-w * 0.18, 0.95, 0.04]}><boxGeometry args={[w * 0.58, 1.36, 0.06]} /></mesh>
      <mesh material={M.frameDark} position={[-w * 0.18, 0.26, 0.06]}><boxGeometry args={[w * 0.62, 0.12, 0.12]} /></mesh>
      {/* 店内的小桌与货架剪影 */}
      <mesh material={M.wood} position={[-w * 0.28, 0.5, -0.06]}><boxGeometry args={[0.6, 0.06, 0.05]} /></mesh>
      {/* 遮阳棚：条纹 */}
      <group position={[0, 1.95, 0.42]} rotation-x={0.42}>
        {Array.from({ length: n }).map((_, i) => (
          <mesh key={i} material={i % 2 ? M.awningCream : awnMat} position={[-w / 2 + (w / n) * (i + 0.5), 0, 0]} castShadow>
            <boxGeometry args={[w / n, 0.05, 0.95]} />
          </mesh>
        ))}
      </group>
      {tex && (
        <mesh position={[0, 2.55, 0.08]}>
          <planeGeometry args={[Math.min(w * 0.9, 4.2), 0.62]} />
          <meshStandardMaterial map={tex} roughness={0.6} emissive="#FFE7BE" emissiveIntensity={0.08} />
        </mesh>
      )}
    </group>
  );
}

function Shop({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const M = mats();
  const { w, d } = b.box!;
  const R = rng(b.seed ?? 1);
  const wall = wallOf(b.palette);
  const upper = b.floors - 1;
  const H = GF + upper * FH;
  const awnings = ['#A9C2A0', '#E6A3A7', '#9DB6CA', '#E8C77A', '#C98068'];
  const wins = useMemo(() => facadeWindows(w, d, upper, GF, Math.max(2, Math.floor(w / 2.4)), 0.8, 0.85), [w, d, upper]);
  const pitched = R() > 0.45;
  return (
    <group>
      <Box w={w} h={0.25} d={d} mat={M.stoneDark} />
      <Box w={w} h={H - 0.25} d={d} y={0.25} mat={wall} />
      <Box w={w + 0.2} h={0.16} d={d + 0.2} y={GF} mat={M.trim} />
      <Windows list={wins} />
      {signs.map((s, i) => (
        <group key={i}>
          <Storefront x={s.offset * 0.4} z={d / 2} w={w * 0.86} sign={s.sign} awning={awnings[(b.seed ?? 0) % awnings.length]} />
          <Door x={s.offset * 0.4 + w * 0.3} z={d / 2} h={1.5} mat={M.woodDark} />
        </group>
      ))}
      {pitched ? <HipRoof w={w + 0.5} d={d + 0.5} y={H} h={1.4} mat={R() > 0.5 ? M.roofRed : M.roofGrey} /> : (
        <>
          <Box w={w + 0.2} h={0.3} d={d + 0.2} y={H} mat={M.roofFlat} />
          <RoofDetails w={w} d={d} y={H + 0.3} seed={b.seed ?? 1} />
        </>
      )}
    </group>
  );
}

function GardenVilla({ b }: { b: BuildingDef }) {
  const M = mats();
  const { w, d } = b.box!;
  const H = b.floors * FH + 0.4;
  const wall = wallOf(b.palette);
  const shutter = useMemo(() => new MeshStandardMaterial({ color: '#6F9A84', roughness: 0.7 }), []);
  const wins = useMemo(() => facadeWindows(w, d, b.floors, 0.4, Math.max(3, Math.floor(w / 2.2)), 0.8, 0.9, (f, c) => f === 0 && c === 1), [w, d, b.floors]);
  const setback = b.setback ?? 4;
  return (
    <group>
      {/* 前院草坪与花坛 */}
      <Box w={w + 4} h={0.12} d={setback} z={d / 2 + setback / 2} mat={M.grass} unit={6} cast={false} />
      <Box w={w} h={H} d={d} mat={wall} />
      <Box w={w + 0.3} h={0.4} d={d + 0.3} mat={M.stone} />
      <Windows list={wins} />
      {wins.filter((x) => x.ry === 0).map((x, i) => (
        <group key={i}>
          <mesh material={shutter} position={[x.x - x.w / 2 - 0.2, x.y, x.z + 0.03]}><boxGeometry args={[0.3, x.h, 0.05]} /></mesh>
          <mesh material={shutter} position={[x.x + x.w / 2 + 0.2, x.y, x.z + 0.03]}><boxGeometry args={[0.3, x.h, 0.05]} /></mesh>
        </group>
      ))}
      {/* 门廊 */}
      <Box w={2.4} h={0.18} d={1.4} y={FH + 0.35} z={d / 2 + 0.7} mat={M.trim} />
      {[-1, 1].map((s) => <mesh key={s} material={M.trim} position={[s * 1.05, (FH + 0.35) / 2, d / 2 + 1.25]} castShadow><cylinderGeometry args={[0.1, 0.12, FH + 0.35, 10]} /></mesh>)}
      <Door x={0} z={d / 2} y={0.4} h={1.3} />
      <Box w={2.0} h={0.2} d={0.8} z={d / 2 + 0.4} mat={M.stone} />
      <HipRoof w={w + 0.8} d={d + 0.8} y={H} h={2.0} mat={b.palette === 'white' ? M.roofGrey : M.roofRed} />
      <Box w={0.6} h={1.6} d={0.6} x={w * 0.28} y={H + 0.4} z={-d * 0.15} mat={M.brickWall} />
      {/* 花园里的灌木 */}
      {[-w / 2 - 1, w / 2 + 1].map((x) => (
        <mesh key={x} position={[x, 0.6, d / 2 + setback * 0.4]} material={M.hedge} castShadow><sphereGeometry args={[0.8, 12, 10]} /></mesh>
      ))}
    </group>
  );
}

function ShikumenRow({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const M = mats();
  const { w, d } = b.box!;
  const H = b.floors * FH + 0.3;
  const units = signs.length;
  const uw = w / units;
  const wins = useMemo(() => {
    const out: WinSpec[] = [];
    for (let u = 0; u < units; u++) {
      const cx = -w / 2 + uw * (u + 0.5);
      out.push({ x: cx - uw * 0.22, y: FH + 0.3 + FH * 0.5, z: d / 2 + 0.02, ry: 0, w: 0.7, h: 0.8 });
      out.push({ x: cx + uw * 0.22, y: FH + 0.3 + FH * 0.5, z: d / 2 + 0.02, ry: 0, w: 0.7, h: 0.8 });
    }
    return out;
  }, [w, d, units, uw]);
  return (
    <group>
      <Box w={w} h={H} d={d} mat={M.greyBrick} unit={3} />
      <Box w={w + 0.1} h={0.18} d={d + 0.1} y={FH + 0.22} mat={M.brickWall} />
      <Windows list={wins} frame={M.woodDark} />
      {signs.map((s, i) => {
        const cx = -w / 2 + uw * (i + 0.5);
        return (
          <group key={i} position={[cx, 0, d / 2]}>
            {/* 石库门：石门框 + 弧形门楣 + 黑漆双扇门 */}
            <mesh material={M.stone} position={[0, 0.95, 0.06]} castShadow><boxGeometry args={[1.6, 1.9, 0.14]} /></mesh>
            <mesh material={M.stone} position={[0, 2.05, 0.08]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.85, 0.85, 0.18, 18, 1, false, -Math.PI / 2, Math.PI]} /></mesh>
            <mesh material={M.door} position={[-0.27, 0.8, 0.14]}><boxGeometry args={[0.52, 1.55, 0.06]} /></mesh>
            <mesh material={M.door} position={[0.27, 0.8, 0.14]}><boxGeometry args={[0.52, 1.55, 0.06]} /></mesh>
            {[-0.1, 0.1].map((x) => <mesh key={x} material={M.metalLight} position={[x, 0.85, 0.18]}><torusGeometry args={[0.06, 0.015, 6, 12]} /></mesh>)}
            {s.sign && !s.sign.empty && (
              <mesh position={[0, 2.62, 0.1]}><planeGeometry args={[1.8, 0.4]} /><meshStandardMaterial map={signTex(s.sign.text, s.sign.bg, s.sign.fg)} /></mesh>
            )}
          </group>
        );
      })}
      {/* 坡屋顶 + 老虎窗 */}
      <Gable w={w + 0.4} d={d + 0.8} y={H} h={1.6} mat={M.roofGrey} />
      {Array.from({ length: units }).map((_, i) => (
        <group key={i} position={[-w / 2 + uw * (i + 0.5), H + 0.5, d * 0.18]}>
          <Box w={0.9} h={0.7} d={0.8} mat={M.stuccoWhite} />
          <mesh material={M.glass} position={[0, 0.35, 0.41]}><boxGeometry args={[0.55, 0.45, 0.04]} /></mesh>
          <mesh material={M.roofGrey} position={[0, 0.85, 0]} rotation-y={Math.PI / 4} scale={[0.75, 1, 0.75]}><coneGeometry args={[0.85, 0.4, 4]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function ArtDeco({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const M = mats();
  const { w, d } = b.box!;
  const wall = wallOf(b.palette);
  const H = GF + (b.floors - 1) * FH;
  const cols = Math.max(3, Math.floor(w / 2.1));
  const wins = useMemo(() => facadeWindows(w, d, b.floors - 1, GF, cols, 0.85, 0.95), [w, d, b.floors, cols]);
  const shop = signs.find((s) => s.lotId);
  return (
    <group>
      <Box w={w} h={GF} d={d} mat={M.stone} />
      <Box w={w} h={H - GF} d={d} y={GF} mat={wall} />
      {/* 竖向壁柱 */}
      {Array.from({ length: cols + 1 }).map((_, i) => (
        <Box key={i} w={0.28} h={H - GF + 0.8} d={0.24} x={-w / 2 + (w / cols) * i} y={GF} z={d / 2 + 0.06} mat={M.trim} />
      ))}
      <Windows list={wins} />
      {/* 阶梯式顶部 */}
      <Box w={w * 0.7} h={0.9} d={d * 0.8} y={H} mat={wall} />
      <Box w={w * 0.36} h={0.8} d={d * 0.6} y={H + 0.9} mat={M.trim} />
      <Box w={w + 0.2} h={0.2} d={d + 0.2} y={H} mat={M.trim} />
      {shop ? <Storefront x={0} z={d / 2} w={w * 0.6} sign={shop.sign} awning="#C98068" /> : (
        <>
          <mesh material={M.glass} position={[-w * 0.3, 0.95, d / 2 + 0.03]}><boxGeometry args={[w * 0.3, 1.2, 0.05]} /></mesh>
          <mesh material={M.glass} position={[w * 0.3, 0.95, d / 2 + 0.03]}><boxGeometry args={[w * 0.3, 1.2, 0.05]} /></mesh>
        </>
      )}
      <Door x={shop ? w * 0.38 : 0} z={d / 2} h={1.55} mat={M.woodDark} />
    </group>
  );
}

function Arcade({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const M = mats();
  const { w, d } = b.box!;
  const wall = wallOf(b.palette);
  const over = 4.3; // 出挑覆盖人行道的深度（与 build.ts 柱位一致：人行道宽 - 0.7）
  const H = GF + 0.4 + (b.floors - 1) * FH;
  const wins = useMemo(() => facadeWindows(w, d + over, b.floors - 1, GF + 0.4, Math.max(3, Math.floor(w / 2.2)), 0.8, 0.9, undefined, false).map((x) => ({ ...x, z: x.z })), [w, d, b.floors]);
  return (
    <group>
      {/* 底层（退后的店面） */}
      <Box w={w} h={GF + 0.4} d={d} mat={M.stone} />
      {signs.map((s, i) => (
        <group key={i}>
          <Storefront x={s.offset} z={d / 2} w={Math.min(6, w / signs.length - 0.6)} sign={s.sign} awning="#E8C77A" />
          <Door x={s.offset + 2.2} z={d / 2} h={1.55} mat={M.woodDark} />
        </group>
      ))}
      {/* 出挑的上层 */}
      <group position-z={over / 2}>
        <Box w={w} h={H - GF - 0.4} d={d + over} y={GF + 0.4} mat={wall} />
        <Box w={w + 0.2} h={0.25} d={d + over + 0.2} y={GF + 0.3} mat={M.trim} />
        <Box w={w + 0.2} h={0.3} d={d + over + 0.2} y={H} mat={M.trim} />
      </group>
      <group position-z={over / 2}><Windows list={wins} /></group>
      {/* 柱廊 */}
      {[-2, -1, 0, 1, 2].map((i) => (
        <group key={i} position={[(i * w) / 4.4, 0, d / 2 + over]}>
          <mesh material={M.trim} position-y={(GF + 0.4) / 2} castShadow><cylinderGeometry args={[0.22, 0.26, GF + 0.4, 12]} /></mesh>
          <mesh material={M.trim} position-y={GF + 0.25}><boxGeometry args={[0.6, 0.2, 0.6]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function WorkersHousing({ b }: { b: BuildingDef }) {
  const M = mats();
  const { w, d } = b.box!;
  const wall = wallOf(b.palette);
  const H = b.floors * FH + 0.3;
  const cols = Math.max(4, Math.floor(w / 2.3));
  const wins = useMemo(() => facadeWindows(w, d, b.floors, 0.3, cols, 0.8, 0.8), [w, d, b.floors, cols]);
  const balconies = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let f = 1; f < b.floors; f++) for (let c = 0; c < cols; c += 2) out.push({ x: -w / 2 + (w / cols) * (c + 0.5), y: 0.3 + f * FH });
    return out;
  }, [w, b.floors, cols]);
  return (
    <group>
      <Box w={w} h={H} d={d} mat={wall} />
      <Box w={w + 0.15} h={0.3} d={d + 0.15} mat={M.stoneDark} />
      <Windows list={wins} />
      {balconies.map((p, i) => (
        <group key={i} position={[p.x, p.y, d / 2 + 0.4]}>
          <mesh material={M.trim}><boxGeometry args={[1.5, 0.1, 0.8]} /></mesh>
          <mesh material={M.metalLight} position={[0, 0.3, 0.38]}><boxGeometry args={[1.5, 0.5, 0.04]} /></mesh>
          {i % 3 === 0 && <mesh position={[0.9, 0.3, -0.1]} material={M.stuccoWhite}><boxGeometry args={[0.35, 0.3, 0.3]} /></mesh>}
        </group>
      ))}
      {b.doors.map((dr, i) => (
        <group key={i}>
          <Door x={dr.offset} z={d / 2} h={1.4} mat={M.metal} />
          <mesh material={M.trim} position={[dr.offset, 1.8, d / 2 + 0.4]}><boxGeometry args={[1.6, 0.12, 0.9]} /></mesh>
        </group>
      ))}
      <Box w={w + 0.2} h={0.35} d={d + 0.2} y={H} mat={M.roofFlat} />
      <RoofDetails w={w} d={d} y={H + 0.35} seed={b.seed ?? 3} />
    </group>
  );
}

function MarketHall({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const M = mats();
  const { w, d } = b.box!;
  const sign = signs[0]?.sign;
  const tex = useMemo(() => signTex(sign?.text ?? '社区菜场', '#5E8C6A', '#FFFFFF'), [sign?.text]);
  return (
    <group>
      <Box w={w} h={2.6} d={d} mat={M.stuccoCream} />
      <Box w={w * 0.9} h={2.0} d={0.2} z={d / 2} mat={M.interior} cast={false} />
      {/* 开敞门面里的摊位 */}
      {[-0.3, 0, 0.3].map((f) => (
        <group key={f} position={[f * w, 0, d / 2 - 1.2]}>
          <RoundedBox args={[w * 0.22, 0.8, 1.0]} radius={0.05} position-y={0.4} material={M.wood} />
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={i} position={[-0.8 + (i % 3) * 0.8, 0.95, -0.2 + Math.floor(i / 3) * 0.4]}>
              <sphereGeometry args={[0.2, 10, 8]} />
              <meshStandardMaterial color={['#9BC25B', '#E8A33D', '#D9534F'][i % 3]} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[0, 2.25, d / 2 + 0.6]} rotation-x={0.35}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[-w / 2 + (w / 12) * (i + 0.5), 0, 0]} castShadow>
            <boxGeometry args={[w / 12, 0.05, 1.3]} />
            <meshStandardMaterial color={i % 2 ? '#FBF6EC' : '#7FA868'} roughness={0.8} />
          </mesh>
        ))}
      </group>
      <Gable w={w + 0.6} d={d + 0.6} y={2.6} h={2.0} mat={M.metalLight} />
      <mesh position={[0, 3.3, d / 2 + 0.05]}><planeGeometry args={[5.5, 1.1]} /><meshStandardMaterial map={tex} /></mesh>
    </group>
  );
}

function Civic({ b }: { b: BuildingDef }) {
  const M = mats();
  const { w, d } = b.box!;
  const H = b.floors * FH + 0.6;
  const tex = useMemo(() => signTex(b.name ?? '社区服务中心', '#FFFFFF', '#5E7D96'), [b.name]);
  return (
    <group>
      <Box w={w} h={H} d={d} mat={M.stuccoWhite} />
      <Box w={w * 0.96} h={H * 0.5} d={0.1} y={H * 0.35} z={d / 2} mat={M.glass} cast={false} />
      <Box w={w + 0.3} h={0.3} d={d + 0.3} y={H} mat={M.roofFlat} />
      <RoofDetails w={w} d={d} y={H + 0.3} seed={7} />
      <Box w={3.5} h={0.18} d={1.6} y={2.0} z={d / 2 + 0.8} mat={M.trim} />
      <Door x={0} z={d / 2} h={1.6} mat={M.glass} w={1.6} />
      <mesh position={[0, H - 0.5, d / 2 + 0.06]}><planeGeometry args={[6, 0.8]} /><meshStandardMaterial map={tex} /></mesh>
    </group>
  );
}

/**
 * 武康大楼：多边形挤出 + 分段材质。
 * 基座两层（石材 + 拱廊）| 3–7 层红砖 | 顶层白色 + 栏杆 | 船头圆弧转角。
 */
function WukangMansion({ poly }: { poly: V2[] }) {
  const M = mats();
  const base = 2 * FH + 0.2, mid = 5 * FH, top = FH;
  const geos = useMemo(() => {
    const inset = (k: number) => shrink(poly, k);
    return {
      base: extrudePolygon(poly, base, 0, 3),
      band1: extrudePolygon(inset(-0.18), 0.22, 0, 3),
      mid: extrudePolygon(inset(0.05), mid, 0, 2.6),
      band2: extrudePolygon(inset(-0.22), 0.3, 0, 3),
      top: extrudePolygon(inset(0.25), top, 0, 3),
      roof: extrudePolygon(inset(0.1), 0.25, 0, 3),
    };
  }, [poly]);
  const { wins, arches, rails } = useMemo(() => mansionFacade(poly, base, mid), [poly, base, mid]);
  return (
    <group>
      <mesh geometry={geos.base} material={M.stone} castShadow receiveShadow />
      <mesh geometry={geos.band1} material={M.trim} position-y={base - 0.05} castShadow />
      <mesh geometry={geos.mid} material={M.brickWall} position-y={base + 0.17} castShadow receiveShadow />
      <mesh geometry={geos.band2} material={M.trim} position-y={base + 0.17 + mid} castShadow />
      <mesh geometry={geos.top} material={M.stuccoWhite} position-y={base + 0.47 + mid} castShadow />
      <mesh geometry={geos.roof} material={M.trim} position-y={base + 0.47 + mid + top} />
      <Windows list={wins} />
      {/* 底层拱廊：深色券洞 + 白色券面 */}
      {arches.map((a, i) => (
        <group key={i} position={[a.x, 0, a.z]} rotation-y={a.ry}>
          <mesh material={M.woodDark} position={[0, 0.85, 0.02]}><boxGeometry args={[0.9, 1.7, 0.06]} /></mesh>
          <mesh material={M.woodDark} position={[0, 1.7, 0.02]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.45, 0.45, 0.06, 14, 1, false, -Math.PI / 2, Math.PI]} /></mesh>
          <mesh material={M.trim} position={[0, 1.7, 0.06]}><torusGeometry args={[0.5, 0.07, 6, 16, Math.PI]} /></mesh>
        </group>
      ))}
      {/* 顶层与船头的阳台栏杆 */}
      {rails.map((r, i) => (
        <group key={i} position={[r.x, r.y, r.z]} rotation-y={r.ry}>
          <mesh material={M.trim}><boxGeometry args={[r.len, 0.08, 0.5]} /></mesh>
          <mesh material={M.frameDark} position={[0, 0.3, 0.22]}><boxGeometry args={[r.len, 0.04, 0.04]} /></mesh>
          {Array.from({ length: Math.max(2, Math.floor(r.len / 0.3)) }).map((_, k, arr) => (
            <mesh key={k} material={M.frameDark} position={[-r.len / 2 + (r.len / (arr.length - 1)) * k, 0.15, 0.22]}><boxGeometry args={[0.03, 0.3, 0.03]} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** 多边形向内（k>0）或向外（k<0）偏移（近似：沿顶点角平分线） */
function shrink(poly: V2[], k: number): V2[] {
  const n = poly.length;
  const area = poly.reduce((s, p, i) => s + (p.x * poly[(i + 1) % n].z - poly[(i + 1) % n].x * p.z), 0);
  const sgn = area > 0 ? 1 : -1;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n];
    const e1 = norm2({ x: p.x - a.x, z: p.z - a.z }), e2 = norm2({ x: b.x - p.x, z: b.z - p.z });
    const n1 = { x: -e1.z * sgn, z: e1.x * sgn }, n2 = { x: -e2.z * sgn, z: e2.x * sgn };
    const m = norm2({ x: n1.x + n2.x, z: n1.z + n2.z });
    const cos = Math.max(0.35, m.x * n1.x + m.z * n1.z);
    return { x: p.x + (m.x * k) / cos, z: p.z + (m.z * k) / cos };
  });
}
const norm2 = (v: V2) => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; };

function mansionFacade(poly: V2[], base: number, mid: number) {
  const n = poly.length;
  const area = poly.reduce((s, p, i) => s + (p.x * poly[(i + 1) % n].z - poly[(i + 1) % n].x * p.z), 0);
  const sgn = area > 0 ? 1 : -1;
  const wins: WinSpec[] = [];
  const arches: { x: number; z: number; ry: number }[] = [];
  const rails: { x: number; y: number; z: number; ry: number; len: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const e = { x: (b.x - a.x) / L, z: (b.z - a.z) / L };
    const out = { x: e.z * sgn, z: -e.x * sgn }; // 外法线
    const ry = Math.atan2(out.x, out.z);
    const at = (t: number, off: number) => ({ x: a.x + e.x * t + out.x * off, z: a.z + e.z * t + out.z * off });
    if (L < 1.2) {
      // 船头圆弧：每段一扇窗 + 阳台
      const m = at(L / 2, 0.1);
      for (let f = 0; f < 5; f++) wins.push({ ...m, y: base + 0.17 + f * FH + FH / 2, ry, w: 0.42, h: 0.8 });
      if (i % 2 === 0) for (const y of [base + 0.17 + FH * 1.05, base + 0.17 + FH * 3.05, base + 0.47 + mid]) {
        const r = at(L / 2, 0.32); rails.push({ ...r, y, ry, len: L + 0.05 });
      }
      continue;
    }
    // 红砖段：成对的窗户
    const cols = Math.floor(L / 2.0);
    for (let c = 0; c < cols; c++) {
      const t = (L / cols) * (c + 0.5);
      for (let f = 0; f < 5; f++) {
        for (const dx of [-0.36, 0.36]) wins.push({ ...at(t + dx, 0.1), y: base + 0.17 + f * FH + FH / 2, ry, w: 0.4, h: 0.8 });
      }
      // 基座二层窗
      wins.push({ ...at(t, 0.04), y: FH + 0.2 + FH / 2, ry, w: 0.9, h: 0.75 });
      // 顶层窗
      wins.push({ ...at(t, -0.2), y: base + 0.47 + mid + FH / 2, ry, w: 0.8, h: 0.7 });
      // 底层拱廊
      if (L > 6) arches.push({ ...at(t, 0.04), ry });
    }
    if (L > 6) {
      const r = at(L / 2, 0.05);
      rails.push({ ...r, y: base + 0.47 + mid, ry, len: L - 0.6 });
    }
  }
  return { wins, arches, rails };
}

/** 平屋顶细节：女儿墙、水箱、空调外机、屋顶小花园 —— 俯视时屋顶不再是一块空白 */
function RoofDetails({ w, d, y, seed }: { w: number; d: number; y: number; seed: number }) {
  const M = mats();
  const R = rng(seed * 7 + 1);
  const t = 0.18;
  const planters = Math.floor(R() * 3);
  return (
    <group position-y={y}>
      <Box w={w + 0.2} h={0.4} d={t} z={d / 2} mat={M.trim} />
      <Box w={w + 0.2} h={0.4} d={t} z={-d / 2} mat={M.trim} />
      <Box w={t} h={0.4} d={d} x={w / 2} mat={M.trim} />
      <Box w={t} h={0.4} d={d} x={-w / 2} mat={M.trim} />
      {/* 水箱 */}
      <mesh position={[-w * 0.22, 0.55, -d * 0.18]} material={M.metalLight} castShadow><cylinderGeometry args={[0.55, 0.55, 1.1, 14]} /></mesh>
      {/* 空调外机 */}
      {[0, 1].map((i) => <Box key={i} w={0.8} h={0.5} d={0.5} x={w * 0.2 + i * 0.95} z={-d * 0.3} mat={M.stuccoWhite} />)}
      {/* 屋顶小花园 */}
      {Array.from({ length: planters }).map((_, i) => (
        <group key={i} position={[w * 0.18 - i * 1.2, 0, d * 0.22]}>
          <Box w={1.0} h={0.35} d={1.0} mat={M.wood} />
          <mesh position-y={0.6} material={M.hedge} castShadow><sphereGeometry args={[0.45, 10, 8]} /></mesh>
        </group>
      ))}
    </group>
  );
}
