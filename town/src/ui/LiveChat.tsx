/**
 * 「打个飞的」动画 + 「聊一聊」窗口。
 * 聊一聊：店主在线 → 直接聊；店主不在线 → 写下需求（做什么 / 预算 / 时间 / 线上线下）发给对方。
 */
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { FLY, chatStarted, useLive, type NeedNote } from '../store/useLive';
import { useCelebrate } from '../store/useCelebrate';
import { residentById } from '../data/seed';
import { Btn, Panel } from './kit';
import { WORK_HOURS, hourLabel, isWorkTime, localHour } from '../scene/clock';

/**
 * 打个飞的：起飞后整屏穿越云层（小飞机飞过云海），云层挡住换地图 / 渲染 / 网络的时间；
 * 降落时云层散开，顶部出现「✈️ 我们到了！」。
 */
const FlySceneLazy = lazy(() => import('./FlyScene').then((m) => ({ default: m.FlyScene })));
/** 提前在后台加载穿云场景，第一次打飞的也不会卡 */
export function preloadFlyScene() { void import('./FlyScene'); }

export function FlyOverlay() {
  const f = useLive((s) => s.flying);
  if (!f) return null;
  if (f.phase === 'arrived') {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-24 z-[70] flex justify-center" data-testid="fly-arrived">
        <div className="fx-pop rounded-full bg-cream-50/95 px-5 py-2 text-base font-black text-cocoa-800 shadow-soft">✈️ 我们到了！{f.title}</div>
      </div>
    );
  }
  const show = f.phase === 'clouds' || f.phase === 'down';
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" data-testid="fly-overlay">
      <style>{`
        @keyframes clouds-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes clouds-out { 0% { opacity: 1 } 60% { opacity: .85 } 100% { opacity: 0 } }
        @keyframes flash { 0% { opacity: .9 } 100% { opacity: 0 } }
      `}</style>
      {show && (
        <div className="absolute inset-0" style={{ animation: `${f.phase === 'down' ? 'clouds-out' : 'clouds-in'} ${f.phase === 'down' ? FLY.down : 140}ms ease both` }}>
          {/* 天空：上深下浅，靠近云层顶部偏暖 */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(#5E9BE6 0%, #A9CDF5 38%, #E8F2FD 72%, #FFF6E6 100%)' }} />
          <Suspense fallback={null}><FlySceneLazy phase={f.phase === 'down' ? 'down' : 'clouds'} /></Suspense>
          {/* 进云的一瞬间：白色闪一下 */}
          {f.phase === 'clouds' && <div className="absolute inset-0 bg-white" style={{ animation: 'flash 260ms ease-out both' }} />}
          <div className="absolute inset-x-0 bottom-[18%] flex justify-center">
            <div className="rounded-full bg-cream-50/85 px-4 py-1.5 text-sm font-black text-cocoa-800 shadow-soft backdrop-blur">✈️ 打个飞的 → {f.title}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LiveChat() {
  const open = useLive((s) => s.open);
  const th = useLive((s) => (s.open ? s.threads[s.open] : undefined));
  const send = useLive((s) => s.send);
  const leaveNeed = useLive((s) => s.leaveNeed);
  const close = () => useLive.getState().openLive(undefined);
  const [text, setText] = useState('');
  const [need, setNeed] = useState<NeedNote>({ what: '', budget: '', when: '', how: '都可以' });
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [th?.msgs.length]);
  if (!open || !th) return null;
  const r = residentById(open);
  const online = !!r?.online;
  const sentNeed = th.msgs.some((m) => m.need);
  const hour = localHour();
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex items-end justify-center p-3 md:items-center md:justify-end">
      <Panel testId="live-chat" title={<span>💬 {th.name}{th.shopName ? <span className="text-sm font-semibold text-stone-500"> · {th.shopName}</span> : null}</span>}
        subtitle={online ? '🟢 主理人在线 · 可以直接聊' : '⚪ 主理人不在线 · 写下需求，对方上线后会收到'} onClose={close} className="h-[72vh] w-full max-w-md">
        <div className="flex h-full flex-col">
          {!isWorkTime(hour) && (
            <div className="mb-2 rounded-xl bg-haze-200/60 px-2 py-1 text-[11px] text-stone-600" data-testid="after-hours">
              🌙 现在是当地 {hourLabel(hour)}，不在工作时间（{WORK_HOURS.start}:00–{WORK_HOURS.end}:00）。消息照常可以发{online ? '，对方在线可以直接聊' : '，对方上线后会看到'}。
            </div>
          )}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-testid="live-msgs">
            {th.msgs.length === 0 && <div className="text-xs text-stone-500">{online ? '打个招呼：说说你是谁、想做什么、预算和时间。' : '对方暂时不在线。把需求写清楚，对方一上线就能看到。'}</div>}
            {th.msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : m.from === 'system' ? 'justify-center' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${m.from === 'me' ? 'bg-almond-300 text-cocoa-800' : m.from === 'system' ? 'bg-sage-200/70 text-[11px] text-stone-600' : 'bg-cream-100'}`}>{m.text}</div>
              </div>
            ))}
            <div ref={end} />
          </div>
          {chatStarted(th) && !th.agreed && online && (
            <Btn size="sm" tone="sage" className="mt-2" data-testid="live-agree" onClick={() => useLive.getState().agree(open)}>🤝 达成初步合作意向</Btn>
          )}
          {online || sentNeed ? (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(open, text); setText(''); }}>
              <input className="input" data-testid="live-input" placeholder={online ? '说点什么…' : '补充一句…'} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
              <Btn type="submit" data-testid="live-send">发送</Btn>
            </form>
          ) : (
            <form className="mt-2 grid gap-1.5 rounded-2xl bg-cream-100 p-2" data-testid="need-form" onSubmit={(e) => { e.preventDefault(); if (need.what.trim().length >= 4) leaveNeed(open, need); }}>
              <div className="text-xs font-black text-cocoa-800">写下需求，发给 {th.name}</div>
              <textarea className="input min-h-[64px]" data-testid="need-what" placeholder="想做什么？例如：七夕礼盒短视频 3 条，30 秒以内（至少 4 个字）" value={need.what} maxLength={300} onChange={(e) => setNeed({ ...need, what: e.target.value })} />
              <div className="flex gap-1.5">
                <input className="input" data-testid="need-budget" placeholder="预算，例如 3000–5000" value={need.budget} maxLength={30} onChange={(e) => setNeed({ ...need, budget: e.target.value })} />
                <input className="input" data-testid="need-when" placeholder="时间，例如 两周内" value={need.when} maxLength={30} onChange={(e) => setNeed({ ...need, when: e.target.value })} />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {(['线上', '线下', '都可以'] as const).map((h) => <button type="button" key={h} onClick={() => setNeed({ ...need, how: h })} className={`chip ${need.how === h ? 'bg-almond-400' : 'bg-cream-50 text-stone-600'}`}>{h}</button>)}
                <Btn type="submit" size="sm" className="ml-auto" data-testid="need-send" disabled={need.what.trim().length < 4}>发送需求</Btn>
              </div>
              <div className="text-[10px] text-stone-400">不要在需求里写手机号 / 微信；平台会隐藏联系方式，请在站内沟通。</div>
            </form>
          )}
        </div>
      </Panel>
    </div>
  );
}

/** 小礼花：达成初步合作时从屏幕上方撒下彩色纸屑 */
const CONFETTI = ['#F07FAF', '#3D7BD8', '#D9A62E', '#8C6BD6', '#5FB27A', '#FF8A3D'];
export function Confetti() {
  const bursts = useCelebrate((s) => s.bursts);
  if (!bursts.length) return null;
  const b = bursts[bursts.length - 1];
  return (
    <div key={b.id} className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" data-testid="confetti">
      <style>{`@keyframes conf-fall{0%{transform:translate3d(0,-10vh,0) rotate(0)}100%{transform:translate3d(var(--dx),105vh,0) rotate(var(--rot))}}@keyframes pop-in{0%{transform:scale(.4);opacity:0}20%{transform:scale(1.1);opacity:1}80%{opacity:1}100%{opacity:0}}`}</style>
      {Array.from({ length: 70 }).map((_, i) => {
        const left = (i * 37) % 100, delay = (i % 10) * 0.06, dur = 1.8 + ((i * 7) % 10) / 10;
        return <i key={i} className="absolute top-0 block h-2.5 w-1.5 rounded-sm" style={{ left: `${left}%`, background: CONFETTI[i % CONFETTI.length], animation: `conf-fall ${dur}s ${delay}s cubic-bezier(.2,.6,.4,1) both`, ['--dx' as string]: `${((i * 13) % 30) - 15}vw`, ['--rot' as string]: `${(i * 97) % 720}deg` }} />;
      })}
      <div className="absolute left-1/2 top-[22%] -translate-x-1/2 rounded-full bg-cream-50/95 px-5 py-2 text-base font-black text-cocoa-800 shadow-soft" style={{ animation: 'pop-in 3s ease-out both' }}>🎉 {b.title}</div>
    </div>
  );
}
