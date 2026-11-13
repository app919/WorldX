/**
 * 服务中心的业务规则（纯逻辑，可单测）：
 * - P1-5 创业服务市场：按类别比价（同名套餐取最低价）、认证优先；预约咨询需选时间段；
 * - P1-6 信用与保障：实名认证 / 企业认证（统一社会信用代码校验）、案例审核、投诉与申诉；信用分由认证 + 成交评价 + 已审核案例构成；
 * - P1-8 价格测试：只登记付费意向，用于验证付费路径（PPT：先证明再收费）；
 * - P1-9 运营看板：按 PPT 的试运营 KPI 与核心看板指标计算；
 * - P2-10 融资：项目资料页与投资人偏好匹配；
 * - P2-11 论坛：发帖校验（拦截广告 / 违规），成交故事来自已完成的交易。
 */
import { CONTACTS, SERVICE_PROVIDERS, type Contact, type ServiceCat, type ServicePackage, type ServiceProvider } from '../data/center';
import { validUSCC } from './lots';

/** —— 服务市场：同一类别里按套餐名比价 —— */
export interface PriceRow { name: string; offers: { provider: ServiceProvider; pkg: ServicePackage }[]; min: number }
export function priceCompare(cat: ServiceCat): PriceRow[] {
  const rows = new Map<string, PriceRow>();
  for (const p of SERVICE_PROVIDERS.filter((x) => x.cat === cat)) for (const pkg of p.packages) {
    const r = rows.get(pkg.name) ?? { name: pkg.name, offers: [], min: Infinity };
    r.offers.push({ provider: p, pkg });
    r.min = Math.min(r.min, pkg.price);
    rows.set(pkg.name, r);
  }
  for (const r of rows.values()) r.offers.sort((a, b) => Number(b.provider.certified) - Number(a.provider.certified) || a.pkg.price - b.pkg.price);
  return [...rows.values()];
}

export interface Booking { id: string; providerId: string; pkgId?: string; slot: string; topic: string; status: 'pending' | 'confirmed' | 'done'; at: number }
export function validateBooking(b: Partial<Booking>): string[] {
  const e: string[] = [];
  const p = SERVICE_PROVIDERS.find((x) => x.id === b.providerId);
  if (!p) e.push('请选择服务商');
  if (!b.slot || (p && !p.slots.includes(b.slot))) e.push('请选择一个可预约的时间段');
  if (!b.topic || b.topic.trim().length < 4) e.push('请简单写下想咨询的问题（至少 4 个字）');
  return e;
}

/** —— 信用与保障 —— */
export interface Certs { realName?: { name: string; idTail: string; at: number }; company?: { name: string; code: string; at: number } }
export function validateRealName(name: string, idTail: string): string[] {
  const e: string[] = [];
  if (name.trim().length < 2) e.push('请填写真实姓名');
  if (!/^\d{3}[\dXx]$/.test(idTail.trim())) e.push('请填写身份证号后 4 位（演示，不收集完整证件号）');
  return e;
}
export function validateCompany(name: string, code: string): string[] {
  const e: string[] = [];
  if (name.trim().length < 4) e.push('请填写企业全称');
  if (!validUSCC(code)) e.push('统一社会信用代码不正确（18 位，含校验位）');
  return e;
}

