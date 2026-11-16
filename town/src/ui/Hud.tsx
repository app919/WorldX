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
import { levelOf } from '../domain/progression';
import { currentQuests, useQuests } from '../store/useQuests';
import { useFollow } from '../store/useFollow';
import { CHECKIN_MILESTONES, seasonOf, streakOf } from '../domain/quests';
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
  const lvl = levelOf(useTown((s) => s.wallet));
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
        <div className="flex items-center gap-1.5">
          <button data-testid="open-center" onClick={() => useTown.getState().setTab('center')} className="jelly bg-haze-300 px-3 py-1 text-xs font-black text-cocoa-800">🏛️ 服务中心</button>
          <PurseChip />
        </div>
        {/* 一个数字看懂自己的进度：等级 + 星星（成长值折算进等级里） */}
        <button onClick={() => setPop(pop === 'wallet' ? null : 'wallet')} className="glass flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" data-testid="wallet" title="我的等级与星星">
          <span className="rounded-full bg-cocoa-800 px-1.5 text-[10px] font-black text-cream-50">Lv.{lvl.lv}</span>
          <span className="text-cocoa-700">{lvl.name}</span>
          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-cream-200"><i className="block h-full bg-almond-500" style={{ width: `${Math.round(lvl.pct * 100)}%` }} /></span>
          <span>⭐ {wallet.stars}</span>
        </button>
        {pop === 'wallet' && (
          <div className="glass absolute right-0 top-full mt-2 w-72 rounded-2xl p-3 text-xs" data-testid="wallet-pop">
            <div className="font-black">Lv.{lvl.lv} {lvl.name} · 经验 {lvl.xp}{lvl.next ? ` / ${lvl.next.need}` : ''}</div>
            <div className="text-stone-600">{lvl.next ? `再攒 ${lvl.next.need - lvl.xp} 经验升到 Lv.${lvl.next.lv}「${lvl.next.name}」，解锁：${lvl.next.unlock}。` : '已经是最高等级啦！'}</div>
            <div className="mt-2 font-black">⭐ 星星 {wallet.stars}</div>
            <div className="text-stone-600">逛街、做任务、打招呼、每日签到获得。</div>
            <div className="mt-2 font-black">经验怎么算</div>
            <div className="text-stone-600">经验 = 星星 + 成长值 × 3。成长值（现在 {wallet.growth}）来自开店、对接、合作这些生意上的进步，所以权重更高。</div>
            <div className="mt-2 text-stone-500">💴 钞票、⚡ 体力只属于「打工」小游戏，打工时才显示。</div>
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
        <button data-testid="city-switch" onClick={() => setOpen(!open)} className="whitespace-nowrap rounded-full bg-cocoa-800 px-3 py-1 text-[11px] font-black text-cream-50">🏙️ {city.name} ▾</button>
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
    <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3">
      <div className="pointer-events-auto glass flex w-full max-w-xl justify-between rounded-[1.6rem] px-1.5 py-1.5">
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

/** 任务类型只用小图标区分（设计内核不外显） */
const KIND_ICON: Record<string, string> = { 买: '🎯', 逛: '👀', 跟: '🎪' };

/** 新手 7 天 → 第 8 天起每日委托；底部是 30 天一季的签到条 */
export function Coach() {
  const tab = useTown((s) => s.tab);
  const card = useTown((s) => s.card);
  const tag = useTown((s) => s.avatar?.lifeTag);
  const progress = useQuests((s) => s.progress);
  const claimed = useQuests((s) => s.claimed);
  const view = useQuests((s) => s.view);
  const checkins = useQuests((s) => s.checkins);
  useQuests((s) => s.startDay);
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => { useQuests.getState().checkIn(); }, []);
  if (tab !== 'city' || card) return null;
  const cq = currentQuests();
  const { mode, plan } = cq;
  const unlocked = cq.day;
  const cur = mode === 'newbie' ? plan[(view ?? unlocked) - 1] : cq.today;
  const doneDay = (d: number) => plan[d - 1].quests.every((q) => claimed[q.id]);
  const left = cq.today.quests.filter((q) => !claimed[q.id]).length;
  const ss = seasonOf(checkins.length);
  const streak = streakOf(checkins, questTodayStr());
  if (hidden) {
    return <button data-testid="quest-open" onClick={() => setHidden(false)} className="pointer-events-auto glass absolute left-3 top-24 z-10 rounded-full px-3 py-1 text-xs font-black text-cocoa-700">🎯 {mode === 'newbie' ? `第 ${unlocked} 天任务` : '每日委托'} · 还剩 {left} · 🔥{streak}</button>;
  }
  return (
    <div className="pointer-events-auto glass absolute left-3 top-24 z-10 w-72 rounded-blob p-3" data-testid="coach">
      <div className="flex items-center justify-between text-xs font-black text-cocoa-800">
        <span>🎯 {mode === 'newbie' ? '新手 7 天' : '每日委托'} · {identityOf(tag).label}</span>
        <button onClick={() => setHidden(true)} className="text-stone-400">收起</button>
      </div>
      {mode === 'newbie' && (
        <div className="mt-1.5 flex gap-1" data-testid="quest-days">
          {plan.map((d) => (
            <button key={d.day} disabled={d.day > unlocked} onClick={() => useQuests.getState().setView(d.day)} title={d.day > unlocked ? `第 ${d.day} 天（${d.day - unlocked} 天后解锁）` : d.theme}
              className={`grid h-6 flex-1 place-items-center rounded-full text-[10px] font-black ${d.day === cur.day ? 'bg-almond-400 text-cocoa-800' : doneDay(d.day) ? 'bg-sage-300 text-cocoa-700' : d.day <= unlocked ? 'bg-cream-100 text-stone-600' : 'bg-cream-100/50 text-stone-300'}`}>
              {doneDay(d.day) ? '✓' : d.day > unlocked ? '🔒' : d.day}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 text-sm font-black text-cocoa-800">{mode === 'newbie' ? `第 ${cur.day} 天 · ${cur.theme}` : cur.theme}{cur.badge && <span className="text-[10px] font-bold text-stone-400"> 完成得「{cur.badge}」</span>}</div>
      <div className="mt-1 space-y-1.5" data-testid="quest-list">
        {cur.quests.map((q) => {
          const n = Math.min(q.count, progress[q.id] ?? 0), ok = n >= q.count, got = claimed[q.id];
          return (
            <div key={q.id} className={`rounded-2xl px-2 py-1.5 text-[11px] ${got ? 'bg-sage-200/50 text-stone-400' : 'bg-cream-100'}`} data-testid="quest-item">
              <div className="flex items-start gap-1.5">
                <span className="shrink-0 text-[12px] leading-none">{KIND_ICON[q.kind]}</span>
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
      {/* 签到：30 天一季，3 / 7 / 14 / 21 / 30 天有里程碑 */}
      <div className="mt-2 rounded-2xl bg-cream-100 px-2 py-1.5" data-testid="checkin">
        <div className="flex items-center justify-between text-[11px] font-black text-cocoa-800">
          <span>🔥 连续 {streak} 天 · 第 {ss.season} 季 {ss.inSeason}/30</span>
          <span className="text-[10px] font-bold text-stone-500">{ss.next ? `再签 ${ss.next.n - ss.inSeason} 天得 ⭐${ss.next.stars}` : '本季全勤！'}</span>
        </div>
        <div className="relative mt-1 h-1.5 rounded-full bg-cream-200">
          <i className="absolute inset-y-0 left-0 rounded-full bg-[#FF8A3D]" style={{ width: `${(ss.inSeason / 30) * 100}%` }} />
          {CHECKIN_MILESTONES.map((m) => <i key={m.n} className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-cream-50 ${ss.inSeason >= m.n ? 'bg-[#FF8A3D]' : 'bg-stone-300'}`} style={{ left: `calc(${(m.n / 30) * 100}% - 5px)` }} title={`${m.label}：⭐${m.stars}`} />)}
        </div>
      </div>
      <div className="mt-1 text-[10px] text-stone-400">{left ? `今天还有 ${left} 件小事。` : '今天的任务都完成啦！'}{mode === 'newbie' ? `明天解锁第 ${Math.min(7, unlocked + 1)} 天；第 8 天新手毕业有大礼包。` : '每天 0 点换新委托，周一换主题城市。'}</div>
    </div>
  );
}

/** 回来时：“你不在的时候”摘要（离开超过 8 小时） */
export function ReturnSummaryCard() {
  const s = useQuests((x) => x.summary);
  if (!s) return null;
  const close = () => useQuests.getState().closeSummary();
  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] grid place-items-center bg-cocoa-800/20 p-4" onClick={close}>
      <div className="wobble-in w-full max-w-sm rounded-[2rem] bg-cream-50 p-5 shadow-soft" data-testid="return-summary" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-black text-cocoa-800">👋 欢迎回来！你不在的 {s.hours} 小时里：</div>
        <ul className="mt-2 space-y-1.5 text-sm text-cocoa-800">
          {s.replies.length > 0 && <li>💬 <b>{s.replies.length}</b> 位店主回复了你留下的需求：{s.replies.map((r) => r.shop ?? r.name).join('、')}</li>}
          <li>📰 街区动态更新了 <b>{s.feed}</b> 条</li>
          <li>🏙️ 本周主题城市：<b>{s.theme}</b></li>
          <li>🔥 连续签到 <b>{s.streak}</b> 天（今天已签到）</li>
          <li>🎯 今天的委托：{s.todayTitles.join(' · ')}</li>
        </ul>
        <div className="mt-3 flex gap-2">
          {s.replies.length > 0 && <Btn onClick={() => { close(); useTown.getState().setTab('messages'); }}>去看回复</Btn>}
          <Btn tone="cream" data-testid="return-close" onClick={close}>开始逛</Btn>
        </div>
      </div>
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
      {/* 工具条：镜头缩放（＋ 拉近 / － 拉远，也支持滚轮、双指捏合、键盘 + -）+ 街区动态。电脑在左下角小地图下方，手机在左侧 */}
      <div className="pointer-events-auto absolute left-4 top-[40%] z-20 flex flex-col overflow-hidden rounded-2xl bg-cream-50/90 shadow-soft ring-1 ring-cream-200 md:bottom-4 md:left-3 md:top-auto md:flex-row" data-testid="zoom-controls">
        <button aria-label="拉近" data-testid="zoom-in" onClick={() => { zoomBy(0.8); emitGame('zoom'); }} className="grid h-9 w-9 place-items-center text-lg font-black text-cocoa-700 hover:bg-almond-300">＋</button>
        <button aria-label="拉远" data-testid="zoom-out" onClick={() => { zoomBy(1.25); emitGame('zoom'); }} className="grid h-9 w-9 place-items-center border-cream-200 text-lg font-black text-cocoa-700 hover:bg-almond-300 max-md:border-t md:border-l">－</button>
        <button aria-label="街区动态" data-testid="feed-open" onClick={() => useFollow.getState().setFeed(true)} className="grid h-9 min-w-9 place-items-center border-cream-200 px-2 text-xs font-black text-cocoa-700 hover:bg-almond-300 max-md:border-t md:border-l">📰<span className="hidden md:inline"> 街区动态</span></button>
      </div>
      <div ref={pad} className="pointer-events-auto absolute bottom-24 left-4 z-20 grid h-24 w-24 touch-none place-items-center rounded-full bg-cream-50/60 shadow-soft ring-2 ring-cream-200 md:hidden"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={end} onPointerCancel={end}>
        <div ref={knob} className="h-10 w-10 rounded-full bg-almond-400 shadow-jelly" />
      </div>
      <div className="pointer-events-none absolute bottom-24 right-4 z-20 flex flex-col items-end gap-2">
        <NeedBox />
        <Btn className="pointer-events-auto" tone={myOpc ? 'sakura' : 'cream'} onClick={() => (myOpc ? enterLot(myOpc.lotId) : setWizard(true))} data-testid="my-shop-btn">🏪 {myOpc ? '我的小店' : '开一家小店'}</Btn>
        <Btn className="pointer-events-auto" size="lg" onClick={stroll} data-testid="autowalk">🚶 随便逛逛</Btn>
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
