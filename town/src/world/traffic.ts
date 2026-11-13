/**
 * 交通仿真（纯逻辑，可单测）：让车辆遵守物理世界的基本规律。
 *
 * - 跟车：同一车道保持安全车距，前车减速时后车减速，绝不穿过前车；
 * - 路口：路口是一块“共享区域”，同一时间只允许一条道路方向的车辆进入；
 *   进入前要确认路口空闲、且出口有足够空间（不堵在路口中间）；
 * - 礼让行人：斑马线上有人时，在斑马线前停车；
 * - 加速 / 刹车有上限，速度连续变化（不会瞬间停住或起步）；
 * - 转弯 / 并线沿平滑曲线行驶（仿真里的车身就在曲线上，碰撞检测与画面完全一致）；
 * - 地图边缘的道路尽头是隧道：车辆驶进隧道后，从另一个隧道口驶出（不会凭空出现或开出地图）。
 */
import { TUNNEL, type CompiledDistrict } from './build';
import { dist, inOBB, intersect, segmentOBB, type OBB, type V2 } from './geom';

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
  /** 调试：本帧限制车速的原因 */
  why?: string;
  /** 正在转弯：沿二次贝塞尔曲线 p0 → c → e 行驶；t < t0 时车在曲线上（t0 - len 为曲线起点） */
  turn?: { p0: V2; c: V2; e: V2; len: number; t0: number };
}

export interface Signal { id: string; roads: string[]; center: V2; offset: number }
export interface Traffic {
  lanes: Lane[]; cars: Car[]; /** 路口 → 当前占用的道路 id 与车辆 */ occupancy: Map<string, Set<number>>;
  /** 仿真时钟（秒），驱动红绿灯 */
  time: number;
  /** 每个路口一组红绿灯：各条道路轮流放行（绿 → 黄 → 全红） */
  signals: Map<string, Signal>;
  /** 每条斑马线对应的路口与被横穿的道路（不在路口附近的斑马线没有信号灯，车辆礼让行人） */
  cwSignal: ({ j: string; road: string } | null)[];
}

/** 红绿灯配时（秒） */
export const GREEN = 10, YELLOW = 3, ALL_RED = 1.5;
const PHASE = GREEN + YELLOW + ALL_RED;
export type Light = 'green' | 'yellow' | 'red';

/** 某个路口对某条道路的信号灯 */
export function lightFor(tr: Traffic, j: string, road: string): Light {
  const sg = tr.signals.get(j);
  if (!sg || sg.roads.length < 2) return 'green';
  const k = sg.roads.indexOf(road);
  if (k < 0) return 'green';
  const t = (tr.time + sg.offset) % (PHASE * sg.roads.length);
  const cur = Math.floor(t / PHASE), inPhase = t - cur * PHASE;
  if (cur !== k) return 'red';
  return inPhase < GREEN ? 'green' : inPhase < GREEN + YELLOW ? 'yellow' : 'red';
}

