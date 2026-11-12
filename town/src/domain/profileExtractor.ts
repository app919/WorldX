/**
 * 画像提取：把一句自然语言自我介绍 → 结构化商业节点。
 *
 * 第一版使用可解释的关键词规则（离线、零成本、可测试）。
 * 后续可替换为大模型实现（见 services/aiProvider.ts 的 AiProvider 接口），
 * 但输出必须落在同一套 taxonomy 标签上，并且 **必须经用户确认** 才能参与匹配。
 */
import type { BusinessProfile, Capability, CooperationIntent, CooperationMode, DistrictId, Need } from './types';
import { CAPABILITIES, SPECIAL_NEEDS, capLabel, getCap } from './taxonomy';

export interface ExtractionResult {
  capabilities: Capability[];
  needs: Need[];
  /** AI 根据能力推测“你可能还需要”的上游，默认不勾选，需用户确认 */
  suggestedNeeds: Need[];
  industries: string[];
  districts: DistrictId[];
  mode: CooperationMode;
  intents: CooperationIntent[];
  priceRange?: { min: number; max: number };
  budgetRange?: { min: number; max: number };
  /** 给用户看的“我理解到的” */
  summary: string[];
}

const DISTRICT_KW: Record<DistrictId, string[]> = {
  xuhui: ['徐汇', '武康路', '衡山路', '徐家汇', '安福路'],
  jingan: ['静安', '南京西路', '静安寺', '张园'],
  huangpu: ['黄浦', '外滩', '新天地', '豫园'],
  changning: ['长宁', '愚园路', '中山公园'],
  pudong: ['浦东', '陆家嘴', '张江'],
  other: [],
};

const NEED_MARKERS = ['需要', '希望', '想找', '寻找', '在找', '缺', '求', '找一'];
const CLIENT_MARKERS = ['接', '业务', '客户', '订单', '甲方'];

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？!?；;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findCaps(sentence: string): string[] {
  const s = sentence.toLowerCase();
  const hits = CAPABILITIES.filter((c) => c.keywords.some((k) => s.includes(k.toLowerCase()))).map((c) => c.id);
  // “用 AI 做宣传片 / 用 AI 剪视频”这类中间隔了动词的说法
  if (!hits.includes('ai_video') && /\bai\b|aigc|人工智能/.test(s) && /宣传片|视频|短片/.test(s)) hits.push('ai_video');
  // 更具体的标签覆盖更泛的：例如 “AI 宣传片” 命中时不再额外算作 “短视频制作”的“宣传片”
  if (hits.includes('ai_video') && hits.includes('video') && !/短视频|剪辑|vlog|抖音/.test(s)) {
    return hits.filter((h) => h !== 'video');
  }
  if (hits.includes('industrial_design') && hits.includes('graphic') && !/平面|海报|logo|视觉|插画/.test(s)) {
    return hits.filter((h) => h !== 'graphic');
  }
  return hits;
}

function findSpecialNeeds(sentence: string): string[] {
  return Object.entries(SPECIAL_NEEDS)
    .filter(([, v]) => v.keywords.some((k) => sentence.toLowerCase().includes(k)))
    .map(([k]) => k);
}

