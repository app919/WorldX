/**
 * 业务标签体系 —— 推荐关系“由结构化数据生成”的基础。
 * AI（或规则引擎）只负责把自然语言映射成这些标签，
 * 关系推理只在这张表上做，不允许大模型凭空编造关系。
 */

export interface CapabilityDef {
  id: string;
  label: string;
  industry: string;
  /** 关键词：规则版画像提取使用（未来可替换为大模型 + 同一套标签） */
  keywords: string[];
  /** 提供此能力的人，通常需要采购哪些能力（上游） */
  upstream: string[];
  /** 能力互补、适合联合承接项目的能力（横向） */
  peers: string[];
  /** 哪些行业可能是潜在客户（下游） */
  buyerIndustries: string[];
  /** 可能的合作形式 */
  collabs: string[];
}

export interface IndustryDef {
  id: string;
  label: string;
  /** 行业关联度（0-1），对称使用 */
  related: Record<string, number>;
}

export const INDUSTRIES: IndustryDef[] = [
  { id: 'media', label: '内容与传媒', related: { design: 0.9, marketing: 0.9, brand_retail: 0.7, food: 0.6, tech: 0.5, culture: 0.7, education: 0.5 } },
  { id: 'design', label: '设计与创意', related: { media: 0.9, marketing: 0.8, brand_retail: 0.8, food: 0.6, culture: 0.8, tech: 0.5 } },
  { id: 'marketing', label: '营销策划', related: { media: 0.9, design: 0.8, brand_retail: 0.9, food: 0.8, tech: 0.5, education: 0.4 } },
  { id: 'tech', label: 'AI 与软件', related: { media: 0.5, design: 0.5, education: 0.6, hardware: 0.8, marketing: 0.5, service: 0.4 } },
  { id: 'hardware', label: '硬件与制造', related: { tech: 0.8, design: 0.6, brand_retail: 0.6 } },
  { id: 'brand_retail', label: '品牌与零售', related: { marketing: 0.9, design: 0.8, media: 0.7, food: 0.6, hardware: 0.6 } },
  { id: 'food', label: '餐饮与咖啡', related: { marketing: 0.8, media: 0.6, design: 0.6, brand_retail: 0.6, service: 0.5 } },
  { id: 'culture', label: '文化与艺术', related: { design: 0.8, media: 0.7, education: 0.7 } },
  { id: 'education', label: '咨询与培训', related: { tech: 0.6, culture: 0.7, media: 0.5, marketing: 0.4 } },
  { id: 'service', label: '生活服务', related: { food: 0.5, tech: 0.4, marketing: 0.4 } },
  { id: 'space', label: '空间与场地', related: { culture: 0.6, education: 0.6, food: 0.6, brand_retail: 0.5 } },
];