/** 斑马线的行人信号：被横穿的道路是红灯时行人绿灯；不在路口的斑马线返回 none（车辆礼让） */
export function pedLight(tr: Traffic | null, cwIndex: number): 'walk' | 'stop' | 'none' {
  const m = tr?.cwSignal[cwIndex];
  if (!tr || !m) return 'none';
  const sg = tr.signals.get(m.j)!;
  // 行人绿灯只在横穿道路红灯、且不在全红过渡的最后 1 秒时亮起，留出清空时间
  const l = lightFor(tr, m.j, m.road);
  if (l !== 'red') return 'stop';
  const t = (tr.time + sg.offset) % (PHASE * sg.roads.length);
  const k = sg.roads.indexOf(m.road);
  const before = ((k * PHASE - t) % (PHASE * sg.roads.length) + PHASE * sg.roads.length) % (PHASE * sg.roads.length);
  return before < 2.5 ? 'stop' : 'walk';
}

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
      // 在两条车道中线交点前 4 个单位开始转弯
      const X = intersect(main.from, main.dir, side.from, side.dir);
      if (!isFinite(X.x)) continue;
      const t = project(main, X) - 4;
      if (t > TUNNEL + CAR_LEN && t < main.L - TUNNEL - CAR_LEN) main.branches.push({ lane: side.idx, t });
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
      if (t < TUNNEL + CAR_LEN || t > l.L - TUNNEL - CAR_LEN) continue;
      cars.push({ id: id++, lane: l.idx, t, v: 0, cruise: 5.5 + ((id * 37) % 10) / 5, braking: false, hidden: false, color: COLORS[(id * 5) % COLORS.length], seed: id * 131 + l.idx, committed: new Set() });
    }
  }
  // 红绿灯：每个路口收集经过它的道路与中心点
  const signals = new Map<string, Signal>();
  const acc = new Map<string, { x: number; z: number; n: number; roads: Set<string> }>();
  for (const l of lanes) for (const j of l.junctions) {
    const m = (j.tIn + j.tOut) / 2;
    const a = acc.get(j.id) ?? { x: 0, z: 0, n: 0, roads: new Set<string>() };
    a.x += l.from.x + l.dir.x * m; a.z += l.from.z + l.dir.z * m; a.n++; a.roads.add(l.roadId);
    acc.set(j.id, a);
  }
  let k = 0;
  for (const [id, a] of acc) signals.set(id, { id, roads: [...a.roads].sort(), center: { x: a.x / a.n, z: a.z / a.n }, offset: (k++ * 7.3) % 40 });
  const cwSignal = cd.crosswalks.map((cw) => {
    let best: { j: string; road: string; d: number } | null = null;
    for (const sg of signals.values()) {
      if (!sg.roads.includes(cw.road.id) || sg.roads.length < 2) continue;
      const d = dist(sg.center, cw.center);
      if (d < 22 && (!best || d < best.d)) best = { j: sg.id, road: cw.road.id, d };
    }
    return best ? { j: best.j, road: best.road } : null;
  });
  return { lanes, cars, occupancy: new Map(), time: 0, signals, cwSignal };
}

const bez = (a: V2, b: V2, c: V2, u: number): V2 => ({ x: (1 - u) * (1 - u) * a.x + 2 * u * (1 - u) * b.x + u * u * c.x, z: (1 - u) * (1 - u) * a.z + 2 * u * (1 - u) * b.z + u * u * c.z });
const bezD = (a: V2, b: V2, c: V2, u: number): V2 => {
  const x = 2 * (1 - u) * (b.x - a.x) + 2 * u * (c.x - b.x), z = 2 * (1 - u) * (b.z - a.z) + 2 * u * (c.z - b.z);
  const L = Math.hypot(x, z) || 1; return { x: x / L, z: z / L };
};

/** 车辆在车道坐标 t 处的位置与朝向（转弯中的车在曲线上） */
export function poseAt(tr: Traffic, c: Car, t: number): { p: V2; dir: V2 } {
  const l = tr.lanes[c.lane];
  const tu = c.turn;
  if (tu && t < tu.t0) {
    const u = Math.max(0, Math.min(1, 1 - (tu.t0 - t) / tu.len));
    if (t >= tu.t0 - tu.len) return { p: bez(tu.p0, tu.c, tu.e, u), dir: bezD(tu.p0, tu.c, tu.e, u) };
    // 曲线起点之前（车尾还在原车道上）：沿曲线起点切线反向延伸
    const d0 = bezD(tu.p0, tu.c, tu.e, 0), k = t - (tu.t0 - tu.len);
    return { p: { x: tu.p0.x + d0.x * k, z: tu.p0.z + d0.z * k }, dir: d0 };
  }
  return { p: { x: l.from.x + l.dir.x * t, z: l.from.z + l.dir.z * t }, dir: l.dir };
}

export function carPos(tr: Traffic, c: Car): V2 { return poseAt(tr, c, c.t).p; }
export function carDir(tr: Traffic, c: Car): V2 { return poseAt(tr, c, c.t).dir; }

