import { describe, expect, it } from 'vitest';
import { DISTRICT_ORDER, compiledOf } from './index';
import { carBox, createTraffic, stepTraffic, CAR_LEN } from './traffic';
import { vi } from 'vitest';
vi.setConfig({ testTimeout: 120000 });
import { obbCorners, type OBB } from './geom';

/** 分离轴定理：两个有向矩形是否相交 */
function overlap(a: OBB, b: OBB) {
  const axes = [a.rot, a.rot + Math.PI / 2, b.rot, b.rot + Math.PI / 2].map((r) => ({ x: Math.sin(r), z: Math.cos(r) }));
  const ca = obbCorners(a), cb = obbCorners(b);
  return axes.every((ax) => {
    const pa = ca.map((p) => p.x * ax.x + p.z * ax.z), pb = cb.map((p) => p.x * ax.x + p.z * ax.z);
    return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
  });
}

describe.each(DISTRICT_ORDER)('街区「%s」的车辆遵守物理规律', (id) => {
  const cd = compiledOf(id);

  it('仿真 6 分钟：任何两辆车都不会互相穿过（同车道、路口、转弯都不重叠），也不会堵死', () => {
    const tr = createTraffic(cd);
    const crashes: string[] = [];
    let moved = 0, stoppedTail = 0, samples = 0;
    for (let f = 0; f < 7200; f++) {
      if (f > 6000 && f % 20 === 0) { const vis = tr.cars.filter((c) => !c.hidden); stoppedTail += vis.filter((c) => c.v < 0.1).length / vis.length; samples++; }
      const before = tr.cars.map((c) => c.t);
      stepTraffic(tr, 0.05, []);
      tr.cars.forEach((c, i) => { if (!c.hidden) moved += Math.max(0, c.t - before[i]); });
      const vis = tr.cars.filter((c) => !c.hidden);
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
        if (overlap(carBox(tr, vis[i], -0.05), carBox(tr, vis[j], -0.05))) crashes.push(`t=${(f * 0.05).toFixed(1)}s 车${vis[i].id}×车${vis[j].id}`);
      }
      if (crashes.length > 5) break;
    }
    expect(crashes).toEqual([]);
    expect(moved).toBeGreaterThan(tr.cars.length * 200); // 车辆确实在行驶
    expect(stoppedTail / samples).toBeLessThan(0.4); // 最后一分钟里大部分车辆在行驶（没有路口死锁）
  });

  it('斑马线上有行人时，车辆在斑马线前停下，不会压到行人', () => {
    const tr = createTraffic(cd);
    const cw = cd.crosswalks[0];
    const ped = { x: cw.center.x, z: cw.center.z };
    const hits: string[] = [];
    for (let f = 0; f < 1200; f++) {
      stepTraffic(tr, 0.05, [ped]);
      for (const c of tr.cars) if (!c.hidden && overlap(carBox(tr, c), { cx: ped.x, cz: ped.z, w: 0.7, d: 0.7, rot: 0 })) hits.push(`车${c.id}`);
    }
    expect(hits).toEqual([]);
  });

  it('刹车与加速是连续的（单帧速度变化有上限）', () => {
    const tr = createTraffic(cd);
    let maxJump = 0;
    for (let f = 0; f < 600; f++) {
      const v0 = tr.cars.map((c) => ({ v: c.v, hidden: c.hidden }));
      stepTraffic(tr, 0.05, []);
      // 从地图边缘重新驶入的车辆以行驶速度进入，不计入
      tr.cars.forEach((c, i) => { if (!c.hidden && !v0[i].hidden) maxJump = Math.max(maxJump, Math.abs(c.v - v0[i].v)); });
    }
    expect(maxJump).toBeLessThanOrEqual(9 * 0.05 + 1e-6);
    expect(CAR_LEN).toBeGreaterThan(4);
  });
});
