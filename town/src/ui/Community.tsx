/**
 * 我的社区 —— 商业关系的线下孵化器。
 * 三个空间定位明确；活动信息足够判断“值不值得去”；并与商业地图打通：
 * “你可能适合参加本周六的活动，现场可能有你想认识的潜在客户”。
 */
import { useState } from 'react';
import { EVENTS, SPACE_INFO, type SpaceKind, type TownEvent } from '../data/events';
import { entityById } from '../data/seed';
import { districtName } from '../world';
import { useBusinessMap, useTown } from '../store/useTown';
import { Btn, Card, Disclaimer, Drawer, Pill } from './kit';

export function CommunityPanel() {
  const setTab = useTown((s) => s.setTab);
  const myEvents = useTown((s) => s.myEvents);
  const marketing = useTown((s) => s.marketingOptIn);
  const focus = useTown((s) => s.eventFocus);
  const focusEvent = useTown((s) => s.focusEvent);
  const map = useBusinessMap();
  const [space, setSpace] = useState<SpaceKind | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const customers = new Set(map?.byType.customer.map((r) => r.counterpartyId) ?? []);
  const partners = new Set([...(map?.byType.partner ?? []), ...(map?.byType.supplier ?? [])].map((r) => r.counterpartyId));
  const all = [...myEvents, ...EVENTS].filter((e) => marketing || !e.sponsor);
  const recommended = all.map((e) => ({ e, c: e.attendees.filter((a) => customers.has(a)) })).filter((x) => x.c.length).sort((a, b) => b.c.length - a.c.length)[0];
  const list = all.filter((e) => space === 'all' || e.space === space);

  return (
    <Drawer wide testId="community-panel" title="☕ 我的社区" subtitle="我可以认识谁？和谁见面？" onClose={() => setTab('city')}>
      <div className="space-y-3">
        {recommended && (
          <div className="rounded-2xl bg-almond-300/50 p-3 ring-2 ring-almond-400" data-testid="event-reco">
            <div className="text-xs font-black text-cocoa-600">✨ 根据你的商业地图推荐</div>
            <div className="mt-1 text-sm">你可能适合参加 <b>{recommended.e.date}的「{recommended.e.title}」</b>：已报名的主体里有 {recommended.c.length} 个可能是你的潜在客户（{recommended.c.map((id) => entityById(id)?.name).join('、')}）。</div>
            <Btn size="sm" className="mt-2" onClick={() => focusEvent(recommended.e.id)}>查看活动</Btn>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SPACE_INFO) as SpaceKind[]).map((k) => (
            <button key={k} onClick={() => setSpace(space === k ? 'all' : k)} className={`overflow-hidden rounded-2xl text-left ring-1 transition ${space === k ? 'ring-2 ring-almond-500' : 'ring-cream-200'}`}>
              <SpaceArt kind={k} />
              <div className="bg-cream-50 px-2 py-1.5">
                <div className="text-xs font-black">{SPACE_INFO[k].name}</div>
                <div className="text-[10px] text-stone-600">{SPACE_INFO[k].purpose} · {SPACE_INFO[k].typical}</div>
              </div>
            </button>
          ))}
        </div>
        {space !== 'all' && <div className="flex flex-wrap gap-1">{SPACE_INFO[space].features.map((f) => <Pill key={f} tone="cream">{f}</Pill>)}</div>}
        <div className="flex items-center justify-between">
          <div className="text-sm font-black">活动</div>
          <Btn size="sm" onClick={() => setCreating(!creating)}>{creating ? '收起' : '+ 发起活动'}</Btn>
        </div>
        {creating && <CreateEvent onDone={() => setCreating(false)} />}
        {list.map((e) => <EventCard key={e.id} e={e} open={focus === e.id} onToggle={() => focusEvent(focus === e.id ? undefined : e.id)} customers={customers} partners={partners} />)}
        <Disclaimer>AI 社区主持人会明确身份，只负责欢迎、介绍主题、分配话题、整理纪要与可能的合作；涉及真实人物评价、隐私、收费、承诺与争议处理，由主办方本人决定。赞助内容均明确标注，可在「我的」中关闭。</Disclaimer>
      </div>
    </Drawer>
  );
}

