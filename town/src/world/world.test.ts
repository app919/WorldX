import { describe, expect, it } from 'vitest';
import { DISTRICTS, DISTRICT_ORDER, allLots, compiledOf, navOf } from './index';
import { Zone } from './nav';
import { dist, inOBB } from './geom';
import { roadDir, roadLen, roadPoint } from './helpers';
import { leftOf, add, mul } from './geom';
import { SHOPS, COUNTERPARTIES } from '../data/seed';

describe.each(DISTRICT_ORDER)('街区「%s」的道路规则', (id) => {
  const nav = navOf(id);
  const cd = compiledOf(id);
  const def = DISTRICTS[id];

  it('出生点可以站立', () => {
    expect(nav.nearestWalkable(def.spawn, 2)).not.toBeNull();
  });

  it('机动车道（斑马线以外）不可步行', () => {
    for (const r of def.roads) {
      for (let s = 2; s < roadLen(r) - 2; s += 3) {
        const p = roadPoint(r, s);
        if (cd.crosswalks.some((c) => inOBB(c.box, p, 0.6))) continue;
        expect(nav.walkable(p)).toBe(false);
      }
    }
  });

  it('建筑、树、路灯、花箱、单车都不可穿越', () => {
    for (const b of def.buildings) {
      const c = b.polygon ? { x: b.polygon.reduce((s, p) => s + p.x, 0) / b.polygon.length, z: b.polygon.reduce((s, p) => s + p.z, 0) / b.polygon.length } : { x: b.box!.cx, z: b.box!.cz };
      expect(nav.walkable(c)).toBe(false);
    }
    for (const o of cd.obstacles.filter((x) => x.p)) expect(nav.walkable(o.p!)).toBe(false);
  });

  it('绿化 / 草坪不可步行', () => {
    const lawn = def.areas.find((a) => a.kind === 'lawn' && a.box);
    if (lawn?.box) {
      const p = { x: lawn.box.cx, z: lawn.box.cz };
      if (!cd.paths.some((x) => inOBB(x, p))) expect(nav.walkable(p)).toBe(false);
    }
  });

  it('公园 / 绿地：不压建筑，有入口，从出生点能沿园路走到公园中心', () => {
    const parks = cd.parks;
    expect(parks.length).toBeGreaterThan(0);
    for (const pk of parks) {
      const o = pk.box;
      for (let x = -0.45; x <= 0.45; x += 0.15) for (let z = -0.45; z <= 0.45; z += 0.15) {
        const p = { x: o.cx + x * o.w, z: o.cz + z * o.d };
        expect(cd.def.buildings.some((b) => (b.box ? inOBB(b.box, p) : false)), `${pk.id} 压到建筑`).toBe(false);
      }
      expect(pk.entrances.length, `${pk.id} 没有入口`).toBeGreaterThan(0);
      const path = nav.findPath(def.spawn, { x: o.cx, z: o.cz });
      expect(path, pk.id).not.toBeNull();
      expect(dist(path![path!.length - 1], { x: o.cx, z: o.cz }), pk.id).toBeLessThan(4);
    }
  });

  it('每一扇门都能从出生点沿人行道走到（门口不会被花坛或树挡住）', () => {
    for (const d of cd.doors) {
      const path = nav.findPath(def.spawn, d.trigger);
      expect(path, d.id).not.toBeNull();
      expect(dist(path![path!.length - 1], d.trigger), d.id).toBeLessThan(0.8);
    }
  });

  it('过马路必须经过斑马线：跨街路径上的每一个点都在人行道 / 斑马线上', () => {
    const r = def.roads[0];
    const n = leftOf(roadDir(r));
    const side = (sgn: number) => nav.nearestWalkable(add(roadPoint(r, roadLen(r) * 0.62), mul(n, sgn * (r.carriage / 2 + r.sidewalk / 2))), 4)!;
    const path = nav.findPath(side(1), side(-1))!;
    expect(path).not.toBeNull();
    let crossed = false;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const steps = Math.ceil(dist(a, b) / 0.2);
      for (let k = 0; k <= steps; k++) {
        const p = { x: a.x + ((b.x - a.x) * k) / steps, z: a.z + ((b.z - a.z) * k) / steps };
        const z = nav.zoneAt(p);
        expect([Zone.Walk, Zone.Crosswalk]).toContain(z);
        if (z === Zone.Crosswalk) crossed = true;
      }
    }
    expect(crossed).toBe(true);
  });

  it('移动被挡住时不会穿过机动车道', () => {
    const r = def.roads[0];
    const n = leftOf(roadDir(r));
    const from = nav.nearestWalkable(add(roadPoint(r, roadLen(r) * 0.4), mul(n, r.carriage / 2 + 1.2)), 2)!;
    let p = from;
    for (let i = 0; i < 40; i++) p = nav.move(p, add(p, mul(n, -0.3))).p; // 一直朝马路中心走
    expect(nav.walkable(p)).toBe(true);
    expect(nav.zoneAt(p)).not.toBe(Zone.Road);
  });
});

describe('铺位与店铺', () => {
  it('所有店铺和主体的铺位都真实存在于街区中', () => {
    const ids = new Set(allLots().map((l) => l.door.lotId));
    for (const s of SHOPS) expect(ids.has(s.lotId), s.lotId).toBe(true);
    for (const c of COUNTERPARTIES) if (c.place.lotId) expect(ids.has(c.place.lotId), c.place.lotId).toBe(true);
  });
  it('每个街区都还有可以开店的空铺', () => {
    const taken = new Set([...SHOPS.map((s) => s.lotId), ...COUNTERPARTIES.map((c) => c.place.lotId)]);
    for (const d of DISTRICT_ORDER) expect(allLots().filter((l) => l.district === d && !taken.has(l.door.lotId)).length).toBeGreaterThan(0);
  });
});
