/**
 * 三邻邦服务中心的演示数据（全部虚构，isDemo）：
 * - 创业服务市场：法务 / 财税 / 知识产权 / AI 工具 / 办公空间的认证服务商与套餐（P1）；
 * - 交易型活动：需求发布会 / 资源对接会 / 组队会 / 商业门诊 / 路演投资对接 / 行业闭门会（P1）；
 * - 价格测试：四类付费方的测试价格（P1，只登记意向，不收款）；
 * - 资源人脉库：投资人、园区 / 机构、专家导师（P2）；
 * - 内容与案例论坛：获客 / 销售 / AI 商业化 / 经营复盘 / 政策，行业小组（P2）。
 */
export type ServiceCat = 'legal' | 'tax' | 'ip' | 'ai' | 'space';
export const SERVICE_CAT: Record<ServiceCat, string> = { legal: '法务', tax: '财税', ip: '知识产权', ai: 'AI 工具', space: '办公空间' };

export interface ServicePackage { id: string; name: string; price: number; unit: string; includes: string[]; days: number }
export interface ServiceProvider {
  id: string; name: string; cat: ServiceCat; certified: boolean; summary: string; rating: number; done: number;
  district?: string; packages: ServicePackage[]; slots: string[]; isDemo: true;
}

const P = (p: Omit<ServiceProvider, 'isDemo'>): ServiceProvider => ({ ...p, isDemo: true });
export const SERVICE_PROVIDERS: ServiceProvider[] = [
  P({ id: 'sv_law1', name: '明理律师事务所（虚构）', cat: 'legal', certified: true, summary: '专注一人公司与小微企业：合同审查、合伙协议、劳务纠纷', rating: 4.9, done: 136,
    packages: [{ id: 'pk_law1a', name: '合同审查', price: 600, unit: '份', includes: ['10 页以内', '修改意见', '一次电话沟通'], days: 2 }, { id: 'pk_law1b', name: '合伙协议起草', price: 2800, unit: '份', includes: ['股权与分工条款', '退出机制', '两轮修改'], days: 5 }],
    slots: ['周二 14:00', '周三 10:00', '周五 16:00'] }),
  P({ id: 'sv_law2', name: '小微法务顾问（虚构）', cat: 'legal', certified: false, summary: '按月的轻量法务顾问，适合刚起步的工作室', rating: 4.5, done: 41,
    packages: [{ id: 'pk_law2a', name: '合同审查', price: 400, unit: '份', includes: ['5 页以内', '修改意见'], days: 3 }, { id: 'pk_law2b', name: '法务月度顾问', price: 1500, unit: '月', includes: ['不限次咨询', '每月 4 份合同审查'], days: 30 }],
    slots: ['周一 19:00', '周四 19:00'] }),
  P({ id: 'sv_tax1', name: '账房先生财税（虚构）', cat: 'tax', certified: true, summary: '个体户 / 小规模纳税人记账报税，含开票指导', rating: 4.8, done: 320,
    packages: [{ id: 'pk_tax1a', name: '小规模记账报税', price: 300, unit: '月', includes: ['记账', '月度报税', '开票指导'], days: 30 }, { id: 'pk_tax1b', name: '个体户注册 + 首月报税', price: 899, unit: '次', includes: ['工商注册', '税务登记', '首月报税'], days: 10 }],
    slots: ['周二 10:00', '周三 15:00', '周六 10:00'] }),
  P({ id: 'sv_tax2', name: '云算盘（虚构）', cat: 'tax', certified: true, summary: '线上代账，适合远程协作的一人公司', rating: 4.6, done: 210,
    packages: [{ id: 'pk_tax2a', name: '小规模记账报税', price: 260, unit: '月', includes: ['记账', '月度报税'], days: 30 }],
    slots: ['每天 20:00'] }),
  P({ id: 'sv_ip1', name: '知产小助手（虚构）', cat: 'ip', certified: true, summary: '商标、版权登记，非遗纹样与文创作品保护', rating: 4.7, done: 88,
    packages: [{ id: 'pk_ip1a', name: '商标注册（1 类）', price: 1200, unit: '件', includes: ['查询', '申请', '进度跟踪'], days: 7 }, { id: 'pk_ip1b', name: '作品版权登记', price: 500, unit: '件', includes: ['材料整理', '登记申请'], days: 20 }],
    slots: ['周三 14:00', '周五 10:00'] }),
  P({ id: 'sv_ai1', name: '小智 AI 工坊（虚构）', cat: 'ai', certified: true, summary: 'AI 客服、自动化工作流、AI 短视频工具落地', rating: 4.8, done: 64,
    packages: [{ id: 'pk_ai1a', name: 'AI 客服搭建', price: 3000, unit: '套', includes: ['知识库整理', '接入小程序 / 网页', '一个月调优'], days: 14 }, { id: 'pk_ai1b', name: 'AI 工具诊断', price: 199, unit: '次', includes: ['1 小时线上诊断', '工具清单'], days: 1 }],
    slots: ['周一 14:00', '周四 14:00'] }),
  P({ id: 'sv_space1', name: '邻里会客厅', cat: 'space', certified: true, district: 'yangjing', summary: '6–20 人社区会客厅，按小时预约', rating: 4.9, done: 300,
    packages: [{ id: 'pk_sp1a', name: '会客厅时租', price: 80, unit: '小时', includes: ['投影', '茶水'], days: 0 }, { id: 'pk_sp1b', name: '工位月租', price: 900, unit: '月', includes: ['固定工位', '会议室 4 小时'], days: 30 }],
    slots: ['每天 9:00–21:00'] }),
  P({ id: 'sv_space2', name: '北外滩共享办公（虚构）', cat: 'space', certified: true, district: 'sichuan_n', summary: '靠近四川北路的共享办公', rating: 4.6, done: 150,
    packages: [{ id: 'pk_sp2a', name: '工位月租', price: 1200, unit: '月', includes: ['固定工位', '会议室 8 小时', '注册地址'], days: 30 }],
    slots: ['工作日 9:00–18:00'] }),
];

