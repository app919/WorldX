/**
 * 社区活动（演示数据）。每个活动都要让人一眼判断“值不值得去”：
 * 地点、适合谁、能获得什么、流程、主办方、参加者类型、是否赞助、是否带产品、是否有商务对接、截止时间、退款规则。
 */
import type { DistrictKey } from '../domain/commerce';

export type SpaceKind = 'coffee_lounge' | 'startup_lounge' | 'street_market';

export const SPACE_INFO: Record<SpaceKind, { name: string; purpose: string; typical: string; features: string[] }> = {
  coffee_lounge: { name: '咖啡客厅', purpose: '兴趣与社交', typical: 'CityWalk、兴趣聊天、生活分享', features: ['长桌与咖啡机', '落地窗', '自由入座'] },
  startup_lounge: { name: '创业会客厅', purpose: '商务交流', typical: 'OPC 路演、产品发布、资源对接', features: ['产品展示屏', '主理人介绍', '商务需求墙', '线上会议室', 'AI 会议主持人'] },
  street_market: { name: '街区小市集', purpose: '商业展示', typical: '产品体验、品牌展示、现场销售', features: ['遮阳棚摊位', '产品陈列', '现场支付需商家自备'] },
};

export interface TownEvent {
  id: string;
  title: string;
  space: SpaceKind;
  district: DistrictKey;
  address: string;
  online: boolean;
  date: string; // 展示用
  time: string;
  deadline: string;
  capacity: number;
  /** 已报名的经营主体（用于“现场可能有你的潜在客户”） */
  attendees: string[];
  attendeeTypes: string[];
  audience: string;
  gains: string[];
  agenda: { t: string; what: string }[];
  hostEntity?: string;
  hostIntro: string;
  fee: number;
  refund: string;
  sponsor?: { brand: string; disclosure: string };
  bringProduct: boolean;
  matchmaking: boolean;
  needsApproval: boolean;
  aiHost: boolean;
  isDemo: boolean;
}

export const EVENTS: TownEvent[] = [
  {
    id: 'ev_brand_day', title: '独立品牌产品体验日', space: 'street_market', district: 'wukang', address: '武康路 · 武康大楼船头广场旁（示意）',
    online: false, date: '本周六', time: '14:00–15:30', deadline: '周五 20:00 截止报名', capacity: 80,
    attendees: ['e_wutong', 'e_chunri', 'e_lulu', 'e_guangying'], attendeeTypes: ['独立品牌主理人', '设计师', '摄影 / 视频创作者'],
    audience: '想认识本地独立品牌的创作者、服务商；也欢迎只是来逛逛的人',
    gains: ['试用 6 个本地品牌的新品', '和品牌主理人面对面交流', '在“需求墙”看到品牌近期的合作需求'],
    agenda: [{ t: '14:00', what: '主办方介绍' }, { t: '14:15', what: '产品体验' }, { t: '14:45', what: '品牌与 OPC 交流' }, { t: '15:15', what: '合作需求发布' }],
    hostEntity: 'e_wutong', hostIntro: '梧桐豆子主理人小满，做了三年独立咖啡品牌', fee: 0, refund: '免费活动，无需退款；不能参加请提前取消，把名额留给别人',
    bringProduct: false, matchmaking: true, needsApproval: false, aiHost: true, isDemo: true,
  },
  {
    id: 'ev_opc_night', title: '周三 OPC 创业者交流会', space: 'startup_lounge', district: 'yangjing', address: '张杨路 · 邻里会客厅',
    online: false, date: '本周三', time: '19:30–21:00', deadline: '周三 12:00 截止', capacity: 20,
    attendees: ['e_huike', 'e_market', 'e_dawei', 'e_meiyu'], attendeeTypes: ['一人公司主理人', '社区商家', '自由职业者'],
    audience: '正在做或想做一人公司的人', gains: ['3 分钟介绍自己的业务', '社区商家现场发布需求', 'AI 主持人会后整理可能的合作'],
    agenda: [{ t: '19:30', what: '自我介绍（每人 3 分钟）' }, { t: '20:15', what: '社区商家需求发布' }, { t: '20:40', what: '自由对接' }],
    hostEntity: 'e_huike', hostIntro: '小林，经营邻里会客厅两年', fee: 0, refund: '免费活动', bringProduct: false, matchmaking: true,
    needsApproval: false, aiHost: true, isDemo: true,
  },
  {
    id: 'ev_qixi', title: '甜爱路七夕情书市集', space: 'street_market', district: 'sichuan_n', address: '甜爱路 · 情诗墙沿线（示意）',
    online: false, date: '下周六', time: '15:00–19:00', deadline: '摊位报名下周三截止', capacity: 30,
    attendees: ['e_tianai', 'e_wedding', 'e_books', 'e_dimsum'], attendeeTypes: ['文创品牌', '写真 / 婚庆', '书店', '餐饮'],
    audience: '想在七夕节点做推广的品牌，以及为品牌提供内容服务的创作者', gains: ['摊位展示', '现场拍摄素材', '与写真馆、文创品牌对接节日合作'],
    agenda: [{ t: '15:00', what: '开市' }, { t: '16:30', what: '品牌节日合作对接' }, { t: '18:00', what: '情书朗读' }],
    hostEntity: 'e_tianai', hostIntro: '甜爱文创主理人小甜', fee: 99, refund: '活动前 72 小时可全额退款，之后不退（Demo 不发生真实支付）',
    sponsor: { brand: '演示品牌 · 奶油汽水', disclosure: '赞助内容' }, bringProduct: true, matchmaking: true, needsApproval: true, aiHost: false, isDemo: true,
  },
  {
    id: 'ev_citywalk', title: '武康路梧桐 CityWalk', space: 'coffee_lounge', district: 'wukang', address: '集合点：武康大楼船头广场（示意）',
    online: false, date: '周日', time: '09:30–11:00', deadline: '周六 22:00 截止', capacity: 16,
    attendees: ['e_lulu'], attendeeTypes: ['城市玩家', '摄影爱好者'], audience: '喜欢上海街道和老建筑的任何人',
    gains: ['认识新朋友', '城市漫步路线贴纸'], agenda: [{ t: '09:30', what: '集合' }, { t: '09:45', what: '漫步与讲解' }, { t: '10:45', what: '咖啡小聚' }],
    hostIntro: 'AI 社区主持人（明确为 AI，负责集合提醒与路线讲解）', fee: 0, refund: '免费活动', bringProduct: false, matchmaking: false,
    needsApproval: false, aiHost: true, isDemo: true,
  },
];