export function carBox(tr: Traffic, c: Car, pad = 0): OBB {
  const { p, dir } = poseAt(tr, c, c.t);
  const a = { x: p.x - (dir.x * CAR_LEN) / 2, z: p.z - (dir.z * CAR_LEN) / 2 };
  const b = { x: p.x + (dir.x * CAR_LEN) / 2, z: p.z + (dir.z * CAR_LEN) / 2 };
  return segmentOBB(a, b, CAR_W + pad * 2, pad);
}

/** 规划一次转弯：从当前位置沿原方向驶到两条车道中线的交点附近，再沿曲线拐进新车道 */
function planTurn(tr: Traffic, c: Car, lane: number): { t0: number; turn: NonNullable<Car['turn']> } | null {
  const { p: p0, dir: d0 } = poseAt(tr, c, c.t);
  const nl = tr.lanes[lane];
  const X = intersect(p0, d0, nl.from, nl.dir);
  if (!isFinite(X.x) || !isFinite(X.z)) return null;
  const r0 = (X.x - p0.x) * d0.x + (X.z - p0.z) * d0.z;
  if (r0 < 0.5) return null;
  const r1 = Math.max(3, Math.min(7, r0));
  const e = { x: X.x + nl.dir.x * r1, z: X.z + nl.dir.z * r1 };
  const t0 = project(nl, e);
  if (t0 > nl.L - TUNNEL - CAR_LEN) return null;
  let len = 0, prev = p0;
  for (let k = 1; k <= 12; k++) { const q = bez(p0, X, e, k / 12); len += dist(prev, q); prev = q; }
  return { t0, turn: { p0, c: X, e, len, t0 } };
}

