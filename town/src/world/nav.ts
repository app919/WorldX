/**
 * 步行导航网格（Navigation Grid）+ 碰撞查询。
 *
 * 三层分工：
 *   1. 导航（本文件）：决定角色可以走哪里 —— 只有人行道、斑马线、广场、门前通道是可步行区域；
 *      机动车道、建筑、绿化、围墙一律不可步行。
 *   2. 碰撞（本文件 blocked/slide）：决定角色不能穿过什么 —— 建筑、树池、路灯、消防栓、花箱、长椅、单车……
 *   3. 动画（scene/Chibi）：决定角色怎么走、跑、碰撞后软软回弹。
 */
import { dist, inOBB, inPolygon, obbCorners, type OBB, type V2 } from './geom';
import { buildingContains, type CompiledDistrict } from './build';

export const enum Zone { Blocked = 0, Walk = 1, Crosswalk = 2, Road = 3, Building = 4, Obstacle = 5, Green = 6 }

export const ZONE_LABEL: Record<number, string> = {
  0: '不可通行', 1: '人行道', 2: '斑马线', 3: '机动车道', 4: '建筑', 5: '障碍物', 6: '绿化',
};

export class NavGrid {
  readonly cell = 0.35;
  readonly minX: number; readonly minZ: number; readonly w: number; readonly h: number;
  readonly zone: Uint8Array;
  /** 腐蚀后的可步行网格（考虑角色半径） */
  readonly walk: Uint8Array;

  constructor(readonly cd: CompiledDistrict) {
    const b = cd.def.bounds;
    this.minX = b.minX; this.minZ = b.minZ;
    this.w = Math.ceil((b.maxX - b.minX) / this.cell);
    this.h = Math.ceil((b.maxZ - b.minZ) / this.cell);
    this.zone = new Uint8Array(this.w * this.h).fill(Zone.Green);
    // 按优先级从低到高“绘制”：绿化 → 人行道/广场/门前通道 → 机动车道 → 斑马线 → 障碍物 → 建筑
    const paint = (test: (p: V2) => boolean, bb: { x0: number; x1: number; z0: number; z1: number }, z: Zone) => {
      const i0 = Math.max(0, Math.floor((bb.x0 - this.minX) / this.cell)), i1 = Math.min(this.w - 1, Math.ceil((bb.x1 - this.minX) / this.cell));
      const j0 = Math.max(0, Math.floor((bb.z0 - this.minZ) / this.cell)), j1 = Math.min(this.h - 1, Math.ceil((bb.z1 - this.minZ) / this.cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (test({ x: this.minX + (i + 0.5) * this.cell, z: this.minZ + (j + 0.5) * this.cell })) this.zone[j * this.w + i] = z;
      }
    };
    const bbOf = (pts: V2[], pad = 0) => ({ x0: Math.min(...pts.map((p) => p.x)) - pad, x1: Math.max(...pts.map((p) => p.x)) + pad, z0: Math.min(...pts.map((p) => p.z)) - pad, z1: Math.max(...pts.map((p) => p.z)) + pad });
    const obb = (o: OBB, z: Zone) => paint((p) => inOBB(o, p), bbOf(obbCorners(o)), z);
    cd.sidewalks.forEach((x) => obb(x.box, Zone.Walk));
    cd.def.areas.filter((a) => a.kind === 'plaza' && a.box).forEach((a) => obb(a.box!, Zone.Walk));
    cd.paths.forEach((o) => obb(o, Zone.Walk));
    cd.carriages.forEach((x) => obb(x.box, Zone.Road));
    cd.crosswalks.forEach((x) => obb(x.box, Zone.Crosswalk));
    for (const o of cd.obstacles) {
      if (o.p && o.r) { const p0 = o.p, r = o.r; paint((p) => dist(p0, p) < r, { x0: p0.x - r, x1: p0.x + r, z0: p0.z - r, z1: p0.z + r }, Zone.Obstacle); }
      if (o.box) obb(o.box, Zone.Obstacle);
    }
    for (const b of cd.def.buildings) {
      if (b.polygon) paint((p) => inPolygon(b.polygon!, p), bbOf(b.polygon), Zone.Building);
      else obb(b.box!, Zone.Building);
    }
    // 角色半径约 0.35：一个格子的腐蚀
    this.walk = new Uint8Array(this.w * this.h);
    for (let j = 1; j < this.h - 1; j++) for (let i = 1; i < this.w - 1; i++) {
      let ok = 1;
      for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) {
        const z = this.zone[(j + dj) * this.w + i + di];
        if (z !== Zone.Walk && z !== Zone.Crosswalk) { ok = 0; break; }
      }
      this.walk[j * this.w + i] = ok;
    }
    // 填掉“死胡同”小格：三面被挡住的一格宽缝隙（路缘、树池、路灯之间）——人走进去会被困住
    for (let pass = 0; pass < 4; pass++) {
      let changed = 0;
      for (let j = 1; j < this.h - 1; j++) for (let i = 1; i < this.w - 1; i++) {
        const k = j * this.w + i;
        if (!this.walk[k]) continue;
        const open = this.walk[k - 1] + this.walk[k + 1] + this.walk[k - this.w] + this.walk[k + this.w];
        if (open <= 1) { this.walk[k] = 0; changed++; }
      }
      if (!changed) break;
    }
  }

