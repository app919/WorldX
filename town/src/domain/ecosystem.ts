/**
 * 智能生态位：根据 OPC 的一切资料（营业范围、产品介绍、公司介绍、上传资料提炼、能力画像、所在城市），
 * 从「生态位知识库」里生成它的上游 / 下游 / 供应链 / 横向 / 跨界多元化方向，
 * 按匹配度降序打分，取前 6 个；每个方向必须先过审核，并给出市场价值（年营收，人民币）。
 *
 * 规则（可单测、可解释）：
 * 1. 匹配度 = 0.38 核心实力 + 0.12 资料命中 + 0.12 行业相关 + 0.18 赛道机会 + 0.12 一人适配 + 0.08 地域
 *    —— 核心实力来自能力标签（由 AI / 规则从资料中提取，taxonomy 同一套标签），不允许凭空编造关系。
 * 2. 市场价值采用「自下而上 × 自上而下」三角验证：
 *    自下而上 = 潜在客户数 × 年渗透率 × 年购买频次 × 客单价
 *    自上而下 = 相关行业年规模 × 该细分服务占比
 *    市场规模 TAM = 两者的几何平均；两者相差超过 3 倍视为数据不一致，审核不通过、不展示。
 *    可服务市场 SAM = TAM × 小微服务商可触达比例（长尾客户、线上可获客）
 *    你可获得 SOM（3 年）= min( SAM ÷ 同赛道服务商数 × 竞争力系数 ，一人年产能 × 客单价 )
 *    范围：默认中国；有地域限制（必须线下交付）的按本城市占全国的比重折算并标「本城市」；
 *          可出海的业务可以切换「全球」= 中国规模 ÷ 中国占全球比重。
 * 3. 参数来自公开统计口径的量级（国家统计局、商务部、行业协会与主流研究机构的公开数据，约 2024 年），
 *    取整到量级，用于“方向判断”，不构成投资建议；上线后可由后台按最新数据更新参数表。
 */
import { CAPABILITIES, INDUSTRIES } from './taxonomy';
import { extractProfile } from './profileExtractor';
import type { CityId } from './weather';

export type Scope = 'china' | 'city' | 'global';
export type Relation = 'extend' | 'peer' | 'upstream' | 'downstream' | 'cross';
export const RELATION_LABEL: Record<Relation, string> = {
  extend: '能力延伸', peer: '横向合作', upstream: '上游供应链', downstream: '下游客户', cross: '跨界多元',
};
export const RELATION_TONE: Record<Relation, string> = {
  extend: '#5FB27A', peer: '#3D7BD8', upstream: '#8C6BD6', downstream: '#FF8A3D', cross: '#D9A62E',
};

export interface MarketParams {
  /** 潜在客户（单位见 buyersLabel） */
  buyers: number;
  buyersLabel: string;
  /** 每年会购买这类服务的比例 */
  adoption: number;
  /** 每个购买客户每年购买次数 */
  frequency: number;
  /** 客单价（元 / 次） */
  price: number;
  /** 自上而下：相关行业年规模（元） */
  industrySize: number;
  industryLabel: string;
  /** 自上而下：该细分服务占行业规模的比例 */
  serviceShare: number;
  /** 年复合增长率 */
  cagr: number;
  /** 地域属性：local = 必须本地线下交付；national = 全国线上可交付；global = 可出海 */
  geo: 'local' | 'national' | 'global';
  /** 中国占全球该市场的比重（geo = global 时使用） */
  chinaShareOfGlobal?: number;
  /** 本城市折算口径：gdp = 地区生产总值占比，retail = 社会消费品零售总额占比 */
  cityBasis: 'gdp' | 'retail';
  /** 小微服务商可触达比例 */
  reach: number;
  /** 全国同赛道服务商数量（量级） */
  competitors: number;
  /** 一个人一年能交付的单数 */
  capacity: number;
  sources: string;
}

export interface NicheDef {
  id: string;
  title: string;
  industry: string;
  pitch: string;
  firstStep: string;
  /** 哪些能力标签让你天然适合做这个方向（0-1 权重） */
  fromCaps: Record<string, number>;
  keywords: string[];
  /** 一人公司适配度：轻资产、可独立交付、启动成本低 */
  opcFit: number;
  cityBoost?: Partial<Record<CityId, number>>;
  /** 需要的经营资质（审核会提示） */
  license?: string;
  market: MarketParams;
}

const Y = 1e8; // 1 亿

/** 城市占全国比重（2024 年量级）：GDP 与社会消费品零售总额 */
export const CITY_SHARE: Record<CityId, { name: string; gdp: number; retail: number }> = {
  shanghai: { name: '上海', gdp: 0.040, retail: 0.037 },
  beijing: { name: '北京', gdp: 0.037, retail: 0.029 },
  shenzhen: { name: '深圳', gdp: 0.027, retail: 0.023 },
  changsha: { name: '长沙', gdp: 0.011, retail: 0.011 },
  chengdu: { name: '成都', gdp: 0.017, retail: 0.022 },
};

/** 合规红线：命中即审核不通过，永不展示 */
export const BANNED = ['刷量', '刷单', '控评', '刷好评', '网贷', '套现', '代孕', '博彩', '赌', '传销', '资金盘', '洗钱', '代考', '黑产', '翻墙'];

