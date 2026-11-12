import { useState } from 'react';
import { DEFAULT_HELLO, STATUS_LABEL, canSeeContact } from '../domain/introductions';
import { BIZ_LABEL, relationsWith } from '../domain/commerce';
import type { Introduction } from '../domain/types';
import { entityById, residentById } from '../data/seed';
import { INBOX_LABEL, ME, streetOfDistrict, useTown, type InboxKind } from '../store/useTown';
import { Btn, Card, Chip, Disclaimer, Drawer, Modal, Panel, Pill } from './kit';

/** 打招呼 + 奶油风商业邀请函 */
export function HelloComposer() {
  const target = useTown((s) => s.helloTarget);
  const close = useTown((s) => s.openHello);
  const sayHello = useTown((s) => s.sayHello);
  const profile = useTown((s) => s.profile);
  const myOpc = useTown((s) => s.myOpc);
  const avatar = useTown((s) => s.avatar);
  const [card, setCard] = useState(true);
  const r = target ? residentById(target) : undefined;
  const e = r ? entityById(r.entityId) : undefined;
  const rels = profile && e ? relationsWith(profile, e, streetOfDistrict) : [];
  const rel = rels[0];
  const suggested = rel?.type === 'customer'
    ? `你好！我在做${profile?.capabilities.map((c) => c.label).slice(0, 2).join('、')}。看到「${e?.name}」${rel.evidence === 'published' ? `正在找${rel.needs.find((n) => n.evidence === 'published')?.label ?? '相关服务'}` : '的产品很有特色'}，想问问是否有这方面的计划，方便的话可以聊 15 分钟～`
    : DEFAULT_HELLO;
  const [msg, setMsg] = useState<string | null>(null);
  if (!target || !r) return null;
  return (
    <Modal onClose={() => close(undefined)}>
      <Panel testId="hello-composer" title={`💌 给 ${r.nickname} 打个招呼`} subtitle="对方接受后，双方同意才会交换联系方式" onClose={() => close(undefined)}>
        <textarea className="input h-24 resize-none" maxLength={200} value={msg ?? suggested} onChange={(ev) => setMsg(ev.target.value)} />
        <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={card} onChange={(ev) => setCard(ev.target.checked)} /> 附上我的奶油邀请卡（对方点开可以进入我的小店）</label>
        {card && (
          <div className="mt-2 rounded-[1.5rem] bg-gradient-to-br from-cream-50 via-almond-300/40 to-sakura-200 p-4 shadow-soft ring-2 ring-white" data-testid="invite-card">
            <div className="text-[10px] font-bold tracking-widest text-sage-700">INVITATION · 商业邀请函</div>
            <div className="mt-1 text-lg font-black">{myOpc?.name ?? `${avatar?.nickname} 的工作室`}</div>
            <div className="text-xs text-stone-600">{myOpc?.tagline ?? profile?.headline}</div>
            <div className="mt-2 flex flex-wrap gap-1">{profile?.capabilities.map((c) => <Chip key={c.tag} tone="cream">{c.label}</Chip>)}</div>
            {rel && <div className="mt-2 text-[11px] text-cocoa-600">为什么找你：{rel.answers.why}（{BIZ_LABEL[rel.type]}）</div>}
          </div>
        )}
        <Btn className="mt-3 w-full" onClick={() => sayHello(target, msg ?? suggested, rel?.id)} data-testid="send-hello">发送奶油信封 ✉️</Btn>
      </Panel>
    </Modal>
  );
}

const KINDS: (InboxKind | 'all')[] = ['all', 'invite', 'collab', 'meeting', 'agent', 'chat', 'event', 'order', 'system'];

