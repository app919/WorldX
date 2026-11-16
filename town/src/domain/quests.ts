/**
 * 新手 7 天：不同身份不同的任务与奖励，每天一个主题、三件小事，覆盖「买 · 逛 · 跟」。
 * - 买：有明确需求，快速找到人、聊上、成交；
 * - 逛：看看大家在做什么，探店、换城市、看【例】；
 * - 跟：社区活动、集市、围观、报名，有热闹的氛围。
 * 第 N 天在玩家首次进入后的第 N 个自然日解锁（东八区）；已解锁的天随时可以补做。
 */
import type { GameEvent } from '../store/gameEvents';
import type { LifeTag } from './types';

export type QuestKind = '买' | '逛' | '跟';
export interface Quest { id: string; kind: QuestKind; title: string; hint: string; event: GameEvent; count: number; stars: number; growth: number }
export interface QuestDay { day: number; theme: string; badge: string; quests: Quest[] }

type Row = [QuestKind, string, string, GameEvent, number?];
const D = (tag: string, day: number, theme: string, badge: string, rows: Row[]): QuestDay => ({
  day, theme, badge,
  quests: rows.map(([kind, title, hint, event, count = 1], i) => ({
    id: `${tag}_d${day}_${i}`, kind, title, hint, event, count,
    stars: kind === '买' ? 15 : kind === '跟' ? 12 : 8, growth: kind === '买' ? 6 : kind === '跟' ? 4 : 2,
  })),
});

const OPC: QuestDay[] = [
  D('opc', 1, '开张大吉', '🏪 新店开张', [['逛', '参观一家【例】示范店，看看完整的小店长什么样', '粉色屋顶就是【例】示范店', 'visit_example'], ['买', '开一家自己的小店', '右下角「开一家小店」', 'open_shop'], ['逛', '在「我的生意」告诉 AI 你能提供什么', '底部「我的生意」', 'profile']]),
  D('opc', 2, '找到第一位客户', '🎯 获客新手', [['买', '在「今天来找什么」里搜一次', '右下角搜索框', 'search'], ['买', '打个飞的，飞到一家店门口', '搜索结果里的 ✈️', 'fly'], ['买', '向店铺 AI 分身问一个问题', '进店后点快捷问题', 'agent_ask']]),
  D('opc', 3, '认识左邻右舍', '🤝 好邻居', [['逛', '翻一翻产业链黄页', '底部「产业链」', 'view_chain'], ['买', '速配一次上下游', '在产业链里选你所在的环节', 'speed_match'], ['跟', '给一位邻居打招呼', '点街上的人', 'say_hello']]),
  D('opc', 4, '接一单试试', '📋 接单达人', [['买', '在机会广场投一次标', '底部「机会」', 'bid'], ['买', '找一位店主聊一聊（不在线就留需求）', '进店后点「聊一聊」', 'live_chat'], ['逛', '看看有哪些投资人', '搜「找投资人」', 'view_investor']]),
  D('opc', 5, '赶集日', '🎪 集市常客', [['跟', '围观一场正在进行的活动', '活动牌上的「围观」', 'watch_event'], ['跟', '报名一场社区活动', '「我的社区」', 'join_event'], ['逛', '刷一刷街区动态', '左下角「街区动态」', 'follow_feed']]),
  D('opc', 6, '去别的城市看看', '✈️ 城市旅人', [['逛', '换一个城市逛逛', '顶部城市切换', 'switch_city'], ['逛', '进两家店看看', '走到门口自动进店', 'enter_shop', 2], ['买', '在服务中心看一家财税 / 法务服务商', '右上角「服务中心」', 'center_service']]),
  D('opc', 7, '第一份合作', '🎉 合作达成', [['买', '和一位店主达成初步合作意向', '聊一聊 → 达成初步合作意向', 'deal'], ['跟', '在论坛分享一个小故事', '服务中心 → 论坛', 'forum'], ['逛', '随便逛逛，看看今天的街', '右下角「随便逛逛」', 'stroll']]),
];