export const NICHES: NicheDef[] = [
  {
    id: 'ai_agent_smb', title: 'AI Agent 中小企业落地', industry: 'tech',
    pitch: '给中小企业搭客服、销售跟进、报表等 AI 智能体，按项目 + 年度维护收费。',
    firstStep: '挑一个你熟的行业，做一个「3 天上线」的标准 Agent 套餐，先免费给 2 家试用拿案例。',
    fromCaps: { ai_app: 1, software: 0.8, consulting: 0.6, teaching: 0.35 }, keywords: ['agent', '智能体', 'ai', '大模型', '自动化', 'rpa'],
    opcFit: 0.85, cityBoost: { shanghai: 0.9, beijing: 0.9, shenzhen: 0.85, chengdu: 0.75 },
    market: { buyers: 52_000_000, buyersLabel: '中小企业', adoption: 0.004, frequency: 1, price: 30_000, industrySize: 700 * Y, industryLabel: '企业级 AI 应用', serviceShare: 0.1, cagr: 0.35, geo: 'global', chinaShareOfGlobal: 0.2, cityBasis: 'gdp', reach: 0.6, competitors: 20_000, capacity: 30, sources: '工信部中小企业数量；企业级 AI 应用市场规模（行业研究机构）' },
  },
  {
    id: 'ai_video_brand', title: 'AIGC 品牌宣传片', industry: 'media',
    pitch: '用 AI 生成 + 实拍补镜，给中小品牌做低成本宣传片、产品概念片。',
    firstStep: '做 3 条不同行业的 30 秒样片，挂到小店产品里，标明起价与交付周期。',
    fromCaps: { ai_video: 1, video: 0.8, graphic: 0.5, copywriting: 0.4 }, keywords: ['aigc', 'ai视频', '宣传片', '生成', '视频'],
    opcFit: 0.9,
    market: { buyers: 5_000_000, buyersLabel: '有投放需求的品牌与商家', adoption: 0.03, frequency: 2, price: 5_000, industrySize: 150 * Y, industryLabel: 'AIGC 营销内容', serviceShare: 0.1, cagr: 0.4, geo: 'global', chinaShareOfGlobal: 0.18, cityBasis: 'gdp', reach: 0.7, competitors: 30_000, capacity: 80, sources: '市场主体统计；AIGC 营销内容市场（行业研究机构）' },
  },
  {
    id: 'short_drama', title: '微短剧制作外包', industry: 'media',
    pitch: '承接短剧片方的拍摄、剪辑、AI 特效与配音，按集计费。',
    firstStep: '联系 2 家短剧出品方，报一个「单集剪辑 + 调色」的价格，先接剪辑。',
    fromCaps: { video: 0.85, ai_video: 0.7, copywriting: 0.55, voice: 0.45 }, keywords: ['短剧', '剧本', '拍摄', '剪辑', '影视'],
    opcFit: 0.7, cityBoost: { beijing: 0.85, shanghai: 0.8, changsha: 0.8 },
    market: { buyers: 8_000, buyersLabel: '短剧出品方与承制方', adoption: 0.6, frequency: 6, price: 150_000, industrySize: 505 * Y, industryLabel: '微短剧市场', serviceShare: 0.1, cagr: 0.25, geo: 'global', chinaShareOfGlobal: 0.35, cityBasis: 'gdp', reach: 0.4, competitors: 6_000, capacity: 10, sources: '网络视听协会微短剧市场规模（2024 年约 505 亿元）' },
  },
  {
    id: 'livestream_ops', title: '直播间代运营', industry: 'marketing',
    pitch: '替品牌和商家运营直播间：排品、脚本、场控、投流复盘，按月收服务费 + 佣金。',
    firstStep: '先给一家本地商家免费做 4 场直播，记录 GMV 与转化，做成案例。',
    fromCaps: { livestream: 1, video: 0.55, community_ops: 0.6, planning: 0.45 }, keywords: ['直播', '带货', '主播', '场控', '投流', 'gmv'],
    opcFit: 0.75, cityBoost: { changsha: 0.95, shenzhen: 0.75, chengdu: 0.8 },
    market: { buyers: 3_000_000, buyersLabel: '开播商家', adoption: 0.1, frequency: 12, price: 8_000, industrySize: 58_000 * Y, industryLabel: '直播电商 GMV', serviceShare: 0.005, cagr: 0.15, geo: 'global', chinaShareOfGlobal: 0.5, cityBasis: 'retail', reach: 0.5, competitors: 60_000, capacity: 12, sources: '商务部 / 行业协会直播电商交易额（2024 年约 5.8 万亿元）' },
  },
  {
    id: 'editor_outsourcing', title: '剪辑师外包与后期', industry: 'media',
    pitch: '给博主、MCN 和品牌号提供稳定的剪辑、包装、字幕，按条或包月。',
    firstStep: '定 3 档包月套餐（8 / 15 / 30 条），先找 3 个中腰部博主试用一周。',
    fromCaps: { video: 1, ai_video: 0.5, graphic: 0.3 }, keywords: ['剪辑', '后期', '字幕', '包装', 'pr', '剪映'],
    opcFit: 0.95,
    market: { buyers: 10_000_000, buyersLabel: '商业化内容账号', adoption: 0.02, frequency: 24, price: 600, industrySize: 300 * Y, industryLabel: '视频后期制作外包', serviceShare: 0.1, cagr: 0.12, geo: 'global', chinaShareOfGlobal: 0.3, cityBasis: 'gdp', reach: 0.8, competitors: 200_000, capacity: 400, sources: '平台商业化创作者规模；视频后期外包市场（行业研究）' },
  },
  {
    id: 'product_photo_ecom', title: '电商商品图与详情页', industry: 'design',
    pitch: '给网店拍主图、详情页、短视频素材，按 SKU 计费。',
    firstStep: '做一套「10 个 SKU 一口价」套餐，在小店明码标价。',
    fromCaps: { photo: 1, graphic: 0.7, video: 0.4 }, keywords: ['商品图', '详情页', '主图', '电商', '拍摄', '静物'],
    opcFit: 0.9,
    market: { buyers: 10_000_000, buyersLabel: '活跃电商店铺', adoption: 0.08, frequency: 4, price: 2_000, industrySize: 600 * Y, industryLabel: '电商视觉服务', serviceShare: 0.1, cagr: 0.08, geo: 'global', chinaShareOfGlobal: 0.3, cityBasis: 'retail', reach: 0.7, competitors: 150_000, capacity: 150, sources: '主流电商平台活跃商家数；电商代运营与视觉服务市场' },
  },
  {
    id: 'brand_vi_smb', title: '小微品牌 VI 与包装', industry: 'design',
    pitch: '新开的店和新品牌需要 logo、门头、包装，一次性项目 + 物料复购。',
    firstStep: '做「开店视觉三件套」（logo / 门头 / 菜单或包装），给新开业商家报一口价。',
    fromCaps: { graphic: 1, industrial_design: 0.5, copywriting: 0.4, planning: 0.4 }, keywords: ['logo', 'vi', '包装', '品牌设计', '门头', '视觉'],
    opcFit: 0.9,
    market: { buyers: 8_000_000, buyersLabel: '每年新设企业', adoption: 0.03, frequency: 1, price: 8_000, industrySize: 2_000 * Y, industryLabel: '设计服务业', serviceShare: 0.01, cagr: 0.06, geo: 'national', cityBasis: 'gdp', reach: 0.6, competitors: 100_000, capacity: 40, sources: '市场监管总局新设经营主体；设计服务业规模' },
  },
  {
    id: 'restaurant_marketing', title: '餐饮门店本地营销', industry: 'marketing',
    pitch: '探店视频、团购上架、点评运营一条龙，按月服务本地餐饮门店。',
    firstStep: '在本街区找 3 家餐饮店，各做 1 条探店视频，用数据换长期合作。',
    fromCaps: { video: 0.8, planning: 0.7, community_ops: 0.6, photo: 0.5, copywriting: 0.5, coffee: 0.3, cooking: 0.3 }, keywords: ['探店', '团购', '餐饮', '本地生活', '点评', '门店'],
    opcFit: 0.85, cityBoost: { changsha: 0.95, chengdu: 0.95, shanghai: 0.8 },
    market: { buyers: 8_000_000, buyersLabel: '餐饮门店', adoption: 0.04, frequency: 12, price: 1_500, industrySize: 600 * Y, industryLabel: '本地生活服务商市场', serviceShare: 0.1, cagr: 0.12, geo: 'local', cityBasis: 'retail', reach: 0.6, competitors: 100_000, capacity: 15 * 12, sources: '餐饮门店数量（行业协会）；本地生活服务商市场' },
  },
  {
    id: 'coffee_supply', title: '精品咖啡豆供应', industry: 'food',
    pitch: '给独立咖啡馆供应自烘焙豆和定制拼配，按月稳定供货。',
    firstStep: '做 2 款拼配豆的试饮装，送给附近 10 家独立咖啡馆。',
    fromCaps: { coffee: 1, bakery: 0.45 }, keywords: ['咖啡豆', '烘焙', '拼配', '咖啡'],
    opcFit: 0.7, license: '食品经营许可证（预包装 / 散装食品）；自行烘焙需食品生产许可证',
    market: { buyers: 200_000, buyersLabel: '咖啡馆', adoption: 0.1, frequency: 12, price: 3_000, industrySize: 300 * Y, industryLabel: '咖啡豆市场', serviceShare: 0.025, cagr: 0.15, geo: 'national', cityBasis: 'retail', reach: 0.6, competitors: 5_000, capacity: 40 * 12, sources: '中国咖啡门店数量；咖啡豆市场规模（行业研究）' },
  },
  {
    id: 'coffee_training', title: '咖啡师培训与开店咨询', industry: 'education',
    pitch: '小班咖啡师课程 + 开店选址、设备、菜单咨询。',
    firstStep: '开一期 4 人周末体验课，结课学员转化为开店咨询。',
    fromCaps: { coffee: 1, teaching: 0.7, consulting: 0.6 }, keywords: ['咖啡', '培训', '开店', '咖啡师'],
    opcFit: 0.85,
    market: { buyers: 300_000, buyersLabel: '想入行 / 开店的咖啡从业者', adoption: 0.1, frequency: 1, price: 6_000, industrySize: 20 * Y, industryLabel: '餐饮职业培训中的咖啡类', serviceShare: 0.1, cagr: 0.12, geo: 'local', cityBasis: 'retail', reach: 0.6, competitors: 3_000, capacity: 120, sources: '咖啡门店新增数量与从业者规模（行业研究）' },
  },
  {
    id: 'corporate_training', title: '企业内训与 AI 实操课', industry: 'education',
    pitch: '给企业员工上 AI 工具、内容营销、管理类实操课，按天计费。',
    firstStep: '把你最拿手的技能做成半天课件，先在社区活动里讲一次试讲。',
    fromCaps: { teaching: 1, consulting: 0.8, ai_app: 0.5, copywriting: 0.3 }, keywords: ['内训', '培训', '讲师', '课程', '企业'],
    opcFit: 0.85, cityBoost: { shanghai: 0.9, beijing: 0.9, shenzhen: 0.85 },
    market: { buyers: 1_000_000, buyersLabel: '中型以上企业', adoption: 0.2, frequency: 2, price: 20_000, industrySize: 1_500 * Y, industryLabel: '企业培训市场', serviceShare: 0.05, cagr: 0.1, geo: 'national', cityBasis: 'gdp', reach: 0.4, competitors: 80_000, capacity: 60, sources: '经济普查企业数量；企业培训市场规模' },
  },
  {
    id: 'community_group_buy', title: '社区团购团长', industry: 'community',
    pitch: '经营 2–3 个小区的团购群，选品、到货、分拣，按订单拿佣金。',
    firstStep: '建一个本小区的群，每周做两次「今日鲜货」接龙。',
    fromCaps: { community_ops: 1, grocery: 0.8, cooking: 0.4, driving: 0.4 }, keywords: ['社区', '团购', '团长', '接龙', '生鲜', '小区'],
    opcFit: 0.8,
    market: { buyers: 300_000_000, buyersLabel: '城镇家庭', adoption: 0.1, frequency: 50, price: 8, industrySize: 2_500 * Y, industryLabel: '社区团购 GMV', serviceShare: 0.05, cagr: 0.05, geo: 'local', cityBasis: 'retail', reach: 0.5, competitors: 1_000_000, capacity: 30_000, sources: '国家统计局城镇家庭户数；社区团购交易规模（行业研究）' },
  },
  {
    id: 'crossborder_fulfillment', title: '跨境一件代发与海外仓', industry: 'service',
    pitch: '给小跨境卖家做打包、贴标、头程和海外仓对接，按单收费。',
    firstStep: '和一家海外仓谈代理价，先服务 5 个同城小卖家。',
    fromCaps: { logistics: 1, crossborder: 0.7, software: 0.3 }, keywords: ['海外仓', '代发', '物流', '跨境', '头程'],
    opcFit: 0.6, cityBoost: { shenzhen: 1, shanghai: 0.75 },
    market: { buyers: 600_000, buyersLabel: '跨境电商卖家', adoption: 0.2, frequency: 12, price: 5_000, industrySize: 21_500 * Y, industryLabel: '跨境电商出口额', serviceShare: 0.003, cagr: 0.12, geo: 'global', chinaShareOfGlobal: 0.35, cityBasis: 'gdp', reach: 0.4, competitors: 20_000, capacity: 600, sources: '海关总署跨境电商出口（2024 年约 2.15 万亿元）' },
  },
  {
    id: 'crossborder_content', title: '出海内容与 TikTok Shop 运营', industry: 'brand_retail',
    pitch: '给出海品牌做多语种短视频、海外达人对接、店铺运营。',
    firstStep: '挑一个你熟悉的品类，做 5 条英文带货短视频样片。',
    fromCaps: { crossborder: 1, video: 0.7, copywriting: 0.6, livestream: 0.6, voice: 0.4 }, keywords: ['出海', '海外', 'tiktok', '跨境', '多语种', '外贸'],
    opcFit: 0.8, cityBoost: { shenzhen: 1, shanghai: 0.85, changsha: 0.7 },
    market: { buyers: 600_000, buyersLabel: '出海品牌与卖家', adoption: 0.15, frequency: 12, price: 6_000, industrySize: 21_500 * Y, industryLabel: '跨境电商出口额', serviceShare: 0.003, cagr: 0.2, geo: 'global', chinaShareOfGlobal: 0.25, cityBasis: 'gdp', reach: 0.5, competitors: 30_000, capacity: 15 * 12, sources: '海关总署跨境电商出口；出海营销服务（行业研究）' },
  },
  {
    id: 'hardware_prototype', title: '硬件打样与小批量', industry: 'hardware',
    pitch: '帮硬件创业团队和小品牌做手板、打样、找工厂小批量。',
    firstStep: '整理 5 家靠谱的手板厂和 PCBA 厂报价，做成「打样代办」套餐。',
    fromCaps: { hardware_eng: 1, industrial_design: 0.8, software: 0.3 }, keywords: ['硬件', '打样', '手板', 'pcb', '小批量', '工厂'],
    opcFit: 0.65, cityBoost: { shenzhen: 1, shanghai: 0.6 },
    market: { buyers: 200_000, buyersLabel: '硬件创业团队与中小品牌', adoption: 0.25, frequency: 2, price: 30_000, industrySize: 300 * Y, industryLabel: '原型制作与手板', serviceShare: 0.1, cagr: 0.1, geo: 'global', chinaShareOfGlobal: 0.4, cityBasis: 'gdp', reach: 0.4, competitors: 15_000, capacity: 40, sources: '硬件创业与手板市场（行业研究）' },
  },
  {
    id: 'embodied_ai_integration', title: '具身智能场景集成', industry: 'hardware',
    pitch: '把服务机器人、机械臂落到门店、园区、工厂的具体场景，做部署与调教。',
    firstStep: '和一家机器人厂商签代理，在一个商场做 2 周试点。',
    fromCaps: { hardware_eng: 0.9, ai_app: 0.9, software: 0.7 }, keywords: ['具身智能', '机器人', '机械臂', '人形', '自动化'],
    opcFit: 0.55, cityBoost: { shenzhen: 1, beijing: 0.85, shanghai: 0.85 },
    market: { buyers: 3_000_000, buyersLabel: '可部署机器人的商业场景', adoption: 0.03, frequency: 1, price: 80_000, industrySize: 700 * Y, industryLabel: '服务机器人市场', serviceShare: 0.1, cagr: 0.4, geo: 'global', chinaShareOfGlobal: 0.3, cityBasis: 'gdp', reach: 0.3, competitors: 5_000, capacity: 15, sources: '工信部服务机器人产量与市场规模（行业研究）' },
  },
  {
    id: 'iot_app', title: '智能硬件 App 与固件', industry: 'tech',
    pitch: '给小硬件品牌开发配套 App、小程序和固件升级。',
    firstStep: '做一个通用的蓝牙设备 App 模板，缩短交付时间。',
    fromCaps: { software: 1, hardware_eng: 0.7, ai_app: 0.5 }, keywords: ['app', '小程序', '固件', '蓝牙', 'iot', '物联网'],
    opcFit: 0.8, cityBoost: { shenzhen: 1 },
    market: { buyers: 100_000, buyersLabel: '智能硬件品牌', adoption: 0.2, frequency: 1, price: 50_000, industrySize: 100 * Y, industryLabel: '智能硬件软件外包', serviceShare: 0.1, cagr: 0.12, geo: 'global', chinaShareOfGlobal: 0.3, cityBasis: 'gdp', reach: 0.5, competitors: 10_000, capacity: 10, sources: '智能硬件品牌数量；软件外包市场' },
  },
  {
    id: 'wedding_content', title: '婚礼跟拍与婚礼短片', industry: 'wedding',
    pitch: '婚礼当天跟拍 + 当晚出快剪短片，按场收费。',
    firstStep: '和 2 家婚庆公司 / 场地谈「推荐分成」，先拍 3 场做作品集。',
    fromCaps: { wedding_photo: 1, video: 0.8, photo: 0.8 }, keywords: ['婚礼', '婚纱', '跟拍', '写真', '新人'],
    opcFit: 0.85,
    market: { buyers: 6_100_000, buyersLabel: '每年结婚登记对数', adoption: 0.35, frequency: 1, price: 4_000, industrySize: 20_000 * Y, industryLabel: '婚庆产业', serviceShare: 0.004, cagr: -0.03, geo: 'local', cityBasis: 'retail', reach: 0.6, competitors: 120_000, capacity: 80, sources: '民政部结婚登记（2024 年约 610 万对）' },
  },
  {
    id: 'pet_content', title: '宠物摄影与宠物品牌内容', industry: 'media',
    pitch: '宠物写真、宠物店与宠物品牌的短视频内容。',
    firstStep: '在周末公园做一次「宠物免费拍」活动，积累作品与客户。',
    fromCaps: { photo: 0.9, video: 0.7, community_ops: 0.3 }, keywords: ['宠物', '猫', '狗', '萌宠'],
    opcFit: 0.9,
    market: { buyers: 76_000_000, buyersLabel: '城镇养宠人群', adoption: 0.02, frequency: 1, price: 500, industrySize: 3_000 * Y, industryLabel: '宠物消费市场', serviceShare: 0.0025, cagr: 0.1, geo: 'national', cityBasis: 'retail', reach: 0.7, competitors: 30_000, capacity: 300, sources: '中国宠物行业白皮书（城镇犬猫消费规模约 3000 亿元）' },
  },
  {
    id: 'silver_tech', title: '银发数字助手与老年课堂', industry: 'education',
    pitch: '教老人用手机、AI 工具、防诈骗，社区课 + 一对一上门。',
    firstStep: '和社区居委会合作开一次「手机课」，收集需求做系列课。',
    fromCaps: { teaching: 0.8, community_ops: 0.7, ai_app: 0.4, consulting: 0.3 }, keywords: ['老人', '银发', '养老', '社区', '老年'],
    opcFit: 0.85,
    market: { buyers: 310_000_000, buyersLabel: '60 岁以上人口', adoption: 0.01, frequency: 1, price: 600, industrySize: 400 * Y, industryLabel: '老年教育与学习', serviceShare: 0.05, cagr: 0.15, geo: 'local', cityBasis: 'gdp', reach: 0.4, competitors: 50_000, capacity: 600, sources: '国家统计局 60 岁以上人口（约 3.1 亿）' },
  },
  {
    id: 'craft_experience', title: '非遗手作体验与文旅', industry: 'culture',
    pitch: '把手艺做成 2 小时体验课，接游客、亲子与企业团建。',
    firstStep: '在本街区找一个周末摊位，做 10 份体验名额试水。',
    fromCaps: { craft: 1, teaching: 0.6, bookstore: 0.3, venue_provider: 0.3 }, keywords: ['非遗', '手作', '手艺', '体验', '文旅', '刺绣', '剪纸'],
    opcFit: 0.85, cityBoost: { beijing: 0.9, chengdu: 0.9, changsha: 0.8 },
    market: { buyers: 5_600_000_000, buyersLabel: '国内旅游人次', adoption: 0.001, frequency: 1, price: 150, industrySize: 100 * Y, industryLabel: '手作与研学体验', serviceShare: 0.08, cagr: 0.12, geo: 'local', cityBasis: 'retail', reach: 0.5, competitors: 40_000, capacity: 1_500, sources: '文旅部国内旅游人次（2024 年约 56 亿）' },
  },
  {
    id: 'ip_licensing', title: '文创 IP 授权与联名', industry: 'culture',
    pitch: '把你的图案、手艺或角色授权给消费品牌联名，收授权金。',
    firstStep: '整理 10 个可授权图案，做一份授权价目表。',
    fromCaps: { craft: 0.8, graphic: 0.8, industrial_design: 0.5 }, keywords: ['ip', '授权', '联名', '文创', '插画', '图案'],
    opcFit: 0.75,
    market: { buyers: 500_000, buyersLabel: '消费品牌', adoption: 0.03, frequency: 1, price: 50_000, industrySize: 1_500 * Y, industryLabel: '授权商品零售额', serviceShare: 0.006, cagr: 0.1, geo: 'global', chinaShareOfGlobal: 0.06, cityBasis: 'gdp', reach: 0.3, competitors: 10_000, capacity: 15, sources: '中国品牌授权行业报告（授权商品零售额约 1500 亿元）' },
  },
  {
    id: 'study_tour', title: '研学营与周末营', industry: 'education',
    pitch: '设计城市研学、自然与手作主题营，面向中小学生。',
    firstStep: '设计一条半日城市研学路线，先招 10 个家庭试营。',
    fromCaps: { teaching: 0.8, craft: 0.5, venue_provider: 0.5, consulting: 0.3, bookstore: 0.3 }, keywords: ['研学', '营地', '亲子', '学生', '夏令营'],
    opcFit: 0.6, license: '组织跨城出行需旅行社业务经营许可，或与持证旅行社合作',
    market: { buyers: 160_000_000, buyersLabel: '在校中小学生', adoption: 0.03, frequency: 1, price: 1_500, industrySize: 1_500 * Y, industryLabel: '研学旅行市场', serviceShare: 0.05, cagr: 0.1, geo: 'local', cityBasis: 'retail', reach: 0.3, competitors: 30_000, capacity: 400, sources: '教育部在校生数；研学旅行市场规模（行业研究）' },
  },
  {
    id: 'venue_sharing', title: '快闪与共享空间运营', industry: 'space',
    pitch: '把空间按小时 / 按天出租给品牌快闪、沙龙、拍摄。',
    firstStep: '把你的空间挂到 3 个场地平台，定好分时价格。',
    fromCaps: { venue_provider: 1, planning: 0.5, bookstore: 0.5, community_ops: 0.3 }, keywords: ['场地', '空间', '快闪', '共享', '活动'],
    opcFit: 0.6,
    market: { buyers: 500_000, buyersLabel: '活动主办方', adoption: 0.2, frequency: 4, price: 5_000, industrySize: 2_000 * Y, industryLabel: '活动场地租赁', serviceShare: 0.01, cagr: 0.08, geo: 'local', cityBasis: 'gdp', reach: 0.5, competitors: 50_000, capacity: 150, sources: '会展与活动场地市场（行业研究）' },
  },
  {
    id: 'event_planning', title: '品牌活动与市集策划', industry: 'marketing',
    pitch: '给中小品牌策划快闪、市集、新品发布，打包执行。',
    firstStep: '在本街区发起一场小市集，拉 10 个摊主，做成可复制的模板。',
    fromCaps: { planning: 1, community_ops: 0.7, venue_provider: 0.5, graphic: 0.3 }, keywords: ['活动', '市集', '快闪', '策划', '发布会'],
    opcFit: 0.75,
    market: { buyers: 2_000_000, buyersLabel: '有活动需求的中小企业', adoption: 0.05, frequency: 2, price: 20_000, industrySize: 4_000 * Y, industryLabel: '活动营销市场', serviceShare: 0.01, cagr: 0.08, geo: 'local', cityBasis: 'gdp', reach: 0.5, competitors: 60_000, capacity: 30, sources: '活动营销市场规模（行业研究）' },
  },
  {
    id: 'private_domain', title: '私域社群代运营', industry: 'marketing',
    pitch: '替门店和品牌运营企业微信群、会员与复购，按月收费。',
    firstStep: '给一家门店做 30 天私域复购实验，对比前后复购率。',
    fromCaps: { community_ops: 1, copywriting: 0.6, planning: 0.5 }, keywords: ['私域', '社群', '会员', '复购', '企业微信'],
    opcFit: 0.9,
    market: { buyers: 5_000_000, buyersLabel: '门店与品牌', adoption: 0.02, frequency: 12, price: 3_000, industrySize: 400 * Y, industryLabel: '私域与 SCRM 服务', serviceShare: 0.1, cagr: 0.12, geo: 'national', cityBasis: 'gdp', reach: 0.6, competitors: 50_000, capacity: 10 * 12, sources: '私域运营服务市场（行业研究）' },
  },
  {
    id: 'ai_search_geo', title: 'AI 搜索优化（GEO）与内容', industry: 'marketing',
    pitch: '让品牌在 AI 搜索和问答里被正确推荐：内容规划、结构化资料、监测。',
    firstStep: '给 3 家企业免费做一次「AI 里怎么说你」体检报告。',
    fromCaps: { copywriting: 1, ai_app: 0.6, planning: 0.4, software: 0.3 }, keywords: ['seo', 'geo', 'ai搜索', '内容', '官网'],
    opcFit: 0.9,
    market: { buyers: 5_000_000, buyersLabel: '有官网的企业', adoption: 0.02, frequency: 4, price: 3_000, industrySize: 1_000 * Y, industryLabel: '搜索营销市场', serviceShare: 0.012, cagr: 0.5, geo: 'global', chinaShareOfGlobal: 0.15, cityBasis: 'gdp', reach: 0.7, competitors: 8_000, capacity: 50 * 4, sources: '搜索营销市场规模；企业官网数量（行业研究）' },
  },
  {
    id: 'voice_dubbing', title: '配音与有声书', industry: 'media',
    pitch: '商业配音、有声书、多语种配音，按分钟或按集计费。',
    firstStep: '录 3 段不同风格的样音，挂到小店和配音平台。',
    fromCaps: { voice: 1, video: 0.3, copywriting: 0.3 }, keywords: ['配音', '有声', '播音', '声音', '朗读'],
    opcFit: 0.95,
    market: { buyers: 2_000_000, buyersLabel: '有声内容与视频项目方', adoption: 0.3, frequency: 10, price: 500, industrySize: 150 * Y, industryLabel: '有声书与配音市场', serviceShare: 0.2, cagr: 0.15, geo: 'global', chinaShareOfGlobal: 0.2, cityBasis: 'gdp', reach: 0.8, competitors: 60_000, capacity: 600, sources: '有声书市场规模（行业研究）' },
  },
  {
    id: 'fitness_online', title: '线上体态与健身课程', industry: 'fitness',
    pitch: '线上训练营 + 一对一体态评估，按期收费。',
    firstStep: '开一期 21 天打卡营，用前后对比照做案例。',
    fromCaps: { fitness_coach: 1, video: 0.5, community_ops: 0.4 }, keywords: ['健身', '体态', '瑜伽', '普拉提', '减脂'],
    opcFit: 0.9,
    market: { buyers: 50_000_000, buyersLabel: '有付费意愿的健身人群', adoption: 0.02, frequency: 1, price: 800, industrySize: 100 * Y, industryLabel: '线上健身市场', serviceShare: 0.08, cagr: 0.1, geo: 'national', cityBasis: 'retail', reach: 0.7, competitors: 40_000, capacity: 300, sources: '国家体育总局经常参加体育锻炼人数；线上健身市场' },
  },
  {
    id: 'corporate_wellness', title: '企业健康与运动团建', industry: 'fitness',
    pitch: '给公司做工间操、运动团建、员工健康讲座。',
    firstStep: '设计一个 90 分钟的「办公室体态课」，找 2 家公司试讲。',
    fromCaps: { fitness_coach: 0.9, planning: 0.5, venue_provider: 0.4, teaching: 0.4 }, keywords: ['团建', '企业', '员工', '健康', '运动'],
    opcFit: 0.8,
    market: { buyers: 1_000_000, buyersLabel: '中型以上企业', adoption: 0.05, frequency: 4, price: 8_000, industrySize: 500 * Y, industryLabel: '企业团建市场', serviceShare: 0.03, cagr: 0.08, geo: 'local', cityBasis: 'gdp', reach: 0.5, competitors: 30_000, capacity: 100, sources: '经济普查企业数量；团建市场规模（行业研究）' },
  },
  {
    id: 'bakery_gift', title: '企业节礼与伴手礼定制', industry: 'food',
    pitch: '给公司做中秋、春节、年会伴手礼，定制包装。',
    firstStep: '做一款带企业 logo 的小礼盒样品，提前两个月找 HR 报价。',
    fromCaps: { bakery: 1, coffee: 0.5, florist: 0.6, graphic: 0.3 }, keywords: ['伴手礼', '礼盒', '节礼', '定制', '点心', '烘焙'],
    opcFit: 0.75, license: '食品经营许可证；自制食品需食品生产许可证',
    market: { buyers: 5_000_000, buyersLabel: '有节礼采购的企业', adoption: 0.05, frequency: 2, price: 6_000, industrySize: 12_000 * Y, industryLabel: '礼品市场', serviceShare: 0.0025, cagr: 0.06, geo: 'local', cityBasis: 'retail', reach: 0.5, competitors: 80_000, capacity: 150, sources: '中国礼品行业规模（约 1.2 万亿元）' },
  },
  {
    id: 'florist_subscription', title: '商务花艺订阅', industry: 'brand_retail',
    pitch: '给写字楼前台、酒店、门店每周换花，按月订阅。',
    firstStep: '给周边 5 家门店免费换一次花，留下订阅报价。',
    fromCaps: { florist: 1, venue_provider: 0.2, planning: 0.2 }, keywords: ['花艺', '鲜花', '插花', '订阅', '花束'],
    opcFit: 0.8,
    market: { buyers: 3_000_000, buyersLabel: '写字楼企业、酒店与门店', adoption: 0.1, frequency: 24, price: 400, industrySize: 2_000 * Y, industryLabel: '鲜花零售市场', serviceShare: 0.015, cagr: 0.1, geo: 'local', cityBasis: 'retail', reach: 0.6, competitors: 200_000, capacity: 30 * 24, sources: '花卉协会鲜花零售规模' },
  },
  {
    id: 'book_community', title: '读书会与知识社群', industry: 'culture',
    pitch: '主题读书会、城市漫读、付费知识社群。',
    firstStep: '每周固定一晚办读书会，满 30 人后开年费社群。',
    fromCaps: { bookstore: 1, community_ops: 0.7, teaching: 0.5 }, keywords: ['读书', '书店', '阅读', '社群', '知识'],
    opcFit: 0.85,
    market: { buyers: 500_000_000, buyersLabel: '成年阅读人群', adoption: 0.002, frequency: 1, price: 300, industrySize: 1_500 * Y, industryLabel: '知识付费市场', serviceShare: 0.002, cagr: 0.08, geo: 'national', cityBasis: 'retail', reach: 0.6, competitors: 20_000, capacity: 1_000, sources: '全民阅读调查；知识付费市场规模' },
  },
  {
    id: 'saas_tools_smb', title: '小商家预约与会员小工具', industry: 'tech',
    pitch: '做一个轻量的预约 / 会员 / 储值小程序，按年订阅。',
    firstStep: '先给本街区 3 家店免费用 3 个月，按反馈迭代。',
    fromCaps: { software: 1, ai_app: 0.6, community_ops: 0.2 }, keywords: ['小程序', 'saas', '预约', '会员', '工具'],
    opcFit: 0.8,
    market: { buyers: 15_000_000, buyersLabel: '小微门店', adoption: 0.01, frequency: 1, price: 2_000, industrySize: 300 * Y, industryLabel: '小商户 SaaS', serviceShare: 0.01, cagr: 0.15, geo: 'global', chinaShareOfGlobal: 0.15, cityBasis: 'gdp', reach: 0.7, competitors: 5_000, capacity: 2_000, sources: '个体工商户与小微门店数量；SaaS 市场规模' },
  },
  {
    id: 'ai_customer_service', title: '店铺 AI 客服与智能体', industry: 'tech',
    pitch: '给网店和门店搭 AI 客服、AI 导购，按月订阅。',
    firstStep: '用你自己的小店 AI 分身做演示，给 5 家店做 7 天免费试用。',
    fromCaps: { ai_app: 1, software: 0.7, copywriting: 0.3 }, keywords: ['客服', 'ai', '智能体', 'agent', '导购'],
    opcFit: 0.85,
    market: { buyers: 15_000_000, buyersLabel: '网店与门店', adoption: 0.02, frequency: 12, price: 300, industrySize: 100 * Y, industryLabel: '智能客服市场', serviceShare: 0.1, cagr: 0.45, geo: 'global', chinaShareOfGlobal: 0.2, cityBasis: 'gdp', reach: 0.7, competitors: 6_000, capacity: 200 * 12, sources: '智能客服市场规模（行业研究）' },
  },
  {
    id: 'city_tour_driver', title: '城市漫游包车与向导', industry: 'service',
    pitch: '给游客做半日 / 一日城市漫游包车与讲解。',
    firstStep: '设计 2 条特色路线，在旅游平台上架体验。',
    fromCaps: { driving: 1, planning: 0.4, bookstore: 0.2 }, keywords: ['包车', '向导', '旅游', '漫游', 'citywalk'],
    opcFit: 0.75, license: '营运车辆需道路运输证；讲解服务建议持导游证或与持证机构合作',
    market: { buyers: 3_000_000_000, buyersLabel: '城市过夜游客人次', adoption: 0.001, frequency: 1, price: 600, industrySize: 2_000 * Y, industryLabel: '定制游市场', serviceShare: 0.01, cagr: 0.1, geo: 'local', cityBasis: 'retail', reach: 0.4, competitors: 200_000, capacity: 300, sources: '文旅部旅游统计；定制游市场（行业研究）' },
  },
  {
    id: 'kids_cooking', title: '亲子烘焙与料理课', industry: 'education',
    pitch: '周末亲子烘焙、节日料理小课。',
    firstStep: '借一个有烤箱的场地，开 3 组家庭的周末体验课。',
    fromCaps: { bakery: 0.9, cooking: 0.9, teaching: 0.6 }, keywords: ['亲子', '烘焙', '料理', '儿童', '课程'],
    opcFit: 0.85,
    market: { buyers: 100_000_000, buyersLabel: '有 3–12 岁孩子的家庭', adoption: 0.01, frequency: 4, price: 150, industrySize: 1_000 * Y, industryLabel: '亲子兴趣课市场', serviceShare: 0.006, cagr: 0.06, geo: 'local', cityBasis: 'retail', reach: 0.5, competitors: 20_000, capacity: 1_200, sources: '人口抽样调查；亲子兴趣教育市场' },
  },
  {
    id: 'private_chef', title: '私厨家宴上门', industry: 'food',
    pitch: '上门做家宴、生日宴、小型聚会餐。',
    firstStep: '定 3 档家宴菜单，先在邻居群里接 5 单。',
    fromCaps: { cooking: 1, bakery: 0.4 }, keywords: ['私厨', '家宴', '上门', '做饭', '家常菜'],
    opcFit: 0.85, license: '健康证；对外经营需食品经营许可',
    market: { buyers: 30_000_000, buyersLabel: '城镇中高收入家庭', adoption: 0.02, frequency: 2, price: 1_500, industrySize: 600 * Y, industryLabel: '上门家庭餐饮服务', serviceShare: 0.03, cagr: 0.1, geo: 'local', cityBasis: 'retail', reach: 0.5, competitors: 50_000, capacity: 200, sources: '城镇居民收入分组；家政与上门服务市场' },
  },
  {
    id: 'hardware_crowdfunding', title: '硬件众筹出海', industry: 'hardware',
    pitch: '帮硬件品牌上 Kickstarter / Indiegogo：视频、页面、投放、履约。',
    firstStep: '拆解 10 个成功众筹项目，做一份报价清单。',
    fromCaps: { crossborder: 0.8, hardware_eng: 0.6, video: 0.6, industrial_design: 0.5, copywriting: 0.4 }, keywords: ['众筹', 'kickstarter', '出海', '硬件', '新品'],
    opcFit: 0.7, cityBoost: { shenzhen: 1 },
    market: { buyers: 100_000, buyersLabel: '硬件品牌', adoption: 0.05, frequency: 1, price: 50_000, industrySize: 100 * Y, industryLabel: '中国品牌海外众筹额', serviceShare: 0.025, cagr: 0.12, geo: 'global', chinaShareOfGlobal: 0.3, cityBasis: 'gdp', reach: 0.4, competitors: 1_000, capacity: 10, sources: '海外众筹平台中国项目筹款额（行业研究）' },
  },
  {
    id: 'industrial_design_service', title: '消费电子 ID 设计外包', industry: 'design',
    pitch: '给消费电子和小家电品牌做外观、CMF 与结构配合设计。',
    firstStep: '做 3 个概念外观方案，投给 10 家小家电品牌。',
    fromCaps: { industrial_design: 1, graphic: 0.5, hardware_eng: 0.5 }, keywords: ['工业设计', '外观', 'id', 'cmf', '产品设计'],
    opcFit: 0.8, cityBoost: { shenzhen: 1, shanghai: 0.75 },
    market: { buyers: 300_000, buyersLabel: '硬件与消费品品牌', adoption: 0.1, frequency: 1, price: 60_000, industrySize: 200 * Y, industryLabel: '工业设计服务', serviceShare: 0.1, cagr: 0.1, geo: 'global', chinaShareOfGlobal: 0.3, cityBasis: 'gdp', reach: 0.4, competitors: 15_000, capacity: 15, sources: '工业设计服务市场（行业研究）' },
  },
  // —— 以下两条用来检验审核：命中合规红线，永远不会被展示 ——
  {
    id: 'traffic_brush', title: '直播间刷量与控评', industry: 'marketing',
    pitch: '为直播间提供刷量、控评。', firstStep: '—',
    fromCaps: { livestream: 0.95, community_ops: 0.8 }, keywords: ['直播', '流量'], opcFit: 0.9,
    market: { buyers: 3_000_000, buyersLabel: '开播商家', adoption: 0.01, frequency: 12, price: 1_000, industrySize: 58_000 * Y, industryLabel: '直播电商 GMV', serviceShare: 0.0006, cagr: 0.1, geo: 'national', cityBasis: 'gdp', reach: 0.5, competitors: 10_000, capacity: 500, sources: '—' },
  },
  {
    id: 'loan_lead', title: '网贷导流', industry: 'education',
    pitch: '为网贷平台导流获客。', firstStep: '—',
    fromCaps: { consulting: 0.7, community_ops: 0.6 }, keywords: ['贷款', '金融'], opcFit: 0.9,
    market: { buyers: 10_000_000, buyersLabel: '—', adoption: 0.01, frequency: 1, price: 200, industrySize: 200 * Y, industryLabel: '—', serviceShare: 0.1, cagr: 0, geo: 'national', cityBasis: 'gdp', reach: 0.5, competitors: 10_000, capacity: 1_000, sources: '—' },
  },
];

