import { useEffect, useRef, useState } from 'react';
import { useTown, vitality, type Tab } from '../store/useTown';
import { hourLabel, isNight } from '../scene/clock';
import { ECONOMY_NOTICE } from '../domain/economy';
import { input, zoomBy } from '../scene/input';
import { DISTRICTS, navOf } from '../world';
import { CITIES } from '../domain/cities';
import { emitGame } from '../store/gameEvents';
import { track } from '../net/api';
import { identityOf } from '../domain/identity';
import { useQuests } from '../store/useQuests';
import { dayIndex, planFor } from '../domain/quests';
import { cnDate } from '../domain/weather';
import { cityOfDistrict } from '../domain/cities';
import { useWeather } from '../store/useWeather';
import { WEATHER_ICON, WEATHER_LABEL } from '../domain/weather';
import { Btn } from './kit';
import { NeedBox } from './NeedBox';
import { PurseChip } from './Work';
import { APP_BUILD_NOTE, APP_VERSION } from '../version';

export function TopBar() {
  const hour = useTown((s) => s.hour);
  const street = useTown((s) => s.streetName);
  const district = useTown((s) => s.district);
  const avatar = useTown((s) => s.avatar);
  const wallet = useTown((s) => s.wallet);
  const toggleNight = useTown((s) => s.toggleNight);
  const timeFlow = useTown((s) => s.timeFlow);
  const city = cityOfDistrict(useTown((s) => s.district));
  const weather = useWeather((s) => s.cities[city.id] ?? 'sunny');
  const toggleTimeFlow = useTown((s) => s.toggleTimeFlow);
  const myOpc = useTown((s) => s.myOpc);
  const intros = useTown((s) => s.intros);
  const myEvents = useTown((s) => s.myEvents);
  const [pop, setPop] = useState<'vital' | 'wallet' | null>(null);
  const tag = avatar ? identityOf(avatar.lifeTag) : undefined;
  const v = vitality(district, { myOpc, intros, myEvents });

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
      <div className="pointer-events-auto glass relative flex items-center gap-3 rounded-blob px-4 py-2">
        <div>
          <div className="text-[10px] font-black tracking-wide text-almond-600" data-testid="brand">三邻邦（OPC Town）</div>
          <div className="text-base font-black leading-tight text-cocoa-800">{DISTRICTS[district].name} <span title={APP_BUILD_NOTE} data-testid="version" className="rounded-full bg-cocoa-800 px-1.5 py-0.5 align-middle text-[9px] font-bold text-cream-50">v{APP_VERSION}</span></div>
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
          <button data-testid="timeflow" onClick={toggleTimeFlow} title={timeFlow ? '正在跟随当地时间（点一下可暂停预览）' : '预览中，点一下回到当地时间'} className="text-sm font-bold tabular-nums text-cocoa-600">
            {city.name} {hourLabel(hour)} {timeFlow ? '' : '⏸ 预览'}
          </button>
          <span data-testid="weather" title={`今天${city.name}的天气（按当地天气预报）`} className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-bold text-cocoa-700">{WEATHER_ICON[weather]} {WEATHER_LABEL[weather]}</span>
        </div>
        <button data-testid="open-center" onClick={() => useTown.getState().setTab('center')} className="jelly bg-haze-300 px-3 py-1 text-xs font-black text-cocoa-800">🏛️ 服务中心</button>
        <PurseChip />
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

/** 顶部：城市切换（上海 / 北京 / 深圳 / 长沙 / 成都）+ 当前城市的街区 */
export function DistrictSwitcher() {
  const district = useTown((s) => s.district);
  const go = useTown((s) => s.goDistrict);
  const tab = useTown((s) => s.tab);
  const [open, setOpen] = useState(false);
  if (tab !== 'city') return null;
  const city = cityOfDistrict(district);
  return (
    <div className="pointer-events-auto absolute left-1/2 top-[4.6rem] z-20 -translate-x-1/2 md:top-3" data-testid="district-switcher">
      <div className="flex gap-1 rounded-full bg-cream-50/85 p-1 shadow-soft backdrop-blur">
        <button data-testid="city-switch" onClick={() => setOpen(!open)} className="whitespace-nowrap rounded-full bg-cocoa-700 px-3 py-1 text-[11px] font-black text-cream-50">🏙️ {city.name} ▾</button>
        {city.districts.map((d) => (
          <button key={d} data-testid={`district-${d}`} onClick={() => { if (d !== district) { go(d); emitGame('switch_district'); } }} className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold transition ${district === d ? 'bg-almond-400 text-cocoa-800' : 'text-stone-600 hover:bg-cream-100'}`}>
            {DISTRICTS[d].name}
          </button>
        ))}
      </div>
      {open && (
        <div className="mt-1 grid grid-cols-1 gap-1 rounded-2xl bg-cream-50/95 p-2 shadow-soft" data-testid="city-menu">
          {CITIES.map((c) => (
            <button key={c.id} data-testid={`go-city-${c.id}`} onClick={() => { setOpen(false); if (c.id !== city.id) { go(c.districts[0]); emitGame('switch_city'); track('action', 'browse', 'switch_city', { city: c.id }); } }}
              className={`rounded-xl px-3 py-1.5 text-left text-xs ${c.id === city.id ? 'bg-almond-300' : 'hover:bg-cream-100'}`}>
              <b>{c.name}</b> <span className="text-stone-500">{c.districts.map((d) => DISTRICTS[d].name).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'city', label: '逛街区', icon: '🏙️' },
  { tab: 'biz', label: '我的生意', icon: '💼' },
  { tab: 'chain', label: '产业链', icon: '🔗' },
  { tab: 'opps', label: '机会', icon: '📋' },
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
      <div className="glass flex w-full max-w-xl justify-between rounded-[1.6rem] px-1.5 py-1.5">
        {NAV.map((n) => (
          <button key={n.tab} data-testid={`nav-${n.tab}`} onClick={() => setTab(tab === n.tab && n.tab !== 'city' ? 'city' : n.tab)}
            className={`relative flex min-w-0 flex-1 flex-col items-center whitespace-nowrap rounded-2xl py-1.5 text-[10px] font-bold transition sm:text-[11px] ${tab === n.tab ? 'bg-almond-300 text-cocoa-800 shadow-jelly' : 'text-stone-600'}`}>
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

const KIND_TONE: Record<string, string> = { 买: 'bg-[#3D7BD8] text-white', 逛: 'bg-[#8C6BD6] text-white', 跟: 'bg-[#D9A62E] text-white' };

/** 新手 7 天：按身份的每日任务（买 · 逛 · 跟），完成后领取奖励，三件都领完得当天徽章 */
export function Coach() {
  const tab = useTown((s) => s.tab);
  const card = useTown((s) => s.card);
  const tag = useTown((s) => s.avatar?.lifeTag);
  const progress = useQuests((s) => s.progress);
  const claimed = useQuests((s) => s.claimed);
  const view = useQuests((s) => s.view);
  const startDay = useQuests((s) => s.startDay);
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => { if (!startDay) useQuests.setState({ startDay: questTodayStr() }); }, [startDay]);
  if (tab !== 'city' || card) return null;
  const plan = planFor(tag);
  const unlocked = dayIndex(startDay ?? questTodayStr(), questTodayStr());
  const cur = plan[(view ?? unlocked) - 1];
  const doneDay = (d: number) => plan[d - 1].quests.every((q) => claimed[q.id]);
  const left = cur.quests.filter((q) => !claimed[q.id]).length;
  if (hidden) {
    return <button data-testid="quest-open" onClick={() => setHidden(false)} className="pointer-events-auto glass absolute left-3 top-24 z-10 rounded-full px-3 py-1 text-xs font-black text-cocoa-700">🎯 第 {unlocked} 天任务 · 还剩 {plan[unlocked - 1].quests.filter((q) => !claimed[q.id]).length}</button>;
  }
  return (
    <div className="pointer-events-auto glass absolute left-3 top-24 z-10 w-72 rounded-blob p-3" data-testid="coach">
      <div className="flex items-center justify-between text-xs font-black text-cocoa-800">
        <span>🎯 新手 7 天 · {identityOf(tag).label}</span>
        <button onClick={() => setHidden(true)} className="text-stone-400">收起</button>
      </div>
      <div className="mt-1.5 flex gap-1" data-testid="quest-days">
        {plan.map((d) => (
          <button key={d.day} disabled={d.day > unlocked} onClick={() => useQuests.getState().setView(d.day)} title={d.day > unlocked ? `第 ${d.day} 天（${d.day - unlocked} 天后解锁）` : d.theme}
            className={`grid h-6 flex-1 place-items-center rounded-full text-[10px] font-black ${d.day === cur.day ? 'bg-almond-400 text-cocoa-800' : doneDay(d.day) ? 'bg-sage-300 text-cocoa-700' : d.day <= unlocked ? 'bg-cream-100 text-stone-600' : 'bg-cream-100/50 text-stone-300'}`}>
            {doneDay(d.day) ? '✓' : d.day > unlocked ? '🔒' : d.day}
          </button>
        ))}
      </div>
      <div className="mt-2 text-sm font-black text-cocoa-800">第 {cur.day} 天 · {cur.theme} <span className="text-[10px] font-bold text-stone-400">完成得「{cur.badge}」</span></div>
      <div className="mt-1 space-y-1.5" data-testid="quest-list">
        {cur.quests.map((q) => {
          const n = Math.min(q.count, progress[q.id] ?? 0), ok = n >= q.count, got = claimed[q.id];
          return (
            <div key={q.id} className={`rounded-2xl px-2 py-1.5 text-[11px] ${got ? 'bg-sage-200/50 text-stone-400' : 'bg-cream-100'}`} data-testid="quest-item">
              <div className="flex items-start gap-1.5">
                <span className={`mt-0.5 shrink-0 rounded px-1 text-[9px] font-black ${KIND_TONE[q.kind]}`}>{q.kind}</span>
                <span className={`flex-1 ${got ? 'line-through' : 'font-bold text-cocoa-800'}`}>{q.title}</span>
                {got ? <span>✅</span> : ok
                  ? <button data-testid="quest-claim" onClick={() => useQuests.getState().claim(q.id)} className="shrink-0 rounded-full bg-almond-400 px-2 py-0.5 text-[10px] font-black text-cocoa-800">领取 ⭐{q.stars}</button>
                  : <span className="shrink-0 tabular-nums text-stone-500">{n}/{q.count}</span>}
              </div>
              {!got && <div className="pl-6 text-[10px] text-stone-500">💡 {q.hint}</div>}
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-[10px] text-stone-400">{left ? `今天还有 ${left} 件小事。` : '今天的任务都完成啦！'}明天会解锁新玩法（第 {Math.min(7, unlocked + 1)} 天）。</div>
    </div>
  );
}

const questTodayStr = () => cnDate();

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
      if (nav.walkable(p) && walkTo(p)) { emitGame('stroll'); return; }
    }
  };
  if (tab !== 'city') return null;
  return (
    <>
      {/* 镜头缩放：＋ 拉近 / － 拉远（也支持滚轮、双指捏合、键盘 + -） */}
      <div className="pointer-events-auto absolute left-4 top-[46%] z-20 flex flex-col overflow-hidden rounded-2xl bg-cream-50/90 shadow-soft ring-1 ring-cream-200" data-testid="zoom-controls">
        <button aria-label="拉近" data-testid="zoom-in" onClick={() => { zoomBy(0.8); emitGame('zoom'); }} className="grid h-9 w-9 place-items-center text-lg font-black text-cocoa-700 hover:bg-almond-300">＋</button>
        <div className="h-px bg-cream-200" />
        <button aria-label="拉远" data-testid="zoom-out" onClick={() => { zoomBy(1.25); emitGame('zoom'); }} className="grid h-9 w-9 place-items-center text-lg font-black text-cocoa-700 hover:bg-almond-300">－</button>
      </div>
      <div ref={pad} className="pointer-events-auto absolute bottom-24 left-4 z-20 grid h-24 w-24 touch-none place-items-center rounded-full bg-cream-50/60 shadow-soft ring-2 ring-cream-200 md:hidden"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={end} onPointerCancel={end}>
        <div ref={knob} className="h-10 w-10 rounded-full bg-almond-400 shadow-jelly" />
      </div>
      <div className="pointer-events-auto absolute bottom-24 right-4 z-20 flex flex-col items-end gap-2">
        <NeedBox />
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