const INVESTOR: QuestDay[] = [
  D('inv', 1, '看看大家在做什么', '🔍 项目雷达', [['逛', '参观一家【例】示范店', '粉色屋顶', 'visit_example'], ['买', '搜一个你关心的方向（比如“具身智能”）', '右下角搜索框', 'search'], ['买', '打个飞的过去看看', '搜索结果里的 ✈️', 'fly']]),
  D('inv', 2, '读懂产业链', '🔗 链上视角', [['逛', '翻一翻产业链黄页', '底部「产业链」', 'view_chain'], ['买', '速配一个环节，看看上下游', '在产业链里选一个环节', 'speed_match'], ['逛', '进一家店看看产品', '走到门口自动进店', 'enter_shop']]),
  D('inv', 3, '城市巡游', '🏙️ 城市巡游', [['逛', '换一个城市逛逛（深圳华强北很适合看硬件）', '顶部城市切换', 'switch_city'], ['逛', '进两家店看看', '走到门口', 'enter_shop', 2], ['买', '向店铺 AI 问一个问题', '进店后提问', 'agent_ask']]),
  D('inv', 4, '约个聊聊', '💬 早期发现者', [['买', '找一位主理人聊一聊', '「聊一聊」', 'live_chat'], ['买', '给不在线的主理人留一条需求 / 意向', '对方不在线时写需求', 'leave_need'], ['跟', '给一位邻居打招呼', '点街上的人', 'say_hello']]),
  D('inv', 5, '路演日', '🎤 路演观众', [['跟', '围观一场正在进行的活动', '活动牌上的「围观」', 'watch_event'], ['跟', '报名一场路演 / 对接会', '「我的社区」或服务中心活动', 'join_event'], ['逛', '刷一刷街区动态', '左下角「街区动态」', 'follow_feed']]),
  D('inv', 6, '同行交流', '🧭 资源连接者', [['逛', '看看服务中心的投资人与园区', '搜「找投资人」', 'view_investor'], ['买', '看一家服务商的套餐', '服务中心', 'center_service'], ['逛', '在同一个城市换个街区', '顶部街区切换', 'switch_district']]),
  D('inv', 7, '投出第一张意向', '🎉 意向达成', [['买', '和一位主理人达成初步合作意向', '聊一聊 → 达成初步合作意向', 'deal'], ['跟', '在论坛分享你的观察', '服务中心 → 论坛', 'forum'], ['逛', '随便逛逛', '右下角', 'stroll']]),
];

const BRAND: QuestDay[] = [
  D('brand', 1, '找内容伙伴', '🛍️ 品牌新人', [['买', '搜「找拍摄」或「找剪辑」', '右下角搜索框', 'search'], ['买', '打个飞的到评价分最高的那家', '搜索结果第一个 ✈️', 'fly'], ['逛', '参观一家【例】示范店', '粉色屋顶', 'visit_example']]),
  D('brand', 2, '把需求说清楚', '📝 需求高手', [['买', '找一位店主聊一聊', '「聊一聊」', 'live_chat'], ['买', '给不在线的店主留一条需求', '写清楚做什么 / 预算 / 时间', 'leave_need'], ['买', '向店铺 AI 问价格', '进店后问「多少钱？」', 'agent_ask']]),
  D('brand', 3, '发一张需求单', '📣 招标发起人', [['买', '在机会广场发布一条需求', '底部「机会」→ 发布', 'post_need'], ['逛', '翻一翻产业链黄页，找对口环节', '底部「产业链」', 'view_chain'], ['跟', '给一位邻居打招呼', '点街上的人', 'say_hello']]),
  D('brand', 4, '逛逛别的城市', '✈️ 渠道拓展', [['逛', '换一个城市逛逛（长沙五一商圈直播多）', '顶部城市切换', 'switch_city'], ['逛', '进两家店看看', '走到门口', 'enter_shop', 2], ['买', '速配一次上下游', '产业链里选环节', 'speed_match']]),
  D('brand', 5, '品牌市集', '🎪 市集主理', [['跟', '围观一场活动', '活动牌上的「围观」', 'watch_event'], ['跟', '报名一场活动', '「我的社区」', 'join_event'], ['逛', '刷一刷街区动态', '左下角「街区动态」', 'follow_feed']]),
  D('brand', 6, '找服务商', '🧾 靠谱后援', [['买', '在服务中心看一家服务商', '右上角「服务中心」', 'center_service'], ['逛', '在同一个城市换个街区', '顶部街区切换', 'switch_district'], ['买', '再搜一次需求', '右下角搜索框', 'search']]),
  D('brand', 7, '合作达成', '🎉 合作达成', [['买', '和一家店达成初步合作意向', '聊一聊 → 达成初步合作意向', 'deal'], ['跟', '在论坛分享合作故事', '服务中心 → 论坛', 'forum'], ['逛', '随便逛逛', '右下角', 'stroll']]),
];