// ————————————————————— 资料 → 能力画像 —————————————————————

/** 匹配前问玩家的 3 个小问题 + 自由补充（开了店会记到店铺资料里） */
export interface EcoAnswers {
  /** 最拿手的能力（能力标签 id，最多 3 个） */
  skills: string[];
  /** 最想往哪拓展 */
  direction: 'any' | 'downstream' | 'upstream' | 'peer' | 'cross';
  /** 生意能做多远 */
  reach: 'local' | 'national' | 'global';
  /** 自由补充：营业范围、产品、公司介绍、资源…… */
  note: string;
  updatedAt?: number;
}
export const EMPTY_ANSWERS: EcoAnswers = { skills: [], direction: 'any', reach: 'national', note: '' };
export const DIRECTION_LABEL: Record<EcoAnswers['direction'], string> = { any: '都可以', downstream: '找新客户（下游）', upstream: '做上游供应', peer: '和同行联合', cross: '跨界新赛道' };
export const REACH_LABEL: Record<EcoAnswers['reach'], string> = { local: '本地线下', national: '全国线上', global: '想出海' };

export interface EcoInput {
  name?: string;
  /** 一切资料拼在一起：营业范围、产品介绍、公司介绍、上传资料提炼、正在找、案例 …… */
  text: string;
  /** 已确认的能力标签（来自「我的生意」画像） */
  capabilities?: string[];
  industries?: string[];
  city: CityId;
  /** 【例】示范店不生成（系统示范，不进入产业链） */
  isExample?: boolean;
  /** 玩家回答的问题（让匹配更准） */
  answers?: EcoAnswers;
}

