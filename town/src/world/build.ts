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
  /** 地图边缘的隧道口：道路在地图边缘不会“断掉”，车辆从隧道驶入 / 驶出 */
  tunnels: Tunnel[];
  parks: ParkLayout[];
}

/** 隧道长度（覆盖道路末端的这一段） */
export const TUNNEL = 9;
export interface Tunnel { road: RoadDef; end: 'a' | 'b'; /** 洞口中心（朝向地图内侧的一面） */ mouth: V2; /** 指向地图外的方向 */ out: V2; box: OBB; width: number }

/** 道路端点不在任何其他道路上 = 通往地图外 */
function deadEnds(roads: RoadDef[]): { road: RoadDef; end: 'a' | 'b' }[] {
  const out: { road: RoadDef; end: 'a' | 'b' }[] = [];
  for (const r of roads) for (const end of ['a', 'b'] as const) {
    const p = r[end];
    if (!roads.some((q) => q !== r && inOBB(segmentOBB(q.a, q.b, q.carriage), p, 0.6))) out.push({ road: r, end });
  }
  return out;
}

function tunnelsOf(roads: RoadDef[]): Tunnel[] {
  return deadEnds(roads).map(({ road, end }) => {
    const u = roadDir(road);
    const out = end === 'b' ? u : mul(u, -1);
    const tip = road[end];
    const mouth = add(tip, mul(out, -TUNNEL));
    const width = road.carriage + road.sidewalk * 2 + 1.2;
    return { road, end, mouth, out, width, box: segmentOBB(mouth, add(tip, mul(out, 0.6)), width) };
  });
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
function fillFrontage(def: DistrictDef, bounds: Bounds, tunnels: Tunnel[] = [], blockers: OBB[] = []): BuildingDef[] {
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
    if (all.some((p) => tunnels.some((t) => inOBB(t.box, p, 3)))) return false;
    if (all.some((p) => blockers.some((b) => inOBB(b, p, 1.2)))) return false;
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
        const tunA = tunnels.some((t) => t.road.id === r.id && t.end === 'a'), tunB = tunnels.some((t) => t.road.id === r.id && t.end === 'b');
        const clearOfTunnel = !(tunA && s < TUNNEL + 2.5) && !(tunB && s + w > L - TUNNEL - 2.5);
        if (s + w < L - 2 && clearOfTunnel && free(o, sb)) {
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

/**
 * 公园 / 街心绿地的园路与景观：环形园路 + 十字园路 + 中心小广场 + 池塘 + 树林 + 长椅 + 名牌；
 * 入口：从十字园路的四个端点向外找最近的人行道，中间没有车道和建筑才开口。
 */
export interface ParkLayout { id: string; label: string; box: OBB; paths: OBB[]; entrances: { p: V2; out: V2 }[]; props: PropDef[] }
function parkLayout(def: DistrictDef): ParkLayout[] {
  const out: ParkLayout[] = [];
  const carriages = def.roads.map((r) => segmentOBB(r.a, r.b, r.carriage));
  const walks = def.roads.flatMap((r) => {
    const u = roadDir(r);
    return [1, -1].map((sg) => { const off = mul(leftOf(u), sg * (r.carriage / 2 + r.sidewalk / 2)); return segmentOBB(add(r.a, off), add(r.b, off), r.sidewalk); });
  });
  const trees: TreeSpecies[] = ['camphor', 'plane', 'ginkgo', 'osmanthus'];
  for (const a of def.areas) {
    if (a.kind !== 'park' || !a.box) continue;
    const o = a.box, R = rng(a.id.length * 131 + Math.round(Math.abs(o.cx * 7 + o.cz * 3)));
    const x0 = o.cx - o.w / 2, x1 = o.cx + o.w / 2, z0 = o.cz - o.d / 2, z1 = o.cz + o.d / 2;
    const m = 3.4;
    const strip = (ax: number, az: number, bx: number, bz: number, w: number) => segmentOBB({ x: ax, z: az }, { x: bx, z: bz }, w);
    const paths: OBB[] = [
      strip(x0, o.cz, x1, o.cz, 2.6), strip(o.cx, z0, o.cx, z1, 2.6), // 十字园路
      strip(x0 + m, z0 + m, x1 - m, z0 + m, 2.2), strip(x0 + m, z1 - m, x1 - m, z1 - m, 2.2), // 环路
      strip(x0 + m, z0 + m, x0 + m, z1 - m, 2.2), strip(x1 - m, z0 + m, x1 - m, z1 - m, 2.2),
      { cx: o.cx, cz: o.cz, w: 7, d: 7, rot: 0 }, // 中心小广场
    ];
    const entrances: ParkLayout['entrances'] = [];
    const props: PropDef[] = [];
    for (const [ex, ez, nx, nz] of [[x0, o.cz, -1, 0], [x1, o.cz, 1, 0], [o.cx, z0, 0, -1], [o.cx, z1, 0, 1]]) {
      const n = { x: nx, z: nz };
      for (let d = 0; d <= 40; d += 0.5) {
        const p = { x: ex + nx * d, z: ez + nz * d };
        if (carriages.some((c) => inOBB(c, p, 0.2)) || def.buildings.some((b) => buildingContains(b, p, 1.6))) break;
        if (walks.some((w) => inOBB(w, p, -0.3))) {
          paths.push(segmentOBB({ x: ex - nx * 0.5, z: ez - nz * 0.5 }, add(p, mul(n, 0.8)), 2.6));
          entrances.push({ p: { x: ex, z: ez }, out: n });
          const side = { x: -nz, z: nx };
          props.push({ kind: 'park_sign', p: add({ x: ex - nx * 0.6, z: ez - nz * 0.6 }, mul(side, 2.6)), rot: Math.atan2(nx, nz), text: a.label ?? '公园' });
          break;
        }
      }
    }
    // 池塘：放在一个象限的中央
    const qw = o.w / 2 - m - 1.1 - 1.3, qd = o.d / 2 - m - 1.1 - 1.3;
    const pondR = Math.max(2.2, Math.min(7, Math.min(qw, qd) / 2 - 1.4));
    const pond = { x: o.cx + 1.3 + qw / 2, z: o.cz + 1.3 + qd / 2 };
    if (qw > 7 && qd > 7) props.push({ kind: 'pond', p: pond, scale: pondR });
    // 树林：避开园路、池塘和边缘
    for (let x = x0 + 1.8; x < x1 - 1.5; x += 4.6) for (let z = z0 + 1.8; z < z1 - 1.5; z += 4.6) {
      const p = { x: x + (R() - 0.5) * 2.4, z: z + (R() - 0.5) * 2.4 };
      if (paths.some((q) => inOBB(q, p, 1.7)) || dist(p, pond) < pondR + 2 || R() < 0.22) continue;
      props.push({ kind: 'tree', p, species: trees[Math.floor(R() * trees.length)], scale: 0.8 + R() * 0.5, rot: R() * Math.PI * 2 });
    }
    // 长椅：沿十字园路两侧
    for (const sg of [-1, 1]) for (let k = 7; k < Math.min(o.w, o.d) / 2 - 4; k += 9) {
      props.push({ kind: 'bench', p: { x: o.cx + sg * k, z: o.cz + 2.3 }, rot: Math.PI });
      props.push({ kind: 'bench', p: { x: o.cx - 2.3, z: o.cz + sg * k }, rot: Math.PI / 2 });
    }
    out.push({ id: a.id, label: a.label ?? '公园', box: o, paths, entrances, props });
  }
  return out;
}

export function compileDistrict(raw: DistrictDef): CompiledDistrict {
  const bounds = boundsOf(raw);
  const withCw: DistrictDef = { ...raw, crosswalks: raw.autoCrosswalks === false ? raw.crosswalks : autoCrosswalks(raw) };
  const parks = parkLayout(raw);
  const def = { ...withCw, bounds, buildings: [...raw.buildings, ...fillFrontage(withCw, bounds, tunnelsOf(raw.roads), parks.flatMap((p) => p.paths))] };
  const tunnels = tunnelsOf(def.roads);
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

  for (const pk of parks) paths.push(...pk.paths);
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
  // 路名牌：每条斑马线两端各一块（标出“正在过的路”和“脚下这条路”），以及路段中间每 70 个单位一块
  const roadAt = (p: V2, except?: RoadDef) => sidewalks.find((x) => x.road !== except && inOBB(x.box, p))?.road;
  const signOk = (p: V2) => !inCarriage(p, 0.2) && !inCrosswalk(p, 0.6) && !inBuilding(p, 0.6) && !nearDoor(p, 1.4)
    && !props.some((q) => dist(q.p, p) < 1.3);
  for (const cw of crosswalks) {
    const u = roadDir(cw.road), n = leftOf(u);
    for (const sg of [1, -1]) {
      for (const along of [cw.box.w / 2 + 0.9, -(cw.box.w / 2 + 0.9)]) {
        const p = add(add(cw.center, mul(n, sg * (cw.road.carriage / 2 + 0.45))), mul(u, along));
        if (!signOk(p)) continue;
        const walking = roadAt(p, cw.road);
        props.push({ kind: 'street_sign', p, rot: Math.atan2(u.x, u.z), text: walking ? `${cw.road.name}|${walking.name}` : cw.road.name });
        break;
      }
    }
  }
  for (const r of def.roads) {
    const u = roadDir(r), L = roadLen(r);
    for (let s = 35; s < L - 20; s += 70) {
      for (const side of [1, -1]) {
        const p = add(roadPoint(r, s), mul(leftOf(u), side * (r.carriage / 2 + 0.45)));
        if (signOk(p) && !props.some((q) => q.kind === 'street_sign' && dist(q.p, p) < 25)) { props.push({ kind: 'street_sign', p, rot: Math.atan2(u.x, u.z), text: r.name }); break; }
      }
    }
    // 井盖：车道中线附近，每 38 个单位一个
    for (let s = 19; s < L - 5; s += 38) {
      const p = add(roadPoint(r, s), mul(leftOf(u), r.carriage / 4));
      if (!def.roads.some((o) => o !== r && inOBB(segmentOBB(o.a, o.b, o.carriage), p, 0.5)) && !inCrosswalk(p, 1)) props.push({ kind: 'manhole', p });
    }
  }

  // 三邻邦公告栏：出生点附近的人行道外侧（靠建筑一侧），点击打开机会广场
  {
    let best: { p: V2; rot: number; d: number } | null = null;
    for (const sw of sidewalks) {
      const r = sw.road, u = roadDir(r), L = roadLen(r);
      const n = sw.side === 'L' ? leftOf(u) : mul(leftOf(u), -1);
      for (let s = TUNNEL + 4; s < L - TUNNEL - 4; s += 2) {
        const p = add(roadPoint(r, s), mul(n, r.carriage / 2 + r.sidewalk - 0.45));
        const d = dist(p, def.spawn);
        if (d < 6 || d > 40 || (best && d >= best.d)) continue;
        if (!signOk(p) || inBuilding(p, 0.8) || def.roads.some((o) => o !== r && inOBB(segmentOBB(o.a, o.b, o.carriage + o.sidewalk * 2), p, 1))) continue;
        best = { p, rot: Math.atan2(n.x, n.z) + Math.PI, d };
      }
    }
    if (best) props.push({ kind: 'notice_board', p: best.p, rot: best.rot, text: '三邻邦公告栏' });
  }

  // 停车位里的车
  for (const a of def.areas.filter((x) => x.kind === 'parking' && x.box)) {
    const o = a.box!;
    const n = Math.floor(o.w / 5.2);
    for (let i = 0; i < n; i++) if (R() > 0.25) props.push({ kind: 'car', p: { x: o.cx - o.w / 2 + 2.6 + i * 5.2, z: o.cz }, rot: Math.PI / 2, color: ['#F2D99B', '#9DB6CA', '#F7F3EA', '#C98068', '#A9C2A0'][i % 5] });
  }

  for (const pk of parks) props.push(...pk.props);
  // 隧道口里不放街道家具
  for (let i = props.length - 1; i >= 0; i--) if (tunnels.some((t) => inOBB(t.box, props[i].p, 0.8))) props.splice(i, 1);

  // 碰撞体
  const obstacles: Obstacle[] = tunnels.map((t) => ({ kind: 'tunnel', box: t.box }));
  for (const p of props) {
    const r = p.kind === 'tree' ? 0.3 : p.kind === 'lamp' || p.kind === 'street_sign' ? 0.25 : p.kind === 'hydrant' ? 0.3 : p.kind === 'bin' ? 0.32 : p.kind === 'mailbox' ? 0.45 : p.kind === 'park_sign' ? 0.4
      : p.kind === 'fitness' ? 0.9 : p.kind === 'stall' ? 1.4 : p.kind === 'shrub' ? 0.7 : p.kind === 'umbrella_table' ? 1.0 : 0;
    if (r) obstacles.push({ kind: p.kind, p: p.p, r });
    if (p.kind === 'notice_board') obstacles.push({ kind: 'notice_board', box: { cx: p.p.x, cz: p.p.z, w: 2.0, d: 0.5, rot: p.rot ?? 0 } });
    if (p.kind === 'bench') obstacles.push({ kind: 'bench', box: { cx: p.p.x, cz: p.p.z, w: 2.0, d: 0.8, rot: p.rot ?? 0 } });
    if (p.kind === 'planter') obstacles.push({ kind: 'planter', box: { cx: p.p.x, cz: p.p.z, w: 0.9, d: 2.4, rot: p.rot ?? 0 } });
    // 单车停放区的车与车之间不留一格宽的缝（否则人会走进缝里出不来）
    if (p.kind === 'bike') obstacles.push({ kind: 'bike', box: { cx: p.p.x, cz: p.p.z, w: 1.0, d: 1.5, rot: p.rot ?? 0 } });
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

  return { def, carriages, sidewalks, crosswalks, paths, doors, props, obstacles, lanes, tunnels, parks };
}

export { buildingContains, sub };