/** —— 交易型活动（PPT p.7） —— */
export type DealEventKind = 'demand_day' | 'matchmaking' | 'team_up' | 'clinic' | 'roadshow' | 'closed_door';
export const DEAL_EVENT_LABEL: Record<DealEventKind, string> = {
  demand_day: '企业真实需求发布会', matchmaking: 'OPC 资源对接会', team_up: '联合项目组队会', clinic: '创业者商业门诊', roadshow: '项目路演 / 投资对接', closed_door: '行业闭门会',
};
export interface DealEvent { id: string; kind: DealEventKind; title: string; date: string; venue: string; district: string; who: string; flow: string[]; capacity: number; signed: number; industry?: string; linkedOpps?: string[]; isDemo: true }
export const DEAL_EVENTS: DealEvent[] = [
  { id: 'de_demand', kind: 'demand_day', title: '武康路小店秋季需求发布会', date: '本周六 14:00', venue: '邻里会客厅', district: 'yangjing', who: '有预算的商家 + 能接单的 OPC', flow: ['商家逐个讲需求与预算（每家 5 分钟）', 'OPC 现场报名承接', '一对一洽谈'], capacity: 40, signed: 23, industry: 'ecommerce', linkedOpps: ['op_t1', 'op_t3'], isDemo: true },
  { id: 'de_match', kind: 'matchmaking', title: '电商与非遗 · OPC 资源对接会', date: '下周三 19:00', venue: '街角书店二楼', district: 'sichuan_n', who: '内容、设计、直播、手艺人', flow: ['会前系统按需求预先配对', '每组 15 分钟对谈', '交换联系方式需双方同意'], capacity: 30, signed: 18, isDemo: true },
  { id: 'de_team', kind: 'team_up', title: '「AI 办公提效内训」项目组队会', date: '下周五 19:30', venue: '邻里会客厅', district: 'yangjing', who: '课程设计、讲师、视频', flow: ['讲解项目需求与预算', '按角色组队', '当场形成联合报价'], capacity: 20, signed: 9, industry: 'education', linkedOpps: ['op_t4'], isDemo: true },
  { id: 'de_clinic', kind: 'clinic', title: '创业者商业门诊：获客 · 定价 · 现金流', date: '每周二 / 四晚', venue: '线上 + 邻里会客厅', district: 'yangjing', who: '有产品、卡在增长的一人公司', flow: ['预约 30 分钟', '专家针对一个问题给建议', '会后给一页行动清单'], capacity: 8, signed: 5, isDemo: true },
  { id: 'de_roadshow', kind: 'roadshow', title: '虹口文创与消费项目路演', date: '下月 8 日 14:00', venue: '北外滩共享办公（虚构）', district: 'sichuan_n', who: '已有产品与客户验证、有清晰融资需求的项目', flow: ['项目 8 分钟路演 + 7 分钟问答', '投资人一对一预约'], capacity: 12, signed: 7, industry: 'heritage', isDemo: true },
  { id: 'de_closed', kind: 'closed_door', title: '直播带货出海 · 行业闭门会', date: '下月 15 日 19:00', venue: '武康路某咖啡馆二楼（虚构）', district: 'wukang', who: '跨境卖家、MCN、服务商', flow: ['案例分享', '真实采购需求交换', '合作机会对接'], capacity: 15, signed: 11, industry: 'ecommerce', isDemo: true },
];

