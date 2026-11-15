/**
 * 城市与街区：上海（武康大楼 / 洋泾 / 甜爱路及四川北路）、北京、深圳、长沙、成都。
 * 每个城市一到多个街区，街区规则与武康大楼一致（真实路名与公园名、60% OPC 招租 / 40% 黄金位、10%【例】）。
 */
import type { DistrictKey } from './commerce';
import type { CityId } from './weather';

export interface City { id: CityId; name: string; tz: string; districts: DistrictKey[]; blurb: string }

export const CITIES: City[] = [
  { id: 'shanghai', name: '上海', tz: 'Asia/Shanghai', districts: ['wukang', 'yangjing', 'sichuan_n'], blurb: '梧桐、石库门、浦东社区' },
];

export const cityOfDistrict = (d: DistrictKey): City => CITIES.find((c) => c.districts.includes(d)) ?? CITIES[0];
export const cityById = (id: CityId): City => CITIES.find((c) => c.id === id) ?? CITIES[0];
