/**
 * 程序化街区布局：梧桐树、路灯、普通建筑。
 * 重点建筑（landmarks）来自人工档案，普通建筑由这里按种子程序化生成。
 * 同时输出碰撞体，供角色移动使用（简化为圆形碰撞，不做全套物理）。
 */
import { GAME_LANDMARKS, GAME_ROADS, SHOP_LOTS, distToRoads } from '../data/buildings';

export interface Collider { x: number; z: number; r: number; soft: boolean; kind: 'tree' | 'lamp' | 'building' }
export type HouseKind = 'shikumen' | 'red_villa' | 'apartment' | 'cream_house';
export interface House { x: number; z: number; rot: number; kind: HouseKind; w: number; d: number; h: number; tint: number }

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Placed { x: number; z: number; rot: number }

function along(spacing: number, offset: number, jitter = 0, seed = 1): Placed[] {
  const rnd = mulberry32(seed);
  const out: Placed[] = [];
  for (const r of GAME_ROADS) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
      for (let d = spacing / 2; d < len; d += spacing) {
        for (const side of [1, -1]) {
          const off = r.width / 2 + offset + (rnd() - 0.5) * jitter;
          out.push({ x: a.x + ux * d - uz * side * off, z: a.z + uz * d + ux * side * off, rot: Math.atan2(uz * side, -ux * side) });
        }
      }
    }
  }
  return out;
}

const nearLandmark = (p: { x: number; z: number }, pad: number) =>
  GAME_LANDMARKS.some((b) => Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < Math.max(b.footprint.w, b.footprint.d) / 2 + pad);
const nearLot = (p: { x: number; z: number }, pad: number) => SHOP_LOTS.some((l) => Math.hypot(l.pos.x - p.x, l.pos.z - p.z) < pad);

export const TREES = along(4.6, 0.85, 0.25, 7).filter((p) => distToRoads(p) > 0.5 && !nearLandmark(p, 0.6) && !nearLot(p, 1.6));
export const LAMPS = along(11, 0.45, 0, 3).filter((p) => distToRoads(p) > 0.2 && !nearLandmark(p, 0.5) && !nearLot(p, 1.4) && TREES.every((t) => Math.hypot(t.x - p.x, t.z - p.z) > 1.1));

function buildHouses(): House[] {
  const rnd = mulberry32(42);
  const kinds: HouseKind[] = ['shikumen', 'red_villa', 'apartment', 'cream_house'];
  const out: House[] = [];
  for (const p of along(6.2, 4.4, 1.2, 11)) {
    if (distToRoads(p) < 2.6 || nearLandmark(p, 3.2) || nearLot(p, 4.6)) continue;
    if (out.some((h) => Math.hypot(h.x - p.x, h.z - p.z) < 5.2)) continue;
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    out.push({
      x: p.x, z: p.z, rot: p.rot, kind,
      w: 3.2 + rnd() * 1.2, d: 3.0 + rnd() * 0.8,
      h: kind === 'apartment' ? 3.4 + rnd() * 1.0 : kind === 'shikumen' ? 2.4 + rnd() * 0.5 : 2.2 + rnd() * 0.6,
      tint: rnd(),
    });
  }
  return out;
}
export const HOUSES = buildHouses();

export const COLLIDERS: Collider[] = [
  ...TREES.map((t) => ({ x: t.x, z: t.z, r: 0.32, soft: true, kind: 'tree' as const })),
  ...LAMPS.map((t) => ({ x: t.x, z: t.z, r: 0.22, soft: true, kind: 'lamp' as const })),
  ...HOUSES.map((h) => ({ x: h.x, z: h.z, r: Math.min(h.w, h.d) / 2 + 0.3, soft: false, kind: 'building' as const })),
  ...SHOP_LOTS.map((l) => ({ x: l.pos.x, z: l.pos.z, r: 1.55, soft: false, kind: 'building' as const })),
  ...GAME_LANDMARKS.map((b) => ({ x: b.pos.x, z: b.pos.z, r: Math.min(b.footprint.w, b.footprint.d) / 2, soft: false, kind: 'building' as const })),
];

/** 地图边界 */
export const BOUNDS = (() => {
  const xs = GAME_ROADS.flatMap((r) => r.pts.map((p) => p.x));
  const zs = GAME_ROADS.flatMap((r) => r.pts.map((p) => p.z));
  return { minX: Math.min(...xs) - 6, maxX: Math.max(...xs) + 6, minZ: Math.min(...zs) - 6, maxZ: Math.max(...zs) + 6 };
})();

/** 返回某点最近的路名（顶栏“正在 xx 散步”） */
export function streetAt(p: { x: number; z: number }): string {
  let best = { name: '武康路', d: Infinity };
  for (const r of GAME_ROADS) for (let i = 0; i < r.pts.length - 1; i++) {
    const a = r.pts[i], b = r.pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
    if (d < best.d) best = { name: r.name.replace('（示意）', ''), d };
  }
  return best.name;
}
