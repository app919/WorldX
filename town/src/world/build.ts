/**
 * 把街区数据“编译”成：可渲染的道路元素、程序化补全的街道家具，以及导航所需的区域与碰撞体。
 *
 * 程序化补全只在规则允许的位置放置：
 * - 行道树按道路设定的树种与间距，种在人行道靠路缘一侧的树池里，避开斑马线、门口、路口；
 * - 路灯与行道树错开；共享单车只停在划定的停放区；消防栓、垃圾桶靠路缘；
 * - 门口一定留出通道，不会被花坛或树挡住。
 */
import type { BuildingDef, CrosswalkDef, DistrictDef, PropDef, RoadDef, TreeSpecies } from './types';
import { add, inOBB, inPolygon, leftOf, mul, rng, segmentOBB, sub, dist, type OBB, type V2 } from './geom';
import { frontage, roadDir, roadLen, roadPoint } from './helpers';

export interface Door {
  id: string;
  buildingId: string;
  /** 门洞位置（建筑外墙上） */
  p: V2;
  /** 门外 0.9 处的触发点（站在这里才算“进门”） */
  trigger: V2;
  /** 门朝外的方向 */
  out: V2;
  lotId?: string;
  label?: string;
}

export interface Obstacle { kind: string; p?: V2; r?: number; box?: OBB }

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export interface CompiledDistrict {
  /** 展开后的街区（含自动补全的建筑与斑马线、计算出的边界） */
  def: DistrictDef & { bounds: Bounds };
  carriages: { road: RoadDef; box: OBB }[];
  sidewalks: { road: RoadDef; side: 'L' | 'R'; box: OBB }[];
  crosswalks: { road: RoadDef; box: OBB; center: V2 }[];
  paths: OBB[];
  doors: Door[];
  props: PropDef[];
  obstacles: Obstacle[];
  lanes: { road: RoadDef; from: V2; to: V2; dir: V2 }[];
}

function buildingContains(b: BuildingDef, p: V2, pad = 0): boolean {
  if (b.polygon) return inPolygon(b.polygon, p);
  return !!b.box && inOBB(b.box, p, pad);
}

/** 武康大楼等多边形建筑的门：取沿淮海中路一侧长边的中点 */
function polygonDoor(b: BuildingDef): { p: V2; out: V2 } {
  const poly = b.polygon!;
  const a = poly[poly.length - 1];
  const c = poly[0];
  const mid = mul(add(a, c), 0.5);
  return { p: mid, out: { x: 0, z: 1 } };
}

/** 道路中心线交点（含 T 字路口：端点落在另一条路上） */
function junctions(roads: RoadDef[]) {
  const out: { r: RoadDef; q: RoadDef; sr: number; sq: number; sin: number }[] = [];
  for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
    const r = roads[i], q = roads[j];
    const d1 = sub(r.b, r.a), d2 = sub(q.b, q.a);
    const den = d1.x * d2.z - d1.z * d2.x;
    if (Math.abs(den) < 1e-6) continue;
    const t = ((q.a.x - r.a.x) * d2.z - (q.a.z - r.a.z) * d2.x) / den;
    const u = ((q.a.x - r.a.x) * d1.z - (q.a.z - r.a.z) * d1.x) / den;
    const eps = 0.02;
    if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) continue;
    const sin = Math.abs(den) / (roadLen(r) * roadLen(q));
    out.push({ r, q, sr: t * roadLen(r), sq: u * roadLen(q), sin });
  }
  return out;
}

/** 路口自动斑马线：在每条支路上，与另一条路人行道中线对齐的位置 */
function autoCrosswalks(def: DistrictDef): CrosswalkDef[] {
  const out: CrosswalkDef[] = [...def.crosswalks];
  const add1 = (road: RoadDef, s: number, w: number) => {
    const L = roadLen(road);
    if (s < 3 || s > L - 3) return;
    if (out.some((c) => c.road === road.id && Math.abs(c.t * L - s) < 7)) return;
    out.push({ road: road.id, t: s / L, width: w });
  };
  for (const j of junctions(def.roads)) {
    const dq = (j.r.carriage / 2 + j.r.sidewalk / 2) / Math.max(0.35, j.sin);
    const dr = (j.q.carriage / 2 + j.q.sidewalk / 2) / Math.max(0.35, j.sin);
    for (const sg of [-1, 1]) { add1(j.q, j.sq + sg * dq, 3); add1(j.r, j.sr + sg * dr, 3); }
  }
  return out;
}