/** 推进仿真 dt 秒。peds：所有行人（含玩家）的位置 */
export function stepTraffic(tr: Traffic, dt: number, peds: V2[]) {
  tr.time += dt;
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
        // 起点在路口中间的支路不凭空生成车辆：换到一条从隧道驶入的车道
        const edge = tr.lanes.filter((x) => !x.startsIn);
        c.lane = edge[(c.id * 7 + c.seed) % edge.length].idx;
        continue;
      }
      // 车在隧道里（看不见），从隧道口驶出：隧道口有空位才出来
      const spawnT = TUNNEL - CAR_LEN / 2 - 0.4;
      const first = perLane.get(c.lane)?.[0];
      const startJ = l.junctions.find((j) => j.tIn < TUNNEL + CAR_LEN * 2);
      if ((!first || first.t > spawnT + CAR_LEN * 2 + MIN_GAP) && !(startJ && blockedBy(startJ.id, c)) && areaFree(tr, poseAt(tr, c, spawnT + CAR_LEN).p, 4, c)) {
        c.hidden = false; c.t = spawnT; c.v = c.cruise * 0.6; c.turn = undefined;
        if (startJ) claim(startJ.id, c);
        if (!perLane.has(c.lane)) perLane.set(c.lane, []);
        perLane.get(c.lane)!.unshift(c);
      }
      continue;
    }
    const list = perLane.get(c.lane)!;
    // 转弯中的车：只跟随在汇入点之后（物理上在前方）的车；汇入点后方排队等灯的车不是它的前车
    const leader = c.turn && c.t < c.turn.t0
      ? list.filter((o) => o !== c && o.t > c.turn!.t0 - CAR_LEN * 0.5).sort((a, b) => a.t - b.t)[0]
      : list[list.indexOf(c) + 1];
    const front = c.t + CAR_LEN / 2;
    let vMax = c.cruise;
    c.why = '';
    const lim = (v: number, why: string) => { if (v < vMax) { vMax = v; c.why = why; } };
    // 跟车：保证能在剩余距离内停下
    const stopIn = (d: number) => Math.sqrt(Math.max(0, 2 * BRAKE * 0.6 * Math.max(0, d)));
    if (leader) {
      const gap = leader.t - CAR_LEN / 2 - front - MIN_GAP;
      // 运动学安全车速：即使前车急停，也能在车距内停下
      lim(gap <= 0 ? 0 : Math.sqrt(leader.v * leader.v + 2 * BRAKE * 0.6 * gap), 'leader');
    }
    const turning = !!c.turn && c.t < c.turn.t0;
    if (c.turn && !turning) c.turn = undefined;
    // 支路尽头所在的路口（由并入逻辑单独处理）
    const endJ = l.endsIn ? [...l.junctions].reverse().find((j) => j.tOut >= l.L - 1) : undefined;
    // 路口：未进入且路口被其他道路的车占用、或出口没有空间时，在停止线前停车
    for (const j of turning ? [] : l.junctions) {
      if (j === endJ) break;
      if (front > j.tIn - 0.3) continue; // 已进入
      const d = j.tIn - 1.6 - front; // 停止线在路口前 1.6 个单位（等待中的车不占用路口）
      if (d > 14 + c.v) break;
      // 红绿灯：红灯停；黄灯时还能停下就停（已经停不下来的继续通过）
      const light = lightFor(tr, j.id, l.roadId);
      const canStop = d > (c.v * c.v) / (2 * BRAKE) - 0.2; // 按最大制动力判断还停不停得下
      if ((light === 'red' && (canStop || !c.committed.has(j.id))) || (light === 'yellow' && canStop)) {
        // 还停得下来：在停止线前停车，并让出此前的路口占用
        c.committed.delete(j.id);
        lim(stopIn(d), 'signal');
        break;
      }
      if (d > 14) break;
      const exitFree = !leader || leader.t - CAR_LEN / 2 > j.tOut + MIN_GAP + 0.5 || leader.v > 2;
      if (blockedBy(j.id, c) || !exitFree) lim(stopIn(d), 'junction');
      // 到了“停不下来”的位置就立即占用路口（同一帧里后处理的车会看到），保证另一方还来得及停
      else if (d < (c.v * c.v) / (2 * BRAKE * 0.6) + 1.5) claim(j.id, c);
      break;
    }
    // 斑马线：有行人就停
    for (const cw of turning ? [] : l.crossings) {
      if (front > cw.tIn) continue;
      const d = cw.tIn - 1.2 - front;
      if (d > 12) break;
      if (peds.some((p) => inOBB(cw.box, p, 0.9))) lim(stopIn(d), 'crosswalk');
    }
    // 支路尽头：在主路路口的停止线前等待，路口空闲且主路有空档时一次并入（不会停在路口中间）
    let merge: { lane: number; t: number } | null = null;
    if (l.endsIn && !turning) {
      const stopAt = (endJ ? endJ.tIn : l.L - CAR_LEN) - 1.6;
      const options = tr.lanes.filter((m) => m.roadId === l.endsIn).map((m) => ({ lane: m.idx, t: project(m, l.to) }))
        .filter((o) => o.t > TUNNEL + CAR_LEN && o.t < tr.lanes[o.lane].L - TUNNEL - CAR_LEN * 2);
      const pick = options[(c.id + c.seed) % Math.max(1, options.length)];
      // 并入的空档：目标点附近和前方没有车；后方只关心正在驶来的车（红灯前停着排队的车不算）
      const mergeGap = (lane: number, t: number) => !tr.cars.some((o) => !o.hidden && o !== c && o.lane === lane && ((o.t > t - CAR_LEN * 1.2 && o.t < t + CAR_LEN * 1.8) || (o.t > t - CAR_LEN * 4 && o.t <= t - CAR_LEN * 1.2 && o.v > 1)));
      const can = pick && (!endJ || lightFor(tr, endJ.id, l.roadId) === 'green') && mergeGap(pick.lane, pick.t) && areaFree(tr, l.to, 4, c) && !(endJ && blockedByRoad(endJ.id, l.endsIn, c));
      if (can && front >= stopAt - 1.0) merge = pick;
      else lim(stopIn(stopAt - front), 'merge');
    }
    if (turning) lim(4.2, 'turnspeed'); // 转弯减速
    // 前方感应：制动距离内有任何车辆（横穿、转弯、对向占道），提前减速停车
    const look = (c.v * c.v) / (2 * BRAKE * 0.6) + 3;
    for (let d = 0.4; d <= look; d += 0.7) {
      const t = front + d;
      if (t > l.L + 2) break;
      const p = poseAt(tr, c, t).p;
      if (tr.cars.some((o) => o !== c && !o.hidden && o !== leader && inOBB(carBox(tr, o), p, CAR_W / 2 - 0.1))) { lim(stopIn(d - 1.0), 'car-sensor'); break; }
    }
    // 礼让正在转弯的车：它剩下的转弯轨迹会经过我前方，就先停下让它走完
    if (!turning) {
      outer: for (const o of tr.cars) {
        if (o === c || o.hidden || !o.turn || o.t >= o.turn.t0 || o.lane === c.lane) continue;
        // 我已经挡在它的转弯轨迹上（它在等我）：我先走，避免互相等待
        const myBox = carBox(tr, c, 0.6);
        let inItsWay = false;
        for (let k = 0; k <= 8 && !inItsWay; k++) inItsWay = inOBB(myBox, poseAt(tr, o, o.t + ((o.turn.t0 - o.t) * k) / 8 + CAR_LEN / 2).p);
        if (inItsWay) continue;
        for (let k = 0; k <= 8; k++) {
          const q = poseAt(tr, o, o.t + ((o.turn.t0 - o.t) * k) / 8).p;
          for (let d = 0; d <= look + 2; d += 0.8) {
            const p = poseAt(tr, c, front + d).p;
            if (dist(p, q) < CAR_W + 0.3) { lim(stopIn(d - 1.5), 'yield-turn'); break outer; }
          }
        }
      }
    }
    // 行人感应：车头前方（含转弯曲线）任何位置有人 —— 玩家、路人，不论在不在斑马线上 —— 都提前刹停，绝不压过去
    const lookP = (c.v * c.v) / (2 * BRAKE * 0.6) + 4.5;
    for (let d = 0; d <= lookP; d += 0.5) {
      const p = poseAt(tr, c, front + d).p;
      if (peds.some((q) => dist(q, p) < CAR_W / 2 + 0.7)) { lim(stopIn(d - 1.2), 'ped'); break; }
    }
    const target = Math.max(0, vMax);
    const dv = target - c.v;
    c.braking = dv < -0.3 || (c.v < 0.3 && target < 0.3);
    c.v += Math.max(-BRAKE * dt, Math.min(ACCEL * dt, dv));
    if (c.v < 0) c.v = 0;
    const prevT = c.t;
    c.t += c.v * dt;
    if (merge) {
      if (turnInto(tr, perLane, c, merge.lane)) continue;
      // 没有空档：退回停止线前等待
      c.t = prevT; c.v = Math.max(0, Math.min(c.v, stopIn((endJ ? endJ.tIn : l.L - CAR_LEN) - 1.6 - front)));
    }
    // 主路上经过支路路口时，部分车辆拐进支路（支路起点要有空位）
    for (const b of turning ? [] : l.branches) {
      if (prevT < b.t && c.t >= b.t && (c.seed + Math.floor(b.t)) % 3 === 0 && gapFree(tr, perLane, b.lane, 6) && areaFree(tr, tr.lanes[b.lane].from, 6.5, c) && !tr.lanes[b.lane].junctions.some((j) => j.tIn < CAR_LEN && blockedByRoad(j.id, tr.lanes[b.lane].roadId, c))) {
        if (turnInto(tr, perLane, c, b.lane)) break;
      }
    }
    // 驶进隧道：整辆车进入隧道后隐藏，稍后从另一个隧道口驶出
    if (!l.endsIn && !turning && c.t - CAR_LEN / 2 > l.L - TUNNEL + 0.4) {
      c.hidden = true; c.turn = undefined; c.committed.clear();
      const edge = tr.lanes.filter((x) => !x.startsIn && x.idx !== c.lane);
      if (edge.length) c.lane = edge[(c.id * 3 + Math.floor(c.t)) % edge.length].idx;
      c.t = TUNNEL - CAR_LEN / 2 - 0.4;
      const list2 = perLane.get(l.idx); if (list2) list2.splice(list2.indexOf(c), 1);
    }
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

