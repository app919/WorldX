/**
 * 交通仿真（纯逻辑，可单测）：让车辆遵守物理世界的基本规律。
 *
 * - 跟车：同一车道保持安全车距，前车减速时后车减速，绝不穿过前车；
 * - 路口：路口是一块“共享区域”，同一时间只允许一条道路方向的车辆进入；
 *   进入前要确认路口空闲、且出口有足够空间（不堵在路口中间）；
 * - 礼让行人：斑马线上有人时，在斑马线前停车；
 * - 加速 / 刹车有上限，速度连续变化（不会瞬间停住或起步）；
 * - 车道尽头驶出地图后，从车道起点重新驶入（起点有空位时）。
 */
import type { CompiledDistrict } from './build';
import { dist, inOBB, segmentOBB, type OBB, type V2 } from './geom';

export const CAR_LEN = 4.4;
export const CAR_W = 2.0;
const MIN_GAP = 2.2; // 静止时的最小车距
const ACCEL = 3.2;
const BRAKE = 9;

interface Zone { id: string; tIn: number; tOut: number }
interface Lane {
  idx: number; roadId: string; from: V2; to: V2; dir: V2; L: number; junctions: Zone[]; crossings: { box: OBB; tIn: number; tOut: number }[];
  /** 车道起点 / 终点落在另一条路的车道里（T 字或多岔路口的支路） */
  startsIn?: string; endsIn?: string;
  /** 本车道上可以拐进支路的位置 */
  branches: { lane: number; t: number }[];
}

export interface Car {
  id: number;
  lane: number;
  t: number; // 车辆中心沿车道的位置
  v: number;
  cruise: number;
  braking: boolean;
  hidden: boolean;
  color: string;
  seed: number;
  /** 已获准进入、尚未完全驶出的路口（持续占用，直到车尾离开） */
  committed: Set<string>;
}

export interface Traffic { lanes: Lane[]; cars: Car[]; /** 路口 → 当前占用的道路 id 与车辆 */ occupancy: Map<string, Set<number>> }

const COLORS = ['#F2D99B', '#9DB6CA', '#F7F3EA', '#C98068', '#A9C2A0', '#E6A3A7', '#6F8BA4', '#3E4A5A', '#D7D2CA'];

/** 车道经过其他道路车道的区间 = 路口；经过的斑马线区间 = 需要礼让的地方 */
function buildLanes(cd: CompiledDistrict): Lane[] {
  return cd.lanes.map((l, idx) => {
    const L = dist(l.from, l.to);
    const pos = (t: number) => ({ x: l.from.x + l.dir.x * t, z: l.from.z + l.dir.z * t });
    const junctions: Zone[] = [];
    for (const c of cd.carriages) {
      if (c.road.id === l.road.id) continue;
      // 支路的车会从主路中间拐入 / 拐出，所以路口检测时把支路车道两端各延长一个车长
      const r = c.road;
      const ext = segmentOBB(r.a, r.b, r.carriage, CAR_LEN * 0.6);
      let start = -1;
      for (let t = 0; t <= L; t += 0.5) {
        const inside = inOBB(ext, pos(t), CAR_W / 2 + 0.3);
        if (inside && start < 0) start = t;
        if ((!inside || t + 0.5 > L) && start >= 0) {
          const mid = pos((start + t) / 2);
          // 同一个路口对所有经过它的车道使用同一个 id（按两条路 + 中心位置）
          const pair = [l.road.id, c.road.id].sort().join('+');
          junctions.push({ id: `${pair}@${Math.round(mid.x / 8)},${Math.round(mid.z / 8)}`, tIn: start, tOut: t });
          start = -1;
        }
      }
    }
    const crossings: Lane['crossings'] = [];
    for (const cw of cd.crosswalks) {
      let tIn = -1, tOut = -1;
      for (let t = 0; t <= L; t += 0.5) if (inOBB(cw.box, pos(t), 0.3)) { if (tIn < 0) tIn = t; tOut = t; }
      if (tIn >= 0) crossings.push({ box: cw.box, tIn, tOut });
    }
    junctions.sort((a, b) => a.tIn - b.tIn);
    // 合并同一个路口的多个相邻区间
    const merged: Zone[] = [];
    for (const j of junctions) {
      const last = merged[merged.length - 1];
      if (last && j.tIn - last.tOut < 3) { last.tOut = Math.max(last.tOut, j.tOut); last.id = last.id < j.id ? last.id : j.id; }
      else merged.push({ ...j });
    }
    const containing = (p: V2) => cd.carriages.find((c) => c.road.id !== l.road.id && inOBB(c.box, p, 0.5))?.road.id;
    return { idx, roadId: l.road.id, from: l.from, to: l.to, dir: l.dir, L, junctions: merged, crossings, startsIn: containing(l.from), endsIn: containing(l.to), branches: [] };
  });
}

