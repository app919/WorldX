/**
 * 三邻邦服务中心（PPT P1 / P2）：
 * - 创业服务市场（认证服务商、套餐比价、预约咨询）
 * - 信用与保障（实名 / 企业认证、案例审核、投诉与申诉、信用分）
 * - 交易型活动（需求发布会 / 资源对接会 / 组队会 / 商业门诊 / 路演 / 闭门会）
 * - 会员与价格（四类付费方的测试价格，只登记意向）
 * - 运营后台（运营视角：人工审核、人工撮合、试运营 KPI 看板）
 * - 融资与资源（投资人 / 园区 / 专家，项目资料页与投资人匹配）
 * - 案例论坛（行业小组、经验帖、成交故事）
 */
import { useMemo, useState } from 'react';
import { CONTACTS, CONTACT_LABEL, DEAL_EVENTS, DEAL_EVENT_LABEL, FORUM_GROUPS, PAYER_LABEL, POST_CAT, PRICE_TIERS, SERVICE_CAT, SERVICE_PROVIDERS, type ContactKind, type PostCat, type ServiceCat } from '../data/center';
import { INDUSTRY_CHAINS } from '../data/chains';
import { COMPLAINT_LABEL, STAGE_LABEL, creditScore, kpis, matchInvestors, priceCompare, type ComplaintKind, type ProjectPage } from '../domain/center';
import { recommendProviders } from '../domain/deal';
import { speedMatch } from '../domain/chain';
import { demoOpps } from '../domain/opportunity';
import { COUNTERPARTIES, RESIDENTS, SHOPS } from '../data/seed';
import { useCenter } from '../store/useCenter';
import { useOpp } from '../store/useOpp';
import { useLots } from '../store/useLots';
import { useTown } from '../store/useTown';
import { useMyChain } from './Chain';
import { Btn, Disclaimer, Drawer, Pill } from './kit';

const SECTIONS = [
  ['services', '🧰 服务市场'], ['trust', '🛡️ 信用保障'], ['events', '🤝 交易活动'], ['pricing', '💳 会员与价格'],
  ['funding', '💰 融资资源'], ['forum', '📝 案例论坛'], ['ops', '📊 运营后台'],
] as const;

export function CenterPanel() {
  const setTab = useTown((s) => s.setTab);
  const section = useCenter((s) => s.section);
  const setSection = useCenter((s) => s.setSection);
  const ops = useCenter((s) => s.opsMode);
  return (
    <Drawer wide testId="center-panel" title="🏛️ 三邻邦服务中心" subtitle="创业服务 · 信用保障 · 交易活动 · 会员价格 · 融资资源 · 案例论坛" onClose={() => setTab('city')}>
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.filter(([k]) => k !== 'ops' || ops).map(([k, label]) => (
          <button key={k} data-testid={`center-${k}`} onClick={() => setSection(k)} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${section === k ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-100 text-stone-600'}`}>{label}</button>
        ))}
      </div>
      {!ops && <div className="mt-1 text-[10px] text-stone-400">运营后台在「我的」里打开「运营视角」后出现。</div>}
      <div className="mt-3">
        {section === 'services' && <Services />}
        {section === 'trust' && <Trust />}
        {section === 'events' && <Events />}
        {section === 'pricing' && <Pricing />}
        {section === 'funding' && <Funding />}
        {section === 'forum' && <Forum />}
        {section === 'ops' && ops && <Ops />}
      </div>
    </Drawer>
  );
}