export function extractProfile(text: string): ExtractionResult {
  const offers = new Set<string>();
  const needs = new Set<string>();

  for (const s of splitSentences(text)) {
    const isNeed = NEED_MARKERS.some((m) => s.includes(m));
    const caps = findCaps(s);
    if (isNeed) {
      const sellsService = CLIENT_MARKERS.some((m) => s.includes(m));
      if (sellsService) {
        // “希望接一些企业宣传片的业务” → 需要客户；宣传片是自己卖的服务
        needs.add('client');
        caps.forEach((c) => offers.add(c));
      } else {
        caps.forEach((c) => needs.add(c));
      }
      findSpecialNeeds(s).forEach((n) => needs.add(n));
    } else {
      caps.forEach((c) => offers.add(c));
      // “我认识一些社区里的老人” 这类资源描述
      if (/认识|人脉|朋友/.test(s) && /社区|老人|邻居/.test(s)) offers.add('community_ops');
    }
  }
  // 创意策划：做宣传片 / 视频的人通常也能做基础策划（作为能力提示，仍需确认）
  if ((offers.has('ai_video') || offers.has('video')) && /策划|创意|宣传片/.test(text)) offers.add('planning');

  for (const n of offers) needs.delete(n);

  const lower = text.toLowerCase();
  const districts = (Object.keys(DISTRICT_KW) as DistrictId[]).filter((d) => DISTRICT_KW[d].some((k) => lower.includes(k)));

  let mode: CooperationMode = 'both';
  if (/均可|都可以|都行|线上线下/.test(text)) mode = 'both';
  else if (/只.*远程|仅.*远程|只.*线上/.test(text)) mode = 'remote';
  else if (/只.*线下|仅.*线下/.test(text)) mode = 'onsite';

  const intents = new Set<CooperationIntent>();
  if (/兼职|接单|没有固定工作|自由/.test(text)) intents.add('part_time');
  if (/项目|短期/.test(text)) intents.add('project');
  if (/长期|稳定/.test(text)) intents.add('long_term');
  if (/合伙|组队|一起创业|团队/.test(text)) intents.add('team_up');
  if (!intents.size) intents.add('project');

  const money = (re: RegExp) => {
    const m = text.match(re);
    if (!m) return undefined;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a * 3;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  };
  const priceRange = money(/(?:报价|收费|起价|价格)[^\d]{0,6}(\d{2,7})(?:\s*[-~到至]\s*(\d{2,7}))?/);
  const budgetRange = money(/预算[^\d]{0,6}(\d{2,7})(?:\s*[-~到至]\s*(\d{2,7}))?/);

  const capabilities: Capability[] = [...offers].map((tag) => ({ tag, label: capLabel(tag) }));
  const needList: Need[] = [...needs].map((tag) => ({ tag, label: capLabel(tag) }));
  const suggested = new Set<string>();
  for (const c of offers) for (const u of getCap(c)?.upstream ?? []) if (!offers.has(u) && !needs.has(u)) suggested.add(u);
  const suggestedNeeds: Need[] = [...suggested].map((tag) => ({ tag, label: capLabel(tag) }));

  const industries = [...new Set([...offers].map((c) => getCap(c)?.industry).filter(Boolean) as string[])];

  const summary: string[] = [];
  if (capabilities.length) summary.push(`我能提供：${capabilities.map((c) => c.label).join('、')}`);
  if (needList.length) summary.push(`我需要：${needList.map((n) => n.label).join('、')}`);
  summary.push(`我希望：${[...intents].map((i) => ({ part_time: '兼职接单', project: '项目合作', long_term: '寻找稳定客户', team_up: '组队创业' })[i]).join('、')}`);
  if (districts.length) summary.push(`我的地域：${districts.map((d) => ({ xuhui: '徐汇', jingan: '静安', huangpu: '黄浦', changning: '长宁', pudong: '浦东', other: '其他' })[d]).join('、')}`);
  summary.push(`合作方式：${{ remote: '远程', onsite: '线下', both: '远程、线下均可' }[mode]}`);

  return {
    capabilities, needs: needList, suggestedNeeds, industries, districts, mode,
    intents: [...intents], priceRange, budgetRange, summary,
  };
}

export function toProfile(userId: string, displayName: string, headline: string, x: ExtractionResult, acceptedSuggestions: string[] = []): BusinessProfile {
  const extra = x.suggestedNeeds.filter((n) => acceptedSuggestions.includes(n.tag));
  return {
    userId, displayName, headline,
    industries: x.industries,
    capabilities: x.capabilities,
    needs: [...x.needs, ...extra],
    districts: x.districts,
    mode: x.mode,
    intents: x.intents,
    priceRange: x.priceRange,
    budgetRange: x.budgetRange,
    openToConnect: true,
    confirmed: false, // 必须由用户点击确认
    source: 'self_described',
  };
}

/** 创新一：AI 帮你发现你自己没有想到的生意 —— 输出“探索建议”，不是赚钱保证 */
const COMBOS: { needs: string[]; title: string; why: string }[] = [
  { needs: ['cooking', 'video'], title: '社区美食短视频服务', why: '你会做饭也会拍视频，可以为社区小店或自己做美食内容' },
  { needs: ['community_ops', 'video'], title: '老年生活内容记录服务', why: '你认识社区里的长辈，也会拍视频，可以记录家庭故事、生活影像' },
  { needs: ['community_ops', 'driving'], title: '社区团购 / 本地生活服务', why: '你有社区人脉也有车，适合做社区团购的组织与配送' },
  { needs: ['cooking', 'community_ops'], title: '邻里私房菜 / 社区食堂', why: '厨艺 + 邻里关系，适合小规模预约制的社区餐饮' },
  { needs: ['ai_video', 'consulting'], title: 'AI 视频工作坊', why: '把你的 AI 视频技能做成面向小商家的培训课' },
  { needs: ['graphic', 'coffee'], title: '咖啡联名周边设计', why: '设计能力 + 咖啡行业理解，适合做杯套、包装等联名' },
  { needs: ['photo', 'venue_provider'], title: '共享摄影棚', why: '你有场地也会拍摄，可以按时段出租给小品牌拍产品' },
];

export function suggestDirections(capTags: string[]): { title: string; why: string }[] {
  const set = new Set(capTags);
  const hits = COMBOS.filter((c) => c.needs.every((n) => set.has(n))).map(({ title, why }) => ({ title, why }));
  if (hits.length >= 3) return hits.slice(0, 3);
  // 不足三条时，用单项能力的典型合作形式补充
  for (const t of capTags) {
    for (const collab of getCap(t)?.collabs ?? []) {
      if (hits.length >= 3) break;
      if (!hits.some((h) => h.title === collab)) hits.push({ title: collab, why: `基于你的「${capLabel(t)}」能力` });
    }
  }
  return hits.slice(0, 3);
}
