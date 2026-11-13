/**
 * 打工挣钞票 + 消费 的界面：
 * - 顶栏钱包（💴 钞票 / ⚡ 体力）与「💼 打工」按钮；
 * - 打工告示板（本街区今天的短工）；
 * - 进行中的活（送货指引 / 带我去 / 放弃）；
 * - 店里帮工小游戏（按单配齐）；
 * - 小店柜台（买吃的补体力、买纪念品放进背包）。
 */
import { useEffect, useMemo, useState } from 'react';
import { CASH_NOTICE, COST, INGREDIENTS, MENUS, makeOrders, matches, itemById, type Job } from '../domain/work';
import { placeOfLot, useWork } from '../store/useWork';
import { useTown } from '../store/useTown';
import { Btn, Chip, Panel } from './kit';

export function PurseChip() {
  const enabled = useWork((s) => s.enabled);
  const purse = useWork((s) => s.purse);
  const openBoard = useWork((s) => s.openBoard);
  const [tip, setTip] = useState(false);
  if (!enabled) return null;
  return (
    <div className="relative flex items-center gap-1.5">
      <button data-testid="purse" onClick={() => setTip(!tip)} className="glass flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold">
        <span>💴 {purse.cash}</span>
        <span className={purse.stamina < 20 ? 'text-brick-500' : 'text-sage-700'}>⚡ {Math.round(purse.stamina)}</span>
      </button>
      <button data-testid="open-jobs" onClick={() => openBoard(true)} className="jelly bg-almond-400 px-3 py-1 text-xs font-black text-cocoa-800">💼 打工</button>
      {tip && (
        <div className="glass absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl p-3 text-xs">
          <div className="font-black">💴 街区钞票 {purse.cash} · ⚡ 体力 {Math.round(purse.stamina)}/100</div>
          <div className="mt-1 text-stone-600">累计打工挣 {purse.earned}，消费 {purse.spent}，完成 {purse.jobsDone} 份工。</div>
          <div className="mt-1 text-stone-600">打工消耗体力（跑腿 {COST.delivery}、帮工 {COST.shift}）；去小店吃点东西，或在公园里歇一会儿可以恢复。</div>
          {purse.bag.length > 0 && <div className="mt-1">🎒 背包：{purse.bag.map((id) => itemById(id)?.emoji).join(' ')}</div>}
          <div className="mt-1 text-[10px] text-stone-400">{CASH_NOTICE}</div>
        </div>
      )}
    </div>
  );
}

export function JobBoard() {
  const open = useWork((s) => s.boardOpen);
  const openBoard = useWork((s) => s.openBoard);
  const accept = useWork((s) => s.accept);
  const active = useWork((s) => s.active);
  const purse = useWork((s) => s.purse);
  const district = useTown((s) => s.district);
  const jobs = useMemo(() => (open ? useWork.getState().jobsHere() : []), [open, district, active]);
  if (!open || !useWork.getState().enabled) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center p-3 md:items-center">
      <Panel testId="job-board" title="💼 街区打工告示板" subtitle="今天这条街上的短工 · 靠双脚挣钞票，再到小店里花掉" onClose={() => openBoard(false)} className="max-h-[80vh] w-full max-w-lg">
        <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
          <Chip tone="almond">💴 {purse.cash}</Chip><Chip tone="sage">⚡ 体力 {Math.round(purse.stamina)}</Chip>
          {active && <Chip tone="sakura">手上有活：{active.job.title}</Chip>}
        </div>
        {jobs.length === 0 && <div className="text-sm text-stone-600">今天这条街的活都干完啦，换个街区看看，或者明天再来。</div>}
        <div className="grid gap-2">
          {jobs.map((j) => <JobRow key={j.id} j={j} onTake={() => accept(j)} disabled={!!active} />)}
        </div>
        <div className="mt-3 text-[10px] text-stone-400">{CASH_NOTICE}</div>
      </Panel>
    </div>
  );
}

