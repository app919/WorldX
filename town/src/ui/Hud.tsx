import { useRef } from 'react';
import { useTown, type Tab } from '../store/useTown';
import { hourLabel, isNight } from '../scene/clock';
import { prosperity } from '../domain/economy';
import { input } from '../scene/input';
import { LIFE_TAGS } from './Onboarding';
import { Btn } from './kit';

export function TopBar() {
  const hour = useTown((s) => s.hour);
  const street = useTown((s) => s.streetName);
  const avatar = useTown((s) => s.avatar);
  const wallet = useTown((s) => s.wallet);
  const toggleNight = useTown((s) => s.toggleNight);
  const timeFlow = useTown((s) => s.timeFlow);
  const toggleTimeFlow = useTown((s) => s.toggleTimeFlow);
  const autoWalk = useTown((s) => s.autoWalk);
  const shops = useTown((s) => (s.myOpc ? 5 : 4));
  const intros = useTown((s) => s.intros.filter((i) => i.status !== 'sent' && i.status !== 'declined').length);
  const meetings = useTown((s) => s.meetings.length);
  const tag = LIFE_TAGS.find((t) => t.tag === avatar?.lifeTag);
  const p = prosperity({ shops, confirmedIntros: intros, meetings, events: 4 });

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
      <div className="pointer-events-auto glass flex items-center gap-3 rounded-blob px-4 py-2">
        <div>
          <div className="text-base font-black leading-tight text-cocoa-800">沪上软萌生意街</div>
          <div className="text-[11px] text-stone-600" data-testid="status-line">
            {tag?.emoji} 我的小人 · 正在{street}{autoWalk ? ' CityWalk' : '散步'}
          </div>
        </div>
        <div className="hidden h-8 w-px bg-cream-300 sm:block" />
        <div className="hidden text-center sm:block">
          <div className="text-[10px] text-stone-400">城市繁荣度</div>
          <div className="text-sm font-black text-sage-700">{p}%</div>
        </div>
      </div>

      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div className="glass flex items-center gap-2 rounded-blob px-3 py-2">
          <button onClick={toggleNight} title="昼夜切换" data-testid="daynight" className="jelly grid h-8 w-8 place-items-center bg-cream-100 text-lg">
            {isNight(hour) ? '🌙' : '☀️'}
          </button>
          <button onClick={toggleTimeFlow} title={timeFlow ? '暂停时间' : '时间流动'} className="text-sm font-bold tabular-nums text-cocoa-600">
            {hourLabel(hour)} {timeFlow ? '' : '⏸'}
          </button>
        </div>
        <div className="glass flex items-center gap-3 rounded-full px-3 py-1 text-xs font-bold" title="游戏内奖励，不可兑换人民币">
          <span>⭐ {wallet.stars}</span>
          <span className="text-sage-700">🌱 {wallet.growth}</span>
        </div>
      </div>
    </div>
  );
}

const NAV: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'city', label: '城市', icon: '🏙️' },
  { tab: 'map', label: '商业地图', icon: '🗺️' },
  { tab: 'community', label: '社区', icon: '☕' },
  { tab: 'messages', label: '消息', icon: '💌' },
  { tab: 'me', label: '我的', icon: '🧸' },
];

