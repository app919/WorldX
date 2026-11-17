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
import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { cam } from './input';
import type { Group } from 'three';
import { RoundedBox } from '@react-three/drei';
import { ExtrudeGeometry, InstancedMesh, MeshStandardMaterial, Object3D, Shape, Vector2, type Material } from 'three';
import type { BuildingDef, DistrictDef } from '../world/types';
import type { V2 } from '../world/geom';
import { mats } from './materials';
import { extrudePolygon, worldBox } from './geo';
import { ROOF_COLORS, signTex, type ShopCategory } from './textures';
import { inOBB, inPolygon, rng } from '../world/geom';
import { playerRuntime, useTown } from '../store/useTown';
import { DRAW_DIST } from './quality';
import { COUNTERPARTIES, SHOPS } from '../data/seed';
import { demoRoleOfLot, exampleAtLot, isGolden } from '../domain/lots';
import { ROLE_BADGE, ROLE_DARK, ROLE_TINT } from '../domain/palette';
import { useLots } from '../store/useLots';
import { shopAtLot, useServer } from '../store/useServer';

/**
 * 真实比例（1 单位 = 1 米）：人约 1.7 米、门约 2.25 米、住宅层高 3 米、底层商铺 3.6 米、窗约 1.1 × 1.5 米。
 */
export const FH = 3.0; // 层高

/** 店铺屋顶染色：【例】蓝 /【企】砖红 / 个人店 绿；其他建筑保持原样 */
const RoofTint = createContext<Material | null>(null);
const tintMats = new Map<ShopCategory, Material>();
const tintMat = (c: ShopCategory) => {
  if (!tintMats.has(c)) tintMats.set(c, new MeshStandardMaterial({ color: ROOF_COLORS[c], roughness: 0.72, metalness: 0 }));
  return tintMats.get(c)!;
};
const useRoof = (fallback: Material) => useContext(RoofTint) ?? fallback;
const RANK: Record<ShopCategory, number> = { example: 5, investor: 4, brand: 3, company: 2, personal: 1 };
const GF = 3.6; // 商铺底层层高

export interface WinSpec { x: number; y: number; z: number; ry: number; w: number; h: number }

