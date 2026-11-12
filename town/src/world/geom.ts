/** 平面几何工具（游戏坐标：x 向东，z 向南；单位约 1.5 米） */
export interface V2 { x: number; z: number }

/** 有向矩形：中心 + 尺寸 + 绕 Y 轴旋转（rot=0 时 w 沿 x、d 沿 z） */
export interface OBB { cx: number; cz: number; w: number; d: number; rot: number }

export const v = (x: number, z: number): V2 => ({ x, z });
export const add = (a: V2, b: V2): V2 => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, z: a.z - b.z });
export const mul = (a: V2, k: number): V2 => ({ x: a.x * k, z: a.z * k });
export const len = (a: V2) => Math.hypot(a.x, a.z);
export const norm = (a: V2): V2 => { const l = len(a) || 1; return { x: a.x / l, z: a.z / l }; };
export const dot = (a: V2, b: V2) => a.x * b.x + a.z * b.z;
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z);
/** 左法线（沿方向前进时的左侧；在 x 东 z 南坐标系中 = (dz, -dx)） */
export const leftOf = (d: V2): V2 => ({ x: d.z, z: -d.x });

/** 把世界点变换到 OBB 局部坐标 */
export function toLocal(o: OBB, p: V2): V2 {
  const dx = p.x - o.cx, dz = p.z - o.cz;
  const c = Math.cos(o.rot), s = Math.sin(o.rot);
  // three.js rotation.y = rot：局部 (x,z) → 世界 (x c + z s, -x s + z c)
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

export function inOBB(o: OBB, p: V2, pad = 0): boolean {
  const l = toLocal(o, p);
  return Math.abs(l.x) <= o.w / 2 + pad && Math.abs(l.z) <= o.d / 2 + pad;
}

export function obbCorners(o: OBB): V2[] {
  const c = Math.cos(o.rot), s = Math.sin(o.rot);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const lx = (a * o.w) / 2, lz = (b * o.d) / 2;
    return { x: o.cx + lx * c + lz * s, z: o.cz - lx * s + lz * c };
  });
}

/** 由线段生成 OBB（长轴沿线段方向，w = 宽度） */
export function segmentOBB(a: V2, b: V2, width: number, extend = 0): OBB {
  const d = sub(b, a);
  const L = len(d);
  // 让局部 z 轴沿线段方向：rot 使 (0,1) → d/|d|
  const rot = Math.atan2(d.x, d.z);
  return { cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, w: width, d: L + extend * 2, rot };
}

export function inPolygon(poly: V2[], p: V2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** 两条直线（点+方向）的交点 */
export function intersect(p: V2, d: V2, q: V2, e: V2): V2 {
  const den = d.x * e.z - d.z * e.x;
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / den;
  return add(p, mul(d, t));
}

/** 种子随机数（布局可复现） */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