export function BottomNav() {
  const tab = useTown((s) => s.tab);
  const setTab = useTown((s) => s.setTab);
  const unread = useTown((s) => s.inbox.filter((i) => !i.read).length);
  return (
    <nav className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-3">
      <div className="glass flex w-full max-w-md justify-between rounded-[1.6rem] px-2 py-1.5">
        {NAV.map((n) => (
          <button
            key={n.tab}
            data-testid={`nav-${n.tab}`}
            onClick={() => setTab(n.tab)}
            className={`relative flex flex-1 flex-col items-center rounded-2xl py-1.5 text-[11px] font-bold transition ${tab === n.tab ? 'bg-almond-300 text-cocoa-800 shadow-jelly' : 'text-stone-600'}`}
          >
            <span className="text-lg leading-none">{n.icon}</span>
            {n.label}
            {n.tab === 'messages' && unread > 0 && (
              <span className="absolute right-3 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brick-400 px-1 text-[9px] text-white">{unread}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** 新手三分钟上手 */
export function Coach() {
  const t = useTown((s) => s.tutorial);
  const tab = useTown((s) => s.tab);
  const steps = [
    { done: t.walked, text: '走一走：WASD / 方向键 / 点击地面' },
    { done: t.metSomeone, text: '点一下街上的人，看看 TA 的介绍' },
    { done: t.foundOpportunity, text: '在「商业地图」告诉 AI 你会什么' },
    { done: t.saidHello, text: '给潜在伙伴发一封奶油信封' },
    { done: t.booked, text: '预约一次线上见面' },
  ];
  if (steps.every((s) => s.done) || tab !== 'city') return null;
  const cur = steps.findIndex((s) => !s.done);
  return (
    <div className="pointer-events-auto glass absolute left-3 top-24 z-10 hidden w-64 rounded-blob p-3 md:block" data-testid="coach">
      <div className="mb-1 text-xs font-black text-sage-700">新手小任务 · {steps.filter((s) => s.done).length}/5</div>
      {steps.map((s, i) => (
        <div key={i} className={`flex items-start gap-1.5 py-0.5 text-[12px] ${s.done ? 'text-stone-400 line-through' : i === cur ? 'font-bold text-cocoa-800' : 'text-stone-600'}`}>
          <span>{s.done ? '✅' : i === cur ? '👉' : '○'}</span>{s.text}
        </div>
      ))}
    </div>
  );
}

/** 触屏虚拟摇杆 + 自动漫步 / 我的小店 */
export function Controls() {
  const autoWalk = useTown((s) => s.autoWalk);
  const setAutoWalk = useTown((s) => s.setAutoWalk);
  const myOpc = useTown((s) => s.myOpc);
  const setWizard = useTown((s) => s.setWizard);
  const openChat = useTown((s) => s.openChat);
  const tab = useTown((s) => s.tab);
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    input.joyX = x; input.joyY = y; input.run = l > 0.95;
    knob.current!.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
  };
  const end = () => { input.joyX = input.joyY = 0; input.run = false; knob.current!.style.transform = ''; };
  if (tab !== 'city') return null;
  return (
    <>
      <div
        ref={pad}
        className="pointer-events-auto absolute bottom-24 left-4 z-20 grid h-24 w-24 touch-none place-items-center rounded-full bg-cream-50/60 shadow-soft ring-2 ring-cream-200 md:hidden"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={(e) => e.buttons && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div ref={knob} className="h-10 w-10 rounded-full bg-almond-400 shadow-jelly" />
      </div>
      <div className="pointer-events-auto absolute bottom-24 right-4 z-20 flex flex-col items-end gap-2">
        <Btn tone={myOpc ? 'sakura' : 'cream'} onClick={() => (myOpc ? openChat(myOpc.id) : setWizard(true))} data-testid="my-shop-btn">
          🏪 {myOpc ? '我的小店' : '开一家小店'}
        </Btn>
        <Btn tone={autoWalk ? 'sage' : 'almond'} size="lg" onClick={() => setAutoWalk(!autoWalk)} data-testid="autowalk">
          {autoWalk ? '⏸ 停下来' : '🚶 开始漫步'}
        </Btn>
      </div>
    </>
  );
}

export function Toasts() {
  const toasts = useTown((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-[60] flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`wobble-in rounded-full px-4 py-2 text-sm font-bold shadow-soft ${t.tone === 'ok' ? 'bg-sage-300 text-sage-700' : t.tone === 'warn' ? 'bg-sakura-300 text-brick-500' : 'bg-cream-50 text-cocoa-600'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
