/**
 * 随便逛逛（城市漫步）：从身边出发，串起附近值得看的 5 个地方（地标、【例】示范店、公园、正在进行的活动），
 * 按顺路的顺序一站一站走过去；每到一站停下来面向它，弹出讲解卡，几秒后自动去下一站。
 * 路线规划是纯函数（planStroll），可单测；行走与停留由 StrollDriver（ui/Stroll.tsx）驱动。
 */
import { create } from 'zustand';
import type { DistrictKey } from '../domain/commerce';
import { compiledOf, navOf } from '../world';
import { lotPlan, exampleAtLot } from '../domain/lots';
import { archiveById } from '../data/archives';
import { LIVE_EVENTS } from '../domain/buzz';
import { dist, type V2 } from '../world/geom';

export type StopKind = 'landmark' | 'example' | 'park' | 'event';
export interface StrollStop {
  id: string;
  kind: StopKind;
  title: string;
  blurb: string;
  /** 站着看的位置（人行道上，不踩进门口触发点） */
  at: V2;
  /** 要面向的位置 */
  look: V2;
  lotId?: string;
  eventId?: string;
  archiveId?: string;
}
export const STOP_ICON: Record<StopKind, string> = { landmark: '🏛️', example: '🩷', park: '🌳', event: '🎪' };

/** 规划一条漫步路线：候选点按“离我近 + 类型多样”挑 count 个，再按最近邻排成顺路的顺序 */
export function planStroll(district: DistrictKey, from: V2, count = 5, seed = 1): StrollStop[] {
  const cd = compiledOf(district);
  const nav = navOf(district);
  const cands: StrollStop[] = [];
  const standAt = (p: V2, out: V2, k = 2.4) => nav.nearestWalkable({ x: p.x + out.x * k, z: p.z + out.z * k }, 4);
  // 地标（有档案的建筑）
  for (const b of cd.def.buildings) {
    if (!b.archiveId) continue;
    const a = archiveById(b.archiveId);
    const door = cd.doors.find((d) => d.buildingId === b.id);
    const c = b.polygon ? b.polygon[Math.floor(b.polygon.length / 2)] : { x: b.box!.cx, z: b.box!.cz };
    const at = door ? standAt(door.trigger, door.out, 3) : nav.nearestWalkable(c, 10);
    if (!at) continue;
    cands.push({ id: `lm_${b.id}`, kind: 'landmark', title: a?.name ?? b.name ?? '地标建筑', blurb: a ? `${a.era} · ${a.style}。${a.story.slice(0, 60)}${a.story.length > 60 ? '…' : ''}` : '街区里的地标建筑。', at, look: c, archiveId: b.archiveId });
  }
  // 【例】示范店
  for (const lotId of lotPlan(district).examples) {
    const door = cd.doors.find((d) => d.lotId === lotId);
    const ex = exampleAtLot(lotId);
    if (!door || !ex) continue;
    const at = standAt(door.trigger, door.out);
    if (!at) continue;
    cands.push({ id: `ex_${lotId}`, kind: 'example', title: `【例】${ex.name}`, blurb: `${ex.direction} · ${ex.tagline}`, at, look: door.p, lotId });
  }
  // 公园
  for (const pk of cd.parks) {
    const e = pk.entrances[0];
    const at = e ? standAt(e.p, e.out, 1.5) : nav.nearestWalkable({ x: pk.box.cx, z: pk.box.cz }, 10);
    if (!at) continue;
    cands.push({ id: `pk_${pk.id}`, kind: 'park', title: pk.label, blurb: '进去走走，坐一会儿还能恢复体力。', at, look: { x: pk.box.cx, z: pk.box.cz } });
  }
  // 正在进行的活动
  for (const ev of LIVE_EVENTS.filter((x) => x.district === district)) {
    const p = { x: cd.def.spawn.x + ev.offset.x, z: cd.def.spawn.z + ev.offset.z };
    const at = nav.nearestWalkable({ x: p.x + 3, z: p.z + 3 }, 12);
    if (!at) continue;
    cands.push({ id: `ev_${ev.id}`, kind: 'event', title: `${ev.kind}：${ev.title}`, blurb: `${ev.host} 主办 · 已报名 ${ev.signed}/${ev.capacity}，点「进去看看」可以围观、发弹幕、报名。`, at, look: p, eventId: ev.id });
  }
  // 挑选：每种类型轮流取最近的，保证路线有变化；同一位置附近（< 6 米）只留一个
  const byKind = new Map<StopKind, StrollStop[]>();
  for (const c of cands) (byKind.get(c.kind) ?? byKind.set(c.kind, []).get(c.kind)!).push(c);
  for (const list of byKind.values()) list.sort((a, b) => dist(a.at, from) - dist(b.at, from));
  const order: StopKind[] = (['landmark', 'event', 'example', 'park'] as StopKind[]).filter((k) => byKind.has(k));
  const picked: StrollStop[] = [];
  for (let round = 0; picked.length < count && round < 20; round++) {
    for (let i = 0; i < order.length && picked.length < count; i++) {
      const k = order[(i + round + seed) % order.length];
      const next = byKind.get(k)!.find((c) => !picked.includes(c) && picked.every((p) => dist(p.at, c.at) > 6) && dist(c.at, from) > 4);
      if (next) picked.push(next);
    }
    if (order.every((k) => !byKind.get(k)!.some((c) => !picked.includes(c)))) break;
  }
  // 最近邻排序：顺路走，不来回折返
  const route: StrollStop[] = [];
  let cur = from;
  const rest = [...picked];
  while (rest.length) {
    rest.sort((a, b) => dist(a.at, cur) - dist(b.at, cur));
    const n = rest.shift()!;
    route.push(n); cur = n.at;
  }
  return route;
}

interface StrollState {
  active: boolean;
  stops: StrollStop[];
  i: number;
  phase: 'walking' | 'pause';
  /** 停留到这个时间点后自动去下一站 */
  until: number;
  start(stops: StrollStop[]): void;
  arrive(): void;
  next(): void;
  stop(): void;
}

export const PAUSE_MS = 8000;

export const useStroll = create<StrollState>()((set, get) => ({
  active: false, stops: [], i: 0, phase: 'walking', until: 0,
  start: (stops) => set({ active: stops.length > 0, stops, i: 0, phase: 'walking', until: 0 }),
  arrive: () => set({ phase: 'pause', until: performance.now() + PAUSE_MS }),
  next: () => { const s = get(); if (s.i + 1 >= s.stops.length) set({ active: false }); else set({ i: s.i + 1, phase: 'walking', until: 0 }); },
  stop: () => set({ active: false }),
}));
