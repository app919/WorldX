/**
 * 需求单的交易链路（纯逻辑，可单测）：
 *   发布 → 审核 → 匹配 → 对接 → 成交 → 履约 → 评价
 *
 * - 匹配：需求发布后，平台按产业链环节与能力标签推荐 3 位供给方（写明理由与信用）；
 * - 比选：投标进入比选表（报价 / 工期 / 信用 / 完成单数 / 是否认证 / 是否联合团队）；
 * - 联合交付：需求可以拆成角色，OPC 发起组队、按角色邀请伙伴、约定分成后联合报价；
 * - 成交：成交确认单（合同主体、金额、交付范围、付款节点），双方本人确认（L3），平台不代收款；
 * - 履约：按付款节点交付与验收；
 * - 评价：双方互评，沉淀信用记录，可以一键复购（再次发布同类需求并邀请原合作方）。
 */
import { INDUSTRY_CHAINS, type ChainMember } from '../data/chains';
import type { Bid, DealStatus, Opp, Role, TeamMember } from './opportunity';

export const DEAL_STEPS = ['发布', '审核', '匹配', '对接', '成交', '履约', '评价'] as const;
export function stepOf(s: DealStatus): number {
  return { reviewing: 1, matching: 2, connecting: 3, contracted: 4, delivering: 5, done: 6, closed: 6 }[s];
}

/** —— 信用记录（只来自双方确认完成的合作；演示成员带有虚构的历史记录） —— */
export interface Credit { rating: number; done: number; onTime: number; certified: boolean }
const DEMO_CREDIT: Record<string, Credit> = {
  cm_guangying: { rating: 4.9, done: 12, onTime: 0.95, certified: true },
  cm_lulu: { rating: 4.8, done: 9, onTime: 0.9, certified: false },
  cm_asheng: { rating: 4.7, done: 15, onTime: 1, certified: false },
  cm_xiaobu: { rating: 4.6, done: 21, onTime: 0.88, certified: true },
  cm_global: { rating: 4.5, done: 6, onTime: 0.83, certified: true },
  cm_tianai: { rating: 4.8, done: 8, onTime: 0.9, certified: true },
  cm_rd: { rating: 4.7, done: 5, onTime: 1, certified: true },
  cm_huike: { rating: 4.9, done: 30, onTime: 0.97, certified: true },
  cm_xiaoyu: { rating: 4.4, done: 4, onTime: 0.75, certified: false },
  cm_dawei: { rating: 4.3, done: 2, onTime: 1, certified: false },
};
export function creditOf(memberId?: string): Credit {
  const empty: Credit = { rating: 0, done: 0, onTime: 0, certified: false };
  if (!memberId) return empty;
  return DEMO_CREDIT[memberId] ?? DEMO_CREDIT[memberId.replace(/\d+$/, '')] ?? empty;
}

/** 根据我收到的评价计算我的信用 */
export function myCredit(ratings: { stars: number; onTime: boolean }[]): Credit {
  if (!ratings.length) return { rating: 0, done: 0, onTime: 0, certified: false };
  return { rating: Math.round((ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) * 10) / 10, done: ratings.length, onTime: ratings.filter((r) => r.onTime).length / ratings.length, certified: false };
}

