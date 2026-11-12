import { useEffect, useRef, useState } from 'react';
import { transparencyNotice } from '../domain/agent';
import { shopById, useTown } from '../store/useTown';
import { residentById } from '../data/seed';
import { Btn, Chip, Disclaimer, Panel } from './kit';

const ENTITY_LABEL = { personal_page: '个人创业主页（未注册主体）', opc_entity: 'OPC 经营主体（自述，未核验）', verified_company: '已认证企业' } as const;
const LEVEL_TONE = { L1: 'sage', L2: 'almond', L3: 'sakura' } as const;
const LEVEL_LABEL = { L1: 'L1 接待', L2: 'L2 商务', L3: 'L3 需本人确认' } as const;

/** 店铺 + AI 分身接待 */
export function AgentChat() {
  const opcId = useTown((s) => s.chatOpc);
  const myOpc = useTown((s) => s.myOpc);
  const myAgent = useTown((s) => s.myAgent);
  const close = useTown((s) => s.openChat);
  const ask = useTown((s) => s.askAgent);
  const chats = useTown((s) => (opcId ? s.chats[opcId] : undefined)) ?? [];
  const openHello = useTown((s) => s.openHello);
  const setTab = useTown((s) => s.setTab);
  const intro = useTown((s) => s.intros.find((i) => i.toUserId === shopById(opcId ?? '', myOpc)?.ownerId));
  const profile = useTown((s) => s.profile);
  const [q, setQ] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chats.length]);
  if (!opcId) return null;
  const opc = shopById(opcId, myOpc);
  if (!opc) return null;
  const mine = opc.id === myOpc?.id;
  const owner = residentById(opc.ownerId);
  const ownerOnline = mine ? !!myAgent?.ownerOnline : !!owner?.online;
  const send = (text: string) => { if (text.trim()) { ask(opc.id, text.trim()); setQ(''); } };
  const quick = ['你们是做什么的？', '多少钱？', '可以打个折吗？', '有案例吗？', '想预约聊聊', '你是真人吗？'];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center p-3 md:items-center md:justify-end">
      <Panel
        testId="agent-chat"
        title={<span>🏪 {opc.name}</span>}
        subtitle={opc.tagline}
        onClose={() => close(undefined)}
        className="h-[78vh] w-full max-w-md"
      >
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="haze">{ENTITY_LABEL[opc.entityStatus]}</Chip>
          <Chip tone={ownerOnline ? 'sage' : 'cream'}>{ownerOnline ? '主理人在线' : '主理人离线 · AI 分身托管中'}</Chip>
          {opc.isDemo && <Chip tone="cream">演示店铺</Chip>}
        </div>
        <div className="mt-2 grid gap-1.5">
          {opc.products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-1.5 text-xs">
              <span><b>{p.name}</b> · {p.description}</span>
              <span className="shrink-0 pl-2 font-bold text-cocoa-600">{p.priceConfirmed && p.priceFrom !== undefined ? `¥${p.priceFrom}${p.unit ? `/${p.unit}` : ''} 起` : '询价'}</span>
            </div>
          ))}
        </div>
        {opc.openNeeds.length > 0 && <div className="mt-2 text-xs"><b>正在寻找：</b>{opc.openNeeds.join('、')}</div>}
        {!mine && owner && (
          <div className="mt-2 flex gap-2">
            {intro ? <Btn size="sm" tone="sage" onClick={() => { close(undefined); setTab('messages'); }}>已联系 · 查看进度</Btn>
              : profile ? <Btn size="sm" onClick={() => openHello(owner.id)} data-testid="chat-hello">💌 给主理人打招呼</Btn>
              : <Btn size="sm" tone="cream" onClick={() => { close(undefined); setTab('biz'); }}>先让 AI 认识我</Btn>}
          </div>
        )}

        <div className="mt-3 rounded-2xl bg-haze-200/60 p-3 text-xs" data-testid="agent-transparency">
          🤖 {transparencyNotice(opc.name)}
        </div>
        <div className="mt-2 space-y-2" data-testid="chat-log">
          {chats.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'visitor' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === 'visitor' ? 'bg-almond-300 text-cocoa-800' : 'bg-cream-100'}`}>
                {m.text}
                {m.reply && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Chip tone={LEVEL_TONE[m.reply.level]} className="!px-1.5 !py-0 !text-[9px]">{LEVEL_LABEL[m.reply.level]}</Chip>
                    {m.reply.handoff && <Chip tone="sakura" className="!px-1.5 !py-0 !text-[9px]">已转交主理人</Chip>}
                    {m.reply.citations.length > 0 && <span className="text-[9px] text-stone-400">依据：{m.reply.citations.join(', ')}</span>}
                    {m.reply.action?.kind === 'suggest_meeting' && owner && (
                      <button className="chip bg-sage-300 !py-0 text-[10px]" onClick={() => (intro ? (close(undefined), setTab('messages')) : openHello(owner.id))}>预约主理人</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {quick.map((t) => <button key={t} className="chip bg-cream-100 text-stone-600" onClick={() => send(t)}>{t}</button>)}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(q); }}>
          <input data-testid="chat-input" className="input" placeholder="问问 AI 分身…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Btn type="submit">发送</Btn>
        </form>
        <div className="mt-2"><Disclaimer>价格只引用主理人确认过的资料；最终报价、折扣、合同、交付承诺、退款需主理人本人确认（L3）。</Disclaimer></div>
      </Panel>
    </div>
  );
}
