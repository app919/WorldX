/**
 * 「打个飞的」动画 + 「聊一聊」窗口。
 * 聊一聊：店主在线 → 直接聊；店主不在线 → 写下需求（做什么 / 预算 / 时间 / 线上线下）发给对方。
 */
import { useEffect, useRef, useState } from 'react';
import { FLY_MS, useLive, type NeedNote } from '../store/useLive';
import { residentById } from '../data/seed';
import { Btn, Panel } from './kit';

export function FlyOverlay() {
  const f = useLive((s) => s.flying);
  if (!f) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-sky-200/40 backdrop-blur-[1px]" data-testid="fly-overlay">
      <style>{`@keyframes fly-across{0%{transform:translate(-55vw,18vh) rotate(-12deg) scale(.8)}50%{transform:translate(0,-4vh) rotate(-6deg) scale(1.15)}100%{transform:translate(55vw,10vh) rotate(8deg) scale(.8)}}@keyframes cloud{from{opacity:0;transform:translateX(12vw)}to{opacity:.9;transform:translateX(-12vw)}}`}</style>
      <div className="absolute left-[18%] top-[30%] text-5xl" style={{ animation: `cloud ${FLY_MS}ms ease-out both` }}>☁️</div>
      <div className="absolute right-[22%] top-[58%] text-4xl" style={{ animation: `cloud ${FLY_MS}ms ease-out both` }}>☁️</div>
      <div className="text-7xl" style={{ animation: `fly-across ${FLY_MS}ms ease-in-out both` }}>✈️</div>
      <div className="absolute bottom-[30%] rounded-full bg-cream-50/95 px-4 py-2 text-sm font-black text-cocoa-800 shadow-soft">打个飞的 → {f.title}</div>
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
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex items-end justify-center p-3 md:items-center md:justify-end">
      <Panel testId="live-chat" title={<span>💬 {th.name}{th.shopName ? <span className="text-sm font-semibold text-stone-500"> · {th.shopName}</span> : null}</span>}
        subtitle={online ? '🟢 主理人在线 · 可以直接聊' : '⚪ 主理人不在线 · 写下需求，对方上线后会收到'} onClose={close} className="h-[72vh] w-full max-w-md">
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-testid="live-msgs">
            {th.msgs.length === 0 && <div className="text-xs text-stone-500">{online ? '打个招呼：说说你是谁、想做什么、预算和时间。' : '对方暂时不在线。把需求写清楚，对方一上线就能看到。'}</div>}
            {th.msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : m.from === 'system' ? 'justify-center' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${m.from === 'me' ? 'bg-almond-300 text-cocoa-800' : m.from === 'system' ? 'bg-sage-200/70 text-[11px] text-stone-600' : 'bg-cream-100'}`}>{m.text}</div>
              </div>
            ))}
            <div ref={end} />
          </div>
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
