/**
 * 产业链黄页 + 上下游速配（纯逻辑，可单测）。
 *
 * - 我在链上的位置：由我确认过的商业画像（能力标签 + 自述关键词）与我的小店推断，也可以手动登记；
 * - 速配：上游 = 流向我这个环节的环节里的成员，下游 = 我流向的环节，同行 = 同环节，服务 = 服务支撑；
 *   推荐理由只来自结构化数据（对方“正在找”与我“能提供”的重合），不编造关系；
 * - 缺口：平台内还没有入驻者的环节，提示“招募中 / 我来补位”；
 * - 服务商展位：每个环节 2 个、每次 7 天、先到先得、到期释放；明确标注为推广，不改变匹配分与自然排序。
 */
import { INDUSTRY_CHAINS, type ChainMember, type ChainStage, type Industry } from '../data/chains';
import type { BusinessProfile, OpcProfile } from './types';

export interface Placement { industry: Industry['id']; stage: string; reason: string; manual?: boolean }
export interface Join { industry: Industry['id']; stage: string }

const textOf = (profile?: BusinessProfile, opc?: OpcProfile) =>
  [profile?.headline, ...(profile?.capabilities ?? []).map((c) => `${c.label} ${c.detail ?? ''}`), opc?.category, opc?.tagline, ...(opc?.products ?? []).map((p) => `${p.name} ${p.description}`)]
    .filter(Boolean).join(' ').toLowerCase();

/** 我在三条产业链上可能处于哪些环节 */
export function placeMe(profile: BusinessProfile | undefined, opc: OpcProfile | undefined, joins: Join[] = []): Placement[] {
  const tags = new Set((profile?.capabilities ?? []).map((c) => c.tag));
  const text = textOf(profile, opc);
  const out: Placement[] = joins.map((j) => ({ ...j, reason: '你手动登记在这个环节', manual: true }));
  for (const ind of INDUSTRY_CHAINS) {
    for (const st of ind.stages) {
      if (out.some((p) => p.industry === ind.id && p.stage === st.id)) continue;
      if (st.layer === 'downstream' && !st.caps.length) continue; // 纯客户环节不自动放
      const capHit = st.caps.filter((c) => tags.has(c));
      const kwHit = st.keywords.filter((k) => text && text.includes(k.toLowerCase()));
      if (capHit.length) out.push({ industry: ind.id, stage: st.id, reason: `你的能力「${(profile?.capabilities ?? []).filter((c) => capHit.includes(c.tag)).map((c) => c.label).join('、')}」属于这个环节` });
      else if (kwHit.length >= 1 && st.layer !== 'service') out.push({ industry: ind.id, stage: st.id, reason: `你的介绍里提到「${kwHit.slice(0, 2).join('、')}」` });
    }
  }
  return out;
}

export interface MatchItem { member: ChainMember; relation: 'upstream' | 'downstream' | 'peer' | 'service'; reason: string; score: number }
export const RELATION_LABEL: Record<MatchItem['relation'], string> = { upstream: '上游 · 给你供货 / 素材', downstream: '下游 · 你的客户 / 渠道', peer: '同环节 · 可以联合接单', service: '服务支撑' };