export interface EcoProfile { caps: string[]; industries: string[]; text: string; city: CityId; answers?: EcoAnswers }

export function buildEcoProfile(input: EcoInput): EcoProfile {
  const raw = [input.text, input.answers?.note].filter(Boolean).join('。');
  const text = raw.toLowerCase();
  const x = text.trim() ? extractProfile(raw) : undefined;
  const caps = Array.from(new Set([...(input.answers?.skills ?? []), ...(input.capabilities ?? []), ...(x?.capabilities.map((c) => c.tag) ?? [])])).filter((c) => CAPABILITIES.some((d) => d.id === c));
  const inds = Array.from(new Set([...(input.industries ?? []), ...(x?.industries ?? []), ...caps.map((c) => CAPABILITIES.find((d) => d.id === c)!.industry)]));
  return { caps, industries: inds, text, city: input.city, answers: input.answers };
}

// ————————————————————— 市场价值 —————————————————————

export interface MarketValue {
  scope: Scope;
  scopeLabel: string;
  bottomUp: number;
  topDown: number;
  /** 市场规模（年营收，元） */
  tam: number;
  /** 可服务市场 */
  sam: number;
  /** 你 3 年内可获得 */
  som: number;
  /** 一人年产能上限 */
  capacityCap: number;
  /** 3 年后的市场规模 */
  tam3y: number;
  /** 自下而上与自上而下的差距倍数 */
  divergence: number;
  confidence: 'high' | 'mid' | 'low';
  /** 计算过程（展示给用户） */
  steps: string[];
}

