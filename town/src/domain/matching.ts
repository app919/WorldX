/**
 * AI 商业可能性地图 —— 匹配引擎（第一版：可解释规则 + 加权评分）
 *
 *   S = 0.30·I + 0.30·C + 0.15·G + 0.15·B + 0.10·W
 *
 *   I 行业关联度 · C 能力需求互补度 · G 地域适配度 · B 预算价格适配度 · W 合作意愿匹配度
 *   各项 0–100。
 *
 * 原则：
 * 1. 只使用双方“已确认 + 愿意被连接”的结构化画像，不使用聊天记录推测隐私。
 * 2. 关键信息不足时返回 insufficientInfo=true、score=null，而不是强行打分。
 * 3. 预算是唯一允许缺失的维度：缺失时去掉该项并按剩余权重归一化，同时在 missing 中写明。
 * 4. 输出永远是“可能性”：demandStatus 恒为 unconfirmed。
 * 5. 分数不是成交概率，UI 必须标注“系统估算”。
 */
import type { BusinessProfile, Relationship, RelationType, ScoreBreakdown } from './types';
import {
  CHANNEL_CAPS, DISTRICT_LABEL, DISTRICT_NEIGHBORS, RESOURCE_CAPS,
  capLabel, getCap, industryAffinity,
} from './taxonomy';

export const WEIGHTS = { industry: 0.3, complement: 0.3, geo: 0.15, budget: 0.15, willingness: 0.1 } as const;

export const RELATION_LABEL: Record<RelationType, string> = {
  upstream: '上游供应',
  downstream: '下游客户',
  peer: '横向合作',
  channel: '渠道伙伴',
  resource: '资源伙伴',
};

export const RELATION_HINT: Record<RelationType, string> = {
  upstream: '我可能需要向 TA 采购',
  downstream: 'TA 可能购买我的产品或服务',
  peer: '能力互补，可以联合承接项目',
  channel: 'TA 可能帮我触达更多客户',
  resource: 'TA 可能提供场地、资金或政策等资源',
};

interface Candidate {
  type: RelationType;
  complement: number;
  reasons: string[];
  collabs: string[];
  matchedPairs: number;
}