function boundsOf(def: DistrictDef): Bounds {
  if (def.bounds) return def.bounds;
  const xs = def.roads.flatMap((r) => [r.a.x, r.b.x]), zs = def.roads.flatMap((r) => [r.a.z, r.b.z]);
  const m = 26;
  return { minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minZ: Math.min(...zs) - m, maxZ: Math.max(...zs) + m };
}

/** 沿街自动补全建筑：不压路、不压人行道、不压已有建筑与区域，正立面朝街 */
function fillFrontage(def: DistrictDef, bounds: Bounds): BuildingDef[] {
  if (!def.filler) return [];
  const R = rng(def.filler.seed);
  const gap = def.filler.gap ?? 1.2;
  const placed: BuildingDef[] = [...def.buildings];
  const out: BuildingDef[] = [];
  const zones = def.roads.map((r) => ({ r, o: segmentOBB(r.a, r.b, r.carriage + r.sidewalk * 2 + 0.5, r.sidewalk) }));
  const samples = (o: OBB): V2[] => {
    const c = Math.cos(o.rot), s = Math.sin(o.rot), pts: V2[] = [];
    for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) for (const b of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const lx = a * o.w, lz = b * o.d;
      pts.push({ x: o.cx + lx * c + lz * s, z: o.cz - lx * s + lz * c });
    }
    return pts;
  };
  const free = (o: OBB, setback: number) => {
    const pts = samples(o);
    // 门前通道也要在空地上
    const front = { x: o.cx + Math.sin(o.rot) * (o.d / 2 + setback / 2), z: o.cz + Math.cos(o.rot) * (o.d / 2 + setback / 2) };
    const all = [...pts, front];
    if (pts.some((p) => p.x < bounds.minX + 2 || p.x > bounds.maxX - 2 || p.z < bounds.minZ + 2 || p.z > bounds.maxZ - 2)) return false;
    if (all.some((p) => zones.some((z) => inOBB(z.o, p)))) return false;
    if (all.some((p) => placed.some((b) => buildingContains(b, p, 1.2)))) return false;
    if (placed.some((b) => (b.box ? obbCornersOf(b.box) : b.polygon!).some((q) => inOBB(o, q, 1.2)))) return false;
    if (all.some((p) => def.areas.some((a) => (a.box && inOBB(a.box, p, 0.8)) || (a.polygon && inPolygon(a.polygon, p))))) return false;
    if (all.some((p) => def.props.some((q) => dist(q.p, p) < 1.5))) return false;
    return true;
  };
  let n = 0;
  for (const r of def.roads) {
    const L = roadLen(r);
    const kinds = def.filler.kinds.filter((k) => !k.roads || k.roads.includes(r.id));
    if (!kinds.length) continue;
    const total = kinds.reduce((a, k) => a + (k.weight ?? 1), 0);
    for (const side of ['L', 'R'] as const) {
      let s = 2;
      while (s < L - 4) {
        let pick = R() * total, k = kinds[0];
        for (const kk of kinds) { pick -= kk.weight ?? 1; if (pick <= 0) { k = kk; break; } }
        const w = k.w[0] + R() * (k.w[1] - k.w[0]);
        const d = k.d[0] + R() * (k.d[1] - k.d[0]);
        const sb = k.setback ?? 0.6;
        const o = frontage(r, s + w / 2, side, w, d, sb);
        if (s + w < L - 2 && free(o, sb)) {
          const id = `${def.id}_f${n++}`;
          const floors = Math.round(k.floors[0] + R() * (k.floors[1] - k.floors[0]));
          const lot = k.lot ? `${def.id}_lot${n}` : undefined;
          const doors = k.kind === 'shikumen_row'
            ? [{ offset: -w / 4 }, { offset: w / 4, lotId: lot }]
            : k.kind === 'workers_housing' ? [{ offset: -w / 4 }, { offset: w / 4 }] : [{ offset: 0, lotId: lot }];
          const b: BuildingDef = { id, kind: k.kind, box: o, floors, palette: k.palettes[Math.floor(R() * k.palettes.length)], doors, setback: sb, seed: n * 7 + 3 };
          placed.push(b); out.push(b);
          s += w + gap;
        } else s += 2.5;
      }
    }
  }
  return out;
}