export function MessagesPanel() {
  const inbox = useTown((s) => s.inbox);
  const intros = useTown((s) => s.intros);
  const meetings = useTown((s) => s.meetings);
  const collected = useTown((s) => s.collectedNeeds);
  const setTab = useTown((s) => s.setTab);
  const markRead = useTown((s) => s.markRead);
  const [view, setView] = useState<'connect' | InboxKind | 'all'>('connect');
  const needsMe = intros.filter((i) => i.status === 'accepted' && !i.contactConsent[i.fromUserId === ME ? 'from' : 'to']).length + inbox.filter((i) => i.needsMe && !i.read).length;
  return (
    <Drawer wide testId="messages-panel" title="💌 消息" subtitle={needsMe ? `${needsMe} 件需要你本人处理` : '商务连接、AI 接待、会议与活动'} onClose={() => { markRead(); setTab('city'); }}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button onClick={() => setView('connect')} className={`chip ${view === 'connect' ? 'bg-almond-400' : 'bg-cream-100 text-stone-600'}`}>商务连接 {intros.length}</button>
        {KINDS.map((k) => {
          const n = k === 'all' ? inbox.filter((i) => !i.read).length : inbox.filter((i) => i.kind === k && !i.read).length;
          return <button key={k} onClick={() => { setView(k); }} className={`chip ${view === k ? 'bg-almond-400' : 'bg-cream-100 text-stone-600'}`}>{k === 'all' ? '全部通知' : INBOX_LABEL[k]}{n ? ` ${n}` : ''}</button>;
        })}
      </div>
      {view === 'connect' ? (
        <div className="space-y-3">
          {intros.length === 0 && <div className="text-sm text-stone-600">还没有打过招呼。去「我的生意」看看谁可能是你的客户。</div>}
          {intros.map((i) => <IntroCard key={i.id} intro={i} meetings={meetings.filter((m) => m.introductionId === i.id)} />)}
          {collected.length > 0 && <Card className="!p-3"><div className="text-sm font-black">我的 AI 分身收集的需求</div>{collected.slice(0, 5).map((c) => <div key={c.at} className="mt-1 text-xs text-stone-600">· {c.text}</div>)}</Card>}
        </div>
      ) : (
        <div className="space-y-2">
          {inbox.filter((m) => view === 'all' || m.kind === view).map((m) => (
            <div key={m.id} className={`rounded-2xl p-3 ${m.read ? 'bg-cream-100' : 'bg-almond-300/40'}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone="cream">{INBOX_LABEL[m.kind]}</Pill>
                {m.needsMe && <Pill tone="sakura">需要本人处理</Pill>}
                {m.handledByAgent && <Pill tone="haze">已由 AI 分身处理</Pill>}
                <span className="text-sm font-bold">{m.title}</span>
              </div>
              <div className="mt-0.5 text-xs text-stone-600">{m.body}</div>
              <div className="mt-1 text-[10px] text-stone-400">{new Date(m.at).toLocaleString('zh-CN')}</div>
            </div>
          ))}
          {view === 'order' && <div className="text-xs text-stone-600">暂无订单。第一版先做询价与意向单，再接入持牌支付。</div>}
          {view === 'chat' && <div className="text-xs text-stone-600">双方交换联系方式或在平台内沟通后，真人私聊会出现在这里。</div>}
        </div>
      )}
    </Drawer>
  );
}

function IntroCard({ intro, meetings }: { intro: Introduction; meetings: { id: string; durationMin: number; startsAt: number; topic: string }[] }) {
  const otherId = intro.fromUserId === ME ? intro.toUserId : intro.fromUserId;
  const r = residentById(otherId)!;
  const e = entityById(r.entityId);
  const consent = useTown((s) => s.consentContact);
  const book = useTown((s) => s.book);
  const propose = useTown((s) => s.proposeCollab);
  const [dur, setDur] = useState<15 | 30 | 60>(30);
  const [topic, setTopic] = useState('互相介绍产品与合作需求');
  const mySide = intro.fromUserId === ME ? 'from' : 'to';
  const iConsented = intro.contactConsent[mySide];
  const theyConsented = intro.contactConsent[mySide === 'from' ? 'to' : 'from'];
  const active = !['sent', 'declined'].includes(intro.status);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(15, 0, 0, 0);
  return (
    <Card className="!p-3">
      <div data-testid={`intro-${otherId}`} className="flex items-center justify-between gap-2">
        <div className="font-black">{r.nickname} <span className="text-xs font-normal text-stone-600">{e?.name}</span></div>
        <Chip tone={intro.status === 'declined' ? 'cream' : active ? 'sage' : 'almond'}>{STATUS_LABEL[intro.status]}</Chip>
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-stone-600">“{intro.message}”</div>
      <Steps status={intro.status} />
      {active && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl bg-cream-100 p-2 text-xs">
            <div className="font-bold">① 交换联系方式 {!iConsented && <Pill tone="sakura">需要本人处理</Pill>}</div>
            {canSeeContact(intro) ? <div className="mt-1" data-testid="contact-visible">📇 {r.contact}</div> : (
              <div className="mt-1 flex flex-wrap items-center gap-2"><span>对方{theyConsented ? '已同意' : '尚未同意'} · 你{iConsented ? '已同意' : '尚未同意'}</span>{!iConsented && <Btn size="sm" onClick={() => consent(intro.id)} data-testid="consent-contact">我同意交换</Btn>}</div>
            )}
          </div>
          <div className="rounded-xl bg-cream-100 p-2 text-xs">
            <div className="font-bold">② 发起线上见面会</div>
            {meetings.map((m) => <div key={m.id} className="mt-1">📅 {new Date(m.startsAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {m.durationMin} 分钟 · {m.topic}</div>)}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {[15, 30, 60].map((d) => <button key={d} onClick={() => setDur(d as 15 | 30 | 60)} className={`chip ${dur === d ? 'bg-almond-400' : 'bg-white text-stone-600'}`}>{d} 分钟</button>)}
              <input className="input !py-1 !text-xs" value={topic} onChange={(ev) => setTopic(ev.target.value)} />
              <Btn size="sm" onClick={() => book(intro.id, dur, tomorrow.getTime(), topic)} data-testid="book-meeting">预约明天 15:00</Btn>
            </div>
          </div>
          <div className="rounded-xl bg-cream-100 p-2 text-xs">
            <div className="font-bold">③ 形成合作记录</div>
            <div className="mt-1">你{intro.collabConfirm[mySide] ? '已确认' : '未确认'} · 对方{intro.collabConfirm[mySide === 'from' ? 'to' : 'from'] ? '已确认' : '未确认'}</div>
            {!intro.collabConfirm[mySide] && <Btn size="sm" tone="sage" className="mt-1" onClick={() => propose(intro.id)} data-testid="propose-collab">我们开始合作了</Btn>}
            <div className="mt-1 text-[10px] text-stone-400">合作记录必须双方本人确认，AI 不能擅自认定。</div>
          </div>
        </div>
      )}
      {intro.status === 'sent' && <div className="mt-2"><Disclaimer>{r.online ? '对方在线，' : '对方暂时离线，'}稍等 TA 的回应（演示角色会自动模拟回应）。</Disclaimer></div>}
    </Card>
  );
}

const FLOW = ['sent', 'accepted', 'contact_exchanged', 'meeting_booked', 'collab_confirmed'] as const;
const FLOW_LABEL = ['打招呼', '接受', '交换联系', '见面', '合作'];
function Steps({ status }: { status: Introduction['status'] }) {
  const idx = status === 'collab_proposed' ? 3 : status === 'declined' ? -1 : FLOW.indexOf(status as (typeof FLOW)[number]);
  return (
    <div className="mt-2 flex items-center gap-1">
      {FLOW_LABEL.map((l, i) => (
        <div key={l} className="flex flex-1 flex-col items-center">
          <div className={`h-1.5 w-full rounded-full ${i <= idx ? 'bg-sage-400' : 'bg-cream-300'}`} />
          <span className={`mt-0.5 text-[9px] ${i <= idx ? 'font-bold text-sage-700' : 'text-stone-400'}`}>{l}</span>
        </div>
      ))}
    </div>
  );
}