const capIds = (p: BusinessProfile) => p.capabilities.map((c) => c.tag);
const needIds = (p: BusinessProfile) => p.needs.map((n) => n.tag);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** 找出 me → other 的所有候选关系类型，返回最强的一种 */
function bestRelation(me: BusinessProfile, other: BusinessProfile): Candidate | null {
  const myCaps = capIds(me);
  const myNeeds = needIds(me);
  const theirCaps = capIds(other);
  const theirNeeds = needIds(other);
  const cands: Candidate[] = [];

  // ① 下游客户：对方明确需要我的能力（强），或对方行业属于我能力的典型客户（弱）
  {
    const explicit = myCaps.filter((c) => theirNeeds.includes(c));
    const inferred = myCaps.filter((c) =>
      !explicit.includes(c) && other.industries.some((ind) => getCap(c)?.buyerIndustries.includes(ind)),
    );
    if (explicit.length || inferred.length) {
      const reasons: string[] = [];
      if (explicit.length) reasons.push(`对方公开需求中包含「${explicit.map(capLabel).join('、')}」，正是你能提供的`);
      if (inferred.length) reasons.push(`你提供「${inferred.map(capLabel).join('、')}」，对方经营的行业常常需要这类服务`);
      cands.push({
        type: 'downstream',
        complement: explicit.length ? 100 : 65,
        reasons,
        collabs: uniq([...explicit, ...inferred].flatMap((c) => getCap(c)?.collabs ?? [])).slice(0, 3),
        matchedPairs: explicit.length + inferred.length,
      });
    }
  }

  // ② 上游供应：我明确需要对方的能力（强），或对方能力是我能力的典型上游（弱）
  {
    const explicit = theirCaps.filter((c) => myNeeds.includes(c));
    const inferred = theirCaps.filter((c) => !explicit.includes(c) && myCaps.some((m) => getCap(m)?.upstream.includes(c)));
    if (explicit.length || inferred.length) {
      const reasons: string[] = [];
      if (explicit.length) reasons.push(`你的需求「${explicit.map(capLabel).join('、')}」与对方能提供的服务一致`);
      if (inferred.length) reasons.push(`做你这类业务通常需要「${inferred.map(capLabel).join('、')}」，对方正好提供`);
      cands.push({
        type: 'upstream',
        complement: explicit.length ? 95 : 60,
        reasons,
        collabs: uniq([...explicit, ...inferred].map((c) => `采购${capLabel(c)}`)).slice(0, 3),
        matchedPairs: explicit.length + inferred.length,
      });
    }
  }

  // ③ 横向合作：能力互补（对方的能力是我能力的 peer，且不是同一种能力）
  {
    const pairs = theirCaps.filter((c) => !myCaps.includes(c) && myCaps.some((m) => getCap(m)?.peers.includes(c)));
    if (pairs.length) {
      cands.push({
        type: 'peer',
        complement: Math.min(100, 60 + pairs.length * 12),
        reasons: [`你的「${myCaps.map(capLabel).slice(0, 2).join('、')}」与对方的「${pairs.map(capLabel).join('、')}」能力互补`],
        collabs: ['联合承接品牌项目', '组队参加提案'],
        matchedPairs: pairs.length,
      });
    }
  }

  // ④ 渠道伙伴：我需要客户/渠道，对方具备渠道能力
  {
    const ch = theirCaps.filter((c) => CHANNEL_CAPS.has(c));
    if (ch.length && (myNeeds.includes('channel') || myNeeds.includes('client'))) {
      cands.push({
        type: 'channel',
        complement: myNeeds.includes('channel') ? 90 : 70,
        reasons: [`你在寻找客户/渠道，对方具备「${ch.map(capLabel).join('、')}」能力`],
        collabs: ['渠道分成合作', '社群联合推广'],
        matchedPairs: ch.length,
      });
    }
  }

  // ⑤ 资源伙伴：我需要场地/资金/政策，对方能提供
  {
    const rs = theirCaps.filter((c) => RESOURCE_CAPS.has(c));
    const wants = myNeeds.filter((n) => ['venue', 'funding', 'policy'].includes(n));
    if (rs.length && wants.length) {
      cands.push({
        type: 'resource',
        complement: 85,
        reasons: [`你需要「${wants.map(capLabel).join('、')}」，对方可提供「${rs.map(capLabel).join('、')}」`],
        collabs: ['场地合作', '联合活动'],
        matchedPairs: rs.length,
      });
    }
  }

  if (!cands.length) return null;
  cands.sort((a, b) => b.complement - a.complement || b.matchedPairs - a.matchedPairs);
  return cands[0];
}

function geoScore(me: BusinessProfile, other: BusinessProfile): { score: number; note?: string } {
  const remoteOk = me.mode !== 'onsite' && other.mode !== 'onsite';
  const same = me.districts.filter((d) => other.districts.includes(d));
  if (same.length) return { score: 100, note: `你们都在${same.map((d) => DISTRICT_LABEL[d]).join('、')}` };
  const near = me.districts.some((d) => DISTRICT_NEIGHBORS[d]?.some((n) => (other.districts as string[]).includes(n)));
  if (near) return { score: remoteOk ? 80 : 70, note: '你们所在的区相邻' };
  return { score: remoteOk ? 60 : 25, note: remoteOk ? '双方都接受远程合作' : undefined };
}

function budgetScore(me: BusinessProfile, other: BusinessProfile, type: RelationType): number | null {
  // 卖方报价 vs 买方预算
  const seller = type === 'upstream' ? other : me;
  const buyer = type === 'upstream' ? me : other;
  if (type === 'peer' || type === 'channel' || type === 'resource') return null; // 非买卖关系，不评预算
  const price = seller.priceRange;
  const budget = buyer.budgetRange;
  if (!price || !budget) return null;
  const overlap = Math.min(price.max, budget.max) - Math.max(price.min, budget.min);
  if (overlap >= 0) return 100;
  // 不重叠：按差距衰减
  const gap = price.min > budget.max ? price.min - budget.max : budget.min - price.max;
  const ref = Math.max(price.min, budget.max, 1);
  return Math.max(0, Math.round(100 - (gap / ref) * 150));
}

function willingnessScore(me: BusinessProfile, other: BusinessProfile): { score: number; shared: string[] } {
  const shared = me.intents.filter((i) => other.intents.includes(i));
  const union = uniq([...me.intents, ...other.intents]);
  const j = union.length ? shared.length / union.length : 0;
  return { score: Math.round(50 + 50 * j), shared };
}

const INTENT_LABEL: Record<string, string> = {
  part_time: '兼职接单', project: '承接短期项目', long_term: '长期合作', team_up: '组队创业',
};

