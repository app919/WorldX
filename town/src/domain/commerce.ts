/**
 * 商业撮合引擎 V2 —— 客户优先。
 *
 * V1 的问题：把“人”画成放射状社交图，没有回答
 *   「我的客户在哪里？他们需要什么？我能给他们提供什么？我应该先找谁？」
 *
 * V2 的做法：
 * 1. 关系的主体是“经营主体”（Counterparty：已入驻 OPC / 已入驻商家 / 未入驻公开信息 / 个人），不是头像。
 * 2. 关系按价值流向分五类，客户（customer）永远排在第一位、是默认视图。
 * 3. 同一个主体可以同时有多条关系（例如既是我的客户，又是我的供应商），每条针对一项具体业务。
 * 4. 每条关系必须回答五个问题：客户是谁 / 在哪里 / 可能需要什么 / 我能提供什么 / 为什么推荐我。
 * 5. 需求证据分两级：published（对方公开发布过）与 inferred（系统按行业场景推测，尚未核实）。
 *
 *   S = 0.30·I + 0.30·C + 0.15·G + 0.15·B + 0.10·W   （各项 0–100；预算缺失时不计分并归一化）
 */
import type { BusinessProfile, CooperationIntent, CooperationMode, DistrictId, ScoreBreakdown } from './types';
import {
  CHANNEL_CAPS, DISTRICT_LABEL, DISTRICT_NEIGHBORS, RESOURCE_CAPS, capLabel, getCap, industryAffinity, industryLabel,
} from './taxonomy';

export const WEIGHTS = { industry: 0.3, complement: 0.3, geo: 0.15, budget: 0.15, willingness: 0.1 } as const;

/** 经营主体类型：地图与名片上必须区分，不能把未入驻商家伪装成平台会员 */
export type EntityKind = 'opc' | 'merchant' | 'prospect' | 'individual';
export const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  opc: '已入驻 OPC',
  merchant: '已入驻商家',
  prospect: '未入驻 · 仅公开商业信息',
  individual: '个人 · 不显示精确位置',
};

export type DistrictKey = 'wukang' | 'yangjing' | 'sichuan_n';

export interface Place {
  district: DistrictKey;
  street: string;
  /** 铺位 id（个人没有铺位；个人只显示到街区级别） */
  lotId?: string;
}

export interface NeedItem {
  tag: string;
  detail?: string;
  evidence: 'published' | 'inferred';
}

export interface Counterparty {
  id: string;
  name: string;
  kind: EntityKind;
  summary: string;
  industries: string[];
  place: Place;
  districts: DistrictId[];
  capabilities: string[];
  /** 对方自己公开发布的需求（published） */
  publishedNeeds: { tag: string; detail?: string }[];
  mode: CooperationMode;
  intents: CooperationIntent[];
  priceRange?: { min: number; max: number };
  budgetRange?: { min: number; max: number };
  /** 已入驻主体的主理人（演示角色 id），未入驻主体为空 —— 不能直接打招呼 */
  ownerId?: string;
  openToConnect: boolean;
  isDemo: boolean;
}

export type BizRelType = 'customer' | 'supplier' | 'partner' | 'channel' | 'resource';

export const BIZ_LABEL: Record<BizRelType, string> = {
  customer: '潜在客户',
  supplier: '上游供应商',
  partner: '横向合作伙伴',
  channel: '渠道伙伴',
  resource: '资源伙伴',
};
export const BIZ_QUESTION: Record<BizRelType, string> = {
  customer: '谁可能购买我的产品和服务？',
  supplier: '我需要采购什么？谁可以帮我完成交付？',
  partner: '谁和我能力互补，可以联合交付、共同获客？',
  channel: '谁能帮我把服务卖给更多客户？',
  resource: '谁能提供场地、资金、政策等资源？',
};
export const BIZ_ORDER: BizRelType[] = ['customer', 'supplier', 'partner', 'channel', 'resource'];