/** 把点投影到车道上，返回沿车道的距离 */
function project(l: Lane, p: V2) { return (p.x - l.from.x) * l.dir.x + (p.z - l.from.z) * l.dir.z; }

/** 建立“拐弯”关系：支路起点挂到主路车道上（可拐入），支路终点可以并入主路车道（拐出） */
function linkTurns(lanes: Lane[]) {
  for (const side of lanes) {
    if (!side.startsIn) continue;
    for (const main of lanes.filter((m) => m.roadId === side.startsIn)) {
      const t = project(main, side.from);
      if (t > CAR_LEN && t < main.L - CAR_LEN) main.branches.push({ lane: side.idx, t });
    }
  }
}

export function createTraffic(cd: CompiledDistrict, density = 1): Traffic {
  const lanes = buildLanes(cd);
  linkTurns(lanes);
  // 同一个路口的不同车道区间要用相同 id：按交叉道路对 + 最近中心聚类
  const ids = new Map<string, string>();
  for (const l of lanes) for (const j of l.junctions) {
    const [pair, at] = j.id.split('@');
    const [x, z] = at.split(',').map(Number);
    let found: string | undefined;
    for (const [k, v] of ids) {
      const [p2, a2] = k.split('@');
      const [x2, z2] = a2.split(',').map(Number);
      const sharesRoad = p2.split('+').some((r) => pair.split('+').includes(r));
      if (sharesRoad && Math.abs(x - x2) <= 2 && Math.abs(z - z2) <= 2) { found = v; break; }
    }
    const id = found ?? `J${ids.size}`;
    ids.set(j.id, id);
    j.id = id;
  }
  const cars: Car[] = [];
  let id = 0;
  for (const l of lanes) {
    const n = Math.max(1, Math.floor((l.L / 55) * density));
    for (let k = 0; k < n; k++) {
      let t = ((k + 0.5) / n) * l.L;
      // 不要生成在路口或斑马线上
      for (let g = 0; g < 20 && (l.junctions.some((j) => t > j.tIn - CAR_LEN && t < j.tOut + CAR_LEN) || l.crossings.some((c) => t > c.tIn - CAR_LEN && t < c.tOut + CAR_LEN)); g++) t += 3;
      if (t > l.L - CAR_LEN) continue;
      cars.push({ id: id++, lane: l.idx, t, v: 0, cruise: 5.5 + ((id * 37) % 10) / 5, braking: false, hidden: false, color: COLORS[(id * 5) % COLORS.length], seed: id * 131 + l.idx, committed: new Set() });
    }
  }
  return { lanes, cars, occupancy: new Map() };
}

export function carPos(tr: Traffic, c: Car): V2 {
  const l = tr.lanes[c.lane];
  return { x: l.from.x + l.dir.x * c.t, z: l.from.z + l.dir.z * c.t };
}

export function carBox(tr: Traffic, c: Car, pad = 0): OBB {
  const l = tr.lanes[c.lane];
  const p = carPos(tr, c);
  const a = { x: p.x - (l.dir.x * CAR_LEN) / 2, z: p.z - (l.dir.z * CAR_LEN) / 2 };
  const b = { x: p.x + (l.dir.x * CAR_LEN) / 2, z: p.z + (l.dir.z * CAR_LEN) / 2 };
  return segmentOBB(a, b, CAR_W + pad * 2, pad);
}