/**
 * 转弯前的“看空档”：沿整条转弯曲线采样，任何其他车辆在接下来约 3.5 秒内可能经过的区域
 * （当前车身 + 前方行驶距离）与曲线重叠，就不转——等下一个空档。
 */
function pathFree(tr: Traffic, c: Car, turn: NonNullable<Car['turn']>, horizon = 3.5): boolean {
  const pts: V2[] = [];
  for (let k = 0; k <= 16; k++) pts.push(bez(turn.p0, turn.c, turn.e, k / 16));
  for (let k = 1; k <= 3; k++) { const d = bezD(turn.p0, turn.c, turn.e, 1); pts.push({ x: turn.e.x + d.x * k * 1.5, z: turn.e.z + d.z * k * 1.5 }); }
  for (const o of tr.cars) {
    if (o === c || o.hidden) continue;
    if (o.lane === c.lane && o.t < c.t) continue; // 跟在自己后面的车会跟着自己，不构成冲突
    const { p, dir } = poseAt(tr, o, o.t);
    const ahead = o.v * horizon + 1;
    const zone = segmentOBB({ x: p.x - (dir.x * CAR_LEN) / 2, z: p.z - (dir.z * CAR_LEN) / 2 }, { x: p.x + dir.x * (CAR_LEN / 2 + ahead), z: p.z + dir.z * (CAR_LEN / 2 + ahead) }, CAR_W);
    if (pts.some((q) => inOBB(zone, q, CAR_W / 2 + 0.5))) return false;
    if (o.turn && o.t < o.turn.t0) {
      // 对方也在转弯：两条曲线不能交叉
      for (let k = 0; k <= 12; k++) { const q = bez(o.turn.p0, o.turn.c, o.turn.e, k / 12); if (pts.some((r) => dist(r, q) < CAR_W + 0.6)) return false; }
    }
  }
  return true;
}