/** —— 价格测试（PPT p.8：先证明能带来有效商机再收费；这里只登记付费意向） —— */
export interface PriceTier { id: string; payer: 'opc' | 'enterprise' | 'provider' | 'park'; name: string; price: string; perks: string[] }
export const PAYER_LABEL = { opc: 'OPC 创业者', enterprise: '企业需求方', provider: '专业服务商', park: '园区 / 机构' } as const;
export const PRICE_TIERS: PriceTier[] = [
  { id: 'pt_opc_free', payer: 'opc', name: '基础会员', price: '免费', perks: ['商业主页与小店', '需求大厅浏览与投标', '产业链黄页'] },
  { id: 'pt_opc_pro', payer: 'opc', name: '专业会员', price: '¥99–299 / 月（测试区间）', perks: ['优先推荐给需求方', '专项撮合（每月 2 次）', '商业门诊 1 次'] },
  { id: 'pt_ent_post', payer: 'enterprise', name: '需求发布', price: '¥499–1999 / 条（测试区间）', perks: ['审核加急', '平台推荐 5 位供给方', '比选与成交辅导'] },
  { id: 'pt_ent_deep', payer: 'enterprise', name: '采购撮合', price: '按服务深度报价', perks: ['专人撮合', '组织联合交付团队', '履约跟进'] },
  { id: 'pt_pro_basic', payer: 'provider', name: '认证入驻', price: '¥2000 / 年起（测试区间）', perks: ['认证标识', '服务市场展示', '预约咨询'] },
  { id: 'pt_pro_plus', payer: 'provider', name: '推广 + 线索', price: '¥5000–10000 / 年（测试区间）', perks: ['产业链服务商展位优先', '活动冠名', '线索推送'] },
  { id: 'pt_park', payer: 'park', name: '年度运营', price: '按目标定制', perks: ['活动承办', '招商服务', '运营看板'] },
];

