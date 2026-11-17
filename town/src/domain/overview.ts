/**
 * 地图纵览：某个街区（或全部）有多少 OPC —— 真实用户开的店（蓝字、优先）、演示店铺、【例】示范店、黄金位赞助、空铺；
 * 以及「本周新增」：最近 7 天开的店（只统计真实用户，演示数据没有开店时间）。
 */
import { DISTRICT_ORDER, lotsOf } from '../world';
import { lotPlan, isGolden } from './lots';
import { COUNTERPARTIES, SHOPS } from '../data/seed';
import type { DistrictKey } from './commerce';

export interface RealShop { id: string; lotId: string; name: string; createdAt: number; mine?: boolean }
export interface DistrictOverview {
  district: DistrictKey;
  lots: number;
  real: number;
  demo: number;
  examples: number;
  sponsors: number;
  vacant: number;
  newThisWeek: RealShop[];
}

export const WEEK_MS = 7 * 86400_000;

export function overviewOf(d: DistrictKey, real: RealShop[], sponsorLots: Set<string>, now = Date.now()): DistrictOverview {
  const lots = lotsOf(d).map((l) => l.door.lotId!);
  const set = new Set(lots);
  const plan = lotPlan(d);
  const ex = new Set(plan.examples);
  const realHere = real.filter((r) => set.has(r.lotId));
  const realLots = new Set(realHere.map((r) => r.lotId));
  const demoLots = new Set([...SHOPS.map((s) => s.lotId), ...COUNTERPARTIES.map((c) => c.place.lotId).filter(Boolean) as string[]].filter((l) => set.has(l) && !realLots.has(l) && !ex.has(l)));
  const sponsors = lots.filter((l) => sponsorLots.has(l) && !realLots.has(l)).length;
  const vacant = lots.filter((l) => !realLots.has(l) && !demoLots.has(l) && !ex.has(l) && !sponsorLots.has(l)).length;
  return {
    district: d, lots: lots.length, real: realHere.length, demo: demoLots.size, examples: ex.size, sponsors, vacant,
    newThisWeek: realHere.filter((r) => now - r.createdAt < WEEK_MS).sort((a, b) => b.createdAt - a.createdAt),
  };
}

export function overviewAll(real: RealShop[], sponsorLots: Set<string>, now = Date.now()) {
  return DISTRICT_ORDER.map((d) => overviewOf(d, real, sponsorLots, now));
}

export { isGolden };