const SIDE: QuestDay[] = [
  D('side', 1, '下班后的街', '🌆 下班逛逛', [['逛', '随便逛逛', '右下角「随便逛逛」', 'stroll'], ['逛', '参观一家【例】示范店，看看一人公司怎么做', '粉色屋顶', 'visit_example'], ['逛', '进一家店看看', '走到门口自动进店', 'enter_shop']]),
  D('side', 2, '打一份短工', '💼 街区打工人', [['买', '在打工告示板接一份工', '右上角「打工」', 'work'], ['买', '搜一个你会的技能（比如“剪辑”）', '右下角搜索框', 'search'], ['逛', '镜头拉近看看小人（＋ / －）', '左侧缩放按钮', 'zoom']]),
  D('side', 3, '找副业方向', '🧭 方向探索', [['逛', '翻一翻产业链黄页', '底部「产业链」', 'view_chain'], ['买', '速配一次', '产业链里选环节', 'speed_match'], ['逛', '在「我的生意」写下你会什么', '底部「我的生意」', 'profile']]),
  D('side', 4, '接第一单', '📋 副业起步', [['买', '在机会广场投一次标 / 接一次推广', '底部「机会」', 'bid'], ['买', '找一位店主聊一聊', '「聊一聊」', 'live_chat'], ['跟', '给一位邻居打招呼', '点街上的人', 'say_hello']]),
  D('side', 5, '周末集市', '🎪 集市常客', [['跟', '围观一场活动', '活动牌「围观」', 'watch_event'], ['跟', '报名一场活动', '「我的社区」', 'join_event'], ['逛', '刷一刷街区动态', '左下角', 'follow_feed']]),
  D('side', 6, '开个小店试试', '🏪 副业开张', [['买', '开一家自己的小店', '右下角「开一家小店」', 'open_shop'], ['逛', '换一个城市逛逛', '顶部城市切换', 'switch_city'], ['买', '看一家财税服务商（副业怎么报税）', '服务中心', 'center_service']]),
  D('side', 7, '第一份合作', '🎉 合作达成', [['买', '达成一次初步合作意向', '聊一聊 → 达成', 'deal'], ['跟', '在论坛分享经验', '服务中心 → 论坛', 'forum'], ['逛', '随便逛逛', '右下角', 'stroll']]),
];

const SERVICE: QuestDay[] = [
  D('svc', 1, '摆好服务摊', '🧾 服务开张', [['买', '开一家服务小店', '右下角「开一家小店」', 'open_shop'], ['逛', '参观一家【例】示范店（财税 / 设计都有）', '粉色屋顶', 'visit_example'], ['逛', '在「我的生意」写下你的服务', '底部「我的生意」', 'profile']]),
  D('svc', 2, '找到需要你的人', '🎯 客户雷达', [['买', '搜一下谁在找你这类服务', '右下角搜索框', 'search'], ['买', '打个飞的过去', '✈️', 'fly'], ['买', '向店铺 AI 了解需求', '进店后提问', 'agent_ask']]),
  D('svc', 3, '链上服务', '🔗 链上服务商', [['逛', '翻一翻产业链黄页', '底部「产业链」', 'view_chain'], ['买', '速配一次（看看哪些环节缺服务）', '产业链里选环节', 'speed_match'], ['逛', '看看服务中心的同行', '右上角「服务中心」', 'center_service']]),
  D('svc', 4, '接单', '📋 接单达人', [['买', '在机会广场投一次标', '底部「机会」', 'bid'], ['买', '找一位主理人聊一聊', '「聊一聊」', 'live_chat'], ['跟', '打个招呼', '点街上的人', 'say_hello']]),
  D('svc', 5, '商业门诊', '🎪 门诊坐诊', [['跟', '围观一场活动', '活动牌「围观」', 'watch_event'], ['跟', '报名一场商业门诊 / 对接会', '「我的社区」', 'join_event'], ['逛', '刷一刷街区动态', '左下角', 'follow_feed']]),
  D('svc', 6, '跨城服务', '✈️ 跨城接单', [['逛', '换一个城市逛逛', '顶部城市切换', 'switch_city'], ['逛', '进两家店看看', '走到门口', 'enter_shop', 2], ['买', '给不在线的主理人留一条需求', '对方不在线时写需求', 'leave_need']]),
  D('svc', 7, '合作达成', '🎉 合作达成', [['买', '达成一次初步合作意向', '聊一聊 → 达成', 'deal'], ['跟', '在论坛分享案例', '服务中心 → 论坛', 'forum'], ['逛', '随便逛逛', '右下角', 'stroll']]),
];