/** —— 资源人脉库（P2） —— */
export type ContactKind = 'investor' | 'park' | 'expert';
export const CONTACT_LABEL: Record<ContactKind, string> = { investor: '投资人', park: '园区 / 机构', expert: '专家 / 导师' };
export interface Contact { id: string; kind: ContactKind; name: string; org: string; summary: string; industries: string[]; stages?: string[]; ticket?: string; offers: string[]; isDemo: true }
export const CONTACTS: Contact[] = [
  { id: 'ct_inv1', kind: 'investor', name: '陈投资（虚构）', org: '梧桐早期基金（虚构）', summary: '只看天使轮，偏好消费品牌与内容电商', industries: ['ecommerce'], stages: ['idea', 'mvp', 'revenue'], ticket: '50–300 万', offers: ['天使投资', '品牌渠道资源'], isDemo: true },
  { id: 'ct_inv2', kind: 'investor', name: '吴合伙人（虚构）', org: '海派文化创投（虚构）', summary: '关注非遗、文创与城市文化消费', industries: ['heritage'], stages: ['mvp', 'revenue'], ticket: '100–500 万', offers: ['Pre-A / A 轮', '文旅渠道'], isDemo: true },
  { id: 'ct_inv3', kind: 'investor', name: '刘天使（虚构）', org: '个人天使', summary: '教育与 AI 应用，愿意投一人公司', industries: ['education', 'ecommerce'], stages: ['idea', 'mvp'], ticket: '20–100 万', offers: ['天使投资', '导师辅导'], isDemo: true },
  { id: 'ct_park1', kind: 'park', name: '洋泾创业服务站（虚构）', org: '社区创业服务', summary: '免费工位 3 个月、创业补贴申报辅导', industries: ['ecommerce', 'education', 'heritage'], offers: ['免费工位', '补贴申报', '注册地址'], isDemo: true },
  { id: 'ct_park2', kind: 'park', name: '北外滩文创园（虚构）', org: '文创园区', summary: '文创与非遗项目优先入驻，提供展陈空间', industries: ['heritage'], offers: ['展陈空间', '租金优惠', '活动场地'], isDemo: true },
  { id: 'ct_exp1', kind: 'expert', name: '周老师（虚构）', org: '前电商平台运营总监', summary: '直播间搭建、投流与选品', industries: ['ecommerce'], offers: ['商业门诊', '直播间诊断'], isDemo: true },
  { id: 'ct_exp2', kind: 'expert', name: '何老师（虚构）', org: '课程产品顾问', summary: '把经验做成可复制的课程产品', industries: ['education'], offers: ['课程设计辅导', '定价建议'], isDemo: true },
];

/** —— 内容与案例论坛（P2） —— */
export type PostCat = 'growth' | 'sales' | 'ai' | 'review' | 'policy' | 'deal_story';
export const POST_CAT: Record<PostCat, string> = { growth: '获客', sales: '销售', ai: 'AI 商业化', review: '经营复盘', policy: '政策', deal_story: '成交故事' };
export interface ForumPost { id: string; cat: PostCat; group: string; title: string; body: string; author: string; likes: number; at: number; mine?: boolean; dealId?: string; isDemo?: true }
export const FORUM_GROUPS = [
  { id: 'g_ecom', name: '电商 · 直播与出海小组', industry: 'ecommerce' },
  { id: 'g_heritage', name: '非遗手艺人小组', industry: 'heritage' },
  { id: 'g_edu', name: '教育培训小组', industry: 'education' },
  { id: 'g_opc', name: '一人公司经营交流', industry: '' },
];
export function demoPosts(now: number): ForumPost[] {
  const d = 86400000;
  return [
    { id: 'fp1', cat: 'growth', group: 'g_ecom', title: '挂耳咖啡的第一场直播：我们怎么从 0 做到 300 单', body: '选品只留 3 个 SKU；直播间背景用店里的梧桐窗景；提前在社区团里预热……', author: '梧桐豆子', likes: 42, at: now - 2 * d, isDemo: true },
    { id: 'fp2', cat: 'ai', group: 'g_opc', title: '一个人用 AI 客服接住了 70% 的咨询', body: '把 FAQ 整理成 30 条，L3 的问题（报价、合同）一律转给本人……', author: '小智 AI 工坊（虚构）', likes: 35, at: now - 3 * d, isDemo: true },
    { id: 'fp3', cat: 'review', group: 'g_heritage', title: '糕团体验课做了 10 期的复盘', body: '周六上午最好卖；小朋友 + 家长一起报名；礼盒是复购的入口……', author: '阿婆糕团店', likes: 28, at: now - 5 * d, isDemo: true },
    { id: 'fp4', cat: 'policy', group: 'g_opc', title: '个体户和小规模纳税人怎么选？（演示整理）', body: '看开票需求、客户是否需要专票、未来是否融资……具体以当地政策与专业意见为准。', author: '账房先生财税（虚构）', likes: 51, at: now - 6 * d, isDemo: true },
    { id: 'fp5', cat: 'sales', group: 'g_edu', title: '企业内训怎么报价不吃亏', body: '按“课程开发 + 交付场次 + 课后辅导”拆开报，留出一次免费的需求访谈……', author: '知行课程工作室（虚构）', likes: 19, at: now - 1 * d, isDemo: true },
  ];
}