export function canGoGlobal(n: NicheDef) { return n.market.geo === 'global' && !!n.market.chinaShareOfGlobal; }
export function isLocal(n: NicheDef) { return n.market.geo === 'local'; }
/** 默认范围：有地域限制 → 本城市；否则中国 */
export function defaultScope(n: NicheDef): Scope { return isLocal(n) ? 'city' : 'china'; }
export function allowedScopes(n: NicheDef): Scope[] {
  return isLocal(n) ? ['city', 'china'] : canGoGlobal(n) ? ['china', 'global'] : ['china'];
}

export function marketValue(n: NicheDef, city: CityId, scope: Scope = defaultScope(n), fit = 0.7): MarketValue {
  const m = n.market;
  if (!allowedScopes(n).includes(scope)) scope = defaultScope(n);
  const bottomUp = m.buyers * m.adoption * m.frequency * m.price;
  const topDown = m.industrySize * m.serviceShare;
  const chinaTam = Math.sqrt(bottomUp * topDown);
  const divergence = Math.max(bottomUp, topDown) / Math.max(1, Math.min(bottomUp, topDown));
  const cs = CITY_SHARE[city];
  const cityRatio = m.cityBasis === 'gdp' ? cs.gdp : cs.retail;
  const ratio = scope === 'city' ? cityRatio : scope === 'global' ? 1 / (m.chinaShareOfGlobal ?? 1) : 1;
  const tam = chinaTam * ratio;
  const sam = tam * m.reach;
  // 同赛道服务商按同一范围折算；竞争力系数 0.5–1.5 随匹配度
  const comp = Math.max(1, m.competitors * (scope === 'city' ? cityRatio : scope === 'global' ? 1 / (m.chinaShareOfGlobal ?? 1) : 1));
  const capacityCap = m.capacity * m.price;
  const som = Math.min(sam / comp * (0.5 + fit), capacityCap);
  const tam3y = tam * Math.pow(1 + m.cagr, 3);
  const confidence = divergence <= 1.5 ? 'high' : divergence <= 3 ? 'mid' : 'low';
  const scopeLabel = scope === 'city' ? `本城市 · ${cs.name}` : scope === 'global' ? '全球' : '中国';
  const steps = [
    `自下而上：${m.buyersLabel} ${fmtCount(m.buyers)} × 年渗透率 ${pct(m.adoption)} × 年频次 ${m.frequency} 次 × 客单价 ${fmtYuan(m.price)} = ${fmtYuan(bottomUp)}`,
    `自上而下：${m.industryLabel} ${fmtYuan(m.industrySize)} × 细分占比 ${pct(m.serviceShare)} = ${fmtYuan(topDown)}`,
    `三角验证：中国市场规模 = √(${fmtYuan(bottomUp)} × ${fmtYuan(topDown)}) = ${fmtYuan(chinaTam)}（两种算法相差 ${divergence.toFixed(1)} 倍，可信度${confidence === 'high' ? '高' : confidence === 'mid' ? '中' : '低'}）`,
    scope === 'city' ? `本城市折算：× ${cs.name}占全国${m.cityBasis === 'gdp' ? ' GDP ' : '社会消费品零售总额'}比重 ${pct(cityRatio)} = ${fmtYuan(tam)}`
      : scope === 'global' ? `全球折算：÷ 中国占全球比重 ${pct(m.chinaShareOfGlobal ?? 1)} = ${fmtYuan(tam)}` : `范围：中国国内`,
    `可服务市场 SAM = ${fmtYuan(tam)} × 小微服务商可触达 ${pct(m.reach)} = ${fmtYuan(sam)}`,
    `你可获得 SOM（3 年）= min(${fmtYuan(sam)} ÷ 同赛道约 ${fmtCount(comp)} 家 × 竞争力 ${(0.5 + fit).toFixed(2)}，一人年产能 ${m.capacity} 单 × ${fmtYuan(m.price)} = ${fmtYuan(capacityCap)}) = ${fmtYuan(som)}`,
    `年复合增长 ${pct(m.cagr)}：3 年后市场规模约 ${fmtYuan(tam3y)}`,
    `数据口径：${m.sources}（约 2024 年量级，取整）`,
  ];
  return { scope, scopeLabel, bottomUp, topDown, tam, sam, som, capacityCap, tam3y, divergence, confidence, steps };
}

