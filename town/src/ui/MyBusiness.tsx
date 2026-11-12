/**
 * 我的生意 —— 客户优先的商业地图。
 * 默认视图回答：我的客户在哪里？他们可能需要什么？我能给他们提供什么？为什么推荐我？我应该先找谁？
 */
import { useState } from 'react';
import { BIZ_DISCLAIMER, BIZ_LABEL, BIZ_ORDER, BIZ_QUESTION, ENTITY_KIND_LABEL, WEIGHTS, type BizRelation, type BizRelType } from '../domain/commerce';
import { extractProfile, suggestDirections, toProfile, type ExtractionResult } from '../domain/profileExtractor';
import { CAPABILITIES, DISTRICT_LABEL, capLabel } from '../domain/taxonomy';
import type { DistrictId } from '../domain/types';
import { STORY_INTRO_TEXT, entityById, residentOfEntity } from '../data/seed';
import { allLots, districtName } from '../world';
import { ME, useBusinessMap, useTown } from '../store/useTown';
import { Btn, Card, Chip, Disclaimer, Drawer, Pill } from './kit';

export function MyBusiness() {
  const profile = useTown((s) => s.profile);
  const setTab = useTown((s) => s.setTab);
  const [editing, setEditing] = useState(false);
  return (
    <Drawer wide testId="biz-panel" title="💼 我的生意" subtitle="找到客户 · 发现需求 · 连接资源 · 促成合作" onClose={() => setTab('city')}>
      {!profile || editing ? <ProfileSetup onDone={() => setEditing(false)} /> : <BizHome onEdit={() => setEditing(true)} />}
    </Drawer>
  );
}