function JobRow({ j, onTake, disabled }: { j: Job; onTake: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-cream-100 px-3 py-2 text-xs" data-testid={`job-${j.kind}`}>
      <div>
        <div className="font-black text-cocoa-800">{j.kind === 'delivery' ? '📦' : '🧑‍🍳'} {j.title}</div>
        <div className="text-stone-600">
          {j.kind === 'delivery'
            ? <>从「{j.from.name}」（{j.from.street}）→「{j.to.name}」（{j.to.street}）· 建议 {j.minutes} 分钟内送到</>
            : <>在「{j.at.name}」（{j.at.street}）· 共 {j.orders} 单，每单 💴{j.payPerOrder}，全对再奖 💴6</>}
        </div>
        <div className="text-stone-400">体力 -{j.kind === 'delivery' ? COST.delivery : COST.shift}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-black text-almond-600">💴 {j.kind === 'delivery' ? j.pay : `${j.payPerOrder * j.orders}+`}</span>
        <Btn size="sm" disabled={disabled} onClick={onTake}>接单</Btn>
      </div>
    </div>
  );
}

/** 进行中的活：顶部提示条 */
export function ActiveJobBar() {
  const active = useWork((s) => s.active);
  const guide = useWork((s) => s.guide);
  const cancel = useWork((s) => s.cancel);
  const district = useTown((s) => s.district);
  const goDistrict = useTown((s) => s.goDistrict);
  const enabled = useWork((s) => s.enabled);
  if (!active || !enabled) return null;
  const j = active.job;
  const lotId = j.kind === 'delivery' ? (active.picked ? j.to.lotId : j.from.lotId) : j.at.lotId;
  const pl = placeOfLot(lotId);
  const text = j.kind === 'delivery'
    ? (active.picked ? `📦 送货中：把${j.goods}送到「${j.to.name}」· ${j.to.street}` : `📦 去「${j.from.name}」取货 · ${j.from.street}`)
    : `🧑‍🍳 去「${j.at.name}」帮工 · ${j.at.street}`;
  return (
    <div className="pointer-events-auto glass absolute left-1/2 top-[5.2rem] z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-cocoa-800" data-testid="active-job">
      <span>{text}</span>
      {pl && pl.district !== district
        ? <Btn size="sm" onClick={() => goDistrict(pl.district as never, pl.trigger)}>去那个街区</Btn>
        : <Btn size="sm" onClick={guide} data-testid="job-guide">🧭 带我去</Btn>}
      <button onClick={cancel} className="text-stone-400">放弃</button>
    </div>
  );
}