const VISITOR: QuestDay[] = [
  D('vis', 1, '初来乍到', '📷 街区游客', [['逛', '随便逛逛', '右下角「随便逛逛」', 'stroll'], ['逛', '镜头拉近看看（＋ / －）', '左侧缩放按钮', 'zoom'], ['逛', '参观一家【例】示范店', '粉色屋顶', 'visit_example']]),
  D('vis', 2, '探店日', '🍰 探店达人', [['逛', '进两家店看看', '走到门口自动进店', 'enter_shop', 2], ['买', '向店铺 AI 问一个问题', '进店后提问', 'agent_ask'], ['买', '在「今天来找什么」里搜一次', '右下角搜索框', 'search']]),
  D('vis', 3, '城市漫游', '🏙️ 城市漫游', [['逛', '换一个城市逛逛', '顶部城市切换', 'switch_city'], ['逛', '在同一个城市换个街区', '顶部街区切换', 'switch_district'], ['买', '打个飞的', '搜索结果里的 ✈️', 'fly']]),
  D('vis', 4, '打一份短工', '💼 街区打工人', [['买', '在打工告示板接一份工', '右上角「打工」', 'work'], ['跟', '给一位邻居打招呼', '点街上的人', 'say_hello'], ['逛', '刷一刷街区动态', '左下角「街区动态」', 'follow_feed']]),
  D('vis', 5, '赶集日', '🎪 集市常客', [['跟', '围观一场活动', '活动牌「围观」', 'watch_event'], ['跟', '报名一场活动', '「我的社区」', 'join_event'], ['逛', '翻一翻产业链黄页', '底部「产业链」', 'view_chain']]),
  D('vis', 6, '找点灵感', '💡 灵感收集', [['逛', '在「我的生意」写下你会什么', '底部「我的生意」', 'profile'], ['买', '找一位店主聊一聊', '「聊一聊」', 'live_chat'], ['逛', '看看投资人在关注什么', '搜「找投资人」', 'view_investor']]),
  D('vis', 7, '成为邻居', '🏠 新邻居', [['买', '开一家自己的小店', '右下角「开一家小店」', 'open_shop'], ['跟', '在论坛说说你的第一周', '服务中心 → 论坛', 'forum'], ['逛', '随便逛逛', '右下角', 'stroll']]),
];

export const QUEST_PLANS: Record<'opc' | 'investor' | 'brand' | 'side_hustle' | 'service' | 'visitor', QuestDay[]> = {
  opc: OPC, investor: INVESTOR, brand: BRAND, side_hustle: SIDE, service: SERVICE, visitor: VISITOR,
};

const LEGACY: Partial<Record<LifeTag, keyof typeof QUEST_PLANS>> = { worker: 'side_hustle', freelancer: 'service', retiree: 'visitor', student: 'visitor', explorer: 'visitor' };
export const planFor = (tag?: LifeTag): QuestDay[] => QUEST_PLANS[(tag && (LEGACY[tag] ?? tag)) as keyof typeof QUEST_PLANS] ?? VISITOR;