function BizHome({ onEdit }: { onEdit: () => void }) {
  const profile = useTown((s) => s.profile)!;
  const map = useBusinessMap()!;
  const type = useTown((s) => s.bizType);
  const focus = useTown((s) => s.bizFocus);
  const setBiz = useTown((s) => s.setBiz);
  const show = useTown((s) => s.showMarkers);
  const setShow = useTown((s) => s.setShowMarkers);
  const [view, setView] = useState<'list' | 'flow' | 'more'>('list');
  const list = map.byType[type];

  return (
    <div className="space-y-3">
      <Card className="!p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold text-stone-600">我提供什么？</div>
            <div className="text-sm font-black">{profile.capabilities.map((c) => c.label).join(' / ')}</div>
            <div className="mt-0.5 text-[11px] text-stone-600">服务范围：{profile.districts.map((d) => DISTRICT_LABEL[d]).join('、')}{profile.mode !== 'onsite' ? '，可远程合作' : ''}{profile.priceRange ? ` · 报价 ${profile.priceRange.min}–${profile.priceRange.max} 元` : ''}</div>
          </div>
          <button className="chip shrink-0 bg-cream-100 text-stone-600" onClick={onEdit}>✏️ 修改</button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5" data-testid="biz-counts">
          {([['customer', '潜在客户'], ['supplier', '潜在供应商'], ['partner', '合作伙伴'], ['channel', '渠道资源']] as [BizRelType, string][]).map(([t, l]) => {
            const n = t === 'channel' ? map.counts.channel + map.counts.resource : map.counts[t];
            const on = type === t || (t === 'channel' && type === 'resource');
            return (
              <button key={t} onClick={() => setBiz(t)} className={`rounded-2xl px-1 py-2 text-center transition ${on ? 'bg-almond-300 ring-2 ring-almond-500' : 'bg-cream-100'}`}>
                <div className="text-xl font-black tabular-nums text-cocoa-800">{n}</div>
                <div className="text-[10px] font-bold text-stone-600">{l}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-1.5">
        {([['list', '优先联系'], ['flow', '商业关系视图'], ['more', '生意灵感 · 成长']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} className={`chip ${view === v ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-100 text-stone-600'}`}>{l}</button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[11px] text-stone-600"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> 在街区地图上标出</label>
      </div>

      {view === 'list' && (
        <>
          <div className="flex flex-wrap gap-1">
            {BIZ_ORDER.map((t) => (
              <button key={t} onClick={() => setBiz(t)} className={`chip ${type === t ? 'bg-cocoa-600 text-cream-50' : 'bg-cream-100 text-stone-600'}`}>{BIZ_LABEL[t]} {map.counts[t]}</button>
            ))}
          </div>
          <div className="text-xs font-bold text-stone-600">{BIZ_QUESTION[type]}</div>
          <div className="space-y-2" data-testid="biz-list">
            {list.length === 0 && <div className="text-sm text-stone-600">暂时没有找到。试试补充你的能力或需求。</div>}
            {list.map((r, i) => <RelationCard key={r.id} r={r} rank={i + 1} open={focus === r.id || (!focus && i === 0)} onOpen={() => setBiz(type, r.id)} />)}
          </div>
        </>
      )}
      {view === 'flow' && <FlowView />}
      {view === 'more' && <More />}
      <Disclaimer>{BIZ_DISCLAIMER}</Disclaimer>
    </div>
  );
}

function RelationCard({ r, rank, open, onOpen }: { r: BizRelation; rank: number; open: boolean; onOpen: () => void }) {
  const e = entityById(r.counterpartyId)!;
  const owner = residentOfEntity(e.id);
  const intro = useTown((s) => s.intros.find((i) => owner && i.toUserId === owner.id));
  const openHello = useTown((s) => s.openHello);
  const saveLead = useTown((s) => s.saveLead);
  const saved = useTown((s) => s.savedLeads.includes(e.id));
  const setTab = useTown((s) => s.setTab);
  const goDistrict = useTown((s) => s.goDistrict);
  const walkTo = useTown((s) => s.walkTo);
  const district = useTown((s) => s.district);
  const lot = e.place.lotId ? allLots().find((l) => l.door.lotId === e.place.lotId) : undefined;
  const goSee = () => {
    if (!lot) return;
    setTab('city');
    if (lot.district !== district) goDistrict(lot.district, lot.door.trigger);
    else walkTo(lot.door.trigger);
  };
  const isCustomer = r.type === 'customer';
  return (
    <div className={`rounded-2xl bg-cream-50 p-3 ring-1 transition ${open ? 'ring-almond-400 shadow-soft' : 'ring-cream-200'}`} data-testid={`rel-${r.counterpartyId}`}>
      <button onClick={onOpen} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black text-stone-400">#{rank}</span>
            <span className="font-black text-cocoa-800">{e.name}</span>
            <Pill tone={e.kind === 'prospect' ? 'cream' : e.kind === 'individual' ? 'haze' : 'sage'}>{ENTITY_KIND_LABEL[e.kind]}</Pill>
          </div>
          <div className="mt-0.5 text-[11px] text-stone-600">{e.summary}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-black tabular-nums text-cocoa-800">{r.score === null ? '—' : `${r.score}%`}</div>
          <div className="text-[9px] text-stone-400">{r.score === null ? '信息不足' : '系统估算'}</div>
        </div>
      </button>
      <dl className="mt-2 grid grid-cols-[4.6rem_1fr] gap-x-2 gap-y-1 text-[12px]">
        <dt className="font-bold text-stone-600">{isCustomer ? '客户在哪里' : '在哪里'}</dt><dd>{r.answers.where}</dd>
        <dt className="font-bold text-stone-600">{isCustomer ? '可能需要' : '关系'}</dt>
        <dd>{r.answers.need} <Pill tone={r.evidence === 'published' ? 'sage' : 'sakura'}>{r.evidence === 'published' ? '对方已发布' : '系统推测 · 尚未核实'}</Pill></dd>
        <dt className="font-bold text-stone-600">{isCustomer ? '你可以提供' : '对方提供'}</dt><dd>{r.answers.offer}</dd>
        <dt className="font-bold text-stone-600">为什么推荐</dt><dd>{r.answers.why}</dd>
      </dl>
      {open && (
        <div className="mt-2 rounded-xl bg-cream-100 p-2">
          <div className="text-[11px] font-black">计算依据（S = 0.30I + 0.30C + 0.15G + 0.15B + 0.10W）</div>
          {([['industry', 'I 行业关联', WEIGHTS.industry], ['complement', 'C 能力需求互补', WEIGHTS.complement], ['geo', 'G 地域适配', WEIGHTS.geo], ['budget', 'B 预算适配', WEIGHTS.budget], ['willingness', 'W 合作意愿', WEIGHTS.willingness]] as const).map(([k, l, w]) => {
            const v = r.breakdown[k];
            return (
              <div key={k} className="mt-1 flex items-center gap-2 text-[10px]">
                <span className="w-24 text-stone-600">{l} ×{w}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-300">{v !== null && <div className="h-full rounded-full bg-almond-400" style={{ width: `${v}%` }} />}</div>
                <span className="w-12 text-right tabular-nums">{v === null ? '未计分' : v}</span>
              </div>
            );
          })}
          <ul className="mt-1 space-y-0.5 text-[10px] text-stone-600">{r.basis.map((b) => <li key={b}>· {b}</li>)}</ul>
          {r.missing.length > 0 && <div className="mt-1 text-[10px] text-brick-500">缺少信息：{r.missing.join('；')}</div>}
          <div className="mt-1 text-[11px]"><b>建议下一步：</b>{r.nextStep}</div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {lot && <Btn size="sm" tone="cream" onClick={goSee}>📍 {lot.district === district ? '走到店门口' : `去${districtName(lot.district)}看看`}</Btn>}
        {r.canContact && owner && (intro
          ? <Btn size="sm" tone="sage" onClick={() => setTab('messages')}>已联系 · 看进度</Btn>
          : <Btn size="sm" onClick={() => openHello(owner.id)} data-testid={`hello-${r.counterpartyId}`}>💌 打个招呼</Btn>)}
        {!r.canContact && <Btn size="sm" tone="cream" disabled={saved} onClick={() => saveLead(e.id)}>{saved ? '已收藏线索' : '⭐ 收藏为线索'}</Btn>}
        {!r.canContact && <span className="self-center text-[10px] text-stone-400">未入驻，无法直接联系</span>}
      </div>
    </div>
  );
}

/** 商业关系视图：按价值流向分层 —— 客户在上、我在中间、供应商在下、横向合作在两侧、渠道与资源在底部 */
function FlowView() {
  const map = useBusinessMap()!;
  const setBiz = useTown((s) => s.setBiz);
  const avatar = useTown((s) => s.avatar)!;
  const W = 480, H = 420;
  const row = (rels: BizRelation[], y: number, x0 = 40, x1 = W - 40) => rels.slice(0, 5).map((r, i, a) => ({ r, x: a.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (a.length - 1), y }));
  const nodes = [
    ...row(map.byType.customer, 48, 52, W - 52),
    ...row(map.byType.supplier, 300, 150, W - 52),
    ...row(map.byType.partner.slice(0, 4), 0).map((n, i) => ({ ...n, y: 122 + i * 36, x: 56 })),
    ...row([...map.byType.channel, ...map.byType.resource], 382, 150, W - 52),
  ];
  const me = { x: W / 2 + 40, y: 178 };
  const COLOR: Record<BizRelType, string> = { customer: '#D9AE55', supplier: '#9DB6CA', partner: '#86A57C', channel: '#E6A3A7', resource: '#A47B5B' };
  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[22rem] rounded-2xl bg-cream-100" data-testid="flow-svg">
          <text x={12} y={18} fontSize="11" fontWeight="800" fill="#7A5539">潜在客户：谁会购买我的服务（价值流向 ↑）</text>
          <text x={150} y={270} fontSize="11" fontWeight="800" fill="#5E7D96">上游供应：我需要采购什么（↓）</text>
          <text x={150} y={352} fontSize="11" fontWeight="800" fill="#A47B5B">渠道与资源</text>
          {nodes.map(({ r, x, y }) => (
            <line key={`l${r.id}`} x1={me.x} y1={me.y} x2={x} y2={y} stroke={COLOR[r.type]} strokeWidth={2.5} strokeDasharray={r.evidence === 'published' ? undefined : '6 5'} opacity={0.8} />
          ))}
          <circle cx={me.x} cy={me.y} r={30} fill={avatar.look.body} stroke="#FFFDF8" strokeWidth={4} />
          <text x={me.x} y={me.y - 2} textAnchor="middle" fontSize="12" fontWeight="900" fill="#4A3426">我</text>
          <text x={me.x} y={me.y + 12} textAnchor="middle" fontSize="8" fill="#4A3426">OPC 主理人</text>
          {nodes.map(({ r, x, y }) => {
            const e = entityById(r.counterpartyId)!;
            return (
              <g key={r.id} className="cursor-pointer" onClick={() => setBiz(r.type, r.id)}>
                <rect x={x - 42} y={y - 15} width={84} height={30} rx={12} fill="#FFFDF8" stroke={COLOR[r.type]} strokeWidth={2} />
                <text x={x} y={y - 1} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#4A3426">{e.name.replace(/（.*?）/g, '').slice(0, 7)}</text>
                <text x={x} y={y + 10} textAnchor="middle" fontSize="8" fill="#6F6A63">{BIZ_LABEL[r.type]} {r.score ?? '?'}%</text>
              </g>
            );
          })}
          <text x={14} y={100} fontSize="11" fontWeight="800" fill="#56704F">横向合作</text>
        </svg>
      </div>
      <div className="mt-1 text-[10px] text-stone-600">实线 = 对方已发布相关需求或你已发布需求；虚线 = 系统推测。同一主体可能同时出现在多层（例如既是客户又是供应商），每条关系针对一项具体业务。</div>
    </div>
  );
}

function More() {
  const profile = useTown((s) => s.profile)!;
  const myOpc = useTown((s) => s.myOpc);
  const intros = useTown((s) => s.intros);
  const ideas = suggestDirections(profile.capabilities.map((c) => c.tag));
  const accepted = intros.filter((i) => !['sent', 'declined'].includes(i.status));
  const steps = [
    { t: '发现自己能够提供什么', done: profile.capabilities.length > 0 },
    { t: '建立个人工作室', done: !!myOpc },
    { t: '找到第一个合作伙伴', done: accepted.length > 0 },
    { t: '完成第一个客户项目', done: intros.some((i) => i.status === 'collab_confirmed') },
    { t: '建立稳定的上下游关系', done: accepted.length >= 3 },
    { t: '组建自己的小团队', done: intros.filter((i) => i.status === 'collab_confirmed').length >= 3 },
  ];
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-black">生意灵感（探索建议，不保证赚钱）</div>
        {ideas.map((d) => <div key={d.title} className="mt-1 rounded-xl bg-cream-100 px-3 py-2 text-xs"><b>{d.title}</b> · {d.why}</div>)}
      </div>
      <div>
        <div className="text-sm font-black">我的商业成长地图</div>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {steps.map((s, i) => <div key={s.t} className={`rounded-xl px-2 py-1.5 text-[11px] ${s.done ? 'bg-sage-300 text-sage-700' : 'bg-cream-100 text-stone-600'}`}>{s.done ? '✓' : i + 1}. {s.t}</div>)}
        </div>
        <div className="mt-1 text-[10px] text-stone-400">“完成客户项目”只统计双方本人确认的合作记录。</div>
      </div>
    </div>
  );
}

/** 一句话让 AI 认识你 —— 提取结果必须经你确认 */
function ProfileSetup({ onDone }: { onDone: () => void }) {
  const avatar = useTown((s) => s.avatar)!;
  const saveProfile = useTown((s) => s.saveProfile);
  const [text, setText] = useState('');
  const [x, setX] = useState<ExtractionResult | null>(null);
  const [caps, setCaps] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [sugg, setSugg] = useState<string[]>([]);
  const [districts, setDistricts] = useState<DistrictId[]>([]);
  const run = (t: string) => {
    const r = extractProfile(t);
    setX(r); setCaps(r.capabilities.map((c) => c.tag)); setNeeds(r.needs.map((n) => n.tag)); setSugg([]);
    setDistricts(r.districts.length ? r.districts : ['xuhui']);
  };
  const confirm = () => {
    if (!x) return;
    const p = toProfile(ME, avatar.nickname, text.split(/[。！？\n]/)[0].slice(0, 40), {
      ...x, capabilities: caps.map((tag) => ({ tag, label: capLabel(tag) })), needs: needs.map((tag) => ({ tag, label: capLabel(tag) })), districts,
    }, sugg);
    saveProfile({ ...p, industries: [...new Set(caps.map((c) => CAPABILITIES.find((d) => d.id === c)?.industry).filter(Boolean) as string[])] });
    onDone();
  };
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((a) => a !== v) : [...arr, v]);
  return (
    <div data-testid="profile-setup" className="space-y-2">
      <div className="rounded-2xl bg-cream-100 p-3 text-sm"><b>先告诉 AI：你能提供什么？</b>一两句话就好——你会什么、想接什么样的生意、在哪个区。</div>
      <textarea data-testid="profile-input" className="input h-20 resize-none" placeholder={`例如：${STORY_INTRO_TEXT}`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => run(text)} disabled={!text.trim()} data-testid="extract-btn">✨ 让 AI 理解我</Btn>
        <Btn tone="cream" onClick={() => { setText(STORY_INTRO_TEXT); run(STORY_INTRO_TEXT); }} data-testid="use-example">用示例：AI 视频制作人</Btn>
      </div>
      {x && (
        <Card className="wobble-in !p-3">
          <div className="text-sm font-black">我理解到的你 <span className="text-[11px] font-normal text-stone-600">点标签增删，确认后才用于匹配</span></div>
          <div className="mt-2 space-y-2 text-xs">
            <Row label="我能提供">
              {[...new Set([...x.capabilities.map((c) => c.tag), ...caps])].map((t) => <Toggle key={t} on={caps.includes(t)} onClick={() => toggle(caps, setCaps, t)}>{capLabel(t)}</Toggle>)}
              <select className="chip bg-white/70 text-stone-600" value="" onChange={(e) => e.target.value && setCaps([...caps, e.target.value])}>
                <option value="">+ 添加</option>{CAPABILITIES.filter((c) => !caps.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Row>
            <Row label="我需要">{[...new Set([...x.needs.map((n) => n.tag), ...needs])].map((t) => <Toggle key={t} on={needs.includes(t)} onClick={() => toggle(needs, setNeeds, t)}>{capLabel(t)}</Toggle>)}</Row>
            {x.suggestedNeeds.length > 0 && <Row label="AI 猜你还需要">{x.suggestedNeeds.map((n) => <Toggle key={n.tag} on={sugg.includes(n.tag)} onClick={() => toggle(sugg, setSugg, n.tag)} dashed>{n.label}</Toggle>)}</Row>}
            <Row label="服务区域">{(['xuhui', 'jingan', 'huangpu', 'changning', 'pudong', 'hongkou'] as DistrictId[]).map((d) => <Toggle key={d} on={districts.includes(d)} onClick={() => setDistricts(districts.includes(d) ? districts.filter((v) => v !== d) : [...districts, d])}>{DISTRICT_LABEL[d]}</Toggle>)}</Row>
          </div>
          <Btn className="mt-3 w-full" onClick={confirm} disabled={!caps.length} data-testid="confirm-profile">✅ 确认，帮我找客户</Btn>
          <div className="mt-2"><Disclaimer>只有你确认的标签会公开并用于匹配；AI 不读取聊天记录推测隐私。可随时在「我的」里关闭“愿意被推荐”。</Disclaimer></div>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5"><span className="w-20 shrink-0 font-bold text-stone-600">{label}</span>{children}</div>;
}
function Toggle({ on, onClick, children, dashed }: { on: boolean; onClick: () => void; children: React.ReactNode; dashed?: boolean }) {
  return <button onClick={onClick} className={`chip ${on ? 'bg-almond-400 text-cocoa-800' : `bg-white/70 text-stone-400 ${dashed ? 'border border-dashed border-stone-400' : 'line-through'}`}`}>{on ? '✓ ' : '+ '}{children}</button>;
}
export { Chip };