/** 上下游速配：以我所在的环节为中心 */
export function speedMatch(industryId: string, stageId: string, myOffers: string[] = [], myNeeds: string[] = []): MatchItem[] {
  const ind = INDUSTRY_CHAINS.find((x) => x.id === industryId);
  if (!ind) return [];
  const ups = new Set(ind.flows.filter((f) => f.to === stageId).map((f) => f.from));
  const downs = new Set(ind.flows.filter((f) => f.from === stageId).map((f) => f.to));
  const flowWhat = (a: string, b: string) => ind.flows.find((f) => f.from === a && f.to === b)?.what;
  const svc = ind.stages.filter((s) => s.layer === 'service').map((s) => s.id);
  const hit = (a: string[], b: string[]) => a.filter((x) => b.some((y) => y.includes(x.slice(0, 2)) || x.includes(y.slice(0, 2))));
  const out: MatchItem[] = [];
  for (const m of ind.members) {
    let relation: MatchItem['relation'] | null = null;
    let reason = '';
    if (ups.has(m.stage)) { relation = 'upstream'; reason = `它在上游「${stageName(ind, m.stage)}」，向你的环节提供「${flowWhat(m.stage, stageId)}」`; }
    else if (downs.has(m.stage)) { relation = 'downstream'; reason = `它在下游「${stageName(ind, m.stage)}」，需要你的环节提供「${flowWhat(stageId, m.stage)}」`; }
    else if (m.stage === stageId) { relation = 'peer'; reason = '和你在同一个环节，可以联合承接更大的项目'; }
    else if (svc.includes(m.stage) || m.kind === 'service') { relation = 'service'; reason = `可以为你提供「${m.offers.join('、') || '服务支撑'}」`; }
    if (!relation) continue;
    const needHit = hit(m.needs, myOffers), offerHit = hit(m.offers, myNeeds);
    if (needHit.length) reason += `；对方正在找「${m.needs.join('、')}」，正好是你能提供的`;
    if (offerHit.length) reason += `；对方能提供「${offerHit.join('、')}」，正是你需要的`;
    const score = Math.min(99, (relation === 'downstream' ? 62 : relation === 'upstream' ? 58 : relation === 'peer' ? 50 : 40) + needHit.length * 15 + offerHit.length * 12 + (m.entityId ? 6 : 0) + (m.kind === 'prospect' ? -8 : 0));
    out.push({ member: m, relation, reason, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

const stageName = (ind: Industry, id: string) => ind.stages.find((s) => s.id === id)?.name ?? id;

/** 平台内还没有入驻者（只有未入驻公开信息或空着）的环节 */
export function gaps(ind: Industry): ChainStage[] {
  return ind.stages.filter((s) => !ind.members.some((m) => m.stage === s.id && m.kind !== 'prospect'));
}

/** —— 服务商展位（抢位） —— */
export const SLOTS_PER_STAGE = 2;
export const SLOT_DAYS = 7;
export interface Slot { stage: string; provider: string; offer: string; resource: ResourceKind; until: number; mine?: boolean }
export type ResourceKind = 'funding' | 'logistics' | 'venue' | 'traffic' | 'legal' | 'training' | 'tools';
export const RESOURCE_LABEL: Record<ResourceKind, string> = {
  funding: '资金 / 供应链金融', logistics: '仓储物流', venue: '场地', traffic: '流量 / 渠道', legal: '财税法务 / 知识产权', training: '培训', tools: '工具 / SaaS',
};

export function activeSlots(slots: Slot[], stage: string, now: number) {
  return slots.filter((s) => s.stage === stage && s.until > now);
}

export function claimSlot(slots: Slot[], req: { stage: string; provider: string; offer: string; resource: ResourceKind }, now: number): { ok: true; slots: Slot[] } | { ok: false; why: string } {
  const live = activeSlots(slots, req.stage, now);
  if (!req.provider.trim() || !req.offer.trim()) return { ok: false, why: '请填写服务商名称和能提供的资源' };
  if (/刷单|保证金|返利|代刷|包过/.test(req.offer)) return { ok: false, why: '资源描述含有不允许的内容（刷单 / 收保证金 / 包过 等）' };
  if (live.some((s) => s.mine)) return { ok: false, why: '你已经在这个环节有一个展位了' };
  if (live.length >= SLOTS_PER_STAGE) {
    const next = Math.min(...live.map((s) => s.until));
    return { ok: false, why: `这个环节的 ${SLOTS_PER_STAGE} 个展位都被抢了，最早 ${Math.ceil((next - now) / 86400000)} 天后释放，可以先排队候补` };
  }
  return { ok: true, slots: [...slots.filter((s) => s.until > now), { ...req, until: now + SLOT_DAYS * 86400000, mine: true }] };
}

/** 演示：开局已被占用的展位 */
export function demoSlots(now: number): Slot[] {
  const d = 86400000;
  return [
    { stage: 'ec_fulfil', provider: '临港小仓（虚构）', offer: '中小卖家一件代发首月免仓租', resource: 'logistics', until: now + 3 * d },
    { stage: 'ec_service', provider: '账房先生财税（虚构）', offer: '个体户 / 小微企业记账报税咨询', resource: 'legal', until: now + 5 * d },
    { stage: 'ec_service', provider: '小微贷顾问（虚构）', offer: '订单融资方案咨询（演示）', resource: 'funding', until: now + 2 * d },
    { stage: 'hc_service', provider: '知产小助手（虚构）', offer: '纹样版权登记咨询', resource: 'legal', until: now + 4 * d },
    { stage: 'ed_service', provider: '小课表 SaaS（虚构）', offer: '排课签到系统 30 天试用', resource: 'tools', until: now + 6 * d },
  ];
}
