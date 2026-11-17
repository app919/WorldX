/**
 * 创意广场：把想法（可选公开）展示出来；「AI 落地教练」根据创意内容给出：
 *   1. 一句话定位与最接近的生态位（含审核与市场价值，复用智能生态位的知识库与算法）；
 *   2. 从想法到真实的 5 步路线（每步有“做到什么算过关”）；
 *   3. 上下游怎么做：需要向谁采购（上游）、卖给谁（下游）、和谁联合（同行）；
 *   4. 这个系统里在每个上下游环节有哪些资源（店铺、服务商、投资人、需求大厅、活动）。
 * 关系推理只在能力标签与知识库上做（与「我的生意」「智能生态位」同一套），不让大模型凭空编造。
 */
import { BANNED, fmtYuan, generateNiches, type NicheMatch } from './ecosystem';
import { CAPABILITIES, INDUSTRIES } from './taxonomy';
import type { CityId } from './weather';

export interface Idea {
  id: string;
  title: string;
  desc: string;
  author: string;
  city: CityId;
  tags: string[];
  /** 是否公开展示在创意广场 */
  public: boolean;
  at: number;
  likes: number;
  mine?: boolean;
}

const DAY = 86400_000;
const T0 = Date.UTC(2026, 10, 1);
/** 示范创意（演示用，作者为街区里的演示居民） */
export const DEMO_IDEAS: Idea[] = [
  { id: 'idea_pet_ai', title: '宠物店的 AI 客服 + 每月宠物写真', desc: '给社区宠物店装一个 AI 客服回答洗护预约，每月再给会员宠物拍一次写真，做成会员权益。', author: '小林', city: 'shanghai', tags: ['AI', '宠物', '摄影'], public: true, at: T0 + 1 * DAY, likes: 23 },
  { id: 'idea_hutong_craft', title: '胡同里的非遗手作周末课', desc: '在南锣鼓巷借一个院子，周末开 2 小时剪纸、兔儿爷彩绘体验课，接游客和亲子家庭。', author: '阿槐', city: 'beijing', tags: ['非遗', '亲子', '文旅'], public: true, at: T0 + 2 * DAY, likes: 31 },
  { id: 'idea_hw_kickstarter', title: '把桌面小机器人做成众筹出海', desc: '自己设计了一个桌面陪伴机器人，想在华强北找工厂打样，上 Kickstarter 众筹。', author: '阿杰', city: 'shenzhen', tags: ['硬件', '出海', '具身智能'], public: true, at: T0 + 3 * DAY, likes: 18 },
  { id: 'idea_tea_live', title: '茶饮店夜间直播间代运营', desc: '五一商圈很多茶饮店晚上客流高，帮他们做夜间直播和团购，按月收服务费加佣金。', author: '湘湘', city: 'changsha', tags: ['直播', '餐饮', '夜经济'], public: true, at: T0 + 4 * DAY, likes: 27 },
  { id: 'idea_chengdu_ip', title: '熊猫插画 IP 授权给文创店', desc: '我画了一套成都熊猫插画，想授权给太古里周边的文创店和咖啡店做联名杯和贴纸。', author: '小蓉', city: 'chengdu', tags: ['插画', 'IP', '联名'], public: true, at: T0 + 5 * DAY, likes: 15 },
  { id: 'idea_silver_class', title: '社区老人手机与 AI 小课堂', desc: '在洋泾社区开每周一次的老人手机课，教用 AI 拍照修图、防诈骗，后面接一对一上门。', author: '王阿姨', city: 'shanghai', tags: ['银发', '社区', '培训'], public: true, at: T0 + 6 * DAY, likes: 19 },
];

/** 发布审核：合规红线 + 联系方式（站内沟通，不公开手机号 / 微信） */
export function reviewIdea(title: string, desc: string): { ok: boolean; reason?: string } {
  const t = `${title} ${desc}`;
  if (title.trim().length < 4) return { ok: false, reason: '标题至少 4 个字' };
  if (desc.trim().length < 10) return { ok: false, reason: '说明至少 10 个字：想做什么、给谁、怎么赚钱' };
  const bad = BANNED.find((w) => t.includes(w));
  if (bad) return { ok: false, reason: `涉及「${bad}」，不符合平台规则` };
  if (/1[3-9]\d{9}/.test(t) || /(微信|vx|wx|v信)[:：\s]*[A-Za-z0-9_-]{5,}/i.test(t)) return { ok: false, reason: '不要在创意里写手机号或微信，平台内可以直接聊' };
  return { ok: true };
}

/** 系统里的一条资源（由 UI 注入的搜索函数提供：店铺、真实用户的店、服务商、投资人） */
export interface ResourceHit { id: string; title: string; sub: string; badge?: string; canTrade: boolean; kind: string }
export type FindResources = (q: string) => ResourceHit[];

export interface ChainLink { label: string; why: string; resources: ResourceHit[] }
export interface PlanStep { title: string; detail: string; pass: string; system: { label: string; action: IdeaAction }[] }
export type IdeaAction = 'post_need' | 'open_shop' | 'center_services' | 'center_funding' | 'community' | 'eco';

export interface IdeaPlan {
  position: string;
  caps: string[];
  niches: NicheMatch[];
  steps: PlanStep[];
  upstream: ChainLink[];
  downstream: ChainLink[];
  peers: ChainLink[];
  /** 资源总数（用于“系统里有 N 个资源可以帮你”） */
  resourceCount: number;
}