export const CAPABILITIES: CapabilityDef[] = [
  {
    id: 'video', label: '短视频制作', industry: 'media',
    keywords: ['短视频', '视频', '剪辑', '拍视频', 'vlog', '宣传片', '抖音'],
    upstream: ['photo', 'voice', 'copywriting'], peers: ['graphic', 'copywriting', 'photo'],
    buyerIndustries: ['food', 'brand_retail', 'marketing', 'culture', 'education'],
    collabs: ['产品宣传片', '短视频账号代运营', '门店探店视频'],
  },
  {
    id: 'ai_video', label: 'AI 宣传片', industry: 'media',
    keywords: ['ai 宣传片', 'ai宣传片', 'ai 视频', 'ai视频', 'aigc', '生成视频'],
    upstream: ['voice', 'copywriting', 'photo'], peers: ['graphic', 'copywriting'],
    buyerIndustries: ['brand_retail', 'tech', 'food', 'marketing'],
    collabs: ['AI 产品宣传片', '品牌概念短片'],
  },
  {
    id: 'planning', label: '创意策划', industry: 'marketing',
    keywords: ['策划', '创意', '活动策划', 'campaign'],
    upstream: ['video', 'graphic', 'copywriting'], peers: ['video', 'graphic'],
    buyerIndustries: ['brand_retail', 'food', 'culture'],
    collabs: ['品牌活动策划', '联合提案'],
  },
  {
    id: 'photo', label: '摄影', industry: 'media',
    keywords: ['摄影', '拍照', '拍摄', '照片', '摄影棚'],
    upstream: ['venue'], peers: ['video', 'graphic'],
    buyerIndustries: ['food', 'brand_retail', 'culture'],
    collabs: ['产品摄影', '门店形象照', '视频后期合作'],
  },
  {
    id: 'graphic', label: '平面设计', industry: 'design',
    keywords: ['平面', '设计', 'logo', '海报', '视觉', '包装设计', '插画'],
    upstream: ['copywriting'], peers: ['video', 'copywriting', 'photo'],
    buyerIndustries: ['brand_retail', 'food', 'culture', 'tech'],
    collabs: ['品牌视觉', '包装设计', '联合承接品牌项目'],
  },
  {
    id: 'copywriting', label: '文案策划', industry: 'marketing',
    keywords: ['文案', '写作', '公众号', '小红书', '写稿'],
    upstream: [], peers: ['video', 'graphic'],
    buyerIndustries: ['brand_retail', 'food', 'education'],
    collabs: ['品牌文案', '内容日历'],
  },
  {
    id: 'voice', label: '配音', industry: 'media',
    keywords: ['配音', '声音', '播音', '旁白'],
    upstream: [], peers: ['video', 'ai_video'],
    buyerIndustries: ['media', 'education'],
    collabs: ['宣传片配音', '课程旁白'],
  },
  {
    id: 'software', label: '软件开发', industry: 'tech',
    keywords: ['开发', '程序', '小程序', '网站', 'app', '软件', '编程'],
    upstream: ['graphic'], peers: ['ai_app', 'graphic'],
    buyerIndustries: ['brand_retail', 'food', 'education', 'service'],
    collabs: ['门店小程序', '官网搭建'],
  },
  {
    id: 'ai_app', label: 'AI 应用落地', industry: 'tech',
    keywords: ['ai 应用', 'ai应用', '大模型', 'agent', '智能体', '自动化'],
    upstream: ['software'], peers: ['software', 'consulting'],
    buyerIndustries: ['brand_retail', 'education', 'service', 'marketing'],
    collabs: ['AI 客服', '流程自动化'],
  },
  {
    id: 'hardware_eng', label: '硬件工程', industry: 'hardware',
    keywords: ['硬件', '电路', '嵌入式', '工程师'],
    upstream: [], peers: ['industrial_design', 'ai_app'],
    buyerIndustries: ['hardware', 'tech'],
    collabs: ['原型机开发'],
  },
  {
    id: 'industrial_design', label: '工业设计', industry: 'design',
    keywords: ['工业设计', '外观设计', '产品设计', '结构'],
    upstream: [], peers: ['hardware_eng', 'graphic'],
    buyerIndustries: ['hardware', 'brand_retail'],
    collabs: ['产品外观', '玩偶/周边设计'],
  },
  {
    id: 'coffee', label: '咖啡与烘焙', industry: 'food',
    keywords: ['咖啡', '烘焙', '甜品', '面包', '咖啡馆', '咖啡店'],
    upstream: ['video', 'graphic', 'photo', 'copywriting', 'software'], peers: ['venue'],
    buyerIndustries: ['service', 'culture'],
    collabs: ['联名饮品', '活动场地合作'],
  },
  {
    id: 'cooking', label: '做饭 / 家常菜', industry: 'food',
    keywords: ['做饭', '烧菜', '家常菜', '厨艺', '私房菜'],
    upstream: ['video', 'photo'], peers: ['video'],
    buyerIndustries: ['service'],
    collabs: ['社区美食内容', '私房菜体验'],
  },
  {
    id: 'consulting', label: '咨询与培训', industry: 'education',
    keywords: ['咨询', '培训', '课程', '讲师', '辅导', '顾问'],
    upstream: ['video', 'graphic'], peers: ['ai_app'],
    buyerIndustries: ['brand_retail', 'tech', 'service'],
    collabs: ['企业内训', '工作坊'],
  },
  {
    id: 'community_ops', label: '社群运营', industry: 'marketing',
    keywords: ['社群', '社区', '运营', '团购', '老人', '邻居'],
    upstream: ['copywriting'], peers: ['planning'],
    buyerIndustries: ['food', 'brand_retail', 'service'],
    collabs: ['社群分销', '社区活动'],
  },
  {
    id: 'driving', label: '出行与配送', industry: 'service',
    keywords: ['开车', '有车', '辆车', '司机', '配送', '跑腿'],
    upstream: [], peers: ['community_ops'],
    buyerIndustries: ['food', 'service'],
    collabs: ['社区配送', '本地生活服务'],
  },
  {
    id: 'venue_provider', label: '场地提供', industry: 'space',
    keywords: ['场地', '空间', '会议室', '工作室出租'],
    upstream: [], peers: ['coffee'],
    buyerIndustries: ['culture', 'education', 'brand_retail'],
    collabs: ['沙龙场地', '快闪店'],
  },
];

/** 非能力型的特殊需求（客户、渠道、资源） */
export const SPECIAL_NEEDS: Record<string, { label: string; keywords: string[] }> = {
  client: { label: '企业客户', keywords: ['客户', '接单', '业务', '甲方', '订单'] },
  channel: { label: '销售渠道', keywords: ['渠道', '代理', '分销', '卖货', 'mcn'] },
  venue: { label: '场地', keywords: ['场地', '空间', '摄影棚', '会议室'] },
  funding: { label: '资金', keywords: ['资金', '投资', '融资'] },
  policy: { label: '政策服务', keywords: ['政策', '补贴', '注册公司', '工商'] },
  partner: { label: '合伙人', keywords: ['合伙人', '合伙', '一起创业'] },
};

/** 能提供“渠道”角色的能力 */
export const CHANNEL_CAPS = new Set(['community_ops', 'planning']);
/** 能提供“资源”角色的能力 */
export const RESOURCE_CAPS = new Set(['venue_provider']);

const capIndex = new Map(CAPABILITIES.map((c) => [c.id, c]));
const indIndex = new Map(INDUSTRIES.map((i) => [i.id, i]));

export const getCap = (id: string) => capIndex.get(id);
export const getIndustry = (id: string) => indIndex.get(id);
export const capLabel = (id: string) => capIndex.get(id)?.label ?? SPECIAL_NEEDS[id]?.label ?? id;
export const industryLabel = (id: string) => indIndex.get(id)?.label ?? id;

export function industryAffinity(a: string, b: string): number {
  if (a === b) return 1;
  return indIndex.get(a)?.related[b] ?? indIndex.get(b)?.related[a] ?? 0;
}

export const DISTRICT_LABEL: Record<string, string> = {
  xuhui: '徐汇', jingan: '静安', huangpu: '黄浦', changning: '长宁', pudong: '浦东', other: '其他区域',
};
/** 相邻行政区（地域适配用，粗粒度） */
export const DISTRICT_NEIGHBORS: Record<string, string[]> = {
  xuhui: ['jingan', 'changning', 'huangpu'],
  jingan: ['xuhui', 'huangpu', 'changning'],
  huangpu: ['xuhui', 'jingan', 'pudong'],
  changning: ['xuhui', 'jingan'],
  pudong: ['huangpu'],
  other: [],
};
