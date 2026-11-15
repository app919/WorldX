/**
 * 城市与街区：上海（武康大楼 / 洋泾 / 甜爱路及四川北路）、北京、深圳、长沙、成都。
 * 每个城市一到多个街区，街区规则与武康大楼一致（真实路名与公园名、60% OPC 招租 / 40% 黄金位、10%【例】）。
 */
import type { DistrictKey } from './commerce';
import type { CityId } from './weather';

export interface City { id: CityId; name: string; tz: string; districts: DistrictKey[]; blurb: string }

export const CITIES: City[] = [
  { id: 'shanghai', name: '上海', tz: 'Asia/Shanghai', districts: ['wukang', 'yangjing', 'sichuan_n'], blurb: '梧桐、石库门、浦东社区' },
  { id: 'beijing', name: '北京', tz: 'Asia/Shanghai', districts: ['nanluo'], blurb: '胡同、四合院、戏剧与文创' },
  { id: 'shenzhen', name: '深圳', tz: 'Asia/Shanghai', districts: ['huaqiang'], blurb: '华强北：硬件、电子、跨境出海' },
  { id: 'changsha', name: '长沙', tz: 'Asia/Shanghai', districts: ['wuyi'], blurb: '五一商圈：茶饮、直播、夜经济' },
  { id: 'chengdu', name: '成都', tz: 'Asia/Shanghai', districts: ['chunxi'], blurb: '春熙路与太古里：潮流、设计、游戏' },
];

export const cityOfDistrict = (d: DistrictKey): City => CITIES.find((c) => c.districts.includes(d)) ?? CITIES[0];
export const cityById = (id: CityId): City => CITIES.find((c) => c.id === id) ?? CITIES[0];