  idx(p: V2) {
    const i = Math.floor((p.x - this.minX) / this.cell), j = Math.floor((p.z - this.minZ) / this.cell);
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i;
  }
  zoneAt(p: V2): Zone { const k = this.idx(p); return k < 0 ? Zone.Blocked : this.zone[k]; }
  walkable(p: V2): boolean { const k = this.idx(p); return k >= 0 && this.walk[k] === 1; }

  /**
   * 尝试移动：被挡住时自动绕开障碍（树、路灯、单车、花箱……），不会卡住。
   * 绕行方法：在身边约 8 米的小范围里做一次局部寻路，找一条通往“前方”的路线并沿着走；
   * memo 记住这条绕行路线，直到绕过去为止（不会左右来回抖动）。
   */
  move(from: V2, to: V2, memo?: { side: number; path?: V2[]; ttl?: number }): { p: V2; hit: boolean } {
    const step = dist(from, to);
    // 正在沿绕行路线走
    if (memo?.path?.length && (memo.ttl ?? 0) > 0) {
      memo.ttl!--;
      while (memo.path.length && dist(memo.path[0], from) < Math.max(0.12, step * 0.6)) memo.path.shift();
      const wp = memo.path[0];
      if (wp) {
        const d = dist(from, wp), k = Math.min(1, step / (d || 1));
        const q = { x: from.x + (wp.x - from.x) * k, z: from.z + (wp.z - from.z) * k };
        if (this.walkable(q)) return { p: q, hit: true };
      }
      memo.path = undefined;
    }
    if (this.walkable(to)) { if (memo) memo.path = undefined; return { p: to, hit: false }; }
    // 自己已经站在不可走的位置（例如传送后）：先朝最近的可走点挪出来，不会被困住
    if (!this.walkable(from)) {
      const near = this.nearestWalkable(from, 3);
      if (near) { const d = dist(from, near), st = Math.max(step, 0.05); return { p: d <= st ? near : { x: from.x + ((near.x - from.x) / d) * st, z: from.z + ((near.z - from.z) / d) * st }, hit: false }; }
    }
    const ux = (to.x - from.x) / (step || 1), uz = (to.z - from.z) / (step || 1);
    // 小角度偏转就能过去的（擦着障碍边缘），直接走
    for (const a of [0.3, -0.3, 0.6, -0.6]) {
      const c = Math.cos(a), sn = Math.sin(a);
      const q = { x: from.x + (ux * c - uz * sn) * step, z: from.z + (ux * sn + uz * c) * step };
      if (this.walkable(q)) return { p: q, hit: true };
    }
    // 局部寻路绕过去：目标是前方 2.5–4 米处的可走点
    for (const ahead of [2.5, 4, 1.6]) {
      const goal = this.nearestWalkable({ x: from.x + ux * ahead, z: from.z + uz * ahead }, 1.2);
      if (!goal || dist(goal, from) < 0.5) continue;
      const path = this.localPath(from, goal, 24);
      if (path && path.length > 1) {
        if (memo) { memo.path = path.slice(1); memo.ttl = 90; }
        const wp = path[1], d = dist(from, wp), k = Math.min(1, step / (d || 1));
        const q = { x: from.x + (wp.x - from.x) * k, z: from.z + (wp.z - from.z) * k };
        if (this.walkable(q)) return { p: q, hit: true };
      }
    }
    const sx = { x: to.x, z: from.z };
    if (this.walkable(sx)) return { p: sx, hit: true };
    const sz = { x: from.x, z: to.z };
    if (this.walkable(sz)) return { p: sz, hit: true };
    return { p: from, hit: true };
  }