const capLabelOf = (id: string) => CAPABILITIES.find((c) => c.id === id)?.label ?? id;
const indLabelOf = (id: string) => INDUSTRIES.find((c) => c.id === id)?.label ?? id;
/** 搜索时用的关键词：能力标签的第一个关键词更像“人话” */
const capQuery = (id: string) => CAPABILITIES.find((c) => c.id === id)?.keywords[0] ?? capLabelOf(id);
const IND_QUERY: Record<string, string> = {
  media: '视频', design: '设计', marketing: '营销', tech: 'AI', hardware: '硬件', brand_retail: '品牌', food: '咖啡', culture: '文创',
  education: '培训', service: '物流', space: '场地', wedding: '婚礼', fitness: '健身', community: '社区',
};

function pick(find: FindResources, q: string, n = 2): ResourceHit[] {
  return find(q).filter((h) => h.canTrade || h.kind === 'provider' || h.kind === 'contact').slice(0, n);
}

/** AI 落地教练：根据创意生成落地路线与上下游资源 */
export function coachIdea(idea: Pick<Idea, 'title' | 'desc' | 'city'>, find: FindResources): IdeaPlan {
  const gen = generateNiches({ text: `${idea.title}。${idea.desc}`, city: idea.city }, { count: 3 });
  const niches = gen.items;
  const caps = gen.profile.caps;
  const top = niches[0];
  const n = top?.niche;
  const buyers = n?.market.buyersLabel ?? '目标客户';
  const myCaps = caps.slice(0, 3).map(capLabelOf);

  // —— 上下游：从能力标签推（上游 = 这些能力需要采购的能力；下游 = 可能付费的行业；同行 = 互补能力） ——
  const defs = caps.map((c) => CAPABILITIES.find((d) => d.id === c)!).filter(Boolean);
  const ups = [...new Set(defs.flatMap((d) => d.upstream))].filter((c) => !caps.includes(c)).slice(0, 3);
  const downs = [...new Set([...(n ? [n.industry] : []), ...defs.flatMap((d) => d.buyerIndustries)])].slice(0, 3);
  const peers = [...new Set(defs.flatMap((d) => d.peers))].filter((c) => !caps.includes(c) && !ups.includes(c)).slice(0, 2);
  const upstream: ChainLink[] = ups.map((c) => ({ label: capLabelOf(c), why: `做「${idea.title}」需要的${capLabelOf(c)}，先外包给专业的人，比自己从零学更快`, resources: pick(find, capQuery(c)) }));
  const downstream: ChainLink[] = downs.map((i) => ({ label: indLabelOf(i), why: `${indLabelOf(i)}行业的商家可能为它付费：先找 3–5 家聊聊痛点和预算`, resources: pick(find, IND_QUERY[i] ?? indLabelOf(i)) }));
  const peerLinks: ChainLink[] = peers.map((c) => ({ label: capLabelOf(c), why: `和${capLabelOf(c)}的人联合交付，能接更大的单`, resources: pick(find, capQuery(c)) }));
  // 资金与创业服务：任何创意都用得上
  const funding = pick(find, '投资人', 2);
  const service = pick(find, '财税', 1);

  const position = `给「${buyers}」，用${myCaps.length ? `「${myCaps.join('、')}」` : '你的能力'}，解决「${idea.title}」想解决的问题${n ? `；最接近的方向是「${n.title}」（匹配 ${top.match}%）` : ''}。`;
  const price = n?.market.price;
  const steps: PlanStep[] = [
    { title: '① 一句话说清楚', detail: position, pass: '能让一个陌生人 10 秒听懂：给谁、解决什么、为什么是你', system: [{ label: '用「智能生态位」看看相关方向', action: 'eco' }] },
    { title: '② 验证真需求（1–2 周）', detail: `找 10 个${buyers}聊：现在怎么解决？花多少钱？最烦什么？不要推销，只听。`, pass: '至少 3 个人愿意付定金、预约试用或留下需求', system: [{ label: '在需求大厅发「征集试用」', action: 'post_need' }, { label: '去社区活动现场找人聊', action: 'community' }] },
    { title: '③ 做最小样品（2–4 周）', detail: n ? n.firstStep : '先做一个能演示的最小版本，不求完美。', pass: '有一个能给客户看、能收钱的版本（样片 / 样品 / 体验课 / Demo）', system: [{ label: '上游外包：见下方「上游」资源', action: 'eco' }] },
    { title: '④ 定价与第一单', detail: `${price ? `参考客单价约 ${fmtYuan(price)}；` : ''}在小店明码标价，写清交付内容与周期；让 AI 分身先帮你接待咨询。`, pass: '完成第一单交付并拿到评价', system: [{ label: '开一家小店 / 上架产品', action: 'open_shop' }, { label: '找财税、法务服务', action: 'center_services' }] },
    { title: '⑤ 复制放大', detail: `${top ? `这个方向的市场规模约 ${fmtYuan(top.value.tam)}（${top.value.scopeLabel}），一个人 3 年可获得约 ${fmtYuan(top.value.som)}。` : ''}找同行联合交付、找渠道，需要钱时再看融资资源。`, pass: '每月稳定 3 单以上，有复购或转介绍', system: [{ label: '看融资资源', action: 'center_funding' }] },
  ];
  const all = [...upstream, ...downstream, ...peerLinks].flatMap((l) => l.resources).concat(funding, service);
  // 把资金与服务资源挂到第 4、5 步
  if (service.length) steps[3].detail += ` 系统里的服务商：${service.map((s) => s.title).join('、')}。`;
  if (funding.length) steps[4].detail += ` 系统里的投资方：${funding.map((s) => s.title).join('、')}。`;
  return { position, caps, niches, steps, upstream, downstream, peers: peerLinks, resourceCount: new Set(all.map((x) => x.id)).size };
}
