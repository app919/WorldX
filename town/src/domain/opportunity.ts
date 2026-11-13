/**
 * 机会广场（公告栏）：招标项目 / 推广接单 / 灵活用工（纯逻辑，可单测）。
 *
 * - 招标：商家发布项目（预算、截止、要求、交付物），OPC 与个人投标（报价、方案、工期），发布方选标；
 * - 推广接单：商家发布推广任务（探店视频、笔记、分销），访客接单拿推广码，提交作品，商家验收后结算；
 * - 灵活用工：兼职 / 按次 / 按小时的岗位，访客投递，商家邀约。
 *
 * 规则（演示版即执行）：
 * - 发布前校验：标题、预算或报酬、截止时间必填；不允许“刷单 / 收保证金 / 押金 / 培训费 / 先交钱”等内容；
 * - 推广必须标注「广告 / 推广」，不得虚假宣传；
 * - 平台不代收款、不担保交易（演示）；合同、报价确认、付款属于 L3，必须本人确认；
 * - 灵活用工不构成劳动关系，按次 / 按小时结算，注意人身安全与个税申报。
 */
import type { Industry } from '../data/chains';

export type OppKind = 'tender' | 'promo' | 'gig';
export const OPP_LABEL: Record<OppKind, string> = { tender: '招标项目', promo: '推广接单', gig: '灵活用工' };

export interface Opp {
  id: string;
  kind: OppKind;
  title: string;
  poster: string;
  /** 发布方对应的链上成员 / 街区主体 */
  memberId?: string;
  entityId?: string;
  industry: Industry['id'];
  stage?: string;
  district?: string;
  /** 招标预算 / 兼职报酬（元，演示） */
  budget?: { min: number; max: number };
  pay?: string;
  commission?: string;
  deadlineDays: number;
  requirements: string[];
  deliverables: string[];
  /** 用于和我的能力匹配 */
  tags: string[];
  quota?: number;
  postedAt: number;
  mine?: boolean;
  isDemo?: boolean;
}

export type BidStatus = 'submitted' | 'shortlisted' | 'won' | 'lost';
export interface Bid { id: string; oppId: string; bidder: string; quote: number; days: number; plan: string; status: BidStatus; at: number; mine?: boolean }

export type TaskStatus = 'taken' | 'submitted' | 'approved' | 'rejected';
export interface PromoTask { oppId: string; code: string; status: TaskStatus; link?: string; at: number }

export type AppStatus = 'applied' | 'invited' | 'declined';
export interface Application { oppId: string; note: string; status: AppStatus; at: number }

export const RULES: Record<OppKind, string[]> = {
  tender: ['预算与截止时间公开，所有投标方看到的信息一致', '选标后由双方本人确认合同与付款方式（L3），平台演示版不代收款、不担保', '谨防“先交保证金 / 押金才能投标”'],
  promo: ['推广内容必须标注「广告 / 推广」', '不得虚假宣传、不得刷单刷评', '佣金按商家验收结果结算（演示金额，与游戏钞票无关）'],
  gig: ['灵活用工按次 / 按小时结算，不构成劳动关系', '任何要求先交培训费、押金的岗位请直接举报', '注意人身安全；收入请按规定申报个税'],
};

const BANNED = /刷单|刷评|保证金|押金|培训费|先交钱|返现|代刷|包过|内部名额/;

export function validateOpp(o: Partial<Opp>): string[] {
  const err: string[] = [];
  if (!o.title || o.title.trim().length < 4) err.push('标题至少 4 个字');
  if (!o.kind) err.push('请选择类型');
  if (o.kind === 'tender' && (!o.budget || o.budget.min <= 0 || o.budget.max < o.budget.min)) err.push('招标需要填写合理的预算区间');
  if (o.kind === 'gig' && !o.pay) err.push('灵活用工需要写明报酬（如 ¥35/小时）');
  if (o.kind === 'promo' && !o.commission) err.push('推广任务需要写明佣金或报酬');
  if (!o.deadlineDays || o.deadlineDays < 1 || o.deadlineDays > 60) err.push('截止时间需在 1–60 天内');
  const all = [o.title, ...(o.requirements ?? []), ...(o.deliverables ?? []), o.pay, o.commission].join(' ');
  if (BANNED.test(all)) err.push('内容包含不允许的要求（刷单 / 保证金 / 押金 / 培训费 等）');
  return err;
}