function EventCard({ e, open, onToggle, customers, partners }: { e: TownEvent; open: boolean; onToggle: () => void; customers: Set<string>; partners: Set<string> }) {
  const joined = useTown((s) => s.joinedEvents.includes(e.id));
  const join = useTown((s) => s.joinEvent);
  const c = e.attendees.filter((a) => customers.has(a)).length;
  const p = e.attendees.filter((a) => partners.has(a)).length;
  const host = e.hostEntity ? entityById(e.hostEntity) : undefined;
  return (
    <Card className={`!p-3 ${open ? 'ring-2 ring-almond-400' : ''}`}>
      <button onClick={onToggle} className="w-full text-left" data-testid={`event-${e.id}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-black">{e.title}</div>
            <div className="text-[11px] text-stone-600">{e.date} {e.time} · {e.online ? '线上' : '线下'} · {SPACE_INFO[e.space].name}</div>
            <div className="text-[11px] text-stone-600">📍 {e.address}（{districtName(e.district)}）</div>
          </div>
          {e.sponsor && <Pill tone="sakura">{e.sponsor.disclosure} · {e.sponsor.brand}</Pill>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Pill tone="cream">{e.attendees.length + (joined ? 1 : 0)}/{e.capacity} 人</Pill>
          <Pill tone="cream">{e.fee ? `¥${e.fee}` : '免费'}</Pill>
          {e.matchmaking && <Pill tone="sage">有商务对接环节</Pill>}
          {e.bringProduct && <Pill tone="haze">可带产品</Pill>}
          {e.needsApproval && <Pill tone="cream">需主办方审核</Pill>}
          {e.aiHost && <Pill tone="haze">AI 主持人（明确身份）</Pill>}
          {c > 0 && <Pill tone="almond">现场可能有 {c} 位潜在客户</Pill>}
          {p > 0 && <Pill tone="sage">{p} 位潜在伙伴</Pill>}
        </div>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 text-[12px]">
          <div><b>适合谁：</b>{e.audience}</div>
          <div><b>能获得：</b>{e.gains.join('；')}</div>
          <div><b>流程：</b>{e.agenda.map((a) => `${a.t} ${a.what}`).join(' → ')}</div>
          <div><b>主办方：</b>{e.hostIntro}{host ? `（${host.name}）` : ''}</div>
          <div><b>参加者类型：</b>{e.attendeeTypes.join('、')}</div>
          <div><b>已报名主体：</b>{e.attendees.map((a) => entityById(a)?.name ?? a).join('、')}</div>
          <div><b>报名截止：</b>{e.deadline}</div>
          <div><b>取消与退款：</b>{e.refund}</div>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <Btn size="sm" tone={joined ? 'sage' : 'almond'} onClick={() => join(e.id)} disabled={joined} data-testid={`join-${e.id}`}>{joined ? (e.needsApproval ? '已申请' : '已报名') : e.needsApproval ? '申请参加' : '报名'}</Btn>
      </div>
    </Card>
  );
}

function CreateEvent({ onDone }: { onDone: () => void }) {
  const create = useTown((s) => s.createEvent);
  const district = useTown((s) => s.district);
  const [f, setF] = useState({ title: '', space: 'coffee_lounge' as SpaceKind, online: false, date: '本周四', time: '19:30–21:00', capacity: 12, fee: 0, audience: '', agenda: '', sponsor: false, approval: false, ai: true, bring: false, match: true });
  const ok = f.title.trim() && f.audience.trim();
  return (
    <Card className="wobble-in space-y-2 !p-3">
      <input className="input" placeholder="活动标题（必填）" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input className="input" placeholder="适合谁？能获得什么？（必填）" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} />
      <input className="input" placeholder="流程，例如：19:30 自我介绍；20:00 需求发布" value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} />
      <div className="flex flex-wrap gap-2 text-xs">
        <select className="input !w-auto" value={f.space} onChange={(e) => setF({ ...f, space: e.target.value as SpaceKind })}>{(Object.keys(SPACE_INFO) as SpaceKind[]).map((k) => <option key={k} value={k}>{SPACE_INFO[k].name}</option>)}</select>
        <input className="input !w-24" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <input className="input !w-32" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        <label className="flex items-center gap-1">人数 <input className="input !w-16" type="number" min={2} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></label>
        <label className="flex items-center gap-1">费用 ¥ <input className="input !w-16" type="number" min={0} value={f.fee} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} /></label>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label><input type="checkbox" checked={f.online} onChange={(e) => setF({ ...f, online: e.target.checked })} /> 线上</label>
        <label><input type="checkbox" checked={f.match} onChange={(e) => setF({ ...f, match: e.target.checked })} /> 有商务对接</label>
        <label><input type="checkbox" checked={f.bring} onChange={(e) => setF({ ...f, bring: e.target.checked })} /> 可带产品</label>
        <label><input type="checkbox" checked={f.sponsor} onChange={(e) => setF({ ...f, sponsor: e.target.checked })} /> 允许品牌赞助</label>
        <label><input type="checkbox" checked={f.approval} onChange={(e) => setF({ ...f, approval: e.target.checked })} /> 报名需审核</label>
        <label><input type="checkbox" checked={f.ai} onChange={(e) => setF({ ...f, ai: e.target.checked })} /> 我不在时由 AI 主持</label>
      </div>
      <Btn size="sm" disabled={!ok} onClick={() => {
        create({
          id: `ev_${Date.now().toString(36)}`, title: f.title, space: f.space, district, address: `${districtName(district)}（地点待主办方确认）`, online: f.online, date: f.date, time: f.time,
          deadline: '活动前一天截止', capacity: f.capacity, attendees: [], attendeeTypes: ['不限'], audience: f.audience, gains: [f.audience],
          agenda: f.agenda ? f.agenda.split(/[；;]/).map((x) => ({ t: x.trim().split(' ')[0] ?? '', what: x.trim().split(' ').slice(1).join(' ') || x.trim() })) : [],
          hostIntro: '我', fee: f.fee, refund: f.fee ? '活动前 72 小时可全额退款（Demo 不发生真实支付）' : '免费活动', bringProduct: f.bring, matchmaking: f.match,
          needsApproval: f.approval, aiHost: f.ai, isDemo: false,
        });
        onDone();
      }}>发布活动</Btn>
    </Card>
  );
}

/** 空间缩略图：小场景插画（与奶油软陶世界统一的配色，不使用表情符号图标） */
function SpaceArt({ kind }: { kind: SpaceKind }) {
  return (
    <svg viewBox="0 0 120 70" className="block w-full" aria-hidden>
      <rect width="120" height="70" fill="#F4EBDA" />
      <path d="M0 52 L60 34 L120 52 L60 70 Z" fill="#E9DCC3" />
      {kind === 'coffee_lounge' && (
        <g>
          <rect x="18" y="10" width="38" height="26" rx="4" fill="#C2D3E0" stroke="#FBF6EC" strokeWidth="3" />
          <line x1="37" y1="10" x2="37" y2="36" stroke="#FBF6EC" strokeWidth="2" />
          <rect x="74" y="20" width="22" height="18" rx="4" fill="#7A5539" />
          <rect x="78" y="14" width="14" height="8" rx="2" fill="#A9A39A" />
          <ellipse cx="58" cy="50" rx="16" ry="5" fill="#A47B5B" />
          <rect x="56" y="50" width="4" height="10" fill="#7A5539" />
          <circle cx="52" cy="46" r="3" fill="#FBF6EC" /><circle cx="64" cy="46" r="3" fill="#FBF6EC" />
        </g>
      )}
      {kind === 'startup_lounge' && (
        <g>
          <rect x="34" y="8" width="52" height="28" rx="4" fill="#4A3426" />
          <rect x="38" y="12" width="44" height="20" rx="2" fill="#E8C77A" />
          <rect x="44" y="16" width="20" height="3" rx="1" fill="#FBF6EC" /><rect x="44" y="22" width="30" height="3" rx="1" fill="#FBF6EC" />
          <ellipse cx="60" cy="52" rx="24" ry="7" fill="#FBF6EC" stroke="#C9C0B2" />
          <circle cx="38" cy="47" r="4" fill="#9DB6CA" /><circle cx="82" cy="47" r="4" fill="#F0C4C6" /><circle cx="60" cy="60" r="4" fill="#A9C2A0" />
          <rect x="94" y="14" width="18" height="24" rx="3" fill="#F0C4C6" /><rect x="97" y="18" width="12" height="2" fill="#FBF6EC" /><rect x="97" y="23" width="9" height="2" fill="#FBF6EC" />
        </g>
      )}
      {kind === 'street_market' && (
        <g>
          {[18, 52, 86].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 14} 30 L${x} 18 L${x + 14} 30 Z`} fill={['#E6A3A7', '#A9C2A0', '#E8C77A'][i]} />
              <rect x={x - 12} y="30" width="24" height="3" fill="#FBF6EC" />
              <rect x={x - 11} y="40" width="22" height="10" rx="2" fill="#A47B5B" />
              <line x1={x - 11} y1="30" x2={x - 11} y2="50" stroke="#6F6A63" strokeWidth="1.5" /><line x1={x + 11} y1="30" x2={x + 11} y2="50" stroke="#6F6A63" strokeWidth="1.5" />
              <circle cx={x - 4} cy="38" r="2.5" fill="#D9534F" /><circle cx={x + 3} cy="38" r="2.5" fill="#F2D45C" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