export interface BizRelation {
  id: string;
  type: BizRelType;
  counterpartyId: string;
  /** 这条关系涉及的“我的业务”（能力标签） */
  myServices: string[];
  /** 对方提供给我的能力（供应/合作/渠道/资源） */
  theirServices: string[];
  /** 对方可能的需求（客户关系） */
  needs: { tag: string; label: string; evidence: 'published' | 'inferred' }[];
  /** 五个问题的答案（客户关系） */
  answers: { who: string; where: string; need: string; offer: string; why: string };
  evidence: 'published' | 'inferred';
  score: number | null;
  breakdown: ScoreBreakdown;
  insufficientInfo: boolean;
  missing: string[];
  basis: string[]; // 计算依据（给人看的）
  nextStep: string;
  canContact: boolean; // 未入驻主体不能直接打招呼
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const capsOf = (p: BusinessProfile) => p.capabilities.map((c) => c.tag);
const needsOf = (p: BusinessProfile) => p.needs.map((n) => n.tag);

export function placeText(c: Counterparty, streetOf: (d: DistrictKey) => string): string {
  const area = `${DISTRICT_LABEL[c.districts[0]] ?? ''}区 · ${streetOf(c.place.district)}`;
  return c.kind === 'individual' ? `${area}（个人只显示到街区）` : `${area} · ${c.place.street}`;
}

function geo(me: BusinessProfile, c: Counterparty) {
  const remoteOk = me.mode !== 'onsite' && c.mode !== 'onsite';
  const same = me.districts.filter((d) => c.districts.includes(d));
  if (same.length) return { score: 100, note: `同在${same.map((d) => DISTRICT_LABEL[d]).join('、')}` };
  const near = me.districts.some((d) => DISTRICT_NEIGHBORS[d]?.some((n) => (c.districts as string[]).includes(n)));
  if (near) return { score: remoteOk ? 80 : 70, note: '所在区相邻' };
  return { score: remoteOk ? 60 : 25, note: remoteOk ? '双方接受远程合作' : '距离较远' };
}

function budget(seller?: { min: number; max: number }, buyer?: { min: number; max: number }): number | null {
  if (!seller || !buyer) return null;
  const overlap = Math.min(seller.max, buyer.max) - Math.max(seller.min, buyer.min);
  if (overlap >= 0) return 100;
  const gap = seller.min > buyer.max ? seller.min - buyer.max : buyer.min - seller.max;
  return Math.max(0, Math.round(100 - (gap / Math.max(seller.min, buyer.max, 1)) * 150));
}

function will(me: BusinessProfile, c: Counterparty) {
  const shared = me.intents.filter((i) => c.intents.includes(i));
  const union = uniq([...me.intents, ...c.intents]);
  return Math.round(50 + 50 * (union.length ? shared.length / union.length : 0));
}

function score(parts: { I: number; C: number; G: number; B: number | null; W: number }) {
  let wsum = WEIGHTS.industry + WEIGHTS.complement + WEIGHTS.geo + WEIGHTS.willingness;
  let s = WEIGHTS.industry * parts.I + WEIGHTS.complement * parts.C + WEIGHTS.geo * parts.G + WEIGHTS.willingness * parts.W;
  if (parts.B !== null) { s += WEIGHTS.budget * parts.B; wsum += WEIGHTS.budget; }
  return Math.round(s / wsum);
}

export function missingInfo(me: BusinessProfile, c: Counterparty): string[] {
  const m: string[] = [];
  if (!me.capabilities.length && !me.needs.length) m.push('你能提供什么 / 需要什么');
  if (!me.districts.length) m.push('你的服务区域');
  if (!c.industries.length) m.push('对方的行业');
  return m;
}

/** 计算我与一个主体之间的所有业务关系（可能多条） */
export function relationsWith(me: BusinessProfile, c: Counterparty, streetOf: (d: DistrictKey) => string = () => ''): BizRelation[] {
  if (!me.confirmed || !c.openToConnect) return [];
  const myCaps = capsOf(me);
  const myNeeds = needsOf(me);
  const pubNeeds = c.publishedNeeds.map((n) => n.tag);
  const I = Math.round(Math.max(0, ...me.industries.flatMap((a) => c.industries.map((b) => industryAffinity(a, b)))) * 100);
  const G = geo(me, c);
  const W = will(me, c);
  const missing = missingInfo(me, c);
  const insufficient = missing.length > 0;
  const where = placeText(c, streetOf);
  const out: BizRelation[] = [];

  const make = (
    type: BizRelType, C: number, B: number | null, partial: Omit<BizRelation, 'id' | 'type' | 'counterpartyId' | 'score' | 'breakdown' | 'insufficientInfo' | 'missing' | 'basis' | 'canContact'>,
  ) => {
    const breakdown: ScoreBreakdown = { industry: I, complement: C, geo: G.score, budget: B, willingness: W };
    const miss = [...missing];
    if (B === null && (type === 'customer' || type === 'supplier')) miss.push('预算 / 报价（未计分，按其余维度归一化）');
    const basis = [
      `行业关联 ${I}（${myCaps.map((x) => industryLabel(getCap(x)?.industry ?? '')).filter(Boolean)[0] ?? '你'} ↔ ${c.industries.map(industryLabel).join('、')}）`,
      `能力需求互补 ${C}（${partial.evidence === 'published' ? '对方公开发布了相关需求' : '按行业常见场景推测'}）`,
      `地域适配 ${G.score}（${G.note}）`,
      B === null ? '预算适配：缺少信息，未计分' : `预算适配 ${B}`,
      `合作意愿 ${W}`,
    ];
    out.push({
      id: `${type}:${c.id}`, type, counterpartyId: c.id,
      score: insufficient ? null : score({ I, C, G: G.score, B, W }),
      breakdown, insufficientInfo: insufficient, missing: miss, basis,
      canContact: !!c.ownerId && c.kind !== 'prospect',
      ...partial,
    });
  };

  // A. 潜在客户：我的哪项服务，可能满足对方的什么需求
  {
    const published = myCaps.filter((s) => pubNeeds.includes(s));
    const inferred = myCaps.filter((s) => !published.includes(s) && c.industries.some((ind) => getCap(s)?.buyerIndustries.includes(ind)));
    const services = [...published, ...inferred];
    if (services.length) {
      const needs = [
        ...published.map((t) => ({ tag: t, label: c.publishedNeeds.find((n) => n.tag === t)?.detail ?? capLabel(t), evidence: 'published' as const })),
        ...inferred.map((t) => ({ tag: t, label: (getCap(t)?.collabs ?? [capLabel(t)]).slice(0, 2).join('、'), evidence: 'inferred' as const })),
      ];
      const ev = published.length ? 'published' : 'inferred';
      make('customer', published.length ? 100 : 62, budget(me.priceRange, c.budgetRange), {
        myServices: services, theirServices: [], needs, evidence: ev,
        answers: {
          who: `${c.name}（${industryLabelList(c.industries)}）`,
          where,
          need: ev === 'published'
            ? `对方公开发布：${needs.filter((n) => n.evidence === 'published').map((n) => n.label).join('；')}`
            : `系统推测可能需要：${needs.map((n) => n.label).join('；')}（尚未核实）`,
          offer: services.map(capLabel).join('、'),
          why: ev === 'published'
            ? `对方发布的需求与你的「${published.map(capLabel).join('、')}」直接对应`
            : `「${industryLabelList(c.industries)}」行业常需要「${inferred.map(capLabel).join('、')}」，与你的服务类型可能匹配；尚未发现对方明确发布的采购需求`,
        },
        nextStep: c.kind === 'prospect'
          ? '对方尚未入驻，无法直接联系：可收藏为线索，或参加对方可能出现的街区活动'
          : ev === 'published' ? '打个招呼，带上与需求对应的案例' : '打个招呼，礼貌询问是否有相关计划',
      });
    }
  }

  // B. 上游供应商：我需要采购什么
  {
    const explicit = c.capabilities.filter((x) => myNeeds.includes(x));
    const inferred = c.capabilities.filter((x) => !explicit.includes(x) && myCaps.some((m) => getCap(m)?.upstream.includes(x)));
    const svc = [...explicit, ...inferred];
    if (svc.length) {
      make('supplier', explicit.length ? 95 : 60, budget(c.priceRange, me.budgetRange), {
        myServices: [], theirServices: svc, needs: [], evidence: explicit.length ? 'published' : 'inferred',
        answers: {
          who: `${c.name}（${industryLabelList(c.industries)}）`, where,
          need: explicit.length ? `你公开的需求：${explicit.map(capLabel).join('、')}` : `做你的业务通常需要：${inferred.map(capLabel).join('、')}`,
          offer: `对方可提供：${svc.map(capLabel).join('、')}`,
          why: explicit.length ? '对方能力与你发布的需求直接对应' : '对方能力是你交付服务时的常见上游环节（推测）',
        },
        nextStep: '打个招呼，了解对方的服务范围与报价',
      });
    }
  }

  // C. 横向合作：能力互补
  {
    const peers = c.capabilities.filter((x) => !myCaps.includes(x) && myCaps.some((m) => getCap(m)?.peers.includes(x)));
    if (peers.length) {
      make('partner', Math.min(100, 60 + peers.length * 12), null, {
        myServices: myCaps.filter((m) => getCap(m)?.peers.some((p) => peers.includes(p))), theirServices: peers, needs: [], evidence: 'inferred',
        answers: {
          who: `${c.name}（${industryLabelList(c.industries)}）`, where,
          need: '联合交付、共同获客', offer: `你的「${myCaps.map(capLabel).slice(0, 2).join('、')}」+ 对方的「${peers.map(capLabel).join('、')}」`,
          why: '能力互补，可以一起承接更完整的项目（推测）',
        },
        nextStep: '打个招呼，聊聊能否组队提案',
      });
    }
  }

  // D. 渠道伙伴
  {
    const ch = c.capabilities.filter((x) => CHANNEL_CAPS.has(x));
    if (ch.length && (myNeeds.includes('channel') || myNeeds.includes('client'))) {
      make('channel', myNeeds.includes('channel') ? 90 : 70, null, {
        myServices: myCaps, theirServices: ch, needs: [], evidence: 'inferred',
        answers: { who: c.name, where, need: '你在寻找客户 / 渠道', offer: `对方具备：${ch.map(capLabel).join('、')}`, why: '对方能帮你触达更多潜在客户（推测）' },
        nextStep: '打个招呼，探讨渠道分成或联合推广',
      });
    }
  }

  // E. 资源伙伴
  {
    const rs = c.capabilities.filter((x) => RESOURCE_CAPS.has(x));
    const wants = myNeeds.filter((n) => ['venue', 'funding', 'policy'].includes(n));
    if (rs.length && wants.length) {
      make('resource', 85, null, {
        myServices: [], theirServices: rs, needs: [], evidence: 'inferred',
        answers: { who: c.name, where, need: `你需要：${wants.map(capLabel).join('、')}`, offer: `对方可提供：${rs.map(capLabel).join('、')}`, why: '资源与需求对应' },
        nextStep: '打个招呼，了解场地 / 资源使用条件',
      });
    }
  }
  return out;
}

function industryLabelList(ids: string[]) {
  return ids.map(industryLabel).join(' / ');
}

/** 我的商业地图：按类型分组，组内按“已发布需求优先、分数高优先、信息不足靠后”排序 */
export function buildBusinessMap(me: BusinessProfile, all: Counterparty[], streetOf?: (d: DistrictKey) => string) {
  const rels = all.flatMap((c) => relationsWith(me, c, streetOf));
  const rank = (r: BizRelation) => (r.evidence === 'published' ? 1000 : 0) + (r.score ?? -1) + (r.canContact ? 5 : 0);
  const byType = Object.fromEntries(BIZ_ORDER.map((t) => [t, rels.filter((r) => r.type === t).sort((a, b) => rank(b) - rank(a))])) as Record<BizRelType, BizRelation[]>;
  return { byType, all: rels, counts: Object.fromEntries(BIZ_ORDER.map((t) => [t, byType[t].length])) as Record<BizRelType, number> };
}

export const BIZ_DISCLAIMER =
  '推荐基于双方公开的业务信息。标注“系统推测”的需求尚未核实，不代表对方真实存在采购需求；匹配分为系统估算，不是成交概率。';
