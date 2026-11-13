/**
 * 打工挣钞票 + 消费（纯逻辑，可单测）。
 *
 * - 「街区钞票」是游戏内虚拟货币：只能靠在街上打工获得，只能在街区小店里消费；
 *   不能充值、不能兑换人民币、不能提现，也不能购买排名或口碑（与真实交易严格分开）。
 * - 体力：打工消耗体力，吃喝补充体力，在公园里歇一歇也能慢慢恢复。
 * - 两种打工：
 *   1. 跑腿送货：到 A 店取货，沿人行道 / 斑马线送到 B 店（看路名牌和小地图找路）；
 *   2. 店里帮工：在店里按顾客的单子配齐东西（咖啡、花束、买菜、茶歇、摄影布景）。
 */
import { rng } from '../world/geom';

export type GameKind = 'coffee' | 'flower' | 'grocery' | 'tea' | 'studio';

export const CASH_NOTICE = '街区钞票只能靠在街上打工获得、只能在街区小店里消费；不能充值、不能兑换人民币、不能提现，也不能买排名或口碑。';

export const STAMINA_MAX = 100;
export const COST = { delivery: 12, shift: 16 } as const;

export interface Place { lotId: string; name: string; street: string }

export type Job =
  | { kind: 'delivery'; id: string; district: string; title: string; from: Place; to: Place; goods: string; pay: number; minutes: number }
  | { kind: 'shift'; id: string; district: string; title: string; at: Place; game: GameKind; payPerOrder: number; orders: number };

export interface ActiveJob { job: Job; picked: boolean; startedAt: number }

const GOODS: Record<GameKind, string[]> = {
  coffee: ['一袋咖啡豆', '两杯冰美式', '一盒可颂'],
  flower: ['一束向日葵', '一盆尤加利', '一份节日花礼'],
  grocery: ['一袋新鲜蔬菜', '一箱鸡蛋', '一份净菜套餐'],
  tea: ['一套茶歇点心', '一壶桂花茶'],
  studio: ['一卷背景布', '一台补光灯', '一套样品'],
};

/** 根据店铺类型决定帮工小游戏 */
export function gameOf(p: { facade?: string; capabilities?: string[]; category?: string }): GameKind {
  if (p.capabilities?.includes('florist')) return 'flower';
  if (p.capabilities?.includes('coffee') || p.facade === 'cafe') return 'coffee';
  if (p.capabilities?.includes('grocery') || p.facade === 'kiosk') return 'grocery';
  if (p.capabilities?.some((c) => c === 'photo' || c === 'venue_provider') || p.facade === 'studio') return 'studio';
  return 'tea';
}

/** 今天这条街上的短工（同一天内稳定，不会刷新出无限的活） */
export function jobsFor(district: string, places: (Place & { game: GameKind; p: { x: number; z: number } })[], day: number): Job[] {
  const R = rng(day * 977 + district.length * 31 + 7);
  const jobs: Job[] = [];
  for (const pl of places) {
    jobs.push({ kind: 'shift', id: `shift_${pl.lotId}_${day}`, district, title: SHIFT_TITLE[pl.game], at: pl, game: pl.game, payPerOrder: 6 + Math.floor(R() * 3), orders: 4 });
  }
  if (places.length >= 2) {
    const n = Math.min(4, places.length);
    for (let k = 0; k < n; k++) {
      const a = places[Math.floor(R() * places.length)];
      let b = places[Math.floor(R() * places.length)];
      for (let g = 0; g < 8 && b.lotId === a.lotId; g++) b = places[Math.floor(R() * places.length)];
      if (b.lotId === a.lotId) continue;
      const d = Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z);
      const goods = GOODS[a.game][Math.floor(R() * GOODS[a.game].length)];
      jobs.push({
        kind: 'delivery', id: `del_${a.lotId}_${b.lotId}_${day}_${k}`, district, title: `跑腿：把${goods}送到「${b.name}」`, from: a, to: b, goods,
        pay: Math.round(10 + d / 6), minutes: Math.max(3, Math.round(d / 40) + 2),
      });
    }
  }
  return jobs;
}

const SHIFT_TITLE: Record<GameKind, string> = {
  coffee: '咖啡店帮工：按单做饮品',
  flower: '花店帮工：按单包花束',
  grocery: '菜场帮工：按单配菜',
  tea: '会客厅帮工：准备茶歇',
  studio: '摄影棚帮工：按单搭布景',
};

/** 帮工小游戏的原料与订单 */
export interface Ingredient { id: string; label: string; emoji: string }
export interface Order { name: string; need: string[] }

