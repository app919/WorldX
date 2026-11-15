/**
 * 「逛」：街区动态（此刻大家在做什么，点一下飞过去）；
 * 「跟」：活动现场（围观人数、报名人数、弹幕、报名）。
 */
import { useEffect, useMemo, useState } from 'react';
import { danmuAt, eventDetail, feedAt, LIVE_EVENTS, viewersAt } from '../domain/buzz';
import { lotOfExample } from '../domain/lots';
import { useFollow } from '../store/useFollow';
import { useLive } from '../store/useLive';
import { useTown } from '../store/useTown';
import { navOf, DISTRICTS } from '../world';
import { cityOfDistrict } from '../domain/cities';
import { ROLE_COLORS } from '../domain/palette';
import { Btn, Panel } from './kit';

const ago = (ms: number) => (ms < 60000 ? '刚刚' : `${Math.round(ms / 60000)} 分钟前`);

/** 飞到某个活动现场并开始围观 */
export function flyToLive(id: string) {
  const e = LIVE_EVENTS.find((x) => x.id === id)!;
  const nav = navOf(e.district);
  const p = nav.nearestWalkable({ x: DISTRICTS[e.district].spawn.x + e.offset.x + 3, z: DISTRICTS[e.district].spawn.z + e.offset.z + 3 }, 12) ?? DISTRICTS[e.district].spawn;
  useLive.getState().fly({ title: e.title, at: { district: e.district, x: p.x, z: p.z }, then: () => useFollow.getState().watch(id) });
}

export function FeedPanel() {
  const open = useFollow((s) => s.feedOpen);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!open) return; const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, [open]);
  const items = useMemo(() => feedAt(now, lotOfExample), [now]);
  if (!open) return null;
  const close = () => useFollow.getState().setFeed(false);
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center p-3 md:items-center md:justify-start md:pl-20">
      <Panel testId="feed-panel" title="📰 街区动态" subtitle="此刻各个城市的街上在发生什么（演示数据）· 点一下飞过去" onClose={close} className="max-h-[70vh] w-full max-w-sm">
        <div className="space-y-1.5">
          {items.map((it) => (
            <button key={it.id} data-testid="feed-item" onClick={() => { close(); if (it.liveId) flyToLive(it.liveId); else if (it.lotId) useLive.getState().fly({ title: it.who, lotId: it.lotId }); }}
              className="flex w-full items-start gap-2 rounded-2xl bg-cream-100 px-3 py-2 text-left hover:bg-almond-300/60">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black" style={it.example ? { background: ROLE_COLORS.example, color: '#fff' } : undefined}>{it.icon}</span>
              <span className="min-w-0 flex-1 text-xs">
                <b className="text-cocoa-800">{it.who}</b> {it.text}
                <span className="block text-[10px] text-stone-500">{cityOfDistrict(it.district).name} · {DISTRICTS[it.district].name} · {ago(now - it.at)}</span>
              </span>
              <span className="shrink-0 text-[10px] font-bold text-cocoa-600">✈️ 去看看</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function LivePanel() {
  const id = useFollow((s) => s.watching);
  const joined = useFollow((s) => (id ? s.joined.includes(id) : false));
  const mine = useFollow((s) => (id ? s.danmu[id] ?? [] : []));
  const [now, setNow] = useState(Date.now());
  const [text, setText] = useState('');
  useEffect(() => { if (!id) return; const t = setInterval(() => setNow(Date.now()), 3000); return () => clearInterval(t); }, [id]);
  if (!id) return null;
  const e = LIVE_EVENTS.find((x) => x.id === id)!;
  const detail = eventDetail(e);
  const close = () => useFollow.getState().watch(undefined);
  const stream = [...danmuAt(now).map((t, i) => ({ text: t, at: now - (6 - i) * 2500, me: false })), ...mine.map((m) => ({ ...m, me: true }))].sort((a, b) => a.at - b.at).slice(-9);
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center p-3 md:items-center md:justify-end">
      <Panel testId="live-panel" title={<span><span className="mr-1 rounded bg-[#E0453A] px-1 text-xs text-white">● 进行中</span>{e.title}</span>}
        subtitle={`${e.kind} · 主办：${e.host} · ${cityOfDistrict(e.district).name}${DISTRICTS[e.district].name}`} onClose={close} className="max-h-[74vh] w-full max-w-md">
        <div className="grid grid-cols-2 gap-2 text-center" data-testid="live-stats">
          <div className="rounded-2xl bg-cream-100 p-2"><div className="text-xl font-black text-cocoa-800">👀 {viewersAt(e, now) + 1}</div><div className="text-[10px] text-stone-500">人在围观（含你）</div></div>
          <div className="rounded-2xl bg-cream-100 p-2"><div className="text-xl font-black text-cocoa-800">🙋 {e.signed + (joined ? 1 : 0)}/{e.capacity}</div><div className="text-[10px] text-stone-500">已报名</div></div>
        </div>
        <div className="mt-2 h-40 space-y-1 overflow-hidden rounded-2xl bg-cocoa-800/90 p-2 text-[11px] text-cream-50" data-testid="danmu">
          {stream.map((d, i) => <div key={i} className={d.me ? 'font-bold text-[#F2D27A]' : ''}>{d.me ? '我：' : ''}{d.text}</div>)}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); useFollow.getState().say(id, text); setText(''); }}>
          <input className="input" data-testid="danmu-input" placeholder="发条弹幕，跟大家打个招呼…" value={text} maxLength={40} onChange={(ev) => setText(ev.target.value)} />
          <Btn type="submit" size="sm">发送</Btn>
        </form>
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn tone={joined ? 'cream' : 'sage'} disabled={joined || e.signed >= e.capacity} data-testid="live-join" onClick={() => useFollow.getState().join(id)}>{joined ? '✅ 已报名' : e.signed >= e.capacity ? '名额已满' : '🙋 我要报名'}</Btn>
          {detail && <Btn tone="cream" onClick={() => { close(); useTown.getState().focusEvent(detail.id); useTown.getState().setTab('community'); }}>查看活动详情</Btn>}
        </div>
        <div className="mt-2 text-[10px] text-stone-400">围观与报名人数为演示数据；正式上线后按真实围观、报名统计，不制造虚假繁荣。</div>
      </Panel>
    </div>
  );
}
