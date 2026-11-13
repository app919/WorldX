/**
 * 打工与消费的状态（与商业撮合状态分开存放）。
 * 钞票只在游戏内流通：打工挣、小店花，不能充值 / 兑换 / 提现。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { COUNTERPARTIES, SHOPS } from '../data/seed';
import { allLots } from '../world';
import {
  buy, canWork, deliveryPay, emptyPurse, gameOf, getPaid, itemById, jobsFor, rest, shiftPay, startWork,
  type ActiveJob, type GameKind, type Job, type Place, type Purse,
} from '../domain/work';
import { playerRuntime, useTown } from './useTown';

export const today = () => Math.floor(Date.now() / 86400000);

/** 某个街区里可以打工 / 消费的小店（有名字的铺位） */
export function workPlaces(district: string): (Place & { game: GameKind; p: { x: number; z: number }; trigger: { x: number; z: number } })[] {
  const out: (Place & { game: GameKind; p: { x: number; z: number }; trigger: { x: number; z: number } })[] = [];
  for (const l of allLots().filter((x) => x.district === district)) {
    const lotId = l.door.lotId!;
    const shop = SHOPS.find((s) => s.lotId === lotId);
    const ent = COUNTERPARTIES.find((c) => c.place.lotId === lotId && c.kind !== 'individual');
    if (!shop && !ent) continue;
    const name = (shop?.name ?? ent!.name).replace('（虚构）', '').replace('（示意）', '');
    out.push({ lotId, name, street: l.street, game: gameOf({ facade: shop?.facade, capabilities: ent?.capabilities, category: shop?.category }), p: l.door.p, trigger: l.door.trigger });
  }
  return out;
}

export function placeOfLot(lotId: string) {
  for (const d of ['wukang', 'yangjing', 'sichuan_n']) { const p = workPlaces(d).find((x) => x.lotId === lotId); if (p) return { ...p, district: d }; }
  return undefined;
}

interface WorkState {
  purse: Purse;
  active?: ActiveJob;
  boardOpen: boolean;
  /** 正在进行的帮工小游戏 */
  shift?: Extract<Job, { kind: 'shift' }>;
  /** 打开的小店柜台（铺位 id） */
  counter?: string;
  doneToday: string[];
  day: number;

  openBoard(v: boolean): void;
  jobsHere(): Job[];
  accept(job: Job): boolean;
  cancel(): void;
  /** 玩家走到某个铺位门口：处理取货 / 送达 / 开始帮工。返回 true 表示已处理（不再打开店铺） */
  arrive(lotId: string): boolean;
  finishShift(correct: number): void;
  closeShift(): void;
  openCounter(lotId?: string): void;
  buyItem(itemId: string): void;
  restTick(seconds: number): void;
  guide(): void;
}

export const useWork = create<WorkState>()(
  persist(
    (set, get) => ({
      purse: emptyPurse(), boardOpen: false, doneToday: [], day: today(),

      openBoard: (boardOpen) => set({ boardOpen }),
      jobsHere() {
        const t = useTown.getState();
        if (get().day !== today()) set({ day: today(), doneToday: [] });
        return jobsFor(t.district, workPlaces(t.district), today()).filter((j) => !get().doneToday.includes(j.id));
      },
      accept(job) {
        const t = useTown.getState();
        if (get().active) { t.toast('先把手上的活干完（或者放弃）再接新的', 'warn'); return false; }
        const ok = canWork(get().purse, job);
        if (!ok.ok) { t.toast(ok.why!, 'warn'); return false; }
        set((s) => ({ purse: startWork(s.purse, job), active: { job, picked: false, startedAt: Date.now() }, boardOpen: false }));
        t.toast(job.kind === 'delivery' ? `接单！先去「${job.from.name}」（${job.from.street}）取货` : `接单！去「${job.at.name}」（${job.at.street}）帮工`, 'ok');
        get().guide();
        return true;
      },
      cancel() { set({ active: undefined }); useTown.getState().toast('已放弃这份工（体力不退）', 'info'); },
      guide() {
        const a = get().active;
        if (!a) return;
        const lotId = a.job.kind === 'delivery' ? (a.picked ? a.job.to.lotId : a.job.from.lotId) : a.job.at.lotId;
        const pl = placeOfLot(lotId);
        if (pl) useTown.getState().walkTo(pl.trigger);
      },
      arrive(lotId) {
        const a = get().active;
        const t = useTown.getState();
        if (!a) return false;
        if (a.job.kind === 'delivery') {
          if (!a.picked && lotId === a.job.from.lotId) {
            set({ active: { ...a, picked: true } });
            t.toast(`取到了${a.job.goods}！送到「${a.job.to.name}」（${a.job.to.street}），看路名牌和小地图找路`, 'ok');
            t.fxPush({ kind: 'envelope', from: playerRuntime });
            return true;
          }
          if (a.picked && lotId === a.job.to.lotId) {
            const pay = deliveryPay(a.job, (Date.now() - a.startedAt) / 1000);
            set((s) => ({ purse: getPaid(s.purse, pay), active: undefined, doneToday: [...s.doneToday, a.job.id] }));
            t.toast(`送达！挣到 💴 ${pay} 街区钞票`, 'ok');
            t.fxPush({ kind: 'coins', from: playerRuntime });
            return true;
          }
          return false;
        }
        if (lotId === a.job.at.lotId) { set({ shift: a.job }); return true; }
        return false;
      },
      finishShift(correct) {
        const a = get().active, t = useTown.getState();
        if (!a || a.job.kind !== 'shift') return;
        const pay = shiftPay(a.job, correct);
        set((s) => ({ purse: getPaid(s.purse, pay), active: undefined, shift: undefined, doneToday: [...s.doneToday, a.job.id] }));
        t.toast(`下班啦！做对 ${correct}/${a.job.orders} 单，挣到 💴 ${pay}`, 'ok');
        t.fxPush({ kind: 'coins', from: playerRuntime });
      },
      closeShift: () => set({ shift: undefined }),
      openCounter: (counter) => set({ counter }),
      buyItem(itemId) {
        const it = itemById(itemId), t = useTown.getState();
        if (!it) return;
        const r = buy(get().purse, it);
        if (!r.ok) { t.toast(r.why!, 'warn'); return; }
        set({ purse: r.purse });
        t.toast(it.stamina ? `${it.emoji} ${it.name}，体力 +${it.stamina}` : `${it.emoji} ${it.name} 放进了背包`, 'ok');
        t.fxPush({ kind: 'aroma', from: playerRuntime });
      },
      restTick: (sec) => set((s) => (s.purse.stamina >= 100 ? {} : { purse: rest(s.purse, sec) })),
    }),
    { name: 'opc-town-work', version: 1, partialize: (s) => ({ purse: s.purse, active: s.active, doneToday: s.doneToday, day: s.day }) },
  ),
);