/** 窗户：实例化的窗框 + 玻璃 + 窗台 */
export function Windows({ list, frame, glass }: { list: WinSpec[]; frame?: Material; glass?: Material }) {
  const M = mats();
  const fr = useRef<InstancedMesh>(null), gl = useRef<InstancedMesh>(null), gd = useRef<InstancedMesh>(null), sl = useRef<InstancedMesh>(null);
  // 夜里约 40% 的窗不开灯（按位置哈希，固定不闪）
  const dimOf = (w: WinSpec) => ((Math.floor(w.x * 7.3) * 31 + Math.floor(w.y * 3.1) * 17 + Math.floor(w.z * 5.7) * 13) & 1023) % 10 < 4;
  const nDim = list.filter(dimOf).length;
  useLayoutEffect(() => {
    const o = new Object3D();
    let a = 0, b = 0;
    list.forEach((w, i) => {
      o.position.set(w.x, w.y, w.z); o.rotation.set(0, w.ry, 0);
      o.scale.set(w.w + 0.12, w.h + 0.12, 1); o.updateMatrix(); fr.current!.setMatrixAt(i, o.matrix);
      o.translateZ(0.03); o.scale.set(w.w, w.h, 1); o.updateMatrix();
      if (dimOf(w)) gd.current?.setMatrixAt(b++, o.matrix); else gl.current?.setMatrixAt(a++, o.matrix);
      o.position.set(w.x, w.y - w.h / 2 - 0.07, w.z); o.translateZ(0.06); o.scale.set(w.w + 0.16, 1, 1); o.updateMatrix(); sl.current!.setMatrixAt(i, o.matrix);
    });
    [fr, gl, gd, sl].forEach((r) => { if (r.current) r.current.instanceMatrix.needsUpdate = true; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  if (!list.length) return null;
  return (
    <group>
      <instancedMesh ref={fr} args={[undefined, frame ?? M.frame, list.length]}><boxGeometry args={[1, 1, 0.08]} /></instancedMesh>
      {list.length - nDim > 0 && <instancedMesh ref={gl} args={[undefined, glass ?? M.glass, list.length - nDim]}><boxGeometry args={[1, 1, 0.06]} /></instancedMesh>}
      {nDim > 0 && <instancedMesh ref={gd} args={[undefined, glass ?? M.glassDim, nDim]}><boxGeometry args={[1, 1, 0.06]} /></instancedMesh>}
      <instancedMesh ref={sl} args={[undefined, M.trim, list.length]} castShadow><boxGeometry args={[1, 0.08, 0.2]} /></instancedMesh>
    </group>
  );
}

export function Buildings({ def }: { def: DistrictDef }) {
  const myOpc = useTown((s) => s.myOpc);
  const myTag = useTown((s) => s.avatar?.lifeTag);
  const myRole: ShopCategory | undefined = myTag === 'investor' ? 'investor' : myTag === 'brand' ? 'brand' : undefined;
  useLots((s) => s.sponsors);
  useServer((s) => s.shops);
  return (
    <group>
      {def.buildings.map((b) => {
        if (b.kind === 'wukang_mansion') {
          const c = b.polygon!.reduce((a, p) => ({ x: a.x + p.x / b.polygon!.length, z: a.z + p.z / b.polygon!.length }), { x: 0, z: 0 });
          return <Cutaway key={b.id} cx={c.x} cz={c.z} reach={14} height={26} contains={(p) => inPolygon(b.polygon!, p)}><WukangMansion poly={b.polygon!} /></Cutaway>;
        }
        const o = b.box!;
        const signs = b.doors.map((d) => ({ ...d, sign: signFor(d.lotId, myOpc && myOpc.lotId === d.lotId ? myOpc.name : undefined, !!myOpc?.license, myRole ?? (myOpc?.license ? 'company' : undefined)) }));
        const cat = signs.reduce<ShopCategory | undefined>((a, x) => (x.sign?.cat && (!a || RANK[x.sign.cat] > RANK[a]) ? x.sign.cat : a), undefined);
        return (
          <Cutaway key={b.id} cx={o.cx} cz={o.cz} reach={Math.max(o.w, o.d) / 2} height={b.floors * FH + 2.5} contains={(p) => inOBB(o, p, 0.2)}>
            <group position={[o.cx, 0, o.cz]} rotation-y={o.rot} userData={{ roof: cat }}>
              <RoofTint.Provider value={cat ? tintMat(cat) : null}>
                <Model b={b} signs={signs} />
              </RoofTint.Provider>
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
function Cutaway({ cx, cz, reach, height = 8, contains, children }: { cx: number; cz: number; reach: number; height?: number; contains?: (p: V2) => boolean; children: React.ReactNode }) {
  const g = useRef<Group>(null);
  const st = useRef({ k: 1, until: 0 });
  const { camera } = useThree();
  useFrame((_, dtRaw) => {
    if (!g.current) return;
    const dt = Math.min(dtRaw, 0.05);
    g.current.visible = Math.hypot(cx - playerRuntime.x, cz - playerRuntime.z) < DRAW_DIST + reach;
    if (!g.current.visible || !contains) return;
    // 俯视时挡住角色的楼：平滑“切”到只剩底层（店面与招牌仍可见），走开后再长回去；有 1.2 秒停留，避免来回闪
    let occ = false;
    if (cam.mode === 'top' && Math.hypot(cx - playerRuntime.x, cz - playerRuntime.z) < reach + 30) {
      const px = playerRuntime.x, pz = playerRuntime.z, py = 1.5;
      const c = camera.position;
      for (let k = 0.03; k <= 0.7 && !occ; k += 0.03) {
        const y = py + (c.y - py) * k;
        if (y > height) break;
        occ = contains({ x: px + (c.x - px) * k, z: pz + (c.z - pz) * k });
      }
    }
    const now = performance.now();
    if (occ) st.current.until = now + 1200;
    const want = now < st.current.until ? 0.14 : 1; // 压成一圈矮墙（像模拟经营游戏的“降墙”），露出里面的角色
    st.current.k += (want - st.current.k) * Math.min(1, dt * 6);
    g.current.scale.y = st.current.k;
  });
  return <group ref={g}>{children}</group>;
}

/** 招牌 + 店铺类别（决定屋顶颜色 = 全站身份色）：例 粉 / 企 蓝 / 投 黑 / 品 金 / 个人 紫 */
export function signFor(lotId?: string, mine?: string, mineLicensed?: boolean, mineRole?: ShopCategory): { text: string; bg: string; fg: string; empty: boolean; cat?: ShopCategory } | undefined {
  if (!lotId) return undefined;
  const C = (licensed: boolean): ShopCategory => (licensed ? 'company' : 'personal');
  const tag = (c?: ShopCategory) => (c && ROLE_BADGE[c] ? `${ROLE_BADGE[c]}|` : '');
  if (mine) { const c = mineRole ?? C(!!mineLicensed); return { text: `${tag(c)}${mine}`, bg: '#E8C77A', fg: '#4A3426', empty: false, cat: c }; }
  // 真实用户开的店（来自后端）
  const remote = shopAtLot(lotId);
  if (remote) return { text: `${tag(C(remote.licensed))}${remote.name}`, bg: '#FBF6EC', fg: '#4A3426', empty: false, cat: C(remote.licensed) };
  const cat = demoRoleOfLot(lotId);
  const ex = exampleAtLot(lotId);
  if (ex) return { text: `例|${ex.name}`, bg: ROLE_TINT.example, fg: ROLE_DARK.example, empty: false, cat: 'example' };
  const shop = SHOPS.find((s) => s.lotId === lotId);
  if (shop) return { text: `${tag(cat)}${shop.name}`, bg: '#FBF6EC', fg: '#4A3426', empty: false, cat };
  const ent = COUNTERPARTIES.find((c) => c.place.lotId === lotId);
  if (ent) return { text: `${tag(cat)}${ent.name.replace('（虚构）', '').replace('（示意）', '')}`, bg: cat ? ROLE_TINT[cat] : '#F4EBDA', fg: cat ? ROLE_DARK[cat] : '#7A5539', empty: false, cat };
  const sp = useLots.getState().sponsorOf(lotId);
  if (sp && sp.status === 'live') return { text: `赞|${sp.name.replace('（虚构）', '')}`, bg: ROLE_TINT.brand, fg: ROLE_DARK.brand, empty: false, cat: 'brand' };
  if (isGolden(lotId)) return { text: '黄金位 · 赞助招商', bg: '#F2D27A', fg: '#6B4E12', empty: false };
  return { text: 'OPC 招租', bg: '#E9DCC3', fg: '#8D877F', empty: true };
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
    case 'siheyuan': return <Siheyuan b={b} signs={signs} />;
    case 'tower': return <Tower b={b} signs={signs} />;
    case 'horsewall': return <Horsewall b={b} signs={signs} />;
    case 'chuanxi': return <Chuanxi b={b} signs={signs} />;
    case 'temple': return <Temple b={b} />;
    default: return <Shop b={b} signs={signs} />;
  }
}

const wallOf = (p: BuildingDef['palette']) => {
  const M = mats();
  return p === 'brick' ? M.brickWall : p === 'grey' ? M.stuccoGrey : p === 'white' ? M.stuccoWhite : p === 'pink' ? M.stuccoPink : p === 'blue' ? M.stuccoBlue : M.stuccoCream;
};

/** 正立面上一排排窗户（局部坐标，正立面在 +z） */
/** 窗户真实尺寸系数（参数沿用旧的相对值，乘上它得到约 1.1 × 1.5 米） */
const WIN_W = 1.4, WIN_H = 1.75;
function facadeWindows(w: number, d: number, floors: number, y0: number, cols: number, ww = 0.75, wh = 0.85, skip?: (f: number, c: number) => boolean, sides = true): WinSpec[] {
  const out: WinSpec[] = [];
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    if (skip?.(f, c)) continue;
    const x = -w / 2 + (w / cols) * (c + 0.5);
    out.push({ x, y: y0 + f * FH + FH * 0.5, z: d / 2 + 0.02, ry: 0, w: ww * WIN_W, h: wh * WIN_H });
    if (sides && c === 0) {
      const sc = Math.max(1, Math.floor(d / 2.6));
      for (let k = 0; k < sc; k++) {
        const z = -d / 2 + (d / sc) * (k + 0.5);
        out.push({ x: -w / 2 - 0.02, y: y0 + f * FH + FH * 0.5, z, ry: -Math.PI / 2, w: ww * 0.9 * WIN_W, h: wh * WIN_H });
        out.push({ x: w / 2 + 0.02, y: y0 + f * FH + FH * 0.5, z, ry: Math.PI / 2, w: ww * 0.9 * WIN_W, h: wh * WIN_H });
      }
    }
  }
  return out;
}

function Box({ w, h, d, y = 0, x = 0, z = 0, mat, unit = 4, cast = true }: { w: number; h: number; d: number; y?: number; x?: number; z?: number; mat: Material; unit?: number; cast?: boolean }) {
  const g = useMemo(() => worldBox(w, h, d, unit), [w, h, d, unit]);
  return <mesh geometry={g} material={mat} position={[x, y + h / 2, z]} castShadow={cast} receiveShadow />;
}

function HipRoof({ w, d, y, h, mat: m0 }: { w: number; d: number; y: number; h: number; mat: Material }) {
  const mat = useRoof(m0);
  return (
    <mesh position={[0, y + h / 2, 0]} rotation-y={Math.PI / 4} scale={[w / Math.SQRT2, 1, d / Math.SQRT2]} material={mat} castShadow>
      <coneGeometry args={[1.08, h, 4, 1]} />
    </mesh>
  );
}


/** 双坡屋顶：屋脊沿 x 方向，三角形截面挤出 */
function Gable({ w, d, y, h, mat: m0 }: { w: number; d: number; y: number; h: number; mat: Material }) {
  const mat = useRoof(m0);
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

function Door({ x, z, y = 0, w = 1.1, h = 2.25, mat }: { x: number; z: number; y?: number; w?: number; h?: number; mat?: Material }) {
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
      <mesh material={M.interior} position={[-w * 0.18, 1.45, -0.12]}><boxGeometry args={[w * 0.55, 2.3, 0.05]} /></mesh>
      <mesh material={M.shopGlass} position={[-w * 0.18, 1.45, 0.04]}><boxGeometry args={[w * 0.58, 2.4, 0.06]} /></mesh>
      <mesh material={M.frameDark} position={[-w * 0.18, 0.26, 0.06]}><boxGeometry args={[w * 0.62, 0.12, 0.12]} /></mesh>
      {/* 店内的小桌与货架剪影 */}
      <mesh material={M.wood} position={[-w * 0.28, 0.75, -0.06]}><boxGeometry args={[0.6, 0.06, 0.05]} /></mesh>
      {/* 遮阳棚：条纹 */}
      <group position={[0, 2.85, 0.6]} rotation-x={0.42}>
        {Array.from({ length: n }).map((_, i) => (
          <mesh key={i} material={i % 2 ? M.awningCream : awnMat} position={[-w / 2 + (w / n) * (i + 0.5), 0, 0]} castShadow>
            <boxGeometry args={[w / n, 0.05, 1.3]} />
          </mesh>
        ))}
      </group>
      {tex && (
        <mesh position={[0, 3.25, 0.08]}>
          <planeGeometry args={[Math.min(w * 0.9, 4.2), 0.6]} />
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
  const tint = useContext(RoofTint);
  return (
    <group>
      <Box w={w} h={0.25} d={d} mat={M.stoneDark} />
      <Box w={w} h={H - 0.25} d={d} y={0.25} mat={wall} />
      <Box w={w + 0.2} h={0.16} d={d + 0.2} y={GF} mat={M.trim} />
      <Windows list={wins} />
      {signs.map((s, i) => (
        <group key={i}>
          <Storefront x={s.offset * 0.4} z={d / 2} w={w * 0.86} sign={s.sign} awning={awnings[(b.seed ?? 0) % awnings.length]} />
          <Door x={s.offset * 0.4 + w * 0.3} z={d / 2} mat={M.woodDark} />
        </group>
      ))}
      {pitched ? <HipRoof w={w + 0.5} d={d + 0.5} y={H} h={1.4} mat={R() > 0.5 ? M.roofRed : M.roofGrey} /> : (
        <>
          <Box w={w + 0.2} h={0.3} d={d + 0.2} y={H} mat={tint ?? M.roofFlat} />
          <RoofDetails w={w} d={d} y={H + 0.3} seed={b.seed ?? 1} />
        </>
      )}
    </group>
  );
}

/** 城市风格材质（共享） */
let cityMats: Record<string, MeshStandardMaterial> | null = null;
const CM = () => (cityMats ??= {
  red: new MeshStandardMaterial({ color: '#A8322A', roughness: 0.7 }),
  redDoor: new MeshStandardMaterial({ color: '#B8392E', roughness: 0.55 }),
  tileGrey: new MeshStandardMaterial({ color: '#5E6266', roughness: 0.8 }),
  tileGreen: new MeshStandardMaterial({ color: '#3F6E5A', roughness: 0.6 }),
  white: new MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.9 }),
  black: new MeshStandardMaterial({ color: '#3A3A3C', roughness: 0.8 }),
  timber: new MeshStandardMaterial({ color: '#5B3A26', roughness: 0.75 }),
  curtain: new MeshStandardMaterial({ color: '#7FA6C4', roughness: 0.15, metalness: 0.55 }),
  curtainDark: new MeshStandardMaterial({ color: '#4E6F8A', roughness: 0.2, metalness: 0.5 }),
  gold: new MeshStandardMaterial({ color: '#D9A62E', roughness: 0.4, metalness: 0.5 }),
});

/** 店铺门脸：有铺位就画橱窗 + 招牌，没有就画一扇门 */
function Fronts({ signs, w, d, awning, door }: { signs: Signed[]; w: number; d: number; awning: string; door?: Material }) {
  const M = mats();
  return (
    <>
      {signs.map((sg, i) => (
        <group key={i}>
          {sg.lotId ? <Storefront x={sg.offset * 0.4} z={d / 2} w={w * 0.84} sign={sg.sign} awning={awning} /> : null}
          <Door x={sg.offset * 0.4 + (sg.lotId ? w * 0.3 : 0)} z={d / 2} mat={door ?? M.woodDark} />
        </group>
      ))}
    </>
  );
}

/** 北京四合院 / 胡同铺面：灰砖墙、灰瓦双坡顶、红色大门、门墩 */
function Siheyuan({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const M = mats(), C = CM();
  const { w, d } = b.box!;
  const H = b.floors * FH + 0.5;
  return (
    <group>
      <Box w={w} h={0.3} d={d} mat={M.stoneDark} />
      <Box w={w} h={H - 0.3} d={d} y={0.3} mat={M.greyBrick} unit={3} />
      <Box w={w + 0.1} h={0.18} d={d + 0.1} y={H - 0.25} mat={C.black} />
      <Fronts signs={signs} w={w} d={d} awning="#8C6BD6" door={C.redDoor} />
      {/* 红漆门框 + 门墩 */}
      {signs.filter((x) => !x.lotId).map((sg, i) => (
        <group key={i} position={[sg.offset * 0.4, 0, d / 2]}>
          <mesh material={C.red} position={[0, 1.35, 0.08]}><boxGeometry args={[1.8, 2.7, 0.12]} /></mesh>
          {[-0.6, 0.6].map((x) => <mesh key={x} material={M.stone} position={[x, 0.22, 0.3]}><boxGeometry args={[0.3, 0.44, 0.4]} /></mesh>)}
        </group>
      ))}
      <Gable w={w + 0.6} d={d + 1.0} y={H} h={1.5} mat={C.tileGrey} />
      <Box w={w + 0.7} h={0.16} d={0.3} y={H + 1.42} mat={C.black} />
    </group>
  );
}

/** 深圳玻璃幕墙塔楼：石材裙楼 + 底层商铺 + 玻璃塔身 + 顶部冠带（屋顶按身份色） */
function Tower({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const M = mats(), C = CM();
  const { w, d } = b.box!;
  const podium = GF + FH;
  const H = podium + Math.max(2, b.floors - 2) * FH;
  const tint = useContext(RoofTint);
  const nameTex = useMemo(() => (b.name ? signTex(b.name, '#24549E', '#FFFFFF', 512, 96) : null), [b.name]);
  return (
    <group>
      <Box w={w} h={podium} d={d} mat={M.stone} />
      <Fronts signs={signs} w={w} d={d} awning="#3D7BD8" door={M.glass} />
      <Box w={w * 0.86} h={H - podium} d={d * 0.86} y={podium} mat={b.palette === 'blue' ? C.curtainDark : C.curtain} />
      {/* 横向窗带 */}
      {Array.from({ length: Math.max(2, b.floors - 2) }).map((_, i) => (
        <Box key={i} w={w * 0.88} h={0.12} d={d * 0.88} y={podium + (i + 1) * FH - 0.06} mat={M.trim} cast={false} />
      ))}
      <Box w={w * 0.9} h={0.5} d={d * 0.9} y={H} mat={tint ?? M.trim} />
      {nameTex && <mesh position={[0, H - 0.8, (d * 0.86) / 2 + 0.03]}><planeGeometry args={[Math.min(w * 0.8, 7), 1.2]} /><meshStandardMaterial map={nameTex} emissive="#FFFFFF" emissiveIntensity={0.15} /></mesh>}
    </group>
  );
}

/** 湖湘 / 徽派马头墙：白墙、黑瓦、两端阶梯式封火山墙 */
function Horsewall({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const C = CM();
  const { w, d } = b.box!;
  const H = b.floors * FH + 0.6;
  return (
    <group>
      <Box w={w} h={0.4} d={d} mat={C.black} />
      <Box w={w} h={H - 0.4} d={d} y={0.4} mat={C.white} />
      <Fronts signs={signs} w={w} d={d} awning="#5B3A26" door={C.timber} />
      <Gable w={w - 0.2} d={d + 0.6} y={H} h={1.3} mat={C.tileGrey} />
      {/* 两端阶梯式马头墙 */}
      {[-1, 1].map((sg) => (
        <group key={sg} position={[sg * (w / 2 - 0.15), H, 0]}>
          {[0, 1, 2].map((k) => (
            <group key={k}>
              <Box w={0.3} h={0.9 - k * 0.25} d={d * (1 - k * 0.3)} y={0} mat={C.white} />
              <Box w={0.5} h={0.14} d={d * (1 - k * 0.3) + 0.2} y={0.9 - k * 0.25} mat={C.black} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** 川西民居 / 太古里：白墙 + 深色木构架 + 出檐深远的灰瓦四坡顶 */
function Chuanxi({ b, signs }: { b: BuildingDef; signs: Signed[] }) {
  const M = mats(), C = CM();
  const { w, d } = b.box!;
  const H = b.floors * FH + 0.4;
  return (
    <group>
      <Box w={w} h={0.3} d={d} mat={M.stoneDark} />
      <Box w={w} h={H - 0.3} d={d} y={0.3} mat={C.white} />
      {/* 木构架：立柱 + 横梁 */}
      {[-0.5, -0.17, 0.17, 0.5].map((f) => <Box key={f} w={0.22} h={H} d={0.22} x={f * w} z={d / 2 + 0.05} mat={C.timber} />)}
      {Array.from({ length: b.floors }).map((_, i) => <Box key={i} w={w + 0.1} h={0.18} d={0.24} y={(i + 1) * FH} z={d / 2 + 0.05} mat={C.timber} />)}
      <Fronts signs={signs} w={w} d={d} awning="#5B3A26" door={C.timber} />
      <HipRoof w={w + 1.8} d={d + 1.8} y={H} h={1.6} mat={C.tileGrey} />
    </group>
  );
}

/** 传统楼阁 / 寺庙：石台基、红墙红柱、重檐歇山（层数 = 檐数） */
function Temple({ b }: { b: BuildingDef }) {
  const M = mats(), C = CM();
  const { w, d } = b.box!;
  const base = 2.0;
  const tiers = Math.max(1, Math.min(3, b.floors));
  const roof = b.palette === 'brick' ? C.tileGreen : C.tileGrey;
  const tex = useMemo(() => signTex(b.name ?? '', '#2F3B5C', '#F2D27A', 512, 128), [b.name]);
  let y = base;
  const parts: React.ReactNode[] = [];
  for (let t = 0; t < tiers; t++) {
    const k = 1 - t * 0.22, ww = w * 0.8 * k, dd = d * 0.7 * k, hh = t === 0 ? 5.5 : 4.0;
    parts.push(
      <group key={t}>
        <Box w={ww} h={hh} d={dd} y={y} mat={C.red} />
        {[-0.45, -0.15, 0.15, 0.45].map((f) => <Box key={f} w={0.3} h={hh} d={0.3} x={f * ww} y={y} z={dd / 2 + 0.2} mat={C.redDoor} />)}
        <HipRoof w={ww + 2.2} d={dd + 2.2} y={y + hh} h={1.2} mat={roof} />
      </group>,
    );
    y += hh + 0.9;
  }
  return (
    <group>
      <Box w={w} h={base} d={d} mat={M.stone} />
      <Box w={3} h={0.5} d={1.6} y={0} z={d / 2 + 0.8} mat={M.stone} />
      {parts}
      <mesh position={[0, base + 4.4, d * 0.35 + 0.22]}><planeGeometry args={[Math.min(5, w * 0.5), 0.9]} /><meshStandardMaterial map={tex} /></mesh>
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
      <Door x={0} z={d / 2} y={0.4} />
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
  const tint = useContext(RoofTint);
  const wins = useMemo(() => {
    const out: WinSpec[] = [];
    for (let u = 0; u < units; u++) {
      const cx = -w / 2 + uw * (u + 0.5);
      out.push({ x: cx - uw * 0.22, y: FH + 0.3 + FH * 0.5, z: d / 2 + 0.02, ry: 0, w: 0.95, h: 1.45 });
      out.push({ x: cx + uw * 0.22, y: FH + 0.3 + FH * 0.5, z: d / 2 + 0.02, ry: 0, w: 0.95, h: 1.45 });
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
            <mesh material={M.stone} position={[0, 1.35, 0.06]} castShadow><boxGeometry args={[1.9, 2.7, 0.14]} /></mesh>
            <mesh material={M.stone} position={[0, 2.7, 0.08]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.95, 0.95, 0.18, 18, 1, false, -Math.PI / 2, Math.PI]} /></mesh>
            <mesh material={M.door} position={[-0.31, 1.15, 0.14]}><boxGeometry args={[0.6, 2.3, 0.06]} /></mesh>
            <mesh material={M.door} position={[0.31, 1.15, 0.14]}><boxGeometry args={[0.6, 2.3, 0.06]} /></mesh>
            {[-0.1, 0.1].map((x) => <mesh key={x} material={M.metalLight} position={[x, 1.2, 0.18]}><torusGeometry args={[0.06, 0.015, 6, 12]} /></mesh>)}
            {s.sign && !s.sign.empty && (
              <mesh position={[0, 3.85, 0.1]}><planeGeometry args={[1.8, 0.4]} /><meshStandardMaterial map={signTex(s.sign.text, s.sign.bg, s.sign.fg)} /></mesh>
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
          <mesh material={tint ?? M.roofGrey} position={[0, 0.85, 0]} rotation-y={Math.PI / 4} scale={[0.75, 1, 0.75]}><coneGeometry args={[0.85, 0.4, 4]} /></mesh>
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
  const tint = useContext(RoofTint);
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
      <Box w={w * 0.36} h={0.8} d={d * 0.6} y={H + 0.9} mat={tint ?? M.trim} />
      <Box w={w + 0.2} h={0.2} d={d + 0.2} y={H} mat={tint ?? M.trim} />
      {tint && <Box w={w * 0.7 + 0.1} h={0.12} d={d * 0.8 + 0.1} y={H + 0.9} mat={tint} />}
      {shop ? <Storefront x={0} z={d / 2} w={w * 0.6} sign={shop.sign} awning="#C98068" /> : (
        <>
          <mesh material={M.glass} position={[-w * 0.3, 1.5, d / 2 + 0.03]}><boxGeometry args={[w * 0.3, 2.3, 0.05]} /></mesh>
          <mesh material={M.glass} position={[w * 0.3, 1.5, d / 2 + 0.03]}><boxGeometry args={[w * 0.3, 2.3, 0.05]} /></mesh>
        </>
      )}
      <Door x={shop ? w * 0.38 : 0} z={d / 2} mat={M.woodDark} />
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
  const tint = useContext(RoofTint);
  return (
    <group>
      {/* 底层（退后的店面） */}
      <Box w={w} h={GF + 0.4} d={d} mat={M.stone} />
      {signs.map((s, i) => (
        <group key={i}>
          <Storefront x={s.offset} z={d / 2} w={Math.min(6, w / signs.length - 0.6)} sign={s.sign} awning="#E8C77A" />
          <Door x={s.offset + 2.2} z={d / 2} mat={M.woodDark} />
        </group>
      ))}
      {/* 出挑的上层 */}
      <group position-z={over / 2}>
        <Box w={w} h={H - GF - 0.4} d={d + over} y={GF + 0.4} mat={wall} />
        <Box w={w + 0.2} h={0.25} d={d + over + 0.2} y={GF + 0.3} mat={M.trim} />
        <Box w={w + 0.2} h={0.3} d={d + over + 0.2} y={H} mat={tint ?? M.trim} />
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
          <Door x={dr.offset} z={d / 2} mat={M.metal} />
          <mesh material={M.trim} position={[dr.offset, 2.65, d / 2 + 0.4]}><boxGeometry args={[1.6, 0.12, 0.9]} /></mesh>
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
      <Box w={w} h={4.5} d={d} mat={M.stuccoCream} />
      <Box w={w * 0.9} h={3.4} d={0.2} z={d / 2} mat={M.interior} cast={false} />
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
      <group position={[0, 3.4, d / 2 + 0.7]} rotation-x={0.35}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[-w / 2 + (w / 12) * (i + 0.5), 0, 0]} castShadow>
            <boxGeometry args={[w / 12, 0.05, 1.3]} />
            <meshStandardMaterial color={i % 2 ? '#FBF6EC' : '#7FA868'} roughness={0.8} />
          </mesh>
        ))}
      </group>
      <Gable w={w + 0.6} d={d + 0.6} y={4.5} h={2.4} mat={M.metalLight} />
      <mesh position={[0, 4.1, d / 2 + 0.05]}><planeGeometry args={[5.5, 0.8]} /><meshStandardMaterial map={tex} /></mesh>
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
      <Box w={3.5} h={0.18} d={1.6} y={2.85} z={d / 2 + 0.8} mat={M.trim} />
      <Door x={0} z={d / 2} h={2.5} mat={M.glass} w={1.8} />
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
          <mesh material={M.woodDark} position={[0, 1.6, 0.02]}><boxGeometry args={[1.6, 3.2, 0.06]} /></mesh>
          <mesh material={M.woodDark} position={[0, 3.2, 0.02]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.8, 0.8, 0.06, 14, 1, false, -Math.PI / 2, Math.PI]} /></mesh>
          <mesh material={M.trim} position={[0, 3.2, 0.06]}><torusGeometry args={[0.88, 0.1, 6, 16, Math.PI]} /></mesh>
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
      for (let f = 0; f < 5; f++) wins.push({ ...m, y: base + 0.17 + f * FH + FH / 2, ry, w: 0.55, h: 1.5 });
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
        for (const dx of [-0.42, 0.42]) wins.push({ ...at(t + dx, 0.1), y: base + 0.17 + f * FH + FH / 2, ry, w: 0.55, h: 1.5 });
      }
      // 基座二层窗
      wins.push({ ...at(t, 0.04), y: FH + 0.2 + FH / 2, ry, w: 1.2, h: 1.4 });
      // 顶层窗
      wins.push({ ...at(t, -0.2), y: base + 0.47 + mid + FH / 2, ry, w: 1.0, h: 1.4 });
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