// ————————————————————— 审核 —————————————————————

export interface ReviewCheck { name: string; ok: boolean; level: 'pass' | 'warn' | 'reject'; note: string }
export interface Review { status: 'pass' | 'warn' | 'reject'; checks: ReviewCheck[] }

export function reviewNiche(n: NicheDef): Review {
  const hay = `${n.title}${n.pitch}`;
  const hit = BANNED.find((w) => hay.includes(w));
  const bu = n.market.buyers * n.market.adoption * n.market.frequency * n.market.price;
  const td = n.market.industrySize * n.market.serviceShare;
  const div = Math.max(bu, td) / Math.max(1, Math.min(bu, td));
  const checks: ReviewCheck[] = [
    hit ? { name: '合规红线', ok: false, level: 'reject', note: `涉及「${hit}」，违反平台规则与法律法规，不予展示` }
      : { name: '合规红线', ok: true, level: 'pass', note: '未涉及违法违规、虚假交易、金融导流等内容' },
    n.license ? { name: '经营资质', ok: true, level: 'warn', note: `需要：${n.license}` }
      : { name: '经营资质', ok: true, level: 'pass', note: '一般经营范围，个体或公司均可开展' },
    div > 3 ? { name: '估算可信度', ok: false, level: 'reject', note: `两种算法相差 ${div.toFixed(1)} 倍，数据不一致，暂不展示` }
      : { name: '估算可信度', ok: true, level: div > 2 ? 'warn' : 'pass', note: `自下而上与自上而下相差 ${div.toFixed(1)} 倍` },
    n.opcFit < 0.5 ? { name: '一人可交付', ok: true, level: 'warn', note: '启动资金或人手要求较高，建议找搭档' }
      : { name: '一人可交付', ok: true, level: 'pass', note: '轻资产、一个人可以起步' },
    n.market.sources && n.market.sources !== '—' ? { name: '数据来源', ok: true, level: 'pass', note: n.market.sources }
      : { name: '数据来源', ok: false, level: 'reject', note: '没有可追溯的数据来源' },
  ];
  const status = checks.some((c) => c.level === 'reject') ? 'reject' : checks.some((c) => c.level === 'warn') ? 'warn' : 'pass';
  return { status, checks };
}