/** 推进仿真 dt 秒。peds：所有行人（含玩家）的位置 */
export function stepTraffic(tr: Traffic, dt: number, peds: V2[]) {
  const occ = tr.occupancy;
  // 1) 重新计算路口占用（车身与路口区间重叠即占用）
  occ.clear();
  const roadOf = (c: Car) => tr.lanes[c.lane].roadId;
  const claim = (j: string, c: Car) => { if (!occ.has(j)) occ.set(j, new Set()); occ.get(j)!.add(c.id); c.committed.add(j); };
  for (const c of tr.cars) {
    if (c.hidden) { c.committed.clear(); continue; }
    const l = tr.lanes[c.lane];
    // 车尾已经离开的路口释放；车身在路口里的一定占用；此前获准进入的继续占用
    for (const id of [...c.committed]) { const j = l.junctions.find((x) => x.id === id); if (!j || c.t - CAR_LEN / 2 > j.tOut) c.committed.delete(id); }
    for (const j of l.junctions) if (c.t + CAR_LEN / 2 > j.tIn - 0.3 && c.t - CAR_LEN / 2 < j.tOut) c.committed.add(j.id);
    for (const id of c.committed) claim(id, c);
  }
  const byId = new Map(tr.cars.map((c) => [c.id, c]));
  const blockedByRoad = (j: string, road: string, c: Car) => [...(occ.get(j) ?? [])].some((o) => o !== c.id && roadOf(byId.get(o)!) !== road);
  const blockedBy = (j: string, c: Car) => blockedByRoad(j, roadOf(c), c);

  // 2) 每条车道按位置排序，找前车
  const perLane = new Map<number, Car[]>();
  for (const c of tr.cars) if (!c.hidden) { if (!perLane.has(c.lane)) perLane.set(c.lane, []); perLane.get(c.lane)!.push(c); }
  for (const list of perLane.values()) list.sort((a, b) => a.t - b.t);

  for (const c of tr.cars) {
    const l = tr.lanes[c.lane];
    if (c.hidden) {
      if (l.startsIn) {
        // 起点在路口中间的支路不凭空生成车辆：换到一条从地图边缘驶入的车道
        const edge = tr.lanes.filter((x) => !x.startsIn);
        c.lane = edge[(c.id + Math.floor(c.t)) % edge.length].idx;
        c.t = 0;
        continue;
      }
      // 起点有空位才重新驶入
      const first = perLane.get(c.lane)?.[0];
      // 起点若就在路口里（例如从路口出发的支路），还要确认路口没有其他道路的车
      const startJ = l.junctions.find((j) => j.tIn < CAR_LEN * 2);
      if ((!first || first.t > CAR_LEN * 2 + MIN_GAP) && !(startJ && blockedBy(startJ.id, c))) {
        c.hidden = false; c.t = -CAR_LEN / 2; c.v = c.cruise * 0.6;
        if (startJ) claim(startJ.id, c);
        if (!perLane.has(c.lane)) perLane.set(c.lane, []);
        perLane.get(c.lane)!.unshift(c);
      }
      continue;
    }
    const list = perLane.get(c.lane)!;
    const leader = list[list.indexOf(c) + 1];
    const front = c.t + CAR_LEN / 2;
    let vMax = c.cruise;
    // 跟车：保证能在剩余距离内停下
    const stopIn = (d: number) => Math.sqrt(Math.max(0, 2 * BRAKE * 0.6 * Math.max(0, d)));
    if (leader) {
      const gap = leader.t - CAR_LEN / 2 - front - MIN_GAP;
      // 运动学安全车速：即使前车急停，也能在车距内停下
      vMax = Math.min(vMax, gap <= 0 ? 0 : Math.sqrt(leader.v * leader.v + 2 * BRAKE * 0.6 * gap));
    }
    // 支路尽头所在的路口（由并入逻辑单独处理）
    const endJ = l.endsIn ? [...l.junctions].reverse().find((j) => j.tOut >= l.L - 1) : undefined;
    // 路口：未进入且路口被其他道路的车占用、或出口没有空间时，在停止线前停车
    for (const j of l.junctions) {
      if (j === endJ) break;
      if (front > j.tIn - 0.3) continue; // 已进入
      const d = j.tIn - 1.6 - front; // 停止线在路口前 1.6 个单位（等待中的车不占用路口）
      if (d > 14) break;
      const exitFree = !leader || leader.t - CAR_LEN / 2 > j.tOut + MIN_GAP + 0.5 || leader.v > 2;
      if (blockedBy(j.id, c) || !exitFree) vMax = Math.min(vMax, stopIn(d));
      else if (d < 1.2) claim(j.id, c); // 即将进入：立即占用，同一帧里后处理的车会看到
      break;
    }
    // 斑马线：有行人就停
    for (const cw of l.crossings) {
      if (front > cw.tIn) continue;
      const d = cw.tIn - 1.2 - front;
      if (d > 12) break;
      if (peds.some((p) => inOBB(cw.box, p, 0.9))) vMax = Math.min(vMax, stopIn(d));
    }
    // 支路尽头：在主路路口的停止线前等待，路口空闲且主路有空档时一次并入（不会停在路口中间）
    let merge: { lane: number; t: number } | null = null;
    if (l.endsIn) {
      const stopAt = (endJ ? endJ.tIn : l.L - CAR_LEN) - 1.6;
      const options = tr.lanes.filter((m) => m.roadId === l.endsIn).map((m) => ({ lane: m.idx, t: project(m, l.to) }))
        .filter((o) => o.t > CAR_LEN && o.t < tr.lanes[o.lane].L - CAR_LEN);
      const pick = options[(c.id + c.seed) % Math.max(1, options.length)];
      const can = pick && gapFree(tr, perLane, pick.lane, pick.t) && areaFree(tr, l.to, 6.5, c) && !(endJ && blockedByRoad(endJ.id, l.endsIn, c));
      if (can && front >= stopAt - 1.0) merge = pick;
      else vMax = Math.min(vMax, stopIn(stopAt - front));
    }
    // 前方感应：制动距离内有任何车辆（横穿、转弯、对向占道），提前减速停车
    const look = (c.v * c.v) / (2 * BRAKE * 0.6) + 3;
    for (let d = 0.4; d <= look; d += 0.7) {
      const t = front + d;
      if (t > l.L + 2) break;
      const p = { x: l.from.x + l.dir.x * t, z: l.from.z + l.dir.z * t };
      if (tr.cars.some((o) => o !== c && !o.hidden && o !== leader && inOBB(carBox(tr, o), p, CAR_W / 2 - 0.1))) { vMax = Math.min(vMax, stopIn(d - 1.0)); break; }
    }
    const target = Math.max(0, vMax);
    const dv = target - c.v;
    c.braking = dv < -0.3 || (c.v < 0.3 && target < 0.3);
    c.v += Math.max(-BRAKE * dt, Math.min(ACCEL * dt, dv));
    if (c.v < 0) c.v = 0;
    const prevT = c.t;
    c.t += c.v * dt;
    if (merge) { moveTo(perLane, c, merge.lane, merge.t); continue; }
    // 主路上经过支路路口时，部分车辆拐进支路（支路起点要有空位）
    for (const b of l.branches) {
      if (prevT < b.t && c.t >= b.t && (c.seed + Math.floor(b.t)) % 3 === 0 && gapFree(tr, perLane, b.lane, 0) && areaFree(tr, tr.lanes[b.lane].from, 6.5, c) && !tr.lanes[b.lane].junctions.some((j) => j.tIn < CAR_LEN && blockedByRoad(j.id, tr.lanes[b.lane].roadId, c))) {
        moveTo(perLane, c, b.lane, CAR_LEN * 0.2);
        break;
      }
    }
    if (!l.endsIn && c.t - CAR_LEN / 2 > l.L + 1) c.hidden = true;
  }
}

