/**
 * 铺位规则（纯逻辑，可单测）：
 *
 * - 每个街区的铺位：60% 是 OPC 招租位（无论有没有营业执照都可以开店），40% 是「黄金位」，留给赞助商付资金赞助；
 *   黄金位按“离街区入口近 + 在主街上 + 靠近路口”挑选，已有店铺的铺位不会被划成黄金位；
 * - 每个人只能开一家店：店主「姓名」和「手机号」都是唯一的（同一手机号、同一姓名不能重复开店）；
 * - 有营业执照的店铺在招牌和名片上显示「企」角标；执照信息需填写企业名称与 18 位统一社会信用代码（含校验位）。
 */
import { allLots, DISTRICTS } from '../world';
import type { DistrictKey } from './commerce';
import { COUNTERPARTIES, SHOPS } from '../data/seed';
import { dist } from '../world/geom';
import { examplesOf, type ExampleOpc } from '../data/examples';

export const GOLDEN_RATIO = 0.4;
/** 每个街区约 10% 的铺位由【例】示范 OPC 预设占用（从 OPC 招租位里选，不占黄金位） */
export const EXAMPLE_RATIO = 0.1;

export interface LotPlan { total: number; golden: string[]; opc: string[]; /** 【例】示范店占用的铺位（与 examplesOf(d) 一一对应） */ examples: string[] }
const cache = new Map<string, LotPlan>();

/** 已被演示店铺 / 主体占用的铺位 */
const baseTaken = () => new Set([...SHOPS.map((x) => x.lotId), ...COUNTERPARTIES.map((c) => c.place.lotId).filter(Boolean) as string[]]);
/** 已被演示店铺 / 主体 /【例】示范店占用的铺位（不能再开店） */
export const takenByDemo = () => new Set([...baseTaken(), ...(['wukang', 'yangjing', 'sichuan_n'] as DistrictKey[]).flatMap((d) => lotPlan(d).examples)]);

export function lotPlan(d: DistrictKey): LotPlan {
  const hit = cache.get(d);
  if (hit) return hit;
  const def = DISTRICTS[d];
  const lots = allLots().filter((l) => l.district === d);
  const taken = baseTaken();
  const main = def.roads[0].name;
  const score = (l: (typeof lots)[number]) => dist(l.door.p, def.spawn) - (l.street === main ? 30 : 0);
  const n = Math.round(lots.length * GOLDEN_RATIO);
  const golden = lots.filter((l) => !taken.has(l.door.lotId!)).sort((a, b) => score(a) - score(b)).slice(0, n).map((l) => l.door.lotId!);
  const g = new Set(golden);
  // 【例】：离入口较近、未被占用的招租位里隔一个取一个，既容易被看到，又不扎堆
  const exs = examplesOf(d);
  const ne = Math.min(exs.length, Math.round(lots.length * EXAMPLE_RATIO));
  const free = lots.filter((l) => !g.has(l.door.lotId!) && !taken.has(l.door.lotId!)).sort((a, b) => dist(a.door.p, def.spawn) - dist(b.door.p, def.spawn));
  const step = free.length >= ne * 2 ? 2 : 1;
  const examples = Array.from({ length: ne }, (_, i) => free[i * step]?.door.lotId).filter(Boolean) as string[];
  const plan = { total: lots.length, golden, opc: lots.filter((l) => !g.has(l.door.lotId!)).map((l) => l.door.lotId!), examples };
  cache.set(d, plan);
  return plan;
}

const DKEYS: DistrictKey[] = ['wukang', 'yangjing', 'sichuan_n'];
/** 这个铺位上的【例】示范店（没有则 undefined） */
export function exampleAtLot(lotId: string): ExampleOpc | undefined {
  for (const d of DKEYS) { const i = lotPlan(d).examples.indexOf(lotId); if (i >= 0) return examplesOf(d)[i]; }
  return undefined;
}
/** 示范店所在铺位 */
export function lotOfExample(id: string): string | undefined {
  for (const d of DKEYS) { const i = examplesOf(d).findIndex((e) => e.id === id); if (i >= 0) return lotPlan(d).examples[i]; }
  return undefined;
}

