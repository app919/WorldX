import { describe, expect, it } from 'vitest';
import { overviewOf, WEEK_MS } from '../overview';
import { DISTRICT_ORDER, lotsOf } from '../../world';
import { lotPlan } from '../lots';

describe('地图纵览', () => {
  it.each(DISTRICT_ORDER)('街区「%s」：真实 + 演示 +【例】+ 赞助 + 空铺 = 铺位总数；本周新增只算 7 天内的真实店铺', (d) => {
    const free = lotsOf(d).map((l) => l.door.lotId!).filter((l) => !lotPlan(d).examples.includes(l));
    const now = Date.now();
    const real = [
      { id: 'r1', lotId: free[free.length - 1], name: '真实新店', createdAt: now - 2 * 86400_000 },
      { id: 'r2', lotId: free[free.length - 2], name: '真实老店', createdAt: now - WEEK_MS - 1000 },
    ];
    const o = overviewOf(d, real, new Set(), now);
    expect(o.real + o.demo + o.examples + o.sponsors + o.vacant).toBe(o.lots);
    expect(o.real).toBe(2);
    expect(o.newThisWeek.map((x) => x.id)).toEqual(['r1']);
  });
});
