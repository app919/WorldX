import type { OBB, V2 } from './geom';
import { add, leftOf, mul, norm, sub, len } from './geom';
import type { RoadDef } from './types';

export function roadDir(r: RoadDef): V2 { return norm(sub(r.b, r.a)); }
export function roadLen(r: RoadDef): number { return len(sub(r.b, r.a)); }
export function roadPoint(r: RoadDef, s: number): V2 { return add(r.a, mul(roadDir(r), s)); }

/**
 * 沿道路一侧放置建筑：s = 沿路距离，side = 'L' | 'R'（沿 a→b 前进方向的左/右），
 * 返回正立面（局部 +z）朝向道路的 OBB。
 */
export function frontage(r: RoadDef, s: number, side: 'L' | 'R', w: number, d: number, setback = 0.6): OBB {
  const u = roadDir(r);
  const n = side === 'L' ? leftOf(u) : mul(leftOf(u), -1);
  const off = r.carriage / 2 + r.sidewalk + setback + d / 2;
  const c = add(roadPoint(r, s), mul(n, off));
  const face = mul(n, -1);
  return { cx: c.x, cz: c.z, w, d, rot: Math.atan2(face.x, face.z) };
}

/** 人行道上靠路缘的位置（放树、路灯、单车） */
export function curbside(r: RoadDef, s: number, side: 'L' | 'R', inset = 0.7): { p: V2; rot: number } {
  const u = roadDir(r);
  const n = side === 'L' ? leftOf(u) : mul(leftOf(u), -1);
  const p = add(roadPoint(r, s), mul(n, r.carriage / 2 + inset));
  return { p, rot: Math.atan2(u.x, u.z) };
}

/** 人行道外侧靠建筑一侧的位置（放长椅、花箱） */
export function buildingside(r: RoadDef, s: number, side: 'L' | 'R', inset = 0.6): { p: V2; rot: number } {
  const u = roadDir(r);
  const n = side === 'L' ? leftOf(u) : mul(leftOf(u), -1);
  const p = add(roadPoint(r, s), mul(n, r.carriage / 2 + r.sidewalk - inset));
  const face = mul(n, -1);
  return { p, rot: Math.atan2(face.x, face.z) };
}