/** 沿曲线拐进另一条车道（保留路口占用，直到车尾离开路口） */
function turnInto(tr: Traffic, perLane: Map<number, Car[]>, c: Car, lane: number): boolean {
  const plan = planTurn(tr, c, lane);
  if (!plan || !pathFree(tr, c, plan.turn)) return false;
  // 出口要有足够空间：目标车道前方排队（慢速 / 停着）的车太近，就不进入路口，免得停在路口中间
  if (tr.cars.some((o) => o !== c && !o.hidden && o.lane === lane && o.t > plan.t0 - CAR_LEN && o.t < plan.t0 + CAR_LEN * 2.5 + MIN_GAP && o.v < 2)) return false;
  const keep = [...c.committed];
  moveTo(perLane, c, lane, plan.t0 - plan.turn.len);
  c.turn = plan.turn;
  for (const j of keep) if (tr.lanes[lane].junctions.some((x) => x.id === j)) c.committed.add(j);
  for (const j of tr.lanes[lane].junctions) if (j.tIn < plan.t0 + CAR_LEN && j.tOut > plan.t0 - plan.turn.len - CAR_LEN) c.committed.add(j.id);
  return true;
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
export function crosswalkBusy(tr: Traffic | null, cw: OBB, reach = CAR_LEN / 2 + 1.2): boolean {
  if (!tr) return false;
  return tr.cars.some((c) => !c.hidden && inOBB(cw, carPos(tr, c), reach) && (c.v > 0.3 || inOBB(cw, carPos(tr, c), CAR_LEN / 2 + 0.3)));
}

/** 当前街区的交通实例（场景与玩家控制器共享） */
export const trafficRuntime: { tr: Traffic | null; peds: Map<string, V2> } = { tr: null, peds: new Map() };