const obbCornersOf = (o: OBB) => {
  const c = Math.cos(o.rot), s = Math.sin(o.rot);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: o.cx + (a * o.w / 2) * c + (b * o.d / 2) * s, z: o.cz - (a * o.w / 2) * s + (b * o.d / 2) * c }));
};

export function compileDistrict(raw: DistrictDef): CompiledDistrict {
  const bounds = boundsOf(raw);
  const withCw: DistrictDef = { ...raw, crosswalks: raw.autoCrosswalks === false ? raw.crosswalks : autoCrosswalks(raw) };
  const def = { ...withCw, bounds, buildings: [...raw.buildings, ...fillFrontage(withCw, bounds)] };
  const carriages = def.roads.map((r) => ({ road: r, box: segmentOBB(r.a, r.b, r.carriage) }));
  const sidewalks = def.roads.flatMap((r) => {
    const u = roadDir(r);
    return (['L', 'R'] as const).map((side) => {
      const n = side === 'L' ? leftOf(u) : mul(leftOf(u), -1);
      const off = r.carriage / 2 + r.sidewalk / 2;
      return { road: r, side, box: segmentOBB(add(r.a, mul(n, off)), add(r.b, mul(n, off)), r.sidewalk, r.sidewalk / 2) };
    });
  });
  // 斑马线：两端都必须落在人行道上（且不在别的路的车道里），否则不生成——避免把人引到车道中间
  const onSidewalk = (p: V2) => sidewalks.some((x) => inOBB(x.box, p)) && !carriages.some((c) => inOBB(c.box, p));
  const crosswalks = def.crosswalks.map((cw) => {
    const r = def.roads.find((x) => x.id === cw.road)!;
    const c = roadPoint(r, cw.t * roadLen(r));
    const n = leftOf(roadDir(r));
    const half = r.carriage / 2 + 0.4;
    const ok = onSidewalk(add(c, mul(n, r.carriage / 2 + 0.9))) && onSidewalk(add(c, mul(n, -(r.carriage / 2 + 0.9))));
    return { ok, v: { road: r, center: c, box: segmentOBB(add(c, mul(n, -half)), add(c, mul(n, half)), cw.width) } };
  }).filter((x) => x.ok).map((x) => x.v);

  // 门与门前通道
  const doors: Door[] = [];
  const paths: OBB[] = [];
  for (const b of def.buildings) {
    b.doors.forEach((d, i) => {
      let p: V2, out: V2;
      if (b.polygon) ({ p, out } = polygonDoor(b));
      else {
        const o = b.box!;
        const s = Math.sin(o.rot), c = Math.cos(o.rot);
        out = { x: s, z: c }; // 局部 +z
        const side = { x: c, z: -s }; // 局部 +x
        p = add({ x: o.cx, z: o.cz }, add(mul(out, o.d / 2), mul(side, d.offset)));
      }
      const reach = (b.setback ?? 0.6) + 1.2;
      paths.push(segmentOBB(p, add(p, mul(out, reach)), 1.8));
      doors.push({ id: `${b.id}#${i}`, buildingId: b.id, p, out, trigger: add(p, mul(out, 0.9)), lotId: d.lotId, label: d.label ?? b.name });
    });
  }

  const inCarriage = (p: V2, pad = 0) => carriages.some((c) => inOBB(c.box, p, pad));
  const inCrosswalk = (p: V2, pad = 0) => crosswalks.some((c) => inOBB(c.box, p, pad));
  const inBuilding = (p: V2, pad = 0) => def.buildings.some((b) => buildingContains(b, p, pad));
  const nearDoor = (p: V2, r: number) => doors.some((d) => dist(d.trigger, p) < r || dist(d.p, p) < r) || paths.some((o) => inOBB(o, p, r * 0.7));

  // 程序化街道家具
  const props: PropDef[] = [...def.props];
  const R = rng(def.id.length * 97 + 13);
  for (const r of def.roads) {
    const u = roadDir(r);
    const L = roadLen(r);
    for (const side of ['L', 'R'] as const) {
      const n = side === 'L' ? leftOf(u) : mul(leftOf(u), -1);
      const curb = (s: number, inset: number) => add(roadPoint(r, s), mul(n, r.carriage / 2 + inset));
      const okSpot = (p: V2, clear: number) =>
        !inCarriage(p, 0.3) && !inCrosswalk(p, 1.4) && !inBuilding(p, 0.6) && !nearDoor(p, clear) &&
        // 与其他道路的人行道 / 车道交叠处（路口）不放
        !def.roads.some((o) => o !== r && inOBB(segmentOBB(o.a, o.b, o.carriage + o.sidewalk * 2), p, 0.5));
      let k = 0;
      for (let s = r.treeSpacing * 0.7; s < L - 1; s += r.treeSpacing, k++) {
        const treeP = curb(s, 0.85);
        if (r.trees !== 'none' && okSpot(treeP, 2.2)) {
          props.push({ kind: 'tree', p: treeP, species: r.trees as TreeSpecies, scale: 0.85 + R() * 0.35, rot: R() * Math.PI * 2 });
        }
        const mid = curb(s + r.treeSpacing / 2, 0.55);
        if (k % 3 === 1 && okSpot(mid, 1.6)) props.push({ kind: 'lamp', p: mid, rot: Math.atan2(n.x, n.z) + Math.PI });
        else if (k % 7 === 3 && okSpot(mid, 1.6)) props.push({ kind: 'hydrant', p: curb(s + r.treeSpacing / 2, 0.6) });
        else if (k % 5 === 4 && okSpot(mid, 1.6) && r.sidewalk >= 3.5) {
          // 共享单车停放区：只在划定区域内，平行于路缘，不占用通行带
          const zoneC = curb(s + r.treeSpacing / 2, 0.9);
          for (let b = -1; b <= 1; b++) props.push({ kind: 'bike', p: add(zoneC, mul(u, b * 0.9)), rot: Math.atan2(n.x, n.z), color: ['#F2D99B', '#9DB6CA', '#F0C4C6'][(k + b + 3) % 3] });
        } else if (k % 6 === 2 && okSpot(mid, 1.6)) props.push({ kind: 'bin', p: curb(s + r.treeSpacing / 2, 0.6) });
      }
      // 靠建筑一侧的花箱（避开门口）
      for (let s = 9; s < L - 4; s += 17) {
        const p = add(roadPoint(r, s), mul(n, r.carriage / 2 + r.sidewalk - 0.55));
        if (!inCarriage(p, 0.3) && !inCrosswalk(p, 1.5) && !inBuilding(p, 0.1) && !nearDoor(p, 2.6) && r.sidewalk >= 4.2 &&
          !def.roads.some((o) => o !== r && inOBB(segmentOBB(o.a, o.b, o.carriage + o.sidewalk * 2), p, 0.5))) {
          props.push({ kind: 'planter', p, rot: Math.atan2(u.x, u.z) });
        }
      }
    }
  }
  // 停车位里的车
  for (const a of def.areas.filter((x) => x.kind === 'parking' && x.box)) {
    const o = a.box!;
    const n = Math.floor(o.w / 5.2);
    for (let i = 0; i < n; i++) if (R() > 0.25) props.push({ kind: 'car', p: { x: o.cx - o.w / 2 + 2.6 + i * 5.2, z: o.cz }, rot: Math.PI / 2, color: ['#F2D99B', '#9DB6CA', '#F7F3EA', '#C98068', '#A9C2A0'][i % 5] });
  }

  // 碰撞体
  const obstacles: Obstacle[] = [];
  for (const p of props) {
    const r = p.kind === 'tree' ? 0.75 : p.kind === 'lamp' ? 0.25 : p.kind === 'hydrant' ? 0.3 : p.kind === 'bin' ? 0.32 : p.kind === 'mailbox' ? 0.45
      : p.kind === 'fitness' ? 0.9 : p.kind === 'stall' ? 1.4 : p.kind === 'shrub' ? 0.7 : p.kind === 'umbrella_table' ? 1.0 : 0;
    if (r) obstacles.push({ kind: p.kind, p: p.p, r });
    if (p.kind === 'bench') obstacles.push({ kind: 'bench', box: { cx: p.p.x, cz: p.p.z, w: 2.0, d: 0.8, rot: p.rot ?? 0 } });
    if (p.kind === 'planter') obstacles.push({ kind: 'planter', box: { cx: p.p.x, cz: p.p.z, w: 0.9, d: 2.4, rot: p.rot ?? 0 } });
    if (p.kind === 'bike') obstacles.push({ kind: 'bike', box: { cx: p.p.x, cz: p.p.z, w: 0.5, d: 1.5, rot: p.rot ?? 0 } });
    if (p.kind === 'bus_stop') obstacles.push({ kind: 'bus_stop', box: { cx: p.p.x, cz: p.p.z, w: 4.2, d: 0.5, rot: p.rot ?? 0 } });
    if (p.kind === 'car') obstacles.push({ kind: 'car', box: { cx: p.p.x, cz: p.p.z, w: 2.0, d: 4.4, rot: p.rot ?? 0 } });
  }
  for (const a of def.areas) if (a.kind === 'wall' && a.box) obstacles.push({ kind: 'wall', box: a.box });
  // 骑楼柱子：在人行道靠路缘一侧
  for (const b of def.buildings.filter((x) => x.kind === 'arcade' && x.box)) {
    const o = b.box!;
    const s = Math.sin(o.rot), c = Math.cos(o.rot);
    const out = { x: s, z: c }, side = { x: c, z: -s };
    const r = def.roads.find((rr) => Math.abs(Math.abs(Math.atan2(roadDir(rr).x, roadDir(rr).z)) - Math.abs(Math.atan2(side.x, side.z))) < 0.2) ?? def.roads[0];
    const depth = r.sidewalk - 0.7;
    for (let i = -2; i <= 2; i++) {
      const p = add({ x: o.cx, z: o.cz }, add(mul(out, o.d / 2 + depth), mul(side, (i * o.w) / 4.4)));
      if (!nearDoor(p, 1.2)) obstacles.push({ kind: 'column', p, r: 0.35 });
    }
  }

  // 车道（右侧通行）
  const lanes: CompiledDistrict['lanes'] = [];
  for (const r of def.roads) {
    const u = roadDir(r);
    const right = mul(leftOf(u), -1);
    const perDir = r.oneWay ? r.lanes : Math.max(1, Math.floor(r.lanes / 2));
    const laneW = r.carriage / Math.max(r.lanes, 1);
    for (let i = 0; i < perDir; i++) {
      const off = r.oneWay ? (i - (perDir - 1) / 2) * laneW : laneW * (i + 0.5) * (r.id === 'yj_main' ? 0.8 : 1);
      lanes.push({ road: r, from: add(r.a, mul(right, off)), to: add(r.b, mul(right, off)), dir: u });
      if (!r.oneWay) lanes.push({ road: r, from: add(r.b, mul(right, -off)), to: add(r.a, mul(right, -off)), dir: mul(u, -1) });
    }
  }

  return { def, carriages, sidewalks, crosswalks, paths, doors, props, obstacles, lanes };
}

export { buildingContains, sub };