/* ———————————————— P1-5 创业服务市场 ———————————————— */
function Services() {
  const [cat, setCat] = useState<ServiceCat>('legal');
  const [booking, setBooking] = useState<string | null>(null);
  const bookings = useCenter((s) => s.bookings);
  const rows = priceCompare(cat);
  return (
    <div className="space-y-3 text-xs" data-testid="services">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(SERVICE_CAT) as ServiceCat[]).map((c) => <button key={c} data-testid={`svc-cat-${c}`} onClick={() => setCat(c)} className={`rounded-full px-2 py-0.5 ${cat === c ? 'bg-cocoa-800 text-cream-50' : 'bg-cream-100'}`}>{SERVICE_CAT[c]}</button>)}
      </div>
      <div className="rounded-2xl bg-cream-100 p-2.5" data-testid="price-compare">
        <div className="font-black">⚖️ 套餐比价（{SERVICE_CAT[cat]}）</div>
        {rows.map((r) => (
          <div key={r.name} className="mt-1.5">
            <div className="font-bold">{r.name}</div>
            {r.offers.map(({ provider, pkg }) => (
              <div key={pkg.id} className="mt-0.5 flex items-center justify-between gap-2 rounded-lg bg-cream-50 px-2 py-1">
                <span>{provider.name}{provider.certified && <span className="ml-1 rounded bg-sage-400 px-1 text-[9px] font-black text-white">✔认证</span>} · ★{provider.rating} · {pkg.includes.join('、')}</span>
                <span className="shrink-0 font-black">¥{pkg.price}/{pkg.unit}{pkg.price === r.min && r.offers.length > 1 ? <span className="ml-1 rounded bg-almond-300 px-1 text-[9px]">最低</span> : null}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {SERVICE_PROVIDERS.filter((p) => p.cat === cat).map((p) => (
        <div key={p.id} className="rounded-2xl bg-cream-100 p-2.5" data-testid={`provider-${p.id}`}>
          <div className="flex items-center justify-between"><b className="text-cocoa-800">{p.name}</b>{p.certified ? <Pill tone="sage">✔ 平台认证</Pill> : <Pill tone="cream">未认证</Pill>}</div>
          <div className="text-stone-600">{p.summary} · ★{p.rating} · 已服务 {p.done} 次</div>
          {booking === p.id ? <BookForm providerId={p.id} onDone={() => setBooking(null)} /> : <Btn size="sm" className="mt-1.5" data-testid="book-open" onClick={() => setBooking(p.id)}>📅 预约咨询</Btn>}
        </div>
      ))}
      {bookings.length > 0 && (
        <div className="rounded-2xl bg-haze-200/60 p-2.5" data-testid="my-bookings">
          <div className="font-black">我的预约</div>
          {bookings.map((b) => <div key={b.id}>{SERVICE_PROVIDERS.find((x) => x.id === b.providerId)?.name} · {b.slot} · {b.topic} · <b>{{ pending: '待确认', confirmed: '已确认', done: '已完成' }[b.status]}</b></div>)}
        </div>
      )}
      <Disclaimer>认证服务商经过资质与案例审核；推广展位（产业链「服务商展位」）单独标注，不影响这里的比价排序。咨询费用由双方自行结算。</Disclaimer>
    </div>
  );
}

function BookForm({ providerId, onDone }: { providerId: string; onDone: () => void }) {
  const p = SERVICE_PROVIDERS.find((x) => x.id === providerId)!;
  const book = useCenter((s) => s.book);
  const [slot, setSlot] = useState('');
  const [topic, setTopic] = useState('');
  const [err, setErr] = useState<string[]>([]);
  return (
    <div className="mt-1.5 grid gap-1.5" data-testid="book-form">
      <div className="flex flex-wrap gap-1">{p.slots.map((s) => <button key={s} data-testid="book-slot" onClick={() => setSlot(s)} className={`rounded-full px-2 py-0.5 ${slot === s ? 'bg-almond-400 font-bold' : 'bg-cream-50'}`}>{s}</button>)}</div>
      <input className="input" data-testid="book-topic" placeholder="想咨询的问题" value={topic} onChange={(e) => setTopic(e.target.value)} />
      {err.length > 0 && <div className="text-brick-500">{err.join('；')}</div>}
      <div className="flex gap-2"><Btn size="sm" data-testid="book-submit" onClick={() => { const e = book({ providerId, slot, topic }); setErr(e); if (!e.length) onDone(); }}>确认预约</Btn><Btn size="sm" tone="cream" onClick={onDone}>取消</Btn></div>
    </div>
  );
}

/* ———————————————— P1-6 信用与保障 ———————————————— */
function Trust() {
  const certs = useCenter((s) => s.certs);
  const cases = useCenter((s) => s.cases);
  const complaints = useCenter((s) => s.complaints);
  const certifyPerson = useCenter((s) => s.certifyPerson);
  const certifyCompany = useCenter((s) => s.certifyCompany);
  const submitCase = useCenter((s) => s.submitCase);
  const complain = useCenter((s) => s.complain);
  const deals = useOpp((s) => s.deals);
  const ratings = Object.values(deals).filter((d) => d.ratingGot).map((d) => ({ stars: d.ratingGot!.stars, onTime: d.ratingGot!.onTime }));
  const cs = creditScore({ certs, approvedCases: cases.filter((c) => c.status === 'approved').length, ratings, openComplaintsAgainst: 0 });
  const [pn, setPn] = useState(''); const [pid, setPid] = useState(''); const [cn, setCn] = useState(''); const [cc, setCc] = useState('');
  const [ct, setCt] = useState(''); const [cl, setCl] = useState(''); const [cp, setCp] = useState('');
  const [kind, setKind] = useState<ComplaintKind>('no_delivery'); const [target, setTarget] = useState(''); const [detail, setDetail] = useState('');
  const [err, setErr] = useState<Record<string, string[]>>({});
  const counterparts = [...new Set(Object.values(deals).map((d) => d.counterpart))];
  return (
    <div className="space-y-3 text-xs" data-testid="trust">
      <div className="rounded-2xl bg-almond-300/50 p-3" data-testid="credit-score">
        <div className="text-sm font-black">我的信用分 <span className="text-2xl">{cs.score}</span><span className="text-stone-500"> / 100</span></div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-stone-600">{cs.parts.map((p) => <span key={p.label}>{p.label} {p.value >= 0 ? '+' : ''}{p.value}</span>)}</div>
        <div className="mt-1 text-[10px] text-stone-500">只来自认证、审核过的案例和双方确认完成的交易评价，不能购买或刷取。</div>
      </div>
      <section className="rounded-2xl bg-cream-100 p-2.5">
        <div className="font-black">🪪 实名认证 {certs.realName && <Pill tone="sage">✔ 已认证 · {certs.realName.name}</Pill>}</div>
        {!certs.realName && (
          <div className="mt-1 grid grid-cols-[1fr_7rem_auto] gap-1.5">
            <input className="input" data-testid="rn-name" placeholder="真实姓名" value={pn} onChange={(e) => setPn(e.target.value)} />
            <input className="input" data-testid="rn-id" placeholder="身份证后 4 位" maxLength={4} value={pid} onChange={(e) => setPid(e.target.value)} />
            <Btn size="sm" data-testid="rn-submit" onClick={() => setErr({ ...err, rn: certifyPerson(pn, pid) })}>认证</Btn>
          </div>
        )}
        {err.rn?.length ? <div className="text-brick-500">{err.rn.join('；')}</div> : null}
      </section>
      <section className="rounded-2xl bg-cream-100 p-2.5">
        <div className="font-black">🏢 企业认证 {certs.company && <Pill tone="sage">✔ 已认证 · {certs.company.name}</Pill>}</div>
        {!certs.company && (
          <div className="mt-1 grid gap-1.5">
            <input className="input" data-testid="co-name" placeholder="企业全称" value={cn} onChange={(e) => setCn(e.target.value)} />
            <div className="flex gap-1.5"><input className="input" data-testid="co-code" placeholder="统一社会信用代码（18 位）" maxLength={18} value={cc} onChange={(e) => setCc(e.target.value.toUpperCase())} /><Btn size="sm" data-testid="co-submit" onClick={() => setErr({ ...err, co: certifyCompany(cn, cc) })}>认证</Btn></div>
          </div>
        )}
        {err.co?.length ? <div className="text-brick-500" data-testid="co-errors">{err.co.join('；')}</div> : null}
      </section>
      <section className="rounded-2xl bg-cream-100 p-2.5">
        <div className="font-black">📁 案例审核</div>
        <div className="mt-1 grid gap-1.5">
          <input className="input" data-testid="case-title" placeholder="案例标题（如：咖啡品牌秋季新品短视频）" value={ct} onChange={(e) => setCt(e.target.value)} />
          <div className="flex gap-1.5"><input className="input" data-testid="case-client" placeholder="客户（可脱敏）" value={cl} onChange={(e) => setCl(e.target.value)} /><input className="input" data-testid="case-proof" placeholder="作品 / 交付链接" value={cp} onChange={(e) => setCp(e.target.value)} /></div>
          <Btn size="sm" data-testid="case-submit" onClick={() => setErr({ ...err, cs: submitCase({ title: ct, client: cl, proof: cp }) })}>提交审核</Btn>
        </div>
        {err.cs?.length ? <div className="text-brick-500">{err.cs.join('；')}</div> : null}
        {cases.map((c) => <div key={c.id} className="mt-1" data-testid="case-item">{c.title} · {c.client} · <b>{{ reviewing: '审核中', approved: '已审核 ✔', rejected: '未通过' }[c.status]}</b>{c.note ? `（${c.note}）` : ''}</div>)}
      </section>
      <section className="rounded-2xl bg-cream-100 p-2.5">
        <div className="font-black">⚖️ 投诉与申诉</div>
        <div className="mt-1 grid gap-1.5">
          <div className="flex gap-1.5">
            <select className="input" data-testid="cp-kind" value={kind} onChange={(e) => setKind(e.target.value as ComplaintKind)}>{(Object.keys(COMPLAINT_LABEL) as ComplaintKind[]).map((k) => <option key={k} value={k}>{COMPLAINT_LABEL[k]}</option>)}</select>
            <input className="input" data-testid="cp-target" list="cp-targets" placeholder="对方" value={target} onChange={(e) => setTarget(e.target.value)} />
            <datalist id="cp-targets">{counterparts.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <textarea className="input" data-testid="cp-detail" rows={2} placeholder="经过（时间、约定、实际情况），平台会联系双方核实" value={detail} onChange={(e) => setDetail(e.target.value)} />
          <Btn size="sm" data-testid="cp-submit" onClick={() => setErr({ ...err, cp: complain({ kind, target, detail }) })}>提交</Btn>
        </div>
        {err.cp?.length ? <div className="text-brick-500">{err.cp.join('；')}</div> : null}
        {complaints.map((c) => <div key={c.id} className="mt-1" data-testid="complaint-item">{COMPLAINT_LABEL[c.kind]} · {c.target} · <b>{{ open: '已提交', processing: '处理中', resolved: '已处理' }[c.status]}</b>{c.result ? `：${c.result}` : ''}</div>)}
      </section>
      <Disclaimer>交易边界：平台提供撮合与信息服务；合同由交易双方签署，资金与税务由双方依法处理，平台不代收款、不担保交易（演示）。</Disclaimer>
    </div>
  );
}

/* ———————————————— P1-7 交易型活动 ———————————————— */
function Events() {
  const signups = useCenter((s) => s.signups);
  const signup = useCenter((s) => s.signup);
  const setSection = useCenter((s) => s.setSection);
  const setTab = useTown((s) => s.setTab);
  const setOppTab = useOpp((s) => s.setOppTab);
  const { placements, offers, needs } = useMyChain();
  const opps = demoOpps(Date.now());
  const prematch = useMemo(() => {
    const p = placements[0];
    if (p) return speedMatch(p.industry, p.stage, offers, needs).slice(0, 3).map((x) => ({ name: x.member.name, why: x.reason }));
    return recommendProviders({ industry: 'ecommerce', stage: 'ec_content', tags: ['video'] }).map((x) => ({ name: x.member.name, why: x.reason }));
  }, [placements, offers, needs]);
  return (
    <div className="space-y-2 text-xs" data-testid="deal-events">
      <div className="text-stone-600">线上持续发现需求，线下建立信任、缩短沟通距离、促成合作——不做无主题的大型自由交流。</div>
      {DEAL_EVENTS.map((e) => (
        <div key={e.id} className="rounded-2xl bg-cream-100 p-2.5" data-testid={`event-${e.kind}`}>
          <div className="flex items-start justify-between gap-2"><b className="text-cocoa-800">{e.title}</b><Pill tone="haze">{DEAL_EVENT_LABEL[e.kind]}</Pill></div>
          <div className="text-stone-600">{e.date} · {e.venue} · 适合：{e.who} · 已报名 {e.signed + (signups.includes(e.id) ? 1 : 0)}/{e.capacity}</div>
          <div className="mt-0.5 text-stone-500">流程：{e.flow.join(' → ')}</div>
          {e.linkedOpps && <div className="mt-1">现场需求：{e.linkedOpps.map((id) => <button key={id} className="mr-1 underline" onClick={() => { setOppTab('hall', id); setTab('opps'); }}>{opps.find((o) => o.id === id)?.title}</button>)}</div>}
          {e.kind === 'matchmaking' && <div className="mt-1 rounded-lg bg-cream-50 p-1.5" data-testid="prematch"><b>会前预配对（按你的产业链位置）：</b>{prematch.map((m) => <div key={m.name}>· {m.name}：{m.why}</div>)}</div>}
          <div className="mt-1.5 flex gap-1.5">
            {signups.includes(e.id) ? <Pill tone="sage">已报名 ✓</Pill> : <Btn size="sm" data-testid="event-signup" onClick={() => signup(e.id)}>报名</Btn>}
            {e.kind === 'roadshow' && <Btn size="sm" tone="cream" onClick={() => setSection('funding')}>准备项目资料页</Btn>}
            {e.kind === 'team_up' && <Btn size="sm" tone="cream" onClick={() => { setOppTab('hall', 'op_t4'); setTab('opps'); }}>去组队投标</Btn>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ———————————————— P1-8 会员与价格（价格测试） ———————————————— */
function Pricing() {
  const intents = useCenter((s) => s.intents);
  const intent = useCenter((s) => s.intent);
  return (
    <div className="space-y-2 text-xs" data-testid="pricing">
      <Disclaimer>原则：先证明能带来有效商机和成交，再收费；不以“付费入群”作为收入来源。以下为首轮测试价格区间，现阶段只登记付费意向，不收费。</Disclaimer>
      {(Object.keys(PAYER_LABEL) as (keyof typeof PAYER_LABEL)[]).map((payer) => (
        <div key={payer} className="rounded-2xl bg-cream-100 p-2.5">
          <div className="font-black">{PAYER_LABEL[payer]}</div>
          {PRICE_TIERS.filter((t) => t.payer === payer).map((t) => (
            <div key={t.id} className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-cream-50 px-2 py-1.5" data-testid={`tier-${t.id}`}>
              <span><b>{t.name}</b> · {t.price}<div className="text-stone-500">{t.perks.join(' · ')}</div></span>
              {intents.includes(t.id) ? <Pill tone="sage">已登记意向</Pill> : <Btn size="sm" data-testid="tier-intent" onClick={() => intent(t.id)}>我感兴趣</Btn>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ———————————————— P1-9 运营后台：审核 / 人工撮合 / KPI 看板 ———————————————— */
function Ops() {
  const myOpps = useOpp((s) => s.myOpps);
  const bids = useOpp((s) => s.bids);
  const deals = useOpp((s) => s.deals);
  const invite = useOpp((s) => s.invite);
  const invited = useOpp((s) => s.invited);
  const review = useOpp((s) => s.review);
  const intros = useTown((s) => s.intros);
  const profile = useTown((s) => s.profile);
  const myOpc = useTown((s) => s.myOpc);
  const bookings = useCenter((s) => s.bookings);
  const intents = useCenter((s) => s.intents);
  const sponsors = useLots((s) => s.sponsors);
  const queue = myOpps.filter((o) => o.status === 'reviewing');
  const matching = myOpps.filter((o) => o.status === 'matching' && o.kind === 'tender');
  const demo = demoOpps(Date.now());
  const all = [...myOpps, ...demo];
  const dealList = Object.values(deals);
  const won = dealList.filter((d) => ['contracted', 'delivering', 'done'].includes(d.status));
  const k = kpis({
    users: RESIDENTS.length + COUNTERPARTIES.length + 1,
    profiles: SHOPS.length + (myOpc ? 1 : 0) + (profile?.confirmed ? 1 : 0),
    demands: all.filter((o) => o.kind === 'tender').length,
    connections: intros.filter((i) => i.status !== 'sent').length + dealList.length + bids.filter((b) => b.mine).length,
    paid: won.length + bookings.filter((b) => b.status !== 'pending').length + sponsors.filter((s) => s.status === 'live').length,
    demandsWithResponse: all.filter((o) => o.kind === 'tender' && (o.isDemo || bids.some((b) => b.oppId === o.id))).length,
    connectionsEffective: intros.filter((i) => ['accepted', 'contact_exchanged', 'meeting_booked', 'collab_proposed', 'collab_confirmed'].includes(i.status)).length + won.length,
    deals: won.length,
    dealDays: [6, 9, 12, ...won.map(() => 1)],
    repeats: myOpps.filter((o) => o.title.startsWith('【复购】')).length,
    doneDeals: dealList.filter((d) => d.status === 'done').length,
    dealAmounts: won.map((d) => d.contract.amount),
  });
  return (
    <div className="space-y-3 text-xs" data-testid="ops">
      <section className="rounded-2xl bg-cream-100 p-2.5" data-testid="ops-queue">
        <div className="font-black">🧾 人工审核队列（{queue.length}）</div>
        {!queue.length && <div className="text-stone-400">暂无待审核需求。运营视角下新发布的需求会先进入这里。</div>}
        {queue.map((o) => (
          <div key={o.id} className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-cream-50 px-2 py-1">
            <span><b>{o.title}</b> · {o.poster} · {o.area} · {o.budget ? `¥${o.budget.min}–${o.budget.max}` : o.pay ?? o.commission}</span>
            <span className="flex shrink-0 gap-1"><Btn size="sm" tone="sage" data-testid="ops-approve" onClick={() => review(o.id, true)}>通过</Btn><Btn size="sm" tone="cream" data-testid="ops-reject" onClick={() => review(o.id, false, '预算或需求描述不清')}>驳回</Btn></span>
          </div>
        ))}
      </section>
      <section className="rounded-2xl bg-cream-100 p-2.5" data-testid="ops-match">
        <div className="font-black">🤝 人工撮合（{matching.length} 条匹配中）</div>
        {!matching.length && <div className="text-stone-400">暂无匹配中的招标需求。</div>}
        {matching.map((o) => (
          <div key={o.id} className="mt-1 rounded-lg bg-cream-50 px-2 py-1">
            <b>{o.title}</b>
            {recommendProviders(o).map((r) => (
              <div key={r.member.id} className="mt-0.5 flex items-center justify-between gap-2">
                <span>{r.member.name} · {r.reason}</span>
                {(invited[o.id] ?? []).includes(r.member.id) ? <Pill tone="sage">已推荐</Pill> : <Btn size="sm" data-testid="ops-recommend" onClick={() => invite(o.id, r.member.id)}>人工推荐</Btn>}
              </div>
            ))}
          </div>
        ))}
      </section>
      <section className="rounded-2xl bg-cream-50 p-2.5 ring-1 ring-cream-200" data-testid="kpi-board">
        <div className="font-black">📊 试运营 KPI（3 个月目标）</div>
        <div className="mt-1 text-[10px] text-stone-500">演示数据 + 你在本机的操作；正式版接入后台数据。</div>
        <div className="mt-2 grid gap-2">
          {k.targets.map((t) => (
            <div key={t.key} data-testid={`kpi-${t.key}`}>
              <div className="flex justify-between"><span className="text-stone-600">{t.label}</span><span className="font-black tabular-nums text-cocoa-800">{t.value} / {t.target}</span></div>
              <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-almond-500" style={{ width: `${Math.min(100, (t.value / t.target) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {k.board.map((b) => (
            <div key={b.label} className="rounded-xl bg-cream-100 p-2" title={b.hint}>
              <div className="text-[10px] text-stone-500">{b.label}</div>
              <div className="text-base font-black tabular-nums text-cocoa-800">{b.value}</div>
              <div className="text-[9px] text-stone-400">{b.hint}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-stone-500">付费意向登记：{intents.length} 项（用于验证收费路径，不计入付费交易）</div>
      </section>
    </div>
  );
}

/* ———————————————— P2-10 融资与资源 ———————————————— */
function Funding() {
  const [kind, setKind] = useState<ContactKind | 'all'>('all');
  const project = useCenter((s) => s.project);
  const save = useCenter((s) => s.saveProject);
  const reqs = useCenter((s) => s.investorReqs);
  const request = useCenter((s) => s.requestInvestor);
  const signups = useCenter((s) => s.signups);
  const signup = useCenter((s) => s.signup);
  const myOpc = useTown((s) => s.myOpc);
  const [p, setP] = useState<ProjectPage>(project ?? { name: myOpc?.name ?? '', industry: 'ecommerce', stage: 'mvp', traction: '', ask: 0, use: '', deck: '' });
  const [err, setErr] = useState<string[]>([]);
  const matches = project ? matchInvestors(project) : [];
  return (
    <div className="space-y-3 text-xs" data-testid="funding">
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'investor', 'park', 'expert'] as const).map((k) => <button key={k} data-testid={`contact-${k}`} onClick={() => setKind(k)} className={`rounded-full px-2 py-0.5 ${kind === k ? 'bg-cocoa-800 text-cream-50' : 'bg-cream-100'}`}>{k === 'all' ? '全部资源' : CONTACT_LABEL[k]}</button>)}
      </div>
      {CONTACTS.filter((c) => kind === 'all' || c.kind === kind).map((c) => (
        <div key={c.id} className="rounded-2xl bg-cream-100 p-2.5" data-testid="contact-card">
          <div className="flex items-center justify-between"><b>{c.name} · {c.org}</b><Pill tone="haze">{CONTACT_LABEL[c.kind]}</Pill></div>
          <div className="text-stone-600">{c.summary}{c.ticket ? ` · 单笔 ${c.ticket}` : ''}</div>
          <div>能提供：{c.offers.join('、')} · 关注：{c.industries.map((i) => INDUSTRY_CHAINS.find((x) => x.id === i)?.name.split(' · ')[0]).join('、')}</div>
        </div>
      ))}
      <section className="rounded-2xl bg-almond-300/40 p-2.5" data-testid="project-page">
        <div className="font-black">📄 我的项目资料页（融资）</div>
        <div className="mt-1 grid gap-1.5">
          <input className="input" data-testid="pj-name" placeholder="项目名称" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          <div className="flex gap-1.5">
            <select className="input" value={p.industry} onChange={(e) => setP({ ...p, industry: e.target.value })}>{INDUSTRY_CHAINS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <select className="input" value={p.stage} onChange={(e) => setP({ ...p, stage: e.target.value as ProjectPage['stage'] })}>{(Object.keys(STAGE_LABEL) as ProjectPage['stage'][]).map((k) => <option key={k} value={k}>{STAGE_LABEL[k]}</option>)}</select>
          </div>
          <input className="input" data-testid="pj-traction" placeholder="客户验证 / 数据（如：3 个月 120 位付费客户，复购 35%）" value={p.traction} onChange={(e) => setP({ ...p, traction: e.target.value })} />
          <div className="flex gap-1.5"><input className="input" data-testid="pj-ask" placeholder="融资金额（万元）" value={p.ask || ''} onChange={(e) => setP({ ...p, ask: Number(e.target.value) || 0 })} /><input className="input" data-testid="pj-use" placeholder="资金用途" value={p.use} onChange={(e) => setP({ ...p, use: e.target.value })} /></div>
          {err.length > 0 && <div className="text-brick-500">{err.join('；')}</div>}
          <Btn size="sm" data-testid="pj-save" onClick={() => setErr(save(p))}>保存并匹配投资人</Btn>
        </div>
        {matches.length > 0 && (
          <div className="mt-2" data-testid="investor-matches">
            <div className="font-black">🎯 匹配的投资人</div>
            {matches.map(({ c, score, reason }) => {
              const r = reqs.find((x) => x.contactId === c.id);
              return (
                <div key={c.id} className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-cream-50 px-2 py-1">
                  <span><b>{c.name}</b> · 匹配 {score}% · {reason}</span>
                  {r ? <Pill tone={r.status === 'accepted' ? 'sage' : 'almond'}>{r.status === 'accepted' ? '已同意沟通 ✓' : '已发送'}</Pill> : <Btn size="sm" data-testid="investor-request" onClick={() => request(c.id)}>预约沟通</Btn>}
                </div>
              );
            })}
            {signups.includes('de_roadshow') ? <Pill tone="sage">已报名路演 ✓</Pill> : <Btn size="sm" tone="haze" className="mt-1.5" data-testid="roadshow-signup" onClick={() => signup('de_roadshow')}>报名下一场项目路演</Btn>}
          </div>
        )}
      </section>
    </div>
  );
}

/* ———————————————— P2-11 内容与案例论坛 ———————————————— */
function Forum() {
  const groups = useCenter((s) => s.groups);
  const join = useCenter((s) => s.joinGroup);
  const liked = useCenter((s) => s.liked);
  const like = useCenter((s) => s.like);
  const post = useCenter((s) => s.post);
  useCenter((s) => s.posts);
  const deals = useOpp((s) => s.deals);
  const all = useOpp.getState().allOpps();
  const doneDeals = Object.values(deals).filter((d) => d.status === 'done');
  const [group, setGroup] = useState('all');
  const [cat, setCat] = useState<PostCat | 'all'>('all');
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pcat, setPcat] = useState<PostCat>('review');
  const [pgroup, setPgroup] = useState('g_opc');
  const [err, setErr] = useState<string[]>([]);
  const list = useCenter.getState().allPosts().filter((p) => (group === 'all' || p.group === group) && (cat === 'all' || p.cat === cat)).sort((a, b) => b.at - a.at);
  const story = (oppId: string) => {
    const d = deals[oppId], o = all.find((x) => x.id === oppId);
    if (!d || !o) return;
    setWriting(true); setPcat('deal_story');
    setPgroup(FORUM_GROUPS.find((g) => g.industry === o.industry)?.id ?? 'g_opc');
    setTitle(`成交故事：${o.title}`);
    setBody(`和「${d.counterpart}」的合作：金额 ¥${d.contract.amount}，${d.contract.milestones.length} 个付款节点全部按时验收。经验：……`);
  };
  return (
    <div className="space-y-2 text-xs" data-testid="forum">
      <div className="flex flex-wrap gap-1.5">
        {FORUM_GROUPS.map((g) => (
          <span key={g.id} className="flex items-center gap-1 rounded-full bg-cream-100 px-2 py-0.5">
            <button onClick={() => setGroup(group === g.id ? 'all' : g.id)} className={group === g.id ? 'font-black' : ''}>{g.name}</button>
            {groups.includes(g.id) ? <span className="text-sage-700">已加入</span> : <button data-testid="group-join" className="text-almond-600 underline" onClick={() => join(g.id)}>加入</button>}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setCat('all')} className={`rounded-full px-2 py-0.5 ${cat === 'all' ? 'bg-cocoa-800 text-cream-50' : 'bg-cream-100'}`}>全部</button>
        {(Object.keys(POST_CAT) as PostCat[]).map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full px-2 py-0.5 ${cat === c ? 'bg-cocoa-800 text-cream-50' : 'bg-cream-100'}`}>{POST_CAT[c]}</button>)}
        <Btn size="sm" tone="sage" className="ml-auto" data-testid="post-open" onClick={() => setWriting(!writing)}>✍️ 发帖</Btn>
      </div>
      {doneDeals.length > 0 && <div className="rounded-xl bg-almond-300/50 p-2">你有 {doneDeals.length} 笔已完成的合作，可以写成「成交故事」：{doneDeals.map((d) => <button key={d.oppId} data-testid="story-from-deal" className="ml-1 font-bold underline" onClick={() => story(d.oppId)}>{all.find((o) => o.id === d.oppId)?.title}</button>)}</div>}
      {writing && (
        <div className="grid gap-1.5 rounded-2xl bg-cream-100 p-2.5" data-testid="post-form">
          <div className="flex gap-1.5">
            <select className="input" value={pcat} onChange={(e) => setPcat(e.target.value as PostCat)}>{(Object.keys(POST_CAT) as PostCat[]).map((c) => <option key={c} value={c}>{POST_CAT[c]}</option>)}</select>
            <select className="input" value={pgroup} onChange={(e) => setPgroup(e.target.value)}>{FORUM_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          </div>
          <input className="input" data-testid="fp-title" placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" data-testid="fp-body" rows={3} placeholder="分享真实经验：做了什么、结果如何、踩了什么坑" value={body} onChange={(e) => setBody(e.target.value)} />
          {err.length > 0 && <div className="text-brick-500" data-testid="fp-errors">{err.join('；')}</div>}
          <Btn size="sm" data-testid="fp-submit" onClick={() => { const e = post({ title, body, cat: pcat, group: pgroup }); setErr(e); if (!e.length) { setWriting(false); setTitle(''); setBody(''); } }}>发布</Btn>
        </div>
      )}
      {list.map((p) => (
        <div key={p.id} className="rounded-2xl bg-cream-100 p-2.5" data-testid="forum-post">
          <div className="flex items-start justify-between gap-2"><b className="text-cocoa-800">{p.title}</b><Pill tone={p.cat === 'deal_story' ? 'almond' : 'haze'}>{POST_CAT[p.cat]}</Pill></div>
          <div className="text-stone-600">{p.body}</div>
          <div className="mt-1 flex items-center gap-2 text-stone-400">
            <span>{p.author} · {FORUM_GROUPS.find((g) => g.id === p.group)?.name}</span>
            <button className={liked.includes(p.id) ? 'font-bold text-brick-500' : ''} onClick={() => like(p.id)}>♥ {p.likes + (liked.includes(p.id) ? 1 : 0)}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