/** —— 匹配：为一条需求推荐供给方 —— */
export interface Reco { member: ChainMember; reason: string; score: number; credit: Credit }
export function recommendProviders(o: Pick<Opp, 'industry' | 'stage' | 'tags' | 'roles'>, n = 3): Reco[] {
  const ind = INDUSTRY_CHAINS.find((x) => x.id === o.industry);
  if (!ind) return [];
  const want = new Set([...o.tags, ...(o.roles ?? []).flatMap((r) => r.tags)]);
  const seen = new Set<string>();
  const out: Reco[] = [];
  for (const m of INDUSTRY_CHAINS.flatMap((x) => x.members)) {
    if (m.kind === 'prospect' || m.kind === 'service') continue;
    const key = m.entityId ?? m.id;
    if (seen.has(key)) continue;
    const st = INDUSTRY_CHAINS.flatMap((x) => x.stages).find((s) => s.id === m.stage);
    const capHit = (st?.caps ?? []).filter((c) => want.has(c));
    const sameStage = m.stage === o.stage;
    if (!capHit.length && !sameStage) continue;
    seen.add(key);
    const credit = creditOf(m.id);
    const score = Math.min(99, 40 + capHit.length * 12 + (sameStage ? 18 : 0) + Math.round(credit.rating * 3) + (credit.certified ? 5 : 0));
    const reason = [sameStage ? `正好在需求对应的环节「${st?.name}」` : `能力覆盖「${st?.name}」`, credit.done ? `完成 ${credit.done} 单，评分 ${credit.rating}` : '新入驻，暂无成交记录', credit.certified ? '已认证' : ''].filter(Boolean).join('；');
    out.push({ member: m, reason, score, credit });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}

/** —— 比选：给每份投标打上“最低价 / 最快 / 信用最好”标记 —— */
export interface CompareRow { bid: Bid; credit: Credit; badges: string[] }
export function compare(bids: Bid[]): CompareRow[] {
  const rows = bids.map((b) => ({ bid: b, credit: b.mine ? { rating: 0, done: 0, onTime: 0, certified: false } : creditOf(b.memberId), badges: [] as string[] }));
  if (!rows.length) return rows;
  const minQ = Math.min(...rows.map((r) => r.bid.quote)), minD = Math.min(...rows.map((r) => r.bid.days)), maxR = Math.max(...rows.map((r) => r.credit.rating));
  for (const r of rows) {
    if (r.bid.quote === minQ) r.badges.push('报价最低');
    if (r.bid.days === minD) r.badges.push('工期最短');
    if (maxR > 0 && r.credit.rating === maxR) r.badges.push('信用最好');
    if (r.bid.team?.length) r.badges.push(`联合团队 ${r.bid.team.length} 人`);
  }
  return rows;
}

/** —— 联合交付组队 —— */
export function suggestForRole(role: Role, exclude: string[] = []): ChainMember[] {
  const stages = INDUSTRY_CHAINS.flatMap((x) => x.stages).filter((s) => s.caps.some((c) => role.tags.includes(c))).map((s) => s.id);
  const seen = new Set<string>();
  return INDUSTRY_CHAINS.flatMap((x) => x.members)
    .filter((m) => stages.includes(m.stage) && m.kind !== 'prospect' && m.kind !== 'service' && !exclude.includes(m.entityId ?? m.id))
    .filter((m) => { const k = m.entityId ?? m.id; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => creditOf(b.id).rating - creditOf(a.id).rating)
    .slice(0, 3);
}

export function validateTeam(roles: Role[], team: TeamMember[]): string[] {
  const err: string[] = [];
  for (const r of roles) {
    const m = team.find((t) => t.role === r.id);
    if (!m) err.push(`「${r.name}」还没有人`);
    else if (m.state === 'invited') err.push(`「${r.name}」的 ${m.name} 还没确认加入`);
  }
  const sum = team.reduce((a, t) => a + t.split, 0);
  if (team.length && Math.abs(sum - 100) > 0.01) err.push(`分成合计应为 100%（现在 ${sum}%）`);
  if (!team.some((t) => t.state === 'me')) err.push('发起人自己也要承担一个角色');
  return err;
}

/** —— 成交确认单 —— */
export interface Milestone { name: string; pct: number; delivered: boolean; accepted: boolean }
export interface Contract { partyA: string; partyB: string; amount: number; scope: string[]; milestones: Milestone[]; confirmedA: boolean; confirmedB: boolean }

export function draftContract(o: Opp, b: Bid, buyer: string): Contract {
  return {
    partyA: buyer, partyB: b.bidder === '我' ? '我' : b.bidder, amount: b.quote, scope: o.deliverables.length ? [...o.deliverables] : [o.title],
    milestones: [{ name: '启动：确认方案与排期', pct: 30, delivered: false, accepted: false }, { name: '中期：交付初稿 / 样片', pct: 40, delivered: false, accepted: false }, { name: '验收：全部交付', pct: 30, delivered: false, accepted: false }],
    confirmedA: false, confirmedB: false,
  };
}

export function validateContract(c: Contract): string[] {
  const err: string[] = [];
  if (!c.partyA.trim() || !c.partyB.trim()) err.push('合同主体双方都要写明');
  if (!(c.amount > 0)) err.push('金额要大于 0');
  if (!c.scope.filter((s) => s.trim()).length) err.push('交付范围不能为空');
  const sum = c.milestones.reduce((a, m) => a + m.pct, 0);
  if (Math.abs(sum - 100) > 0.01) err.push(`付款节点比例合计应为 100%（现在 ${sum}%）`);
  if (c.milestones.some((m) => !m.name.trim() || m.pct <= 0)) err.push('每个付款节点都要有名称和比例');
  return err;
}

/** 已验收的金额 */
export const paidSoFar = (c: Contract) => Math.round(c.milestones.filter((m) => m.accepted).reduce((a, m) => a + (c.amount * m.pct) / 100, 0));

/** —— 评价 —— */
export interface Rating { stars: number; tags: string[]; text: string; onTime: boolean; by: string; at: number }
export const RATING_TAGS = ['沟通顺畅', '按时交付', '质量超预期', '专业', '愿意再合作', '需求清晰', '付款及时'];
export function validateRating(r: Partial<Rating>): string[] {
  const err: string[] = [];
  if (!r.stars || r.stars < 1 || r.stars > 5) err.push('请打 1–5 星');
  if (r.stars && r.stars <= 2 && (!r.text || r.text.trim().length < 6)) err.push('低分评价请写明原因（至少 6 个字），对方可以申诉');
  return err;
}

/** 复购：基于已完成的需求生成一条新需求草稿 */
export function repeatDraft(o: Opp): Omit<Opp, 'id' | 'postedAt'> {
  return { ...o, title: `【复购】${o.title.replace(/^【复购】/, '')}`, status: 'reviewing', mine: true, isDemo: false };
}
