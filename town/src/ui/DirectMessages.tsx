/**
 * 用户之间的私信（正式模式，连接后端）：
 * - 会话列表（消息页顶部「私信」）、聊天窗口（任意页面都可以打开）；
 * - 对方发来的手机号 / 微信号 / 邮箱会被平台隐藏；
 * - 「留微信号」按钮：功能暂未开放，点击会记录到管理后台的数据看板。
 */
import { useEffect, useRef, useState } from 'react';
import { api, track } from '../net/api';
import { useServer } from '../store/useServer';
import { useTown } from '../store/useTown';
import { Btn, Panel } from './kit';

interface ConvItem { id: string; peer: { id: string; nickname: string; shopName: string | null }; last: { body: string; mine: boolean; at: number } | null; unread: number }
interface Msg { id: string; mine: boolean; body: string; at: number; read: boolean }

export function DmList() {
  const [list, setList] = useState<ConvItem[] | null>(null);
  const dm = useServer((s) => s.dm);
  useEffect(() => {
    let alive = true;
    const load = () => api<{ conversations: ConvItem[] }>('/api/conversations').then((r) => alive && setList(r.conversations)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [dm?.id]);
  return (
    <div className="space-y-1.5" data-testid="dm-list">
      {list === null && <div className="text-xs text-stone-400">加载中…</div>}
      {list?.length === 0 && <div className="text-xs text-stone-600">还没有私信。去街上逛逛，走进其他人开的小店，点「💬 发私信」。</div>}
      {list?.map((c) => (
        <button key={c.id} data-testid="dm-item" onClick={() => useServer.setState({ dm: { id: c.id, peer: c.peer } })} className="flex w-full items-center justify-between gap-2 rounded-2xl bg-cream-100 px-3 py-2 text-left text-xs">
          <span className="min-w-0">
            <b className="text-cocoa-800">{c.peer.nickname}</b>{c.peer.shopName && <span className="text-stone-500"> · {c.peer.shopName}</span>}
            <div className="truncate text-stone-500">{c.last ? `${c.last.mine ? '我：' : ''}${c.last.body}` : '（还没有消息）'}</div>
          </span>
          {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brick-400 px-1 text-[10px] font-bold text-white">{c.unread}</span>}
        </button>
      ))}
    </div>
  );
}

export function DmPanel() {
  const dm = useServer((s) => s.dm);
  const close = useServer((s) => s.closeDm);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dm) return;
    let alive = true;
    setMsgs([]);
    const load = async () => {
      try {
        const r = await api<{ messages: Msg[] }>(`/api/conversations/${dm.id}/messages`);
        if (!alive) return;
        setMsgs(r.messages);
        if (r.messages.some((m) => !m.mine && !m.read)) api(`/api/conversations/${dm.id}/read`, { method: 'POST', json: {} }).catch(() => {});
      } catch { /* 网络抖动时下一轮再取 */ }
    };
    load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [dm]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length]);
  if (!dm) return null;
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      const r = await api<{ message: Msg; contactHidden: boolean }>(`/api/conversations/${dm.id}/messages`, { method: 'POST', json: { body } });
      setMsgs((m) => [...m, r.message]);
      setNote(r.contactHidden ? '提示：消息里的手机号 / 微信号会对对方隐藏，请在平台内沟通。' : '');
    } catch (e) { setNote((e as Error).message); setText(body); }
  };
  const wechat = async () => {
    try { const r = await api<{ message: string }>(`/api/conversations/${dm.id}/wechat-click`, { method: 'POST', json: {} }); useTown.getState().toast(r.message, 'info'); }
    catch (e) { useTown.getState().toast((e as Error).message, 'warn'); }
  };
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-3 md:items-center md:justify-end">
      <Panel testId="dm-panel" title={<span>💬 {dm.peer.nickname}</span>} subtitle={dm.peer.shopName ? `「${dm.peer.shopName}」店主 · 站内私信` : '站内私信'} onClose={close} className="h-[70vh] w-full max-w-md">
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-testid="dm-messages">
            {msgs.length === 0 && <div className="text-xs text-stone-400">打个招呼吧：说明你是谁、想合作什么。</div>}
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.mine ? 'bg-almond-300 text-cocoa-800' : 'bg-cream-100'}`}>{m.body}
                  <div className="text-right text-[9px] text-stone-400">{new Date(m.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}{m.mine && m.read ? ' · 已读' : ''}</div>
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          {note && <div className="mt-1 text-[11px] text-stone-500" data-testid="dm-note">{note}</div>}
          <div className="mt-2 flex gap-2">
            <input className="input" data-testid="dm-input" placeholder="说点什么…" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); }} />
            <Btn data-testid="dm-send" onClick={send}>发送</Btn>
          </div>
          <button data-testid="dm-wechat" onClick={() => { track('action', 'messages', 'wechat_button_ui'); wechat(); }} className="mt-2 rounded-full bg-[#07c160]/15 py-1.5 text-xs font-bold text-[#07a050]">🟩 留微信号（即将上线）</button>
        </div>
      </Panel>
    </div>
  );
}
