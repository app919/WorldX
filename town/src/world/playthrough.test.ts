/**
 * 全量可玩性测试（无界面，模拟角色控制器）：
 *   每一条路的两侧人行道从头走到尾、每一条斑马线走一遍、每一扇门都走到门口触发点。
 * 走路使用与游戏完全相同的 NavGrid.findPath + NavGrid.move（键盘移动的碰撞滑动逻辑）。
 */
import { describe, expect, it } from 'vitest';
import { DISTRICT_ORDER, compiledOf, navOf } from './index';
import { Zone, type NavGrid } from './nav';
import { add, dist, leftOf, mul, type V2 } from './geom';
import { roadDir, roadLen, roadPoint } from './helpers';

/** 按路径逐帧行走（每帧 0.22 个单位，与 4.4 单位/秒、20fps 一致），返回是否到达以及途经的空间类型 */
function walk(nav: NavGrid, from: V2, to: V2) {
  const path = nav.findPath(from, to);
  if (!path) return { ok: false, reason: '无路径', zones: new Set<number>(), steps: 0 };
  let p = { ...path[0] };
  const zones = new Set<number>();
  let steps = 0;
  for (const tgt of path.slice(1)) {
    let guard = 0;
    while (dist(p, tgt) > 0.25 && guard++ < 4000) {
      const d = dist(p, tgt), k = Math.min(0.22, d) / d;
      const next = { x: p.x + (tgt.x - p.x) * k, z: p.z + (tgt.z - p.z) * k };
      const res = nav.move(p, next);
      if (dist(res.p, p) < 1e-6) return { ok: false, reason: `卡住 @${p.x.toFixed(1)},${p.z.toFixed(1)}`, zones, steps };
      p = res.p; steps++;
      zones.add(nav.zoneAt(p));
    }
  }
  return { ok: dist(p, to) < 0.9, reason: dist(p, to) < 0.9 ? '' : `终点偏差 ${dist(p, to).toFixed(2)}`, zones, steps };
}

describe.each(DISTRICT_ORDER)('街区「%s」全量走查', (id) => {
  const cd = compiledOf(id);
  const nav = navOf(id);

  it('每一条路的两侧人行道都能从头走到尾（只经过人行道 / 斑马线）', () => {
    const failures: string[] = [];
    for (const r of cd.def.roads) {
      const u = roadDir(r), L = roadLen(r);
      for (const side of [1, -1]) {
        const n = mul(leftOf(u), side);
        // 路口处人行道被另一条路的车道截断，所以从两端向内找第一个能站立的点
        const at = (s0: number, dir: number) => {
          for (let s = s0; s > 0 && s < L; s += dir * 0.5) {
            const p = add(roadPoint(r, s), mul(n, r.carriage / 2 + r.sidewalk / 2));
            if (nav.walkable(p)) return p;
          }
          return null;
        };
        const a = at(L * 0.02, 1), b = at(L * 0.98, -1);
        if (!a || !b) { failures.push(`${r.name}${side > 0 ? '左' : '右'}侧：端点不可站立`); continue; }
        const res = walk(nav, a, b);
        if (!res.ok) failures.push(`${r.name}${side > 0 ? '左' : '右'}侧：${res.reason}`);
        for (const z of res.zones) if (z !== Zone.Walk && z !== Zone.Crosswalk) failures.push(`${r.name}：走进了 ${z}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('每一条斑马线都能从一侧人行道走到另一侧', () => {
    const failures: string[] = [];
    for (const c of cd.crosswalks) {
      const n = leftOf(roadDir(c.road));
      const off = c.road.carriage / 2 + c.road.sidewalk / 2;
      const a = nav.nearestWalkable(add(c.center, mul(n, off)), 2), b = nav.nearestWalkable(add(c.center, mul(n, -off)), 2);
      if (!a || !b) { failures.push(`${c.road.name} 斑马线两端没有人行道`); continue; }
      const res = walk(nav, a, b);
      if (!res.ok) failures.push(`${c.road.name} 斑马线：${res.reason}`);
      if (res.ok && res.steps * 0.22 > dist(a, b) * 2.2) failures.push(`${c.road.name} 斑马线：绕路过远`);
      if (!res.zones.has(Zone.Crosswalk)) failures.push(`${c.road.name} 斑马线：没有走在斑马线上`);
    }
    expect(failures).toEqual([]);
  });

  it('每一扇门都能从出生点走到门口触发点', () => {
    const start = nav.nearestWalkable(cd.def.spawn, 3)!;
    const failures = cd.doors.map((d) => ({ d, res: walk(nav, start, d.trigger) })).filter((x) => !x.res.ok).map((x) => `${x.d.id}：${x.res.reason}`);
    expect(failures).toEqual([]);
  });

  it('所有人行道连成一张网（没有走不出去的孤岛）', () => {
    const start = nav.idx(nav.nearestWalkable(cd.def.spawn, 3)!);
    const seen = new Uint8Array(nav.w * nav.h);
    const q = [start]; seen[start] = 1;
    while (q.length) {
      const k = q.pop()!;
      for (const nk of [k + 1, k - 1, k + nav.w, k - nav.w]) if (nk >= 0 && nk < seen.length && !seen[nk] && nav.walk[nk]) { seen[nk] = 1; q.push(nk); }
    }
    const islands: string[] = [];
    for (const s of cd.sidewalks) {
      const k = nav.idx(nav.nearestWalkable({ x: s.box.cx, z: s.box.cz }, 3) ?? { x: s.box.cx, z: s.box.cz });
      if (k >= 0 && !seen[k]) islands.push(`${s.road.name}${s.side}`);
    }
    expect(islands).toEqual([]);
  });
});
