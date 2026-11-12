import type { DistrictKey } from '../domain/commerce';
import { WUKANG } from './districts/wukang';
import { YANGJING } from './districts/yangjing';
import { SICHUAN } from './districts/sichuan';
import { compileDistrict, type CompiledDistrict } from './build';
import { NavGrid } from './nav';
import type { DistrictDef } from './types';

export const DISTRICTS: Record<DistrictKey, DistrictDef> = { wukang: WUKANG, yangjing: YANGJING, sichuan_n: SICHUAN };
export const DISTRICT_ORDER: DistrictKey[] = ['wukang', 'yangjing', 'sichuan_n'];

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

/** 所有铺位（门上绑定了 lotId 的位置） */
export function allLots() {
  return DISTRICT_ORDER.flatMap((d) => compiledOf(d).doors.filter((x) => x.lotId).map((x) => ({ district: d, door: x, street: streetOfDoor(d, x.p) })));
}

export function lotById(lotId: string) {
  return allLots().find((l) => l.door.lotId === lotId);
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