/** 帮工小游戏：按顾客的单子把东西放进托盘（顺序不限，数量要对） */
export function ShiftGame() {
  const job = useWork((s) => s.shift);
  const finish = useWork((s) => s.finishShift);
  const close = useWork((s) => s.closeShift);
  const orders = useMemo(() => (job ? makeOrders(job.game, job.orders, job.id.length * 13 + job.payPerOrder) : []), [job]);
  const [i, setI] = useState(0);
  const [tray, setTray] = useState<string[]>([]);
  const [correct, setCorrect] = useState(0);
  const [left, setLeft] = useState(60);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  useEffect(() => { setI(0); setTray([]); setCorrect(0); setLeft(60); }, [job]);
  useEffect(() => {
    if (!job) return;
    const t = setInterval(() => setLeft((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [job]);
  useEffect(() => { if (job && left <= 0) finish(correct); }, [left, job, correct, finish]);
  if (!job) return null;
  const ing = INGREDIENTS[job.game];
  const order = orders[i];
  const label = (id: string) => ing.find((x) => x.id === id);
  const serve = () => {
    const ok = matches(order, tray);
    const c = correct + (ok ? 1 : 0);
    setFlash(ok ? 'ok' : 'bad'); setTimeout(() => setFlash(null), 500);
    setCorrect(c); setTray([]);
    if (i + 1 >= orders.length) finish(c); else setI(i + 1);
  };
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-3 md:items-center">
      <Panel testId="shift-game" title={`🧑‍🍳 ${job.at.name} · ${job.title.split('：')[0]}`} subtitle={`第 ${i + 1}/${orders.length} 单 · 剩 ${left} 秒 · 做对 ${correct} 单`} onClose={close} className="w-full max-w-md">
        <div className={`rounded-2xl p-3 text-center transition ${flash === 'ok' ? 'bg-sage-300' : flash === 'bad' ? 'bg-sakura-300' : 'bg-cream-100'}`}>
          <div className="text-xs text-stone-600">顾客点的是</div>
          <div className="text-xl font-black text-cocoa-800" data-testid="order-name">{order.name}</div>
          <div className="mt-1 text-sm" data-testid="order-need" data-need={order.need.join(',')}>{order.need.map((id, k) => <span key={k} className="mx-0.5">{label(id)?.emoji}{label(id)?.label}</span>)}</div>
        </div>
        <div className="mt-3 text-xs font-bold text-stone-600">托盘：{tray.length ? tray.map((id, k) => <button key={k} onClick={() => setTray(tray.filter((_, x) => x !== k))} className="mx-0.5">{label(id)?.emoji}</button>) : '（点下面的东西放进来，点托盘里的拿出来）'}</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {ing.map((x) => (
            <button key={x.id} data-testid={`ing-${x.id}`} onClick={() => setTray((t) => [...t, x.id])} className="jelly flex flex-col items-center bg-cream-50 py-2 text-xs ring-1 ring-cream-300">
              <span className="text-2xl">{x.emoji}</span>{x.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-between">
          <Btn tone="cream" size="sm" onClick={() => setTray([])}>清空托盘</Btn>
          <Btn data-testid="serve" onClick={serve} disabled={!tray.length}>出餐 / 交付</Btn>
        </div>
      </Panel>
    </div>
  );
}

/** 小店柜台：花钞票 */
export function Counter() {
  const lotId = useWork((s) => s.counter);
  const open = useWork((s) => s.openCounter);
  const buyItem = useWork((s) => s.buyItem);
  const purse = useWork((s) => s.purse);
  const accept = useWork((s) => s.accept);
  const active = useWork((s) => s.active);
  if (!lotId) return null;
  const pl = placeOfLot(lotId);
  if (!pl) return null;
  const shiftJob = useWork.getState().jobsHere().find((j) => j.kind === 'shift' && j.at.lotId === lotId);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-3 md:items-center">
      <Panel testId="counter" title={`🛍️ ${pl.name}`} subtitle={`${pl.street} · 用打工挣的街区钞票消费`} onClose={() => open(undefined)} className="w-full max-w-md">
        <div className="mb-2 flex gap-1.5 text-xs"><Chip tone="almond">💴 {purse.cash}</Chip><Chip tone="sage">⚡ {Math.round(purse.stamina)}</Chip></div>
        <div className="grid gap-2">
          {MENUS[pl.game].map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-2xl bg-cream-100 px-3 py-2 text-xs">
              <span><span className="text-xl">{m.emoji}</span> <b>{m.name}</b> · {m.note}</span>
              <Btn size="sm" data-testid={`buy-${m.id}`} onClick={() => buyItem(m.id)}>💴 {m.price}</Btn>
            </div>
          ))}
        </div>
        {shiftJob && !active && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-almond-300/60 px-3 py-2 text-xs">
            <span>这家店今天招短工：{shiftJob.title}</span>
            <Btn size="sm" data-testid="counter-shift" onClick={() => { if (accept(shiftJob)) { open(undefined); useWork.getState().arrive(lotId); } }}>就在这干</Btn>
          </div>
        )}
        <div className="mt-3 text-[10px] text-stone-400">{CASH_NOTICE}</div>
      </Panel>
    </div>
  );
}
