/**
 * 游戏经济：虚拟奖励与真实商业严格分开。
 *
 * | 体系         | 用途                 | 可兑换人民币 |
 * | 街区星星     | 打卡、探索、社交奖励 | 否           |
 * | 创业成长值   | 店铺成长、社区贡献   | 否           |
 * | 真实订单金额 | 实际交易             | 按合法交易规则结算（不在此模块） |
 *
 * 本模块刻意不提供任何“兑换 / 转账 / 购买排名”的函数。
 */
import type { Wallet } from './types';

export type RewardEvent =
  | 'daily_login' | 'citywalk_checkin' | 'building_visit' | 'make_friend'
  | 'send_hello' | 'meeting_booked' | 'event_joined' | 'shop_opened' | 'shop_decorated'
  | 'verified_review' | 'helped_match';

const TABLE: Record<RewardEvent, { stars?: number; growth?: number; badge?: string; sticker?: string }> = {
  daily_login: { stars: 5 },
  citywalk_checkin: { stars: 3, sticker: 'CityWalk 贴纸' },
  building_visit: { stars: 2 },
  make_friend: { stars: 3 },
  send_hello: { stars: 2 },
  meeting_booked: { growth: 10 },
  event_joined: { growth: 5, badge: '社区贡献' },
  shop_opened: { growth: 20, badge: '开张大吉' },
  shop_decorated: { stars: 5 },
  // 只有经过核实的真实交易评价才增加经营成长值；不能通过刷单获得
  verified_review: { growth: 15 },
  helped_match: { growth: 8, badge: '互助徽章' },
};

export const emptyWallet = (): Wallet => ({ stars: 0, growth: 0, badges: [], stickers: [] });

export function reward(w: Wallet, e: RewardEvent): Wallet {
  const r = TABLE[e];
  return {
    stars: w.stars + (r.stars ?? 0),
    growth: w.growth + (r.growth ?? 0),
    badges: r.badge && !w.badges.includes(r.badge) ? [...w.badges, r.badge] : w.badges,
    stickers: r.sticker && !w.stickers.includes(r.sticker) ? [...w.stickers, r.sticker] : w.stickers,
  };
}

export const ECONOMY_NOTICE = '街区星星与创业成长值只用于游戏内成长，不能兑换人民币，也不能购买排名或口碑。';

/** 城市繁荣度：由真实连接驱动，而不是充值 */
export function prosperity(stats: { shops: number; confirmedIntros: number; meetings: number; events: number }): number {
  return Math.min(100, stats.shops * 6 + stats.confirmedIntros * 8 + stats.meetings * 10 + stats.events * 4);
}
