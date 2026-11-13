import { describe, expect, it } from 'vitest';
import { DISTRICT_ORDER, compiledOf } from './index';
import { carBox, carDir, carPos, createTraffic, stepTraffic, CAR_LEN } from './traffic';
import { inOBB, dist } from './geom';
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

  it('车辆只在路面上行驶，画面上的位置与朝向连续（不瞬移、不开出地图），只在隧道里出现 / 消失', () => {
    const tr = createTraffic(cd);
    const problems: string[] = [];
    let turns = 0;
    const inTunnel = (p: { x: number; z: number }) => cd.tunnels.some((t) => inOBB(t.box, p, 0.2));
    const onRoad = (p: { x: number; z: number }) => cd.carriages.some((c) => inOBB(c.box, p, 0.4)) || inTunnel(p);
    let prev = tr.cars.map((c) => ({ hidden: c.hidden, p: carPos(tr, c), d: carDir(tr, c) }));
    for (let f = 0; f < 4800 && problems.length < 5; f++) {
      stepTraffic(tr, 0.05, []);
      tr.cars.forEach((c, i) => {
        const was = prev[i];
        const p = carPos(tr, c), d = carDir(tr, c);
        if (c.turn) turns++;
        if (!c.hidden) {
          if (!onRoad(p)) problems.push(`车${c.id} 离开路面 (${p.x.toFixed(1)},${p.z.toFixed(1)})`);
          if (was.hidden && !inTunnel(p)) problems.push(`车${c.id} 不在隧道里就出现了`);
          if (!was.hidden) {
            if (dist(p, was.p) > c.v * 0.05 + 0.5) problems.push(`车${c.id} 瞬移 ${dist(p, was.p).toFixed(2)}`);
            const turn = Math.acos(Math.max(-1, Math.min(1, d.x * was.d.x + d.z * was.d.z)));
            if (turn > 0.35) problems.push(`车${c.id} 朝向突变 ${turn.toFixed(2)}`);
          }
        } else if (!was.hidden && !inTunnel(was.p)) problems.push(`车${c.id} 不在隧道里就消失了`);
      });
      prev = tr.cars.map((c) => ({ hidden: c.hidden, p: carPos(tr, c), d: carDir(tr, c) }));
    }
    expect(problems).toEqual([]);
    if (cd.lanes.some((l) => cd.carriages.some((c) => c.road.id !== l.road.id && inOBB(c.box, l.to, 0.5)))) expect(turns).toBeGreaterThan(0);
  });
});