/** 检查画像是否满足匹配所需的最低信息量 */
export function missingFields(p: BusinessProfile): string[] {
  const m: string[] = [];
  if (!p.capabilities.length && !p.needs.length) m.push('能提供什么 / 需要什么');
  if (!p.industries.length) m.push('所属行业');
  if (!p.districts.length) m.push('所在区域');
  return m;
}

export function matchPair(me: BusinessProfile, other: BusinessProfile): Relationship | null {
  if (me.userId === other.userId) return null;
  if (!me.confirmed || !other.confirmed || !other.openToConnect) return null;

  const rel = bestRelation(me, other);
  if (!rel) return null;

  const missing = [...missingFields(me).map((f) => `你的${f}`), ...missingFields(other).map((f) => `对方的${f}`)];
  const I = Math.round(
    Math.max(0, ...me.industries.flatMap((a) => other.industries.map((b) => industryAffinity(a, b)))) * 100,
  );
  const G = geoScore(me, other);
  const B = budgetScore(me, other, rel.type);
  const W = willingnessScore(me, other);

  const breakdown: ScoreBreakdown = { industry: I, complement: rel.complement, geo: G.score, budget: B, willingness: W.score };
  const insufficientInfo = missing.length > 0;

  let score: number | null = null;
  if (!insufficientInfo) {
    let wsum = WEIGHTS.industry + WEIGHTS.complement + WEIGHTS.geo + WEIGHTS.willingness;
    let s = WEIGHTS.industry * I + WEIGHTS.complement * rel.complement + WEIGHTS.geo * G.score + WEIGHTS.willingness * W.score;
    if (B !== null) { s += WEIGHTS.budget * B; wsum += WEIGHTS.budget; }
    score = Math.round(s / wsum);
  }
  if (B === null && (rel.type === 'upstream' || rel.type === 'downstream')) {
    missing.push('预算 / 报价（该项未计分，已按其余维度归一化）');
  }

  // 商业缘分值（可爱的解释，不参与评分）
  const fate: string[] = [];
  if (rel.matchedPairs > 0) fate.push(`你们有 ${rel.matchedPairs} 项能力/需求互补`);
  if (G.note) fate.push(G.note);
  if (W.shared.length) fate.push(`你们都愿意${W.shared.map((s) => INTENT_LABEL[s]).join('、')}`);
  const sharedBuyers = uniq(capIds(me).flatMap((c) => getCap(c)?.buyerIndustries ?? []))
    .filter((ind) => capIds(other).some((c) => getCap(c)?.buyerIndustries.includes(ind)));
  if (sharedBuyers.length) fate.push('你们可能共同服务同一类客户');

  const action = rel.type === 'downstream' ? '打个招呼，礼貌询问对方是否有相关需求'
    : rel.type === 'upstream' ? '打个招呼，了解对方的服务与报价'
    : rel.type === 'peer' ? '打个招呼，聊聊能否组队接项目'
    : rel.type === 'channel' ? '打个招呼，探讨渠道合作方式'
    : '打个招呼，了解资源使用条件';

  return {
    id: `rel_${me.userId}_${other.userId}`,
    fromUserId: me.userId,
    toUserId: other.userId,
    type: rel.type,
    score,
    breakdown,
    insufficientInfo,
    missing,
    reasons: rel.reasons,
    fateReasons: fate,
    possibleCollabs: rel.collabs,
    source: other.source === 'demo_seed' ? '演示数据：双方公开的业务介绍' : '双方公开的业务介绍（经本人确认）',
    demandStatus: 'unconfirmed',
    suggestedAction: action,
  };
}

/** 为一个用户生成商业可能性地图：按关系类型分组、按分数排序；信息不足的排在后面 */
export function buildOpportunityMap(me: BusinessProfile, others: BusinessProfile[], limitPerType = 4): Relationship[] {
  const rels = others.map((o) => matchPair(me, o)).filter((r): r is Relationship => !!r);
  const byType = new Map<RelationType, Relationship[]>();
  for (const r of rels) byType.set(r.type, [...(byType.get(r.type) ?? []), r]);
  const out: Relationship[] = [];
  for (const list of byType.values()) {
    list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    out.push(...list.slice(0, limitPerType));
  }
  return out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/** 统一的免责声明，所有展示推荐的地方都要带上 */
export const MATCH_DISCLAIMER =
  '以上是系统基于双方公开业务描述推测的关系，不代表对方真实存在需求或已经同意合作。匹配分为系统估算，不是成交概率。';