export const INGREDIENTS: Record<GameKind, Ingredient[]> = {
  coffee: [
    { id: 'espresso', label: '浓缩', emoji: '☕' }, { id: 'milk', label: '牛奶', emoji: '🥛' }, { id: 'foam', label: '奶泡', emoji: '☁️' },
    { id: 'ice', label: '冰块', emoji: '🧊' }, { id: 'water', label: '热水', emoji: '💧' }, { id: 'oat', label: '燕麦奶', emoji: '🌾' }, { id: 'syrup', label: '桂花糖浆', emoji: '🍯' },
  ],
  flower: [
    { id: 'rose', label: '玫瑰', emoji: '🌹' }, { id: 'sunflower', label: '向日葵', emoji: '🌻' }, { id: 'tulip', label: '郁金香', emoji: '🌷' },
    { id: 'gyp', label: '满天星', emoji: '✨' }, { id: 'euca', label: '尤加利', emoji: '🌿' }, { id: 'wrap', label: '包装纸', emoji: '🎀' },
  ],
  grocery: [
    { id: 'tomato', label: '番茄', emoji: '🍅' }, { id: 'greens', label: '青菜', emoji: '🥬' }, { id: 'egg', label: '鸡蛋', emoji: '🥚' },
    { id: 'tofu', label: '豆腐', emoji: '🧈' }, { id: 'pork', label: '肉丝', emoji: '🥩' }, { id: 'scallion', label: '小葱', emoji: '🧅' },
  ],
  tea: [
    { id: 'tea', label: '绿茶', emoji: '🍵' }, { id: 'osm', label: '桂花', emoji: '🌼' }, { id: 'cake', label: '绿豆糕', emoji: '🍰' },
    { id: 'fruit', label: '果盘', emoji: '🍉' }, { id: 'cup', label: '茶杯', emoji: '🫖' },
  ],
  studio: [
    { id: 'light', label: '补光灯', emoji: '💡' }, { id: 'bg', label: '背景布', emoji: '🟫' }, { id: 'reflector', label: '反光板', emoji: '⚪' },
    { id: 'tripod', label: '三脚架', emoji: '📐' }, { id: 'prop', label: '小道具', emoji: '🪴' },
  ],
};

const RECIPES: Record<GameKind, Order[]> = {
  coffee: [
    { name: '美式', need: ['espresso', 'water'] }, { name: '拿铁', need: ['espresso', 'milk', 'foam'] },
    { name: '冰拿铁', need: ['ice', 'espresso', 'milk'] }, { name: '燕麦拿铁', need: ['espresso', 'oat', 'foam'] },
    { name: '桂花拿铁', need: ['espresso', 'milk', 'syrup'] }, { name: '冰美式', need: ['ice', 'espresso', 'water'] },
  ],
  flower: [
    { name: '告白花束', need: ['rose', 'rose', 'gyp', 'wrap'] }, { name: '阳光花束', need: ['sunflower', 'euca', 'wrap'] },
    { name: '春日花束', need: ['tulip', 'tulip', 'euca', 'wrap'] }, { name: '小清新', need: ['gyp', 'euca', 'wrap'] },
  ],
  grocery: [
    { name: '番茄炒蛋套餐', need: ['tomato', 'tomato', 'egg', 'scallion'] }, { name: '小葱拌豆腐', need: ['tofu', 'scallion'] },
    { name: '青菜肉丝', need: ['greens', 'pork'] }, { name: '一周早餐蛋', need: ['egg', 'egg', 'egg'] },
  ],
  tea: [
    { name: '桂花茶', need: ['tea', 'osm', 'cup'] }, { name: '下午茶', need: ['tea', 'cake', 'cup'] },
    { name: '水果茶歇', need: ['fruit', 'cake'] }, { name: '会议茶水', need: ['tea', 'cup', 'cup'] },
  ],
  studio: [
    { name: '白底产品图', need: ['bg', 'light', 'light'] }, { name: '人像', need: ['light', 'reflector', 'tripod'] },
    { name: '生活方式场景', need: ['bg', 'prop', 'light'] }, { name: '平铺俯拍', need: ['tripod', 'light', 'prop'] },
  ],
};

export function makeOrders(game: GameKind, n: number, seed: number): Order[] {
  const R = rng(seed);
  return Array.from({ length: n }, () => RECIPES[game][Math.floor(R() * RECIPES[game].length)]);
}

/** 托盘里的东西是否正好配齐（数量一致，顺序不限） */
export function matches(order: Order, tray: string[]): boolean {
  if (order.need.length !== tray.length) return false;
  const a = [...order.need].sort(), b = [...tray].sort();
  return a.every((x, i) => x === b[i]);
}

/** 帮工结算：每单基础工资 + 全部做对的奖励 */
export function shiftPay(job: Extract<Job, { kind: 'shift' }>, correct: number): number {
  return correct * job.payPerOrder + (correct === job.orders ? 6 : 0);
}