export function validateBid(b: Partial<Bid>, opp: Opp): string[] {
  const err: string[] = [];
  if (!b.quote || b.quote <= 0) err.push('请填写报价');
  if (opp.budget && b.quote && b.quote > opp.budget.max * 1.5) err.push('报价远超预算上限，建议先和发布方沟通');
  if (!b.days || b.days < 1) err.push('请填写工期（天）');
  if (!b.plan || b.plan.trim().length < 8) err.push('方案说明至少 8 个字（怎么做、交付什么）');
  return err;
}

/** 机会与我的匹配度：标签重合 + 是否在我所在 / 相邻的产业链环节 */
export function oppScore(o: Opp, myTags: string[], myStages: string[]): number {
  const tagHit = o.tags.filter((t) => myTags.includes(t)).length;
  const stageHit = o.stage && myStages.includes(o.stage) ? 1 : 0;
  return Math.min(99, tagHit * 30 + stageHit * 25 + (o.kind === 'gig' ? 10 : 0));
}

export const promoCode = (oppId: string, seed: number) => `SLB-${oppId.slice(-3).toUpperCase()}${(seed % 9000) + 1000}`;

const d = 86400000;
/** 演示用的公告（全部虚构） */
export function demoOpps(now: number): Opp[] {
  const O = (o: Omit<Opp, 'postedAt' | 'isDemo'> & { ago?: number }): Opp => ({ ...o, postedAt: now - (o.ago ?? 1) * d, isDemo: true });
  return [
    O({ id: 'op_t1', kind: 'tender', title: '挂耳咖啡直播首秀：短视频 6 条 + 直播间视觉', poster: '梧桐豆子', memberId: 'cm_wutong', entityId: 'e_wutong', industry: 'ecommerce', stage: 'ec_content', district: 'wukang', budget: { min: 4000, max: 8000 }, deadlineDays: 7, requirements: ['有食品 / 饮品类拍摄经验', '能在两周内交付'], deliverables: ['15–30 秒短视频 6 条', '直播间背景与贴片'], tags: ['video', 'photo', 'graphic'], ago: 1 }),
    O({ id: 'op_t2', kind: 'tender', title: '东南亚海外店铺代运营（3 个月）', poster: '一帆出海工作室（虚构）', memberId: 'cm_global', industry: 'ecommerce', stage: 'ec_global', budget: { min: 9000, max: 15000 }, deadlineDays: 10, requirements: ['有海外电商平台运营经验', '会英语'], deliverables: ['店铺上新 30 个 SKU', '月度运营报告'], tags: ['crossborder', 'copywriting'], ago: 2 }),
    O({ id: 'op_t3', kind: 'tender', title: '海派糕团节令礼盒包装设计', poster: '阿婆糕团店', memberId: 'cm_apo', entityId: 'e_apo', industry: 'heritage', stage: 'hc_design', district: 'yangjing', budget: { min: 3000, max: 6000 }, deadlineDays: 14, requirements: ['有食品包装经验', '理解传统纹样'], deliverables: ['礼盒结构与视觉 1 套', '印刷文件'], tags: ['graphic', 'industrial_design'], ago: 3 }),
    O({ id: 'op_t4', kind: 'tender', title: '“AI 办公提效”企业内训 2 场（课程 + 讲师）', poster: '某科技公司 HR（虚构）', memberId: 'cm_hr', industry: 'education', stage: 'ed_teach', budget: { min: 6000, max: 12000 }, deadlineDays: 12, requirements: ['讲师有企业培训经验', '课程可定制'], deliverables: ['2 场半天内训', '课件与练习'], tags: ['ai_app', 'consulting', 'teaching'], ago: 1 }),
    O({ id: 'op_p1', kind: 'promo', title: '探店短视频：梧桐豆子秋季新品', poster: '梧桐豆子', memberId: 'cm_wutong', entityId: 'e_wutong', industry: 'ecommerce', stage: 'ec_live', district: 'wukang', commission: '每条 ¥80 + 带货订单 8%', deadlineDays: 14, requirements: ['到店拍摄', '内容标注「广告」'], deliverables: ['15 秒以上探店视频 1 条'], tags: ['video', 'livestream'], quota: 20, ago: 1 }),
    O({ id: 'op_p2', kind: 'promo', title: '甜爱文创七夕礼盒 · 分销推广', poster: '甜爱文创', memberId: 'cm_tianai', entityId: 'e_tianai', industry: 'heritage', stage: 'hc_channel', district: 'sichuan_n', commission: '成交一单 12%', deadlineDays: 20, requirements: ['用专属推广码分享', '不得虚假宣传'], deliverables: ['分享笔记或社群推荐'], tags: ['copywriting', 'community_ops'], quota: 50, ago: 2 }),
    O({ id: 'op_p3', kind: 'promo', title: '读书会会员招募笔记（小红书 / 公众号）', poster: '街角书店', memberId: 'cm_books2', entityId: 'e_books', industry: 'education', stage: 'ed_growth', district: 'sichuan_n', commission: '每篇 ¥60', deadlineDays: 10, requirements: ['标注「推广」'], deliverables: ['图文笔记 1 篇'], tags: ['copywriting'], quota: 10, ago: 4 }),
    O({ id: 'op_g1', kind: 'gig', title: '周末直播场控助理', poster: '小步营销', memberId: 'cm_xiaobu', entityId: 'e_xiaobu', industry: 'ecommerce', stage: 'ec_live', district: 'wukang', pay: '¥40/小时，周末 2 天', deadlineDays: 5, requirements: ['细心、会用直播中控台更好'], deliverables: [], tags: ['livestream', 'community_ops'], quota: 2, ago: 1 }),
    O({ id: 'op_g2', kind: 'gig', title: '糕团手作体验课助教', poster: '阿婆糕团店', memberId: 'cm_apo', entityId: 'e_apo', industry: 'heritage', stage: 'hc_craft', district: 'yangjing', pay: '¥35/小时，每周六上午', deadlineDays: 7, requirements: ['喜欢和小朋友打交道'], deliverables: [], tags: ['craft', 'teaching'], quota: 1, ago: 2 }),
    O({ id: 'op_g3', kind: 'gig', title: '仓库打包员（按件计）', poster: '临港小仓（虚构）', memberId: 'cm_cang', industry: 'ecommerce', stage: 'ec_fulfil', pay: '¥0.8/件，可日结', deadlineDays: 30, requirements: ['能站立工作'], deliverables: [], tags: ['logistics'], quota: 8, ago: 3 }),
    O({ id: 'op_g4', kind: 'gig', title: '社区 AI 手机课助教', poster: '邻里会客厅', memberId: 'cm_huike2', entityId: 'e_huike', industry: 'education', stage: 'ed_teach', district: 'yangjing', pay: '¥120/场（2 小时）', deadlineDays: 9, requirements: ['耐心，会用常见 AI 应用'], deliverables: [], tags: ['teaching', 'ai_app'], quota: 2, ago: 1 }),
  ];
}

/** 演示：我发布的招标会收到链上成员的投标 */
export function demoBidsFor(o: Opp, now: number): Bid[] {
  const base = o.budget ? Math.round((o.budget.min + o.budget.max) / 2) : 1000;
  return [
    { id: `${o.id}_b1`, oppId: o.id, bidder: '光影小棚', quote: Math.round(base * 0.9), days: 10, plan: '先出分镜与样片，确认后两周内拍完并交付全部素材。', status: 'submitted', at: now },
    { id: `${o.id}_b2`, oppId: o.id, bidder: '鹿鹿 · 平面设计', quote: Math.round(base * 0.8), days: 8, plan: '视觉方向 2 套供选择，含两轮修改，交付源文件。', status: 'submitted', at: now },
    { id: `${o.id}_b3`, oppId: o.id, bidder: '一帆出海工作室（虚构）', quote: Math.round(base * 1.05), days: 14, plan: '联合阿声配音做中英双语版本，适合后续出海使用。', status: 'submitted', at: now },
  ];
}
