import { useRef, useState } from 'react';
import { useTown, vitality, type Tab } from '../store/useTown';
import { hourLabel, isNight } from '../scene/clock';
import { ECONOMY_NOTICE } from '../domain/economy';
import { input } from '../scene/input';
import { DISTRICTS, DISTRICT_ORDER, navOf } from '../world';
import { LIFE_TAGS } from './Onboarding';
import { Btn } from './kit';

export function TopBar() {
  const hour = useTown((s) => s.hour);
  const street = useTown((s) => s.streetName);
  const district = useTown((s) => s.district);
  const avatar = useTown((s) => s.avatar);
  const wallet = useTown((s) => s.wallet);
  const toggleNight = useTown((s) => s.toggleNight);
  const timeFlow = useTown((s) => s.timeFlow);
  const toggleTimeFlow = useTown((s) => s.toggleTimeFlow);
  const myOpc = useTown((s) => s.myOpc);
  const intros = useTown((s) => s.intros);
  const myEvents = useTown((s) => s.myEvents);
  const [pop, setPop] = useState<'vital' | 'wallet' | null>(null);
  const tag = LIFE_TAGS.find((t) => t.tag === avatar?.lifeTag);
  const v = vitality(district, { myOpc, intros, myEvents });

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
      <div className="pointer-events-auto glass relative flex items-center gap-3 rounded-blob px-4 py-2">
        <div>
          <div className="text-base font-black leading-tight text-cocoa-800">{DISTRICTS[district].name}</div>
          <div className="text-[11px] text-stone-600" data-testid="status-line">{tag?.emoji} 正在{street}散步</div>
        </div>
        <div className="h-8 w-px bg-cream-300" />
        <button onClick={() => setPop(pop === 'vital' ? null : 'vital')} className="text-center" data-testid="vitality">
          <div className="text-[10px] text-stone-400">街区活力 ⓘ</div>
          <div className="text-sm font-black text-sage-700">{v.score}</div>
        </button>
        {pop === 'vital' && (
          <div className="glass absolute left-0 top-full mt-2 w-72 rounded-2xl p-3 text-xs">
            <div className="mb-1 font-black">街区活力 = 加权平均（0–100）</div>
            {v.parts.map((p) => (
              <div key={p.label} className="flex items-center justify-between gap-2 py-0.5">
                <span>{p.label} ×{p.w}</span><span className="tabular-nums text-stone-600">{p.value} → {Math.round(p.score)}</span>
              </div>
            ))}
            <div className="mt-1 text-[10px] text-stone-400">只统计真实入驻、在线与双方确认的数据，不制造虚假繁荣。演示角色计入演示街区。</div>
          </div>
        )}
      </div>

      <div className="pointer-events-auto relative flex flex-col items-end gap-2">
        <div className="glass flex items-center gap-2 rounded-blob px-3 py-2">
          <button onClick={toggleNight} title="昼夜切换" data-testid="daynight" className="jelly grid h-8 w-8 place-items-center bg-cream-100 text-lg">{isNight(hour) ? '🌙' : '☀️'}</button>
          <button onClick={toggleTimeFlow} title={timeFlow ? '暂停时间' : '时间流动'} className="text-sm font-bold tabular-nums text-cocoa-600">{hourLabel(hour)} {timeFlow ? '' : '⏸'}</button>
        </div>
        <button onClick={() => setPop(pop === 'wallet' ? null : 'wallet')} className="glass flex items-center gap-3 rounded-full px-3 py-1 text-xs font-bold" data-testid="wallet">
          <span>⭐ {wallet.stars}</span><span className="text-sage-700">🌱 {wallet.growth}</span><span className="text-stone-400">ⓘ</span>
        </button>
        {pop === 'wallet' && (
          <div className="glass absolute right-0 top-full mt-2 w-72 rounded-2xl p-3 text-xs">
            <div className="font-black">⭐ 街区星星</div>
            <div className="text-stone-600">获得：每日到访、CityWalk 打卡、认识新朋友、打招呼。用途：装饰小店、给小人换装（即将开放）。</div>
            <div className="mt-2 font-black">🌱 创业成长值</div>
            <div className="text-stone-600">获得：开店、预约见面、参加社区活动、双方确认的合作、帮别人促成合作。用途：解锁店铺升级与街区绿化（即将开放）。</div>
            <div className="mt-2 text-[10px] text-brick-500">{ECONOMY_NOTICE}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DistrictSwitcher() {
  const district = useTown((s) => s.district);
  const go = useTown((s) => s.goDistrict);
  const tab = useTown((s) => s.tab);
  if (tab !== 'city') return null;
  return (
    <div className="pointer-events-auto absolute left-1/2 top-[4.6rem] z-20 flex -translate-x-1/2 gap-1 rounded-full bg-cream-50/85 p-1 shadow-soft backdrop-blur md:top-3">
      {DISTRICT_ORDER.map((d) => (
        <button key={d} data-testid={`district-${d}`} onClick={() => d !== district && go(d)} className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold transition ${district === d ? 'bg-almond-400 text-cocoa-800' : 'text-stone-600 hover:bg-cream-100'}`}>
          {DISTRICTS[d].name}
        </button>
      ))}
    </div>
  );
}

const NAV: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'city', label: '我的上海', icon: '🏙️' },
  { tab: 'biz', label: '我的生意', icon: '💼' },
  { tab: 'community', label: '我的社区', icon: '☕' },
  { tab: 'messages', label: '消息', icon: '💌' },
  { tab: 'me', label: '我的', icon: '🧸' },
];

export function BottomNav() {
  const tab = useTown((s) => s.tab);
  const setTab = useTown((s) => s.setTab);
  const needsMe = useTown((s) => s.inbox.filter((i) => !i.read && i.needsMe).length);
  const unread = useTown((s) => s.inbox.filter((i) => !i.read).length);
  return (
    <nav className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-3">
      <div className="glass flex w-full max-w-md justify-between rounded-[1.6rem] px-2 py-1.5">
        {NAV.map((n) => (
          <button key={n.tab} data-testid={`nav-${n.tab}`} onClick={() => setTab(tab === n.tab && n.tab !== 'city' ? 'city' : n.tab)}
            className={`relative flex flex-1 flex-col items-center rounded-2xl py-1.5 text-[11px] font-bold transition ${tab === n.tab ? 'bg-almond-300 text-cocoa-800 shadow-jelly' : 'text-stone-600'}`}>
            <span className="text-lg leading-none">{n.icon}</span>{n.label}
            {n.tab === 'messages' && unread > 0 && (
              <span className={`absolute right-2 top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] text-white ${needsMe ? 'bg-brick-400' : 'bg-stone-400'}`}>{unread}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Coach() {
  const t = useTown((s) => s.tutorial);
  const tab = useTown((s) => s.tab);
  const card = useTown((s) => s.card);
  const steps = [
    { done: t.walked, text: '沿人行道走一走（WASD / 点击地面）' },
    { done: t.enteredShop, text: '走到店门口，进一家店看看' },
    { done: t.foundCustomer, text: '在「我的生意」告诉 AI 你能提供什么' },
    { done: t.saidHello, text: '给一位潜在客户打招呼' },
    { done: t.booked, text: '预约一次线上见面' },
  ];
  const [hidden, setHidden] = useState(false);
  if (steps.every((s) => s.done) || tab !== 'city' || card || hidden) return null;
  const cur = steps.findIndex((s) => !s.done);
  return (
    <div className="pointer-events-auto glass absolute left-3 top-24 z-10 hidden w-64 rounded-blob p-3 md:block" data-testid="coach">
      <div className="mb-1 flex items-center justify-between text-xs font-black text-sage-700">新手小任务 · {steps.filter((s) => s.done).length}/5<button onClick={() => setHidden(true)} className="text-stone-400">收起</button></div>
      {steps.map((s, i) => (
        <div key={i} className={`flex items-start gap-1.5 py-0.5 text-[12px] ${s.done ? 'text-stone-400 line-through' : i === cur ? 'font-bold text-cocoa-800' : 'text-stone-600'}`}>
          <span>{s.done ? '✅' : i === cur ? '👉' : '○'}</span>{s.text}
        </div>
      ))}
      <div className="mt-1 text-[10px] text-stone-400">规则：只能走人行道，从斑马线过马路，从门口进店。</div>
    </div>
  );
}

export function Controls() {
  const myOpc = useTown((s) => s.myOpc);
  const setWizard = useTown((s) => s.setWizard);
  const enterLot = useTown((s) => s.enterLot);
  const walkTo = useTown((s) => s.walkTo);
  const district = useTown((s) => s.district);
  const tab = useTown((s) => s.tab);
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    input.joyX = x; input.joyY = y; input.run = l > 0.95;
    knob.current!.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
  };
  const end = () => { input.joyX = input.joyY = 0; input.run = false; knob.current!.style.transform = ''; };
  const stroll = () => {
    const nav = navOf(district); const b = nav.cd.def.bounds;
    for (let k = 0; k < 30; k++) {
      const p = { x: b.minX + Math.random() * (b.maxX - b.minX), z: b.minZ + Math.random() * (b.maxZ - b.minZ) };
      if (nav.walkable(p) && walkTo(p)) return;
    }
  };
  if (tab !== 'city') return null;
  return (
    <>
      <div ref={pad} className="pointer-events-auto absolute bottom-24 left-4 z-20 grid h-24 w-24 touch-none place-items-center rounded-full bg-cream-50/60 shadow-soft ring-2 ring-cream-200 md:hidden"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={end} onPointerCancel={end}>
        <div ref={knob} className="h-10 w-10 rounded-full bg-almond-400 shadow-jelly" />
      </div>
      <div className="pointer-events-auto absolute bottom-24 right-4 z-20 flex flex-col items-end gap-2">
        <Btn tone={myOpc ? 'sakura' : 'cream'} onClick={() => (myOpc ? enterLot(myOpc.lotId) : setWizard(true))} data-testid="my-shop-btn">🏪 {myOpc ? '我的小店' : '开一家小店'}</Btn>
        <Btn size="lg" onClick={stroll} data-testid="autowalk">🚶 随便逛逛</Btn>
      </div>
    </>
  );
}

export function Toasts() {
  const toasts = useTown((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 z-[60] flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`wobble-in rounded-full px-4 py-2 text-sm font-bold shadow-soft ${t.tone === 'ok' ? 'bg-sage-300 text-sage-700' : t.tone === 'warn' ? 'bg-sakura-300 text-brick-500' : 'bg-cream-50 text-cocoa-600'}`}>{t.text}</div>
      ))}
    </div>
  );
}
