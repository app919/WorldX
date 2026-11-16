/**
 * 成长等级（一个数字看懂自己在街区里的进度）：经验 = 星星 + 成长值 × 3。
 * 星星：逛街、做任务、打招呼、签到获得；成长值：开店、对接、合作这些「生意上的进步」获得（权重更高）。
 * 等级只解锁装扮与社区权限，不能买排名、不能买口碑。
 */
export interface Level { lv: number; name: string; need: number; unlock: string }
export const LEVELS: Level[] = [
  { lv: 1, name: '新邻居', need: 0, unlock: '逛街、进店、打个飞的' },
  { lv: 2, name: '熟面孔', need: 40, unlock: '名片换个边框' },
  { lv: 3, name: '街坊', need: 100, unlock: '小店遮阳棚换款式' },
  { lv: 4, name: '好邻居', need: 200, unlock: '可以发起社区活动' },
  { lv: 5, name: '街区达人', need: 350, unlock: '每月 1 次免费商业门诊' },
  { lv: 6, name: '城市合伙人', need: 550, unlock: '主题周活动优先报名' },
  { lv: 7, name: '三邻之星', need: 800, unlock: '年度纪念徽章与街区荣誉墙' },
];

export const xpOf = (w: { stars: number; growth: number }) => w.stars + w.growth * 3;

export function levelOf(w: { stars: number; growth: number }) {
  const xp = xpOf(w);
  let cur = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.need) cur = l;
  const next = LEVELS.find((l) => l.lv === cur.lv + 1);
  const pct = next ? (xp - cur.need) / (next.need - cur.need) : 1;
  return { ...cur, xp, next, pct: Math.max(0, Math.min(1, pct)) };
}