// ————————————————————— 匹配打分 —————————————————————

export interface MatchBreakdown { strength: number; text: number; industry: number; opportunity: number; opcFit: number; geo: number }
export interface NicheMatch {
  niche: NicheDef;
  score: number;
  /** 匹配度百分比（1–99） */
  match: number;
  breakdown: MatchBreakdown;
  relation: Relation;
  /** 用到了你的哪些能力 */
  via: string[];
  why: string;
  review: Review;
  value: MarketValue;
}

export const WEIGHTS = { strength: 0.38, text: 0.12, industry: 0.12, opportunity: 0.18, opcFit: 0.12, geo: 0.08 } as const;

function relationOf(n: NicheDef, caps: string[], industries: string[]): Relation {
  const main = Object.entries(n.fromCaps).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (main && caps.includes(main)) return 'extend';
  const defs = caps.map((c) => CAPABILITIES.find((d) => d.id === c)).filter(Boolean) as typeof CAPABILITIES;
  if (main && defs.some((d) => d.peers.includes(main))) return 'peer';
  if (main && defs.some((d) => d.upstream.includes(main))) return 'upstream';
  if (defs.some((d) => d.buyerIndustries.includes(n.industry))) return 'downstream';
  if (industries.includes(n.industry)) return 'peer';
  return 'cross';
}

