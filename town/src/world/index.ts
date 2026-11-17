import type { DistrictKey } from '../domain/commerce';
import { WUKANG } from './districts/wukang';
import { YANGJING } from './districts/yangjing';
import { SICHUAN } from './districts/sichuan';
import { NANLUO } from './districts/nanluo';
import { HUAQIANG } from './districts/huaqiang';
import { WUYI } from './districts/wuyi';
import { CHUNXI } from './districts/chunxi';
import { compileDistrict, type CompiledDistrict } from './build';
import { NavGrid } from './nav';
import type { DistrictDef } from './types';

export const DISTRICTS: Record<DistrictKey, DistrictDef> = { wukang: WUKANG, yangjing: YANGJING, sichuan_n: SICHUAN, nanluo: NANLUO, huaqiang: HUAQIANG, wuyi: WUYI, chunxi: CHUNXI };
/** 所有街区（上海三个 + 北京、深圳、长沙、成都各一个） */
export const DISTRICT_ORDER: DistrictKey[] = ['wukang', 'yangjing', 'sichuan_n', 'nanluo', 'huaqiang', 'wuyi', 'chunxi'];

const compiled = new Map<DistrictKey, CompiledDistrict>();
const navs = new Map<DistrictKey, NavGrid>();

export function compiledOf(id: DistrictKey): CompiledDistrict {
  if (!compiled.has(id)) compiled.set(id, compileDistrict(DISTRICTS[id]));
  return compiled.get(id)!;
}
export function navOf(id: DistrictKey): NavGrid {
  if (!navs.has(id)) navs.set(id, new NavGrid(compiledOf(id)));
  return navs.get(id)!;
}

type LotRef = { district: DistrictKey; door: ReturnType<typeof compiledOf>['doors'][number]; street: string };
const lotsCache = new Map<DistrictKey, LotRef[]>();
/** 某个街区的铺位（只编译这一个街区，启动更快） */
export function lotsOf(d: DistrictKey): LotRef[] {
  if (!lotsCache.has(d)) lotsCache.set(d, compiledOf(d).doors.filter((x) => x.lotId).map((x) => ({ district: d, door: x, street: streetOfDoor(d, x.p) })));
  return lotsCache.get(d)!;
}

/** 所有铺位（会编译全部街区，只在确实需要全城数据时用） */
export function allLots() {
  return DISTRICT_ORDER.flatMap((d) => lotsOf(d));
}

/** 铺位编号前缀 → 街区（不用编译全城就能定位） */
const LOT_PREFIX: [string, DistrictKey][] = [['wk_', 'wukang'], ['yj_', 'yangjing'], ['sc_', 'sichuan_n'], ...DISTRICT_ORDER.map((d) => [`${d}_`, d] as [string, DistrictKey])];
export function districtOfLot(lotId: string): DistrictKey | undefined {
  return LOT_PREFIX.filter(([p]) => lotId.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0]?.[1];
}

export function lotById(lotId: string) {
  const d = districtOfLot(lotId);
  return (d ? lotsOf(d) : allLots()).find((l) => l.door.lotId === lotId) ?? (d ? allLots().find((l) => l.door.lotId === lotId) : undefined);
}

export function streetOfDoor(d: DistrictKey, p: { x: number; z: number }): string {
  const def = DISTRICTS[d];
  let best = { name: def.roads[0].name, dd: Infinity };
  for (const r of def.roads) {
    const dx = r.b.x - r.a.x, dz = r.b.z - r.a.z;
    const t = Math.max(0, Math.min(1, ((p.x - r.a.x) * dx + (p.z - r.a.z) * dz) / (dx * dx + dz * dz)));
    const dd = Math.hypot(p.x - r.a.x - t * dx, p.z - r.a.z - t * dz);
    if (dd < best.dd) best = { name: r.name, dd };
  }
  return best.name;
}

export const districtName = (d: DistrictKey) => DISTRICTS[d].name;