/** 拐弯 / 并线时要横穿对向车道：转弯点周围一定范围内不能有其他车 */
function areaFree(tr: Traffic, p: V2, r: number, self: Car) {
  return !tr.cars.some((o) => o !== self && !o.hidden && dist(carPos(tr, o), p) < r);
}

/** 目标车道在位置 t 附近是否有足够空档 */
function gapFree(tr: Traffic, perLane: Map<number, Car[]>, lane: number, t: number) {
  return !(perLane.get(lane) ?? []).some((o) => Math.abs(o.t - t) < CAR_LEN * 1.8) && !tr.cars.some((o) => !o.hidden && o.lane === lane && Math.abs(o.t - t) < CAR_LEN * 1.8);
}

function moveTo(perLane: Map<number, Car[]>, c: Car, lane: number, t: number) {
  c.committed.clear();
  const old = perLane.get(c.lane);
  if (old) old.splice(old.indexOf(c), 1);
  c.lane = lane; c.t = t;
  if (!perLane.has(lane)) perLane.set(lane, []);
  const list = perLane.get(lane)!;
  list.push(c); list.sort((a, b) => a.t - b.t);
}

/** 某点是否被行驶中的车辆占据（玩家 / 行人碰撞用） */
export function hitsCar(tr: Traffic | null, p: V2, pad = 0.35): boolean {
  if (!tr) return false;
  return tr.cars.some((c) => !c.hidden && inOBB(carBox(tr, c), p, pad));
}

/** 有车辆正在通过这条斑马线（行人应等待） */
export function crosswalkBusy(tr: Traffic | null, cw: OBB): boolean {
  if (!tr) return false;
  return tr.cars.some((c) => !c.hidden && inOBB(cw, carPos(tr, c), CAR_LEN / 2 + 1.2));
}

/** 当前街区的交通实例（场景与玩家控制器共享） */
export const trafficRuntime: { tr: Traffic | null; peds: Map<string, V2> } = { tr: null, peds: new Map() };