/** 跑腿结算：超时也给钱，但少给一些 */
export function deliveryPay(job: Extract<Job, { kind: 'delivery' }>, seconds: number): number {
  return seconds <= job.minutes * 60 ? job.pay : Math.max(4, Math.round(job.pay * 0.6));
}

/** 小店的消费菜单 */
export interface MenuItem { id: string; name: string; emoji: string; price: number; stamina?: number; keepsake?: boolean; note: string }
export const MENUS: Record<GameKind, MenuItem[]> = {
  coffee: [
    { id: 'm_americano', name: '冰美式', emoji: '🧋', price: 15, stamina: 15, note: '提神，体力 +15' },
    { id: 'm_latte', name: '桂花拿铁', emoji: '☕', price: 22, stamina: 22, note: '体力 +22' },
    { id: 'm_croissant', name: '可颂', emoji: '🥐', price: 18, stamina: 18, note: '体力 +18' },
    { id: 'm_beans', name: '梧桐拼配豆（纪念款）', emoji: '🫘', price: 60, keepsake: true, note: '放进背包留作纪念' },
  ],
  grocery: [
    { id: 'm_xlb', name: '小笼包', emoji: '🥟', price: 12, stamina: 22, note: '体力 +22' },
    { id: 'm_sj', name: '生煎', emoji: '🍳', price: 10, stamina: 18, note: '体力 +18' },
    { id: 'm_soy', name: '豆浆', emoji: '🥛', price: 4, stamina: 6, note: '体力 +6' },
    { id: 'm_fruit', name: '时令水果', emoji: '🍑', price: 8, stamina: 10, note: '体力 +10' },
  ],
  flower: [
    { id: 'm_rose', name: '一枝玫瑰', emoji: '🌹', price: 10, keepsake: true, note: '放进背包' },
    { id: 'm_bouquet', name: '小花束', emoji: '💐', price: 39, keepsake: true, note: '放进背包，可以装点自己的小店' },
    { id: 'm_lemon', name: '柠檬水', emoji: '🍋', price: 8, stamina: 10, note: '体力 +10' },
  ],
  tea: [
    { id: 'm_tea', name: '桂花茶', emoji: '🍵', price: 12, stamina: 14, note: '体力 +14' },
    { id: 'm_cake', name: '绿豆糕', emoji: '🍰', price: 8, stamina: 10, note: '体力 +10' },
    { id: 'm_set', name: '下午茶套餐', emoji: '🫖', price: 28, stamina: 32, note: '体力 +32' },
  ],
  studio: [
    { id: 'm_photo', name: '街拍明信片', emoji: '📸', price: 30, keepsake: true, note: '在店门口拍一张，放进背包' },
    { id: 'm_print', name: '拍立得', emoji: '🖼️', price: 15, keepsake: true, note: '放进背包' },
    { id: 'm_water', name: '矿泉水', emoji: '💧', price: 3, stamina: 5, note: '体力 +5' },
  ],
};

export interface Purse { cash: number; stamina: number; bag: string[]; earned: number; spent: number; jobsDone: number }
export const emptyPurse = (): Purse => ({ cash: 30, stamina: 80, bag: [], earned: 0, spent: 0, jobsDone: 0 });

export function canWork(p: Purse, job: Job): { ok: boolean; why?: string } {
  const c = job.kind === 'delivery' ? COST.delivery : COST.shift;
  if (p.stamina < c) return { ok: false, why: `体力不够（需要 ${c}）。去小店吃点东西，或者到公园歇一会儿吧` };
  return { ok: true };
}

export function startWork(p: Purse, job: Job): Purse {
  return { ...p, stamina: Math.max(0, p.stamina - (job.kind === 'delivery' ? COST.delivery : COST.shift)) };
}

export function getPaid(p: Purse, amount: number): Purse {
  return { ...p, cash: p.cash + amount, earned: p.earned + amount, jobsDone: p.jobsDone + 1 };
}

export function buy(p: Purse, item: MenuItem): { ok: boolean; purse: Purse; why?: string } {
  if (p.cash < item.price) return { ok: false, purse: p, why: `钞票不够（还差 ${item.price - p.cash}），去打份工吧` };
  if (item.stamina && p.stamina >= STAMINA_MAX) return { ok: false, purse: p, why: '已经吃饱啦，体力是满的' };
  return {
    ok: true,
    purse: {
      ...p, cash: p.cash - item.price, spent: p.spent + item.price,
      stamina: Math.min(STAMINA_MAX, p.stamina + (item.stamina ?? 0)),
      bag: item.keepsake ? [...p.bag, item.id] : p.bag,
    },
  };
}

/** 在公园里歇着：每秒恢复体力 */
export function rest(p: Purse, seconds: number): Purse {
  return { ...p, stamina: Math.min(STAMINA_MAX, p.stamina + seconds * 2.5) };
}

export const itemById = (id: string) => Object.values(MENUS).flat().find((m) => m.id === id);