export function scoreNiche(n: NicheDef, p: EcoProfile): Omit<NicheMatch, 'review' | 'value'> {
  // 玩家亲口说「最拿手」的能力，权重上浮 15%
  const ws = p.caps.map((c) => ({ c, w: Math.min(1, (n.fromCaps[c] ?? 0) * (p.answers?.skills.includes(c) ? 1.15 : 1)) })).filter((x) => x.w > 0).sort((a, b) => b.w - a.w);
  const strength = Math.min(1, (ws[0]?.w ?? 0) + 0.2 * (ws[1]?.w ?? 0) + 0.1 * (ws[2]?.w ?? 0));
  const hits = n.keywords.filter((k) => p.text.includes(k.toLowerCase())).length;
  const text = Math.min(1, hits / Math.min(3, n.keywords.length));
  const industry = p.industries.reduce((mx, i) => Math.max(mx, i === n.industry ? 1 : INDUSTRIES.find((d) => d.id === i)?.related[n.industry] ?? INDUSTRIES.find((d) => d.id === n.industry)?.related[i] ?? 0), 0);
  const m = n.market;
  const chinaTam = Math.sqrt(m.buyers * m.adoption * m.frequency * m.price * m.industrySize * m.serviceShare);
  const sizeN = Math.max(0, Math.min(1, (Math.log10(chinaTam) - 8) / 3));
  const growthN = Math.max(0, Math.min(1, m.cagr / 0.4));
  const opportunity = 0.5 * sizeN + 0.5 * growthN;
  const geo = n.cityBoost?.[p.city] ?? (m.geo === 'local' ? 0.75 : 0.7);
  const breakdown: MatchBreakdown = { strength, text, industry, opportunity, opcFit: n.opcFit, geo };
  const relation = relationOf(n, p.caps, p.industries);
  const score = Math.min(1, (Object.keys(WEIGHTS) as (keyof MatchBreakdown)[]).reduce((s, k) => s + WEIGHTS[k] * breakdown[k], 0) + prefBonus(n, relation, p.answers));
  // 用 0.7 次幂拉开头部差距：强匹配落在 85–99，弱相关落在 40–60
  const match = Math.max(1, Math.min(99, Math.round(100 * Math.pow(score, 0.7))));
  const via = ws.slice(0, 3).map((x) => CAPABILITIES.find((d) => d.id === x.c)!.label);
  const why = [
    via.length ? `你的「${via.join('、')}」是这个方向的核心能力` : hits ? `你的资料里提到了「${n.keywords.filter((k) => p.text.includes(k.toLowerCase())).slice(0, 3).join('、')}」` : '与你的行业相关',
    m.cagr >= 0.2 ? `赛道年增长约 ${pct(m.cagr)}` : m.cagr > 0 ? `赛道稳定增长（约 ${pct(m.cagr)} / 年）` : '存量市场、靠口碑与复购',
    n.cityBoost?.[p.city] && n.cityBoost[p.city]! >= 0.85 ? `${CITY_SHARE[p.city].name}是这个方向的重点城市` : m.geo === 'local' ? '需要本地线下交付' : '可全国线上接单',
  ].join('；');
  return { niche: n, score, match, breakdown, relation, via, why };
}

/** 问答偏好加分：方向一致 +0.06；市场范围一致 +0.03～0.06（不一致不扣分，只是不加） */
export function prefBonus(n: NicheDef, relation: Relation, a?: EcoAnswers): number {
  if (!a) return 0;
  let b = 0;
  if (a.direction !== 'any' && (relation === a.direction || (a.direction === 'peer' && relation === 'extend'))) b += 0.06;
  if (a.reach === 'local' && n.market.geo === 'local') b += 0.05;
  if (a.reach === 'national' && n.market.geo !== 'local') b += 0.03;
  if (a.reach === 'global' && n.market.geo === 'global') b += 0.06;
  return b;
}

export interface GenerateOptions {
  dismissed?: string[];
  /** 已收藏的方向（移入收藏夹，不再占 6 个推荐位） */
  favorites?: string[];
  scopes?: Record<string, Scope>;
  count?: number;
}

export interface GenerateResult {
  items: NicheMatch[];
  /** 审核拦截的方向数量与原因（透明展示） */
  blocked: { title: string; reason: string }[];
  /** 还剩多少个候选可以补位 */
  remaining: number;
  profile: EcoProfile;
}

export function generateNiches(input: EcoInput, opt: GenerateOptions = {}): GenerateResult {
  const profile = buildEcoProfile(input);
  const empty = { items: [], blocked: [], remaining: 0, profile };
  if (input.isExample) return empty;
  if (!profile.caps.length && !profile.text.trim()) return empty;
  const skip = new Set([...(opt.dismissed ?? []), ...(opt.favorites ?? [])]);
  const blocked: GenerateResult['blocked'] = [];
  const passed: NicheMatch[] = [];
  for (const n of NICHES) {
    const base = scoreNiche(n, profile);
    if (base.breakdown.strength === 0 && base.breakdown.text === 0 && base.breakdown.industry < 0.5) continue; // 与你无关
    const review = reviewNiche(n);
    if (review.status === 'reject') { blocked.push({ title: n.title, reason: review.checks.find((c) => c.level === 'reject')!.note }); continue; }
    if (skip.has(n.id)) continue;
    passed.push({ ...base, review, value: marketValue(n, profile.city, opt.scopes?.[n.id], base.score) });
  }
  passed.sort((a, b) => b.match - a.match || b.score - a.score || b.value.tam - a.value.tam);
  const count = opt.count ?? 6;
  return { items: passed.slice(0, count), blocked, remaining: Math.max(0, passed.length - count), profile };
}

export function matchOne(id: string, input: EcoInput, scope?: Scope): NicheMatch | undefined {
  const n = NICHES.find((x) => x.id === id);
  if (!n) return undefined;
  const profile = buildEcoProfile(input);
  const base = scoreNiche(n, profile);
  return { ...base, review: reviewNiche(n), value: marketValue(n, profile.city, scope, base.score) };
}

// ————————————————————— 格式化 —————————————————————

export function fmtYuan(v: number): string {
  if (!isFinite(v)) return '—';
  if (v >= 1e12) return `${(v / 1e12).toFixed(v >= 1e13 ? 0 : 1)} 万亿元`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(v >= 1e10 ? 0 : 1)} 亿元`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(v >= 1e6 ? 0 : 1)} 万元`;
  return `${Math.round(v)} 元`;
}
export function fmtCount(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1).replace(/\.0$/, '')} 亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1).replace(/\.0$/, '')} 万`;
  return `${Math.round(v)}`;
}
function pct(v: number): string {
  const p = v * 100;
  return `${p >= 10 ? Math.round(p) : p >= 1 ? p.toFixed(1).replace(/\.0$/, '') : p.toFixed(2).replace(/0$/, '')}%`;
}
