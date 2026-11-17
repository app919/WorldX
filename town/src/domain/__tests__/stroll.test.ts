import { describe, expect, it } from 'vitest';
import { planStroll } from '../../store/useStroll';
import { DISTRICT_ORDER, compiledOf, navOf } from '../../world';
import { dist } from '../../world/geom';

describe('随便逛逛：漫步路线', () => {
  it.each(DISTRICT_ORDER)('街区「%s」：3–5 站、都在人行道上、类型多样、顺路、都能走到', (d) => {
    const cd = compiledOf(d), nav = navOf(d);
    const from = cd.def.spawn;
    const r = planStroll(d, from, 5, 1);
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r.length).toBeLessThanOrEqual(5);
    expect(new Set(r.map((s) => s.kind)).size).toBeGreaterThanOrEqual(2);
    for (const s of r) expect(nav.walkable(s.at)).toBe(true);
    // 顺路：每一站是剩下的站里离上一站最近的
    let cur = from;
    for (let i = 0; i < r.length; i++) {
      for (const later of r.slice(i + 1)) expect(dist(r[i].at, cur)).toBeLessThanOrEqual(dist(later.at, cur) + 1e-6);
      cur = r[i].at;
    }
    // 第一站能寻路走到
    expect(nav.findPath(from, r[0].at)).not.toBeNull();
  });
});
