/**
 * 产业链黄页：三条演示产业链（电商直播出海 / 非遗手艺 / 教育培训）的完整上下游，
 * 链上成员（平台用户与商家）放在各自的环节里，“我”高亮显示；点环节看黄页、速配上下游、抢服务商展位。
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { INDUSTRY_CHAINS, LAYER_LABEL, MEMBER_LABEL, type ChainMember, type ChainStage, type Industry } from '../data/chains';
import { RELATION_LABEL, RESOURCE_LABEL, SLOTS_PER_STAGE, SLOT_DAYS, activeSlots, gaps, placeMe, speedMatch, type ResourceKind } from '../domain/chain';
import { entityById } from '../data/seed';
import { lotById } from '../world';
import { useOpp } from '../store/useOpp';
import { useTown } from '../store/useTown';
import { Btn, Disclaimer, Pill } from './kit';

const KIND_TONE: Record<ChainMember['kind'], string> = {
  opc: 'bg-almond-300 text-cocoa-800', merchant: 'bg-sage-300 text-sage-700', individual: 'bg-haze-300 text-cocoa-800',
  prospect: 'bg-cream-100 text-stone-600 ring-1 ring-cream-300', service: 'bg-sakura-300 text-cocoa-800',
};

export function useMyChain() {
  const profile = useTown((s) => s.profile);
  const myOpc = useTown((s) => s.myOpc);
  const joins = useOpp((s) => s.joins);
  const placements = useMemo(() => placeMe(profile?.confirmed ? profile : undefined, myOpc, joins), [profile, myOpc, joins]);
  const offers = [...(profile?.capabilities ?? []).map((c) => c.label), ...(myOpc?.products ?? []).map((p) => p.name)];
  const needs = [...(profile?.needs ?? []).map((n) => n.label), ...(myOpc?.openNeeds ?? [])];
  return { placements, offers, needs, myName: myOpc?.name ?? profile?.displayName ?? '我' };
}

export function ChainPanel() {
  const setTab = useTown((s) => s.setTab);
  const industryId = useOpp((s) => s.industry);
  const setIndustry = useOpp((s) => s.setIndustry);
  const stageId = useOpp((s) => s.stage);
  const setStage = useOpp((s) => s.setStage);
  const ind = INDUSTRY_CHAINS.find((x) => x.id === industryId)!;
  const { placements } = useMyChain();
  const mine = placements.filter((p) => p.industry === ind.id);
  const stage = ind.stages.find((s) => s.id === stageId);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.2rem] top-3 z-20 flex justify-center md:bottom-24 md:top-24 md:px-6">
      <div data-testid="chain-panel" className="wobble-in pointer-events-auto glass flex w-full max-w-6xl flex-col overflow-hidden rounded-blob ring-1 ring-cream-200">
        <div className="flex items-start justify-between gap-2 px-5 pt-4">
          <div>
            <div className="text-lg font-black text-cocoa-800">🔗 产业链黄页 · 上下游速配</div>
            <div className="text-xs text-stone-600">看清一条产业链上有谁、缺谁、我在哪；点任一环节查看黄页、速配上下游、抢服务商展位</div>
          </div>
          <button aria-label="关闭" onClick={() => setTab('city')} className="jelly grid h-8 w-8 shrink-0 place-items-center bg-cream-100 text-cocoa-600">✕</button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-5 pt-3">
          {INDUSTRY_CHAINS.map((x) => (
            <button key={x.id} data-testid={`industry-${x.id}`} onClick={() => setIndustry(x.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${x.id === ind.id ? 'bg-almond-400 text-cocoa-800 shadow-jelly' : 'bg-cream-100 text-stone-600'}`}>{x.emoji} {x.name}</button>
          ))}
        </div>
        <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
          <div className="text-xs text-stone-600">{ind.summary}</div>
          <MyPlacement ind={ind} />
          <ChainDiagram ind={ind} mineStages={mine.map((m) => m.stage)} selected={stageId} onPick={(id) => setStage(id === stageId ? undefined : id)} />
          <Legend />
          {stage && <StageDetail ind={ind} stage={stage} />}
          <GapNote ind={ind} />
        </div>
      </div>
    </div>
  );
}

function MyPlacement({ ind }: { ind: Industry }) {
  const { placements, myName } = useMyChain();
  const setStage = useOpp((s) => s.setStage);
  const setTab = useTown((s) => s.setTab);
  const here = placements.filter((p) => p.industry === ind.id);
  const other = placements.filter((p) => p.industry !== ind.id);
  return (
    <div className="mt-3 rounded-2xl bg-[#FFF1E6] p-3 text-xs ring-2 ring-[#FF8A3D]/60" data-testid="my-placement">
      <div className="font-black text-cocoa-800">⭐ {myName} 在这条链上的位置</div>
      {here.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {here.map((p) => (
            <button key={p.stage} onClick={() => setStage(p.stage)} className="rounded-full bg-[#FF8A3D] px-2.5 py-1 font-bold text-white" title={p.reason}>
              {ind.stages.find((s) => s.id === p.stage)?.name} · 查看速配 →
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-1 text-stone-600">
          还没有放到这条链上。可以在下面点一个环节，选择「我也在这个环节」；或者
          <button className="mx-1 font-bold text-almond-600 underline" onClick={() => setTab('biz')}>在「我的生意」告诉 AI 你能提供什么</button>，系统会自动把你放到对应环节。
        </div>
      )}
      {other.length > 0 && <div className="mt-1 text-stone-400">你在其他链上也有位置：{other.map((p) => `${INDUSTRY_CHAINS.find((x) => x.id === p.industry)?.name}·${INDUSTRY_CHAINS.flatMap((x) => x.stages).find((s) => s.id === p.stage)?.name}`).join('，')}</div>}
    </div>
  );
}

/** 链路图：上游 / 中游 / 下游三列 + 底部服务支撑，箭头上写明流动的是什么 */
function ChainDiagram({ ind, mineStages, selected, onPick }: { ind: Industry; mineStages: string[]; selected?: string; onPick: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [lines, setLines] = useState<{ d: string; x: number; y: number; what: string; hot: boolean }[]>([]);
  const slots = useOpp((s) => s.slots);
  const cols: ChainStage['layer'][] = ['upstream', 'midstream', 'downstream'];
  useLayoutEffect(() => {
    const measure = () => {
      const c = box.current?.getBoundingClientRect();
      if (!c) return;
      const out: typeof lines = [];
      for (const f of ind.flows) {
        const a = refs.current[f.from]?.getBoundingClientRect(), b = refs.current[f.to]?.getBoundingClientRect();
        if (!a || !b) continue;
        let x1: number, y1: number, x2: number, y2: number;
        if (Math.abs(a.left - b.left) < 10) { x1 = a.left + a.width / 2 - c.left; y1 = a.bottom - c.top; x2 = b.left + b.width / 2 - c.left; y2 = b.top - c.top; }
        else { x1 = a.right - c.left; y1 = a.top + a.height / 2 - c.top; x2 = b.left - c.left; y2 = b.top + b.height / 2 - c.top; }
        const mx = (x1 + x2) / 2;
        const d = Math.abs(a.left - b.left) < 10 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        out.push({ d, x: mx, y: (y1 + y2) / 2, what: f.what, hot: !!selected && (f.from === selected || f.to === selected) });
      }
      setLines(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [ind, selected]);
  const now = Date.now();
  const card = (st: ChainStage) => {
    const members = ind.members.filter((m) => m.stage === st.id);
    const isMine = mineStages.includes(st.id);
    const live = activeSlots(slots, st.id, now);
    return (
      <button key={st.id} ref={(el) => { refs.current[st.id] = el; }} data-testid={`stage-${st.id}`} onClick={() => onPick(st.id)}
        className={`relative w-full rounded-2xl bg-cream-50 p-2.5 text-left text-[11px] shadow-soft ring-1 transition ${selected === st.id ? 'ring-[3px] ring-almond-500' : isMine ? 'ring-[3px] ring-[#FF8A3D]' : 'ring-cream-200'}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[12px] font-black text-cocoa-800">{st.name}</span>
          {isMine && <span className="rounded-full bg-[#FF8A3D] px-1.5 text-[10px] font-black text-white" data-testid={`me-in-${st.id}`}>⭐ 我</span>}
        </div>
        <div className="mt-0.5 text-stone-400">{st.roles.slice(0, 3).join(' · ')}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {members.slice(0, 4).map((m) => <span key={m.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${KIND_TONE[m.kind]}`}>{m.name.replace(/（.*?）/g, '')}</span>)}
          {members.length > 4 && <span className="text-[10px] text-stone-400">+{members.length - 4}</span>}
          {!members.some((m) => m.kind !== 'prospect') && <span className="rounded-full border border-dashed border-brick-400 px-1.5 text-[10px] font-bold text-brick-500">招募中</span>}
        </div>
        <div className="mt-1 text-[10px] text-stone-400">服务商展位 {live.length}/{SLOTS_PER_STAGE}</div>
      </button>
    );
  };
  return (
    <div className="mt-3 overflow-x-auto">
      <div ref={box} className="relative min-w-[680px]">
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#B08968" /></marker>
            <marker id="arrh" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#FF8A3D" /></marker></defs>
          {lines.map((l, i) => <path key={i} d={l.d} fill="none" stroke={l.hot ? '#FF8A3D' : '#C9AE92'} strokeWidth={l.hot ? 2.6 : 1.6} markerEnd={`url(#${l.hot ? 'arrh' : 'arr'})`} />)}
        </svg>
        {lines.map((l, i) => <span key={i} className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-1.5 text-[9px] font-bold ${l.hot ? 'bg-[#FF8A3D] text-white' : 'bg-cream-50 text-stone-600 ring-1 ring-cream-200'}`} style={{ left: l.x, top: l.y }}>{l.what}</span>)}
        <div className="grid grid-cols-3 gap-x-14">
          {cols.map((c) => (
            <div key={c} className="space-y-4">
              <div className="text-center text-[11px] font-black text-stone-400">{LAYER_LABEL[c]}</div>
              {ind.stages.filter((s) => s.layer === c).map(card)}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="text-center text-[11px] font-black text-stone-400">服务支撑（为整条链提供资金、工具、财税法务等）</div>
          <div className="mx-auto mt-1 max-w-md">{ind.stages.filter((s) => s.layer === 'service').map(card)}</div>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
      <span className="font-bold text-stone-400">图例：</span>
      {(Object.keys(MEMBER_LABEL) as ChainMember['kind'][]).map((k) => <span key={k} className={`rounded-full px-1.5 py-0.5 font-bold ${KIND_TONE[k]}`}>{MEMBER_LABEL[k]}</span>)}
      <span className="rounded-full bg-[#FF8A3D] px-1.5 py-0.5 font-bold text-white">⭐ 我</span>
      <span className="rounded-full border border-dashed border-brick-400 px-1.5 font-bold text-brick-500">招募中 = 平台内还没人</span>
    </div>
  );
}

function StageDetail({ ind, stage }: { ind: Industry; stage: ChainStage }) {
  const { placements, offers, needs } = useMyChain();
  const join = useOpp((s) => s.join);
  const leave = useOpp((s) => s.leave);
  const joins = useOpp((s) => s.joins);
  const amHere = placements.some((p) => p.industry === ind.id && p.stage === stage.id);
  const manual = joins.some((j) => j.industry === ind.id && j.stage === stage.id);
  const matches = amHere ? speedMatch(ind.id, stage.id, offers, needs) : [];
  const members = ind.members.filter((m) => m.stage === stage.id);
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2" data-testid="stage-detail">
      <div className="rounded-2xl bg-cream-50 p-3 ring-1 ring-cream-200">
        <div className="flex items-center justify-between">
          <div className="text-sm font-black text-cocoa-800">📒 {stage.name} · 黄页</div>
          <Pill tone="haze">{LAYER_LABEL[stage.layer]}</Pill>
        </div>
        <div className="mt-1 text-xs text-stone-600">{stage.desc}</div>
        <div className="mt-2 space-y-2">
          {members.map((m) => <MemberRow key={m.id} m={m} />)}
          {!members.length && <div className="text-xs text-stone-400">这个环节还没有成员。</div>}
        </div>
        <div className="mt-3">
          {amHere ? (
            <div className="flex items-center gap-2 text-xs"><span className="font-bold text-[#E0651F]">⭐ 你在这个环节</span>{manual && <button className="text-stone-400 underline" onClick={() => leave({ industry: ind.id, stage: stage.id })}>取消登记</button>}</div>
          ) : (
            <Btn size="sm" data-testid="join-stage" onClick={() => join({ industry: ind.id, stage: stage.id })}>⭐ 我也在这个环节（登记到黄页）</Btn>
          )}
        </div>
        <SlotBox stage={stage} />
      </div>
      <div className="rounded-2xl bg-cream-50 p-3 ring-1 ring-cream-200" data-testid="speed-match">
        <div className="text-sm font-black text-cocoa-800">⚡ 上下游速配</div>
        {!amHere && <div className="mt-1 text-xs text-stone-600">登记到这个环节后，系统会按产业链的流向为你找出上游供应、下游客户、同环节伙伴和服务商。</div>}
        {(['downstream', 'upstream', 'peer', 'service'] as const).map((rel) => {
          const list = matches.filter((x) => x.relation === rel);
          if (!list.length) return null;
          return (
            <div key={rel} className="mt-2">
              <div className="text-[11px] font-black text-stone-400">{RELATION_LABEL[rel]}</div>
              {list.map((x) => (
                <div key={x.member.id} className="mt-1 rounded-xl bg-cream-100 px-2.5 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2"><b>{x.member.name}</b><span className="shrink-0 font-black text-almond-600">{x.score}%</span></div>
                  <div className="text-stone-600">{x.reason}</div>
                </div>
              ))}
            </div>
          );
        })}
        {amHere && <div className="mt-2"><Disclaimer>匹配分只由链上流向与双方公开的“能提供 / 正在找”计算；服务商展位是推广位，不参与匹配分。</Disclaimer></div>}
      </div>
    </div>
  );
}

function MemberRow({ m }: { m: ChainMember }) {
  const goDistrict = useTown((s) => s.goDistrict);
  const setTab = useTown((s) => s.setTab);
  const openHello = useTown((s) => s.openHello);
  const saveLead = useTown((s) => s.saveLead);
  const profile = useTown((s) => s.profile);
  const e = m.entityId ? entityById(m.entityId) : undefined;
  const lot = e?.place.lotId ? lotById(e.place.lotId) : undefined;
  const visit = () => {
    if (!e) return;
    if (lot) { goDistrict(lot.district, lot.door.trigger); setTab('city'); }
    else { goDistrict(e.place.district); setTab('city'); }
  };
  return (
    <div className="rounded-xl bg-cream-100 px-2.5 py-2 text-xs" data-testid={`member-${m.id}`}>
      <div className="flex flex-wrap items-center gap-1.5"><b className="text-cocoa-800">{m.name}</b><span className={`rounded-full px-1.5 text-[10px] font-bold ${KIND_TONE[m.kind]}`}>{MEMBER_LABEL[m.kind]}</span>
        <span className="text-stone-400">{m.district ? `📍 ${e?.place.street ?? ''}` : m.city ? `📍 ${m.city}` : ''}</span></div>
      <div className="mt-0.5 text-stone-600">{m.summary}</div>
      {m.offers.length > 0 && <div className="mt-0.5"><span className="text-sage-700">能提供：</span>{m.offers.join('、')}</div>}
      {m.needs.length > 0 && <div><span className="text-brick-500">正在找：</span>{m.needs.join('、')}</div>}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {e && <button className="chip bg-almond-300 text-[10px]" onClick={visit}>🚶 去街区找 TA</button>}
        {e?.ownerId && profile && <button className="chip bg-sakura-300 text-[10px]" onClick={() => openHello(e.ownerId)}>💌 打招呼</button>}
        {e && <button className="chip bg-cream-50 text-[10px]" onClick={() => saveLead(e.id)}>⭐ 收藏线索</button>}
        {m.kind === 'prospect' && <span className="text-[10px] text-stone-400">未入驻，只展示公开信息，不能代为联系</span>}
      </div>
    </div>
  );
}

function SlotBox({ stage }: { stage: ChainStage }) {
  const slots = useOpp((s) => s.slots);
  const claim = useOpp((s) => s.claim);
  const myOpc = useTown((s) => s.myOpc);
  const profile = useTown((s) => s.profile);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(myOpc?.name ?? profile?.displayName ?? '');
  const [offer, setOffer] = useState('');
  const [resource, setResource] = useState<ResourceKind>('tools');
  const live = activeSlots(slots, stage.id, Date.now());
  return (
    <div className="mt-3 rounded-xl bg-sakura-200/50 p-2.5 text-xs" data-testid="slot-box">
      <div className="font-black text-cocoa-800">🏷️ 服务商展位 {live.length}/{SLOTS_PER_STAGE}</div>
      <div className="text-[10px] text-stone-500">企业服务商为这个环节提供资源支持（资金、物流、场地、流量、财税法务、培训、工具）。每个环节限 {SLOTS_PER_STAGE} 个、每次 {SLOT_DAYS} 天、先到先得，明确标注为推广，不影响匹配分。</div>
      {live.map((s, i) => (
        <div key={i} className="mt-1 flex items-center justify-between rounded-lg bg-cream-50 px-2 py-1">
          <span><b>{s.provider}</b> · {RESOURCE_LABEL[s.resource]} · {s.offer}</span>
          <span className="shrink-0 pl-2 text-[10px] text-stone-400">{s.mine ? '我的展位 · ' : ''}剩 {Math.ceil((s.until - Date.now()) / 86400000)} 天</span>
        </div>
      ))}
      {!open ? (
        <Btn size="sm" tone="sakura" className="mt-2" data-testid="slot-claim-open" onClick={() => setOpen(true)}>{live.length >= SLOTS_PER_STAGE ? '排队候补' : '⚡ 抢位提供资源'}</Btn>
      ) : (
        <form className="mt-2 grid gap-1.5" onSubmit={(e) => { e.preventDefault(); if (claim({ stage: stage.id, provider, offer, resource })) setOpen(false); }}>
          <input className="input" data-testid="slot-provider" placeholder="服务商名称" value={provider} onChange={(e) => setProvider(e.target.value)} />
          <select className="input" value={resource} onChange={(e) => setResource(e.target.value as ResourceKind)}>
            {(Object.keys(RESOURCE_LABEL) as ResourceKind[]).map((k) => <option key={k} value={k}>{RESOURCE_LABEL[k]}</option>)}
          </select>
          <input className="input" data-testid="slot-offer" placeholder="能提供什么支持（如：首月免仓租、30 天免费试用）" value={offer} onChange={(e) => setOffer(e.target.value)} />
          <div className="flex gap-2"><Btn size="sm" tone="sakura" type="submit" data-testid="slot-claim">确认抢位</Btn><Btn size="sm" tone="cream" type="button" onClick={() => setOpen(false)}>取消</Btn></div>
        </form>
      )}
    </div>
  );
}

function GapNote({ ind }: { ind: Industry }) {
  const g = gaps(ind);
  if (!g.length) return null;
  return (
    <div className="mt-3 rounded-2xl border-2 border-dashed border-brick-400/60 p-3 text-xs" data-testid="chain-gaps">
      <b className="text-brick-500">🧩 这条链上的缺口：</b>{g.map((s) => s.name).join('、')}。平台内还没有入驻者——如果你能做，点开环节「我也在这个环节」就能补位；商家也可以在机会广场发招标找人。
    </div>
  );
}