export const isGolden = (lotId: string) => (['wukang', 'yangjing', 'sichuan_n'] as DistrictKey[]).some((d) => lotPlan(d).golden.includes(lotId));

/** —— 赞助商 —— */
export interface SponsorTier { id: 'season' | 'year'; name: string; price: number; months: number; perks: string[] }
export const SPONSOR_TIERS: SponsorTier[] = [
  { id: 'season', name: '季度赞助', price: 30000, months: 3, perks: ['黄金位店铺与招牌', '街区地图 / 小地图标注', '赞助一场社区活动'] },
  { id: 'year', name: '年度赞助', price: 100000, months: 12, perks: ['黄金位店铺与招牌', '街区地图 / 小地图标注', '每季度冠名一场活动', '产业链对应环节服务商展位优先候补'] },
];
export interface Sponsor { lotId: string; name: string; tier: SponsorTier['id']; until: number; demo?: boolean; mine?: boolean; status: 'live' | 'reviewing' | 'awaiting_payment' }

/** 演示：每个街区已有 2 个黄金位被（虚构）赞助商占用 */
export function demoSponsors(now: number): Sponsor[] {
  const names: Record<DistrictKey, string[]> = {
    wukang: ['梧桐银行社区网点（虚构）', '衡山路咖啡烘焙集团（虚构）'],
    yangjing: ['浦江生活超市（虚构）', '洋泾社区健康驿站（虚构）'],
    sichuan_n: ['北外滩文旅集团（虚构）', '虹口书局（虚构）'],
  };
  return (Object.keys(names) as DistrictKey[]).flatMap((d) => names[d].map((name, i) => ({ lotId: lotPlan(d).golden[i], name, tier: i ? 'season' as const : 'year' as const, until: now + (i ? 60 : 200) * 86400000, demo: true, status: 'live' as const })));
}

/** —— 营业执照：统一社会信用代码（GB 32100-2015）校验 —— */
const USCC_CHARS = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const USCC_W = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
export function usccCheckChar(first17: string): string {
  const sum = first17.split('').reduce((a, ch, i) => a + USCC_CHARS.indexOf(ch) * USCC_W[i], 0);
  const c = 31 - (sum % 31);
  return USCC_CHARS[c === 31 ? 0 : c];
}
export function validUSCC(code: string): boolean {
  const s = code.trim().toUpperCase();
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(s)) return false;
  if (s.slice(0, 17).split('').some((ch) => USCC_CHARS.indexOf(ch) < 0)) return false;
  return usccCheckChar(s.slice(0, 17)) === s[17];
}

/** —— 店主身份：姓名 + 手机号唯一 —— */
export interface Owner { name: string; phone: string }
export const validPhone = (p: string) => /^1[3-9]\d{9}$/.test(p.trim());
export const maskPhone = (p: string) => p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
/** 演示：已开店的店主（虚构） */
export const DEMO_OWNERS: Owner[] = [
  { name: '林小满', phone: '13800000001' }, { name: '王阿强', phone: '13800000002' }, { name: '周一帆', phone: '13800000003' },
  { name: '张建国', phone: '13800000004' }, { name: '林慧', phone: '13800000005' }, { name: '陈阿婆', phone: '13800000006' },
  { name: '田小甜', phone: '13800000007' }, { name: '杰哥', phone: '13800000008' }, { name: '书怡', phone: '13800000009' },
];

export function checkOwner(o: Owner, registry: Owner[]): string[] {
  const err: string[] = [];
  const name = o.name.trim(), phone = o.phone.trim();
  if (name.length < 2) err.push('请填写店主真实姓名');
  if (!validPhone(phone)) err.push('请填写 11 位手机号');
  if (registry.some((r) => r.phone === phone)) err.push('这个手机号已经开过店了（每人只能开一家店）');
  if (registry.some((r) => r.name === name)) err.push('这个姓名已经登记过店铺（每人只能开一家店）');
  return err;
}