/** 今天是第几天（1–7；首次进入当天是第 1 天） */
export function dayIndex(startDay: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`);
  return Math.max(1, Math.min(7, Math.floor(ms / 86400000) + 1));
}

/* ———————— 第 8 天以后：每日委托 · 主题周 · 签到 ———————— */

/** 首次进入后的第几天（不封顶） */
export function rawDay(startDay: string, today: string): number {
  return Math.max(1, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86400000) + 1);
}

type PoolRow = [QuestKind, string, string, GameEvent, number?];
/** 每日委托题库（所有身份通用 + 身份专属），每天按日期抽 买 / 逛 / 跟 各一件 */
const POOL: Record<QuestKind, PoolRow[]> = {
  买: [['买', '搜一次今天的需求', '右下角搜索框', 'search'], ['买', '打个飞的去一家评价分高的店', '搜索结果 ✈️', 'fly'], ['买', '找一位店主聊一聊', '「聊一聊」', 'live_chat'],
    ['买', '向店铺 AI 问一个问题', '进店后提问', 'agent_ask'], ['买', '在机会广场投一次标', '底部「机会」', 'bid'], ['买', '速配一次上下游', '产业链', 'speed_match'], ['买', '看一家服务商的套餐', '服务中心', 'center_service']],
  逛: [['逛', '进两家店看看', '走到门口自动进店', 'enter_shop', 2], ['逛', '刷一刷街区动态', '左下角「街区动态」', 'follow_feed'], ['逛', '随便逛逛', '右下角', 'stroll'],
    ['逛', '参观一家【例】示范店', '粉色屋顶', 'visit_example'], ['逛', '在同一个城市换个街区', '顶部街区切换', 'switch_district'], ['逛', '翻一翻产业链黄页', '底部「产业链」', 'view_chain']],
  跟: [['跟', '围观一场正在进行的活动', '活动牌「围观」', 'watch_event'], ['跟', '报名一场活动', '活动现场 / 我的社区', 'join_event'], ['跟', '给一位邻居打招呼', '点街上的人', 'say_hello'], ['跟', '在论坛分享点什么', '服务中心 → 论坛', 'forum']],
};

const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** 本周主题城市：5 座城市按周轮换（周一开始） */
export const THEME_CITIES = [
  { id: 'shanghai', name: '上海', theme: '梧桐 CityWalk 周' }, { id: 'beijing', name: '北京', theme: '胡同文创周' }, { id: 'shenzhen', name: '深圳', theme: '硬件出海周' },
  { id: 'changsha', name: '长沙', theme: '夜经济直播周' }, { id: 'chengdu', name: '成都', theme: '设计与潮玩周' },
] as const;
export function themeOfWeek(today: string) {
  const days = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86400000) + 3; // 1970-01-01 是周四，+3 让周一换周
  const week = Math.floor(days / 7);
  return { ...THEME_CITIES[week % THEME_CITIES.length], week };
}

/** 某天的每日委托：买 / 逛 / 跟各一件；每周一和周四把「逛」换成“去本周主题城市” */
export function dailyFor(tag: string, today: string): QuestDay {
  const h = hashStr(`${tag}|${today}`);
  const theme = themeOfWeek(today);
  const pick = (k: QuestKind, n: number): Quest => {
    const [kind, title, hint, event, count = 1] = POOL[k][(h >>> n) % POOL[k].length];
    return { id: `daily_${today}_${k}`, kind, title, hint, event, count, stars: kind === '买' ? 12 : kind === '跟' ? 10 : 6, growth: kind === '买' ? 4 : kind === '跟' ? 3 : 1 };
  };
  const wd = (Math.floor(Date.parse(`${today}T00:00:00Z`) / 86400000) + 3) % 7; // 0 = 周一
  const browse: Quest = wd === 0 || wd === 3
    ? { id: `daily_${today}_逛`, kind: '逛', title: `去本周主题城市「${theme.name}」逛逛（${theme.theme}）`, hint: '顶部城市切换', event: 'switch_city', count: 1, stars: 15, growth: 2 }
    : pick('逛', 5);
  return { day: 0, theme: `每日委托 · ${theme.name}${theme.theme}`, badge: '', quests: [pick('买', 1), browse, pick('跟', 9)] };
}

/** 签到：30 天一季，季内第 3 / 7 / 14 / 21 / 30 次签到有里程碑奖励 */
export const CHECKIN_MILESTONES = [{ n: 3, stars: 20, label: '3 天' }, { n: 7, stars: 40, label: '一周' }, { n: 14, stars: 60, label: '两周' }, { n: 21, stars: 80, label: '三周' }, { n: 30, stars: 150, label: '全勤' }];
export function seasonOf(checkins: number) {
  const season = Math.floor(Math.max(0, checkins - 1) / 30) + 1;
  const inSeason = checkins === 0 ? 0 : ((checkins - 1) % 30) + 1;
  return { season, inSeason, next: CHECKIN_MILESTONES.find((m) => m.n > inSeason) };
}

/** 连续签到天数（今天或昨天结尾） */
export function streakOf(dates: string[], today: string): number {
  const set = new Set(dates);
  let d = Date.parse(`${today}T00:00:00Z`);
  if (!set.has(today)) d -= 86400000;
  let n = 0;
  while (set.has(new Date(d).toISOString().slice(0, 10))) { n++; d -= 86400000; }
  return n;
}

/** 第 8 天新手毕业礼 */
export const GRADUATION = { stars: 60, badge: '🎓 三邻邦毕业生' };
