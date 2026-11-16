/**
 * 留存模拟（运营推演用，可单测）：模拟一批新用户从第 1 天到第 90 天每天回来的比例。
 *
 * 模型：用户第 d 天回来的概率 = 身份基础意愿 × 当天的“回来理由”之和（封顶 0.95）
 *   回来理由 = 目标（有任务可做）+ 新鲜感（还有没逛过的东西）+ 社交（有人回我 / 有人找我）+ 习惯（连续签到）+ 事件（主题周、升级）
 * 连续 7 天没回来的人视为流失（之后只有很小的概率被消息召回）。
 * 这是一个透明的推演模型，参数写在下面，用来比较“现在的系统”和“补上留存机制之后”，不是真实数据。
 */
export type Persona = 'opc' | 'investor' | 'brand' | 'side_hustle' | 'visitor';
export const PERSONA_LABEL: Record<Persona, string> = { opc: 'OPC 主理人', investor: '投资人', brand: '品牌方', side_hustle: '在职看副业', visitor: '游客' };
/** 身份基础意愿（有真实生意需求的人更愿意回来） */
const BASE: Record<Persona, number> = { opc: 0.6, investor: 0.5, brand: 0.55, side_hustle: 0.52, visitor: 0.42 };
/** 身份的新鲜感耐久（游客最容易逛腻，投资人看项目最久） */
const NOVELTY_DAYS: Record<Persona, number> = { opc: 9, investor: 12, brand: 8, side_hustle: 7, visitor: 6 };

export interface Features {
  /** 新手 7 天任务 */
  newbie7: boolean;
  /** 第 8 天以后的每日委托（每天 3 件，按身份轮换） */
  daily: boolean;
  /** 30 天签到日历与里程碑（3 / 7 / 14 / 21 / 30 天） */
  streak: boolean;
  /** 每周主题城市（5 座城市轮换，有专属活动与任务） */
  weeklyTheme: boolean;
  /** 不在线时留下的需求会被回复、回来时有“你不在的时候”摘要 */
  returnHooks: boolean;
  /** 成长等级（升级解锁装扮与社区权限） */
  levels: boolean;
  /** 月度赛季：签到日历每 30 天一轮，换新的赛季徽章与主题，不会在第 31 天“断档” */
  season: boolean;
}

export const CURRENT: Features = { newbie7: true, daily: false, streak: false, weeklyTheme: false, returnHooks: false, levels: false, season: false };
/** 只补到 30 天签到（用来说明第 31 天的断档） */
export const NO_SEASON: Features = { newbie7: true, daily: true, streak: true, weeklyTheme: true, returnHooks: true, levels: true, season: false };
export const IMPROVED: Features = { ...NO_SEASON, season: true };

export interface DayPoint { day: number; active: number; alive: number; reasons: { goal: number; novelty: number; social: number; habit: number; event: number } }

export function simulate(p: Persona, f: Features, days = 90): DayPoint[] {
  const out: DayPoint[] = [];
  let alive = 1; // 尚未流失的比例
  let streakWeight = 0; // 连续签到带来的习惯（群体平均）
  let gap = 0; // 群体平均“已经几天没来”（近似）
  for (let d = 1; d <= days; d++) {
    // 第 8 天：新手毕业礼（大礼包 + 解锁每日委托、主题周），把“任务突然没了”的落差接住
    const goal = d <= 7 && f.newbie7 ? 0.42 : f.daily ? 0.26 + (d >= 8 && d <= 10 ? 0.1 - (d - 8) * 0.03 : 0) : 0.06;
    const noveltyBase = Math.exp(-(d - 1) / NOVELTY_DAYS[p]) * 0.38;
    // 主题周：每周换一座主题城市，新鲜感在每周初回升一点（平滑的周节奏）
    const noveltyFloor = f.weeklyTheme ? 0.1 + 0.04 * Math.cos((2 * Math.PI * (d - 1)) / 7) : 0;
    const novelty = Math.max(noveltyBase, noveltyFloor);
    // 社交：OPC / 品牌方 / 投资人发出的需求和私信，被回复就会回来
    const socialNeed = p === 'visitor' ? 0.4 : p === 'side_hustle' ? 0.7 : 1;
    const afterCal = f.streak && d > 30 && !f.season; // 30 天日历走完、没有下一轮
    const social = (f.returnHooks ? 0.16 : 0.05) * socialNeed;
    const cd = f.season ? ((d - 1) % 30) + 1 : d;
    const habit = f.streak && !afterCal ? Math.min(0.2, streakWeight) + ([3, 7, 14, 21, 30].includes(cd) ? 0.06 : 0) : afterCal ? 0.02 : 0;
    const event = f.levels ? ([2, 5, 9, 15, 24, 36, 55].includes(d) ? 0.05 : 0.015) : 0;
    const pr = Math.min(0.95, BASE[p] * (goal + novelty + social + habit + event));
    const active = alive * pr;
    // 流失：连续 7 天不来的近似 —— 每天有 (1 - p)^7 / 7 的人流失；召回钩子让一部分流失的人回来
    const churn = alive * Math.pow(1 - pr, 5) / 5;
    const recall = (1 - alive) * (f.returnHooks ? 0.012 : 0.002);
    alive = Math.max(0, Math.min(1, alive - churn + recall));
    streakWeight = f.streak ? streakWeight * 0.92 + pr * 0.03 : 0;
    gap = gap * 0.8 + (1 - pr);
    out.push({ day: d, active, alive, reasons: { goal, novelty, social, habit, event } });
  }
  void gap;
  return out;
}

/** 活跃明显下滑的日子：当天活跃比前一天下降 ≥ 12%（相对值） */
export function dropDays(series: DayPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) if (series[i].active < series[i - 1].active * 0.88) out.push(series[i].day);
  return out;
}

export const at = (s: DayPoint[], d: number) => s[d - 1]?.active ?? 0;