export interface CaseItem { id: string; title: string; client: string; proof: string; status: 'reviewing' | 'approved' | 'rejected'; note?: string; at: number }
export function validateCase(c: Partial<CaseItem>): string[] {
  const e: string[] = [];
  if (!c.title || c.title.trim().length < 4) e.push('案例标题至少 4 个字');
  if (!c.client || c.client.trim().length < 2) e.push('请填写客户（可脱敏，如“某咖啡品牌”）');
  if (!c.proof || !/^https?:\/\//.test(c.proof.trim())) e.push('请提供可核验的作品或交付链接（http 开头）');
  if (/刷单|保证金|包过/.test(`${c.title} ${c.client}`)) e.push('内容不合规');
  return e;
}

export type ComplaintKind = 'no_delivery' | 'quality' | 'payment' | 'false_info' | 'rating_appeal';
export const COMPLAINT_LABEL: Record<ComplaintKind, string> = { no_delivery: '未按约交付', quality: '质量不符', payment: '未按约付款', false_info: '虚假宣传 / 虚假需求', rating_appeal: '评价申诉' };
export interface Complaint { id: string; kind: ComplaintKind; target: string; detail: string; status: 'open' | 'processing' | 'resolved'; result?: string; at: number }
export function validateComplaint(c: Partial<Complaint>): string[] {
  const e: string[] = [];
  if (!c.kind) e.push('请选择投诉类型');
  if (!c.target || c.target.trim().length < 2) e.push('请选择或填写对方');
  if (!c.detail || c.detail.trim().length < 10) e.push('请描述经过（至少 10 个字），并保留沟通与交付记录');
  return e;
}

/** 信用分（0–100）：认证、已审核案例、成交评价、投诉 */
export function creditScore(x: { certs: Certs; approvedCases: number; ratings: { stars: number; onTime: boolean }[]; openComplaintsAgainst?: number }): { score: number; parts: { label: string; value: number }[] } {
  const avg = x.ratings.length ? x.ratings.reduce((a, r) => a + r.stars, 0) / x.ratings.length : 0;
  const onTime = x.ratings.length ? x.ratings.filter((r) => r.onTime).length / x.ratings.length : 0;
  const parts = [
    { label: '实名认证', value: x.certs.realName ? 15 : 0 },
    { label: '企业认证', value: x.certs.company ? 10 : 0 },
    { label: '已审核案例', value: Math.min(15, x.approvedCases * 5) },
    { label: '成交评价', value: Math.round(avg * 8) },
    { label: '按时履约', value: Math.round(onTime * 10) },
    { label: '成交单数', value: Math.min(10, x.ratings.length * 2) },
    { label: '未结投诉', value: -10 * (x.openComplaintsAgainst ?? 0) },
  ];
  return { score: Math.max(0, Math.min(100, parts.reduce((a, p) => a + p.value, 0))), parts };
}

/** —— P1-9 运营看板（PPT p.10） —— */
export interface KpiInput {
  users: number; profiles: number; demands: number; connections: number; paid: number;
  demandsWithResponse: number; connectionsEffective: number; deals: number; dealDays: number[]; repeats: number; doneDeals: number; dealAmounts: number[];
}
export const KPI_TARGETS = { users: 500, profiles: 200, demands: 30, connections: 50, paid: 10 } as const;
export function kpis(x: KpiInput) {
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return {
    targets: [
      { key: 'users', label: '有效注册用户', value: x.users, target: KPI_TARGETS.users },
      { key: 'profiles', label: '完成商业主页', value: x.profiles, target: KPI_TARGETS.profiles },
      { key: 'demands', label: '真实企业需求', value: x.demands, target: KPI_TARGETS.demands },
      { key: 'connections', label: '有效商业对接', value: x.connections, target: KPI_TARGETS.connections },
      { key: 'paid', label: '付费交易 / 服务', value: x.paid, target: KPI_TARGETS.paid },
    ],
    board: [
      { label: '需求响应率', value: `${pct(x.demandsWithResponse, x.demands)}%`, hint: '有至少一份投标 / 接单的需求占比' },
      { label: '有效对接率', value: `${pct(x.connectionsEffective, x.connections)}%`, hint: '双方确认有沟通意愿的对接占比' },
      { label: '成交转化率', value: `${pct(x.deals, x.demands)}%`, hint: '成交的需求占全部需求' },
      { label: '平均撮合周期', value: x.dealDays.length ? `${(x.dealDays.reduce((a, b) => a + b, 0) / x.dealDays.length).toFixed(1)} 天` : '—', hint: '发布到成交的平均天数' },
      { label: '复购率', value: `${pct(x.repeats, x.doneDeals)}%`, hint: '完成后再次合作的占比' },
      { label: '单笔服务收入', value: x.dealAmounts.length ? `¥${Math.round(x.dealAmounts.reduce((a, b) => a + b, 0) / x.dealAmounts.length)}` : '—', hint: '成交金额的平均值（双方结算，平台不代收）' },
    ],
  };
}

/** —— P2-10 融资：项目资料页与投资人匹配 —— */
export interface ProjectPage { name: string; industry: string; stage: 'idea' | 'mvp' | 'revenue'; traction: string; ask: number; use: string; deck: string }
export const STAGE_LABEL = { idea: '想法 / 原型', mvp: '已有产品，验证中', revenue: '已有稳定收入' } as const;
export function validateProject(p: Partial<ProjectPage>): string[] {
  const e: string[] = [];
  if (!p.name || p.name.trim().length < 2) e.push('请填写项目名称');
  if (!p.industry) e.push('请选择行业');
  if (!p.stage) e.push('请选择阶段');
  if (!p.traction || p.traction.trim().length < 6) e.push('请写下客户验证 / 数据（PPT：路演面向已有产品与客户验证的项目）');
  if (!p.ask || p.ask <= 0) e.push('请填写融资金额（万元）');
  if (!p.use || p.use.trim().length < 4) e.push('请写明资金用途');
  return e;
}
export function matchInvestors(p: ProjectPage): { c: Contact; score: number; reason: string }[] {
  return CONTACTS.filter((c) => c.kind === 'investor').map((c) => {
    const ind = c.industries.includes(p.industry), st = !!c.stages?.includes(p.stage);
    const score = (ind ? 55 : 0) + (st ? 35 : 0) + (p.traction.length > 20 ? 5 : 0);
    const reason = [ind ? '关注你的行业' : '行业不完全匹配', st ? `投资阶段匹配（${STAGE_LABEL[p.stage]}）` : '阶段不太匹配', c.ticket ? `单笔 ${c.ticket}` : ''].filter(Boolean).join('；');
    return { c, score, reason };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}

/** —— P2-11 论坛发帖 —— */
export function validatePost(p: { title?: string; body?: string; cat?: string; group?: string }): string[] {
  const e: string[] = [];
  if (!p.title || p.title.trim().length < 6) e.push('标题至少 6 个字');
  if (!p.body || p.body.trim().length < 20) e.push('正文至少 20 个字，分享真实经验');
  if (!p.cat) e.push('请选择分类');
  if (!p.group) e.push('请选择小组');
  if (/加微信|私信领取|刷单|日赚|保证金|返利/.test(`${p.title} ${p.body}`)) e.push('内容疑似广告或违规（加微信、私信领取、日赚、返利等）');
  return e;
}