  /** 局部 A*：只在起点周围 (2R+1)² 个格子里搜索，开销很小 */
  localPath(from: V2, goal: V2, R = 24): V2[] | null {
    const ci = Math.floor((from.x - this.minX) / this.cell), cj = Math.floor((from.z - this.minZ) / this.cell);
    const gi = Math.floor((goal.x - this.minX) / this.cell), gj = Math.floor((goal.z - this.minZ) / this.cell);
    if (Math.abs(gi - ci) > R || Math.abs(gj - cj) > R) return null;
    const W = 2 * R + 1, N = W * W;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const id = (i: number, j: number) => (j - cj + R) * W + (i - ci + R);
    const ok = (i: number, j: number) => Math.abs(i - ci) <= R && Math.abs(j - cj) <= R && i >= 0 && j >= 0 && i < this.w && j < this.h && this.walk[j * this.w + i] === 1;
    const open: [number, number, number][] = [];
    const h = (i: number, j: number) => Math.hypot(i - gi, j - gj);
    const S = id(ci, cj), G = id(gi, gj);
    g[S] = 0; open.push([h(ci, cj), ci, cj]);
    let found = false;
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, i, j] = open.splice(bi, 1)[0];
      const k0 = id(i, j);
      if (closed[k0]) continue;
      closed[k0] = 1;
      if (k0 === G) { found = true; break; }
      for (const [di, dj, c] of NB) {
        const ni = i + di, nj = j + dj;
        if (!ok(ni, nj) || (di && dj && (!ok(i + di, j) || !ok(i, j + dj)))) continue;
        const nk = id(ni, nj);
        if (closed[nk]) continue;
        const ng = g[k0] + c;
        if (ng < g[nk]) { g[nk] = ng; came[nk] = k0; open.push([ng + h(ni, nj), ni, nj]); }
      }
    }
    if (!found) return null;
    const out: V2[] = [];
    for (let k = G; k !== -1; k = came[k]) {
      const li = (k % W) - R + ci, lj = Math.floor(k / W) - R + cj;
      out.push({ x: this.minX + (li + 0.5) * this.cell, z: this.minZ + (lj + 0.5) * this.cell });
    }
    out.reverse();
    out[0] = from;
    return out;
  }

  nearestWalkable(p: V2, maxR = 12): V2 | null {
    if (this.walkable(p)) return p;
    for (let r = this.cell; r <= maxR; r += this.cell) {
      for (let a = 0; a < 24; a++) {
        const q = { x: p.x + Math.cos((a / 24) * Math.PI * 2) * r, z: p.z + Math.sin((a / 24) * Math.PI * 2) * r };
        if (this.walkable(q)) return q;
      }
    }
    return null;
  }

  /** 网格视线检测（用于路径平滑） */
  lineWalkable(a: V2, b: V2): boolean {
    // 采样足够密，并在两侧各留 0.12 的余量，避免平滑后的路径擦着障碍物的角走（会卡住）
    const d = dist(a, b);
    const n = Math.ceil(d / (this.cell * 0.25));
    const ux = (b.x - a.x) / (d || 1), uz = (b.z - a.z) / (d || 1);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      if (!this.walkable({ x, z }) || !this.walkable({ x: x - uz * 0.12, z: z + ux * 0.12 }) || !this.walkable({ x: x + uz * 0.12, z: z - ux * 0.12 })) return false;
    }
    return true;
  }

  /** A* 寻路（8 邻域）。返回平滑后的路径点；无法到达返回 null */
  findPath(from: V2, to: V2): V2[] | null {
    const s0 = this.nearestWalkable(from, 3), g0 = this.nearestWalkable(to, 12);
    if (!s0 || !g0) return null;
    const S = this.idx(s0), G = this.idx(g0);
    const W = this.w, N = this.w * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap: [number, number][] = [];
    const push = (k: number, f: number) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0]; const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top[1];
    };
    const gi = G % W, gj = (G / W) | 0;
    const hfn = (k: number) => { const dx = Math.abs((k % W) - gi), dz = Math.abs(((k / W) | 0) - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    g[S] = 0; push(S, hfn(S));
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false, iter = 0;
    while (heap.length && iter++ < 400000) {
      const k = pop();
      if (k === G) { found = true; break; }
      if (closed[k]) continue; closed[k] = 1;
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj, c] of NB) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const nk = nj * W + ni;
        if (!this.walk[nk] || closed[nk]) continue;
        if (di && dj && (!this.walk[j * W + ni] || !this.walk[nj * W + i])) continue; // 不切角
        const ng = g[k] + c;
        if (ng < g[nk]) { g[nk] = ng; came[nk] = k; push(nk, ng + hfn(nk)); }
      }
    }
    if (!found) return null;
    const raw: V2[] = [];
    for (let k = G; k !== -1; k = came[k]) raw.push({ x: this.minX + ((k % W) + 0.5) * this.cell, z: this.minZ + (((k / W) | 0) + 0.5) * this.cell });
    raw.reverse();
    // 拉绳平滑
    const out: V2[] = [raw[0]];
    let anchor = 0;
    for (let i = 2; i < raw.length; i++) {
      if (!this.lineWalkable(raw[anchor], raw[i])) { out.push(raw[i - 1]); anchor = i - 1; }
    }
    out.push(raw[raw.length - 1]);
    return out;
  }
}

/** 某一点属于什么空间（优先级：建筑 > 障碍 > 斑马线 > 机动车道 > 人行道/广场/门前通道 > 绿化） */
export function classify(cd: CompiledDistrict, p: V2): Zone {
  if (cd.def.buildings.some((b) => buildingContains(b, p))) return Zone.Building;
  for (const o of cd.obstacles) {
    if (o.p && o.r && dist(o.p, p) < o.r) return Zone.Obstacle;
    if (o.box && inOBB(o.box, p)) return Zone.Obstacle;
  }
  if (cd.crosswalks.some((c) => inOBB(c.box, p))) return Zone.Crosswalk;
  if (cd.carriages.some((c) => inOBB(c.box, p))) return Zone.Road;
  if (cd.paths.some((o) => inOBB(o, p))) return Zone.Walk;
  if (cd.sidewalks.some((s) => inOBB(s.box, p))) return Zone.Walk;
  if (cd.def.areas.some((a) => a.kind === 'plaza' && a.box && inOBB(a.box, p))) return Zone.Walk;
  return Zone.Green;
}
