/**
 * 需求大厅（机会广场 / 公告栏）：围绕一条交易链组织 ——
 *   发布 → 审核 → 匹配 → 对接 → 成交 → 履约 → 评价
 * - 大厅：所有需求单（招标 / 推广 / 用工），按行业、地区、预算、合作方式、截止筛选，按与我的匹配度排序；
 * - 我发布的：平台推荐供给方、邀请投标、比选表、选标、成交确认单、按节点验收、评价与复购；
 * - 我承接的：投标 / 联合投标、中标后确认成交单、按节点交付、评价；以及推广接单与兼职投递。
 */
import { useEffect, useState } from 'react';
import { INDUSTRY_CHAINS, stageById } from '../data/chains';
import { MODE_LABEL, OPP_LABEL, REQUESTER_LABEL, RULES, STATUS_LABEL, oppScore, type DealStatus, type Opp, type OppKind, type WorkMode } from '../domain/opportunity';
import { DEAL_STEPS, RATING_TAGS, compare, paidSoFar, recommendProviders, stepOf, suggestForRole, type Contract } from '../domain/deal';
import { useOpp, type Deal } from '../store/useOpp';
import { useTown } from '../store/useTown';
import { useMyChain } from './Chain';
import { Btn, Disclaimer, Drawer, Pill } from './kit';

const KIND_ICON: Record<OppKind, string> = { tender: '📣', promo: '📢', gig: '🧰' };
const STATUS_TONE: Record<DealStatus, 'cream' | 'almond' | 'sage' | 'haze' | 'sakura'> = {
  reviewing: 'cream', matching: 'almond', connecting: 'haze', contracted: 'sage', delivering: 'sage', done: 'sakura', closed: 'cream',
};

export function OppPanel() {
  const setTab = useTown((s) => s.setTab);
  const tab = useOpp((s) => s.oppTab);
  const setOppTab = useOpp((s) => s.setOppTab);
  const myOpps = useOpp((s) => s.myOpps);
  const bids = useOpp((s) => s.bids);
  const [posting, setPosting] = useState(false);
  const taken = bids.filter((b) => b.mine).length + useOpp.getState().promos.length + useOpp.getState().apps.length;
  return (
    <Drawer wide testId="opp-panel" title="📋 需求大厅 · 机会广场" subtitle="发布 → 审核 → 匹配 → 对接 → 成交 → 履约 → 评价" onClose={() => setTab('city')}>
      <div className="flex flex-wrap gap-1.5">
        {([['hall', '🏛️ 需求大厅'], ['posted', `📣 我发布的 ${myOpps.length || ''}`], ['taken', `🧾 我承接的 ${taken || ''}`]] as const).map(([k, label]) => (
          <button key={k} data-testid={`opp-tab-${k}`} onClick={() => setOppTab(k)}
            className={`rounded-full px-3 py-1 text-xs font-black ${tab === k ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-100 text-stone-600'}`}>{label}</button>
        ))}
        <Btn size="sm" tone="sage" data-testid="opp-post-open" className="ml-auto" onClick={() => setPosting(!posting)}>＋ 发布需求</Btn>
      </div>
      {posting && <PostForm onDone={() => { setPosting(false); setOppTab('posted'); }} />}
      {tab === 'hall' && <Hall />}
      {tab === 'posted' && <Posted />}
      {tab === 'taken' && <Taken />}
    </Drawer>
  );
}

let alerted = false;
/** —— 需求大厅：筛选 + 列表 —— */
function Hall() {
  const profile = useTown((s) => s.profile);
  const { placements } = useMyChain();
  useOpp((s) => s.myOpps);
  useOpp((s) => s.deals);
  const [kind, setKind] = useState<OppKind | 'all'>('all');
  const [industry, setIndustry] = useState('all');
  const [area, setArea] = useState('all');
  const [mode, setMode] = useState<WorkMode | 'all'>('all');
  const [budget, setBudget] = useState('all');
  const [fitOnly, setFitOnly] = useState(false);
  const [sort, setSort] = useState<'match' | 'new' | 'budget'>('match');
  const myTags = (profile?.capabilities ?? []).map((c) => c.tag);
  const myStages = placements.map((p) => p.stage);
  const st = useOpp.getState();
  const list = st.allOpps()
    .filter((o) => st.statusOf(o) === 'matching' || o.mine)
    .filter((o) => (kind === 'all' || o.kind === kind) && (industry === 'all' || o.industry === industry) && (area === 'all' || o.area.includes(area)) && (mode === 'all' || o.mode === mode))
    .filter((o) => budget === 'all' || (o.budget && (budget === 'lt5' ? o.budget.max <= 5000 : budget === '5to10' ? o.budget.max > 5000 && o.budget.min <= 10000 : o.budget.max > 10000)))
    .map((o) => ({ o, score: oppScore(o, myTags, myStages) }))
    .filter((x) => !fitOnly || x.score > 0)
    .sort((a, b) => (sort === 'match' ? b.score - a.score : sort === 'new' ? b.o.postedAt - a.o.postedAt : (b.o.budget?.max ?? 0) - (a.o.budget?.max ?? 0)));
  const fitCount = list.filter((x) => x.score > 0 && !x.o.mine).length;
  useEffect(() => {
    if (fitCount && !alerted) { alerted = true; useTown.getState().toast(`有 ${fitCount} 条需求与你的能力 / 产业链环节匹配，已排在前面`, 'info'); }
  }, [fitCount]);
  const sel = 'input !w-auto !py-1 text-[11px]';
  return (
    <div data-testid="opp-hall">
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {(['all', 'tender', 'promo', 'gig'] as const).map((k) => (
          <button key={k} data-testid={`opp-kind-${k}`} onClick={() => setKind(k)} className={`rounded-full px-2 py-0.5 ${kind === k ? 'bg-cocoa-800 text-cream-50' : 'bg-cream-100'}`}>{k === 'all' ? '全部' : `${KIND_ICON[k]} ${OPP_LABEL[k]}`}</button>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <select className={sel} value={industry} onChange={(e) => setIndustry(e.target.value)}><option value="all">全部行业</option>{INDUSTRY_CHAINS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select className={sel} value={area} onChange={(e) => setArea(e.target.value)}><option value="all">全部地区</option>{['徐汇', '浦东', '虹口', '线上'].map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select className={sel} value={mode} onChange={(e) => setMode(e.target.value as never)}><option value="all">合作方式</option>{(Object.keys(MODE_LABEL) as WorkMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</select>
        <select className={sel} value={budget} onChange={(e) => setBudget(e.target.value)}><option value="all">预算不限</option><option value="lt5">≤ ¥5000</option><option value="5to10">¥5000–10000</option><option value="gt10">&gt; ¥10000</option></select>
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as never)}><option value="match">按匹配度</option><option value="new">最新发布</option><option value="budget">预算最高</option></select>
        <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" data-testid="fit-only" checked={fitOnly} onChange={(e) => setFitOnly(e.target.checked)} />只看适合我</label>
      </div>
      <div className="mt-2"><Disclaimer>{(kind === 'all' ? RULES.tender : RULES[kind]).join('；')}</Disclaimer></div>
      <div className="mt-2 space-y-2">
        {list.map(({ o, score }) => <OppCard key={o.id} o={o} score={score} />)}
        {!list.length && <div className="text-xs text-stone-400">没有符合条件的需求，换个筛选试试。</div>}
      </div>
    </div>
  );
}

/** 一条需求单的标准字段：需求方身份｜预算｜交付时间｜地区｜合作方式｜截止｜状态 */
function Fields({ o }: { o: Opp }) {
  const status = useOpp((s) => s.deals[o.id]?.status) ?? o.status;
  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-stone-600" data-testid="opp-fields">
      <span>👤 {REQUESTER_LABEL[o.requester]}{o.verified ? ' ✔已认证' : ''}</span>
      <span>💰 {o.budget ? `¥${o.budget.min}–${o.budget.max}` : o.pay ?? o.commission}</span>
      {o.deliveryDays && <span>⏱ 交付 {o.deliveryDays} 天</span>}
      <span>📍 {o.area}</span>
      <span>🤝 {MODE_LABEL[o.mode]}</span>
      <span>⏳ {o.deadlineDays} 天后截止</span>
      <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
    </div>
  );
}

function OppCard({ o, score }: { o: Opp; score: number }) {
  const [open, setOpen] = useState(false);
  const st = o.stage ? stageById(o.stage) : undefined;
  const ind = INDUSTRY_CHAINS.find((x) => x.id === o.industry);
  const setIndustry = useOpp((s) => s.setIndustry);
  const setOppTab = useOpp((s) => s.setOppTab);
  const setTab = useTown((s) => s.setTab);
  return (
    <div className="rounded-2xl bg-cream-100 p-3 text-xs" data-testid={`opp-${o.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-black text-cocoa-800">{KIND_ICON[o.kind]} {o.title}</div>
        {score > 0 && <span className="shrink-0"><Pill tone="sage">与你匹配 {score}%</Pill></span>}
      </div>
      <div className="text-stone-500">{o.poster}{o.mine ? '（我发布的）' : ''}</div>
      <Fields o={o} />
      <div className="mt-1 flex flex-wrap gap-1">
        {ind && <button className="chip bg-haze-300 !py-0 text-[10px]" onClick={() => { setIndustry(ind.id, o.stage); setTab('chain'); }}>🔗 {ind.name.split(' · ')[0]}{st ? ` · ${st.name}` : ''}</button>}
        {o.roles && <span className="chip bg-almond-300 !py-0 text-[10px]">可联合交付：{o.roles.map((r) => r.name).join(' / ')}</span>}
        {o.quota && <span className="chip bg-cream-50 !py-0 text-[10px]">名额 {o.quota}</span>}
      </div>
      {open && (
        <div className="mt-2 space-y-1">
          {o.requirements.length > 0 && <div><b>要求：</b>{o.requirements.join('；')}</div>}
          {o.deliverables.length > 0 && <div><b>交付：</b>{o.deliverables.join('；')}</div>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="text-stone-400 underline" onClick={() => setOpen(!open)}>{open ? '收起' : '详情'}</button>
        {!o.mine && o.kind === 'tender' && <BidAction o={o} />}
        {!o.mine && o.kind === 'promo' && <PromoAction o={o} />}
        {!o.mine && o.kind === 'gig' && <GigAction o={o} />}
        {o.mine && <button className="font-bold text-almond-600 underline" onClick={() => setOppTab('posted', o.id)}>去「我发布的」跟进 →</button>}
      </div>
    </div>
  );
}

function BidAction({ o }: { o: Opp }) {
  const bid = useOpp((s) => s.bids.find((b) => b.oppId === o.id && b.mine));
  const team = useOpp((s) => s.teams[o.id]);
  const submit = useOpp((s) => s.bid);
  const startTeam = useOpp((s) => s.startTeam);
  const setOppTab = useOpp((s) => s.setOppTab);
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState(o.budget ? String(o.budget.min) : '');
  const [days, setDays] = useState(String(o.deliveryDays ?? 10));
  const [plan, setPlan] = useState('');
  const [err, setErr] = useState<string[]>([]);
  if (bid) return <span className="flex items-center gap-2"><Pill tone={bid.status === 'won' ? 'sage' : 'almond'}>已投标 · {BID_LABEL[bid.status]}</Pill>{bid.status === 'won' && <button className="font-bold text-almond-600 underline" onClick={() => setOppTab('taken', o.id)}>去确认成交单 →</button>}</span>;
  if (team) return <TeamBuilder o={o} />;
  if (!open) return (
    <span className="flex gap-1.5">
      <Btn size="sm" data-testid="bid-open" onClick={() => setOpen(true)}>投标</Btn>
      {o.roles && <Btn size="sm" tone="haze" data-testid="team-start" onClick={() => startTeam(o.id)}>👥 组队联合投标</Btn>}
    </span>
  );
  return (
    <form className="mt-1 grid w-full gap-1.5" onSubmit={(e) => { e.preventDefault(); setErr(submit(o.id, { quote: Number(quote), days: Number(days), plan })); }}>
      <div className="flex gap-1.5"><input className="input" data-testid="bid-quote" placeholder="报价（元）" value={quote} onChange={(e) => setQuote(e.target.value)} /><input className="input" placeholder="工期（天）" value={days} onChange={(e) => setDays(e.target.value)} /></div>
      <textarea className="input" data-testid="bid-plan" rows={2} placeholder="方案：怎么做、交付什么、有什么案例" value={plan} onChange={(e) => setPlan(e.target.value)} />
      {err.length > 0 && <div className="text-brick-500">{err.join('；')}</div>}
      <div className="flex gap-2"><Btn size="sm" type="submit" data-testid="bid-submit">提交投标</Btn><Btn size="sm" tone="cream" type="button" onClick={() => setOpen(false)}>取消</Btn></div>
    </form>
  );
}
const BID_LABEL = { submitted: '已提交', shortlisted: '进入比选', won: '中标 🎉', lost: '未中标' } as const;

/** 联合交付组队：按角色邀请伙伴、约定分成、联合报价 */
function TeamBuilder({ o }: { o: Opp }) {
  const team = useOpp((s) => s.teams[o.id]) ?? [];
  const inviteRole = useOpp((s) => s.inviteRole);
  const setSplit = useOpp((s) => s.setSplit);
  const submit = useOpp((s) => s.bid);
  const [quote, setQuote] = useState(o.budget ? String(o.budget.max) : '');
  const [days, setDays] = useState(String(o.deliveryDays ?? 14));
  const [plan, setPlan] = useState('');
  const [err, setErr] = useState<string[]>([]);
  const used = team.map((t) => t.memberId ?? t.name);
  const sum = team.reduce((a, t) => a + t.split, 0);
  return (
    <div className="mt-1 w-full rounded-xl bg-haze-200/60 p-2.5" data-testid="team-builder">
      <div className="font-black text-cocoa-800">👥 联合交付团队 · 分成合计 {sum}%</div>
      {o.roles!.map((r) => {
        const m = team.find((t) => t.role === r.id);
        return (
          <div key={r.id} className="mt-1.5 rounded-lg bg-cream-50 px-2 py-1.5" data-testid={`role-${r.id}`}>
            <div className="flex items-center justify-between gap-2">
              <b>{r.name}</b>
              {m ? (
                <span className="flex items-center gap-1.5">
                  {m.name} {m.state === 'me' ? <Pill tone="almond">我</Pill> : m.state === 'invited' ? <Pill tone="cream">邀请中</Pill> : <Pill tone="sage">已加入</Pill>}
                  <input className="input !w-14 !py-0.5" data-testid={`split-${r.id}`} value={m.split} onChange={(e) => setSplit(o.id, r.id, Number(e.target.value) || 0)} />%
                </span>
              ) : <span className="text-stone-400">待邀请</span>}
            </div>
            {!m && (
              <div className="mt-1 flex flex-wrap gap-1">
                {suggestForRole(r, used).map((c) => (
                  <button key={c.id} data-testid={`invite-role-${r.id}`} className="chip bg-almond-300 !py-0 text-[10px]" onClick={() => inviteRole(o.id, r.id, c.name, c.id)}>邀请 {c.name}</button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-2 grid gap-1.5">
        <div className="flex gap-1.5"><input className="input" data-testid="team-quote" placeholder="联合报价（元）" value={quote} onChange={(e) => setQuote(e.target.value)} /><input className="input" placeholder="工期（天）" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        <textarea className="input" data-testid="team-plan" rows={2} placeholder="联合方案：分工、节奏、交付物" value={plan} onChange={(e) => setPlan(e.target.value)} />
        {err.length > 0 && <div className="text-brick-500" data-testid="team-errors">{err.join('；')}</div>}
        <Btn size="sm" data-testid="team-submit" onClick={() => setErr(submit(o.id, { quote: Number(quote), days: Number(days), plan }, team))}>提交联合投标</Btn>
      </div>
    </div>
  );
}

function PromoAction({ o }: { o: Opp }) {
  const task = useOpp((s) => s.promos.find((p) => p.oppId === o.id));
  const take = useOpp((s) => s.takePromo);
  const submit = useOpp((s) => s.submitPromo);
  const [link, setLink] = useState('');
  if (!task) return <Btn size="sm" data-testid="promo-take" onClick={() => take(o.id)}>接单推广</Btn>;
  if (task.status === 'taken') return (
    <span className="flex w-full flex-wrap items-center gap-1.5">
      <Pill tone="almond">推广码 {task.code}</Pill>
      <input className="input !w-40" data-testid="promo-link" placeholder="作品链接" value={link} onChange={(e) => setLink(e.target.value)} />
      <Btn size="sm" data-testid="promo-submit" onClick={() => submit(o.id, link)}>提交验收</Btn>
    </span>
  );
  return <Pill tone={task.status === 'approved' ? 'sage' : 'almond'}>推广码 {task.code} · {task.status === 'approved' ? '已验收 ✓' : task.status === 'submitted' ? '待商家验收' : '未通过'}</Pill>;
}

function GigAction({ o }: { o: Opp }) {
  const app = useOpp((s) => s.apps.find((a) => a.oppId === o.id));
  const apply = useOpp((s) => s.apply);
  if (app) return <Pill tone={app.status === 'invited' ? 'sage' : 'almond'}>{app.status === 'invited' ? '商家邀约你沟通 ✓' : app.status === 'applied' ? '已投递' : '未合适'}</Pill>;
  return <Btn size="sm" data-testid="gig-apply" onClick={() => apply(o.id, '我对这个岗位感兴趣，时间可以配合。')}>投递</Btn>;
}

/** —— 交易链路进度条 —— */
function Stepper({ status }: { status: DealStatus }) {
  const k = stepOf(status);
  return (
    <div className="mt-2 flex items-center gap-0.5" data-testid="deal-stepper">
      {DEAL_STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center">
          <div className={`h-1.5 w-full rounded-full ${i < k || (i === k && status === 'done') ? 'bg-sage-400' : i === k ? 'bg-almond-500' : 'bg-cream-300'}`} />
          <span className={`mt-0.5 text-[9px] ${i === k ? 'font-black text-cocoa-800' : 'text-stone-400'}`}>{s}</span>
        </div>
      ))}
    </div>
  );
}

/** —— 我发布的：需求方视角 —— */
function Posted() {
  const myOpps = useOpp((s) => s.myOpps);
  const focus = useOpp((s) => s.focusOpp);
  if (!myOpps.length) return <div className="mt-3 text-xs text-stone-400">还没有发布需求。点右上角「＋ 发布需求」。</div>;
  return <div className="mt-3 space-y-3" data-testid="opp-posted">{[...myOpps].sort((a, b) => Number(b.id === focus) - Number(a.id === focus)).map((o) => <BuyerDeal key={o.id} o={o} />)}</div>;
}

function BuyerDeal({ o }: { o: Opp }) {
  const deal = useOpp((s) => s.deals[o.id]);
  const bids = useOpp((s) => s.bids.filter((b) => b.oppId === o.id && !b.mine));
  const invited = useOpp((s) => s.invited[o.id]) ?? [];
  const invite = useOpp((s) => s.invite);
  const award = useOpp((s) => s.award);
  const status = deal?.status ?? o.status;
  return (
    <div className="rounded-2xl bg-cream-100 p-3 text-xs" data-testid={`deal-${o.id}`}>
      <div className="font-black text-cocoa-800">{KIND_ICON[o.kind]} {o.title}</div>
      <Fields o={o} />
      <Stepper status={status} />
      {status === 'reviewing' && <div className="mt-2 text-stone-600">⏳ 正在审核：身份与需求真实性、是否含广告或违规内容…</div>}
      {status === 'matching' && o.kind === 'tender' && (
        <>
          <div className="mt-2 font-black">🎯 平台为你推荐的供给方</div>
          {recommendProviders(o).map((r) => (
            <div key={r.member.id} className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-cream-50 px-2 py-1" data-testid="reco">
              <span><b>{r.member.name}</b> · 匹配 {r.score}% · {r.reason}</span>
              {invited.includes(r.member.id) ? <Pill tone="sage">已邀请</Pill> : <Btn size="sm" data-testid="reco-invite" onClick={() => invite(o.id, r.member.id)}>邀请投标</Btn>}
            </div>
          ))}
          <div className="mt-2 font-black">⚖️ 比选表（{bids.length} 份投标）</div>
          {bids.length ? (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[11px]" data-testid="compare-table">
                <thead className="text-stone-400"><tr><th>投标方</th><th>报价</th><th>工期</th><th>信用</th><th>标记</th><th /></tr></thead>
                <tbody>
                  {compare(bids).map(({ bid, credit, badges }) => (
                    <tr key={bid.id} className="border-t border-cream-300 align-top" data-testid="incoming-bid">
                      <td className="py-1"><b>{bid.bidder}</b><div className="text-stone-500">{bid.plan}</div></td>
                      <td>¥{bid.quote}</td><td>{bid.days} 天</td>
                      <td>{credit.done ? `★${credit.rating} · ${credit.done} 单 · 准时 ${Math.round(credit.onTime * 100)}%` : '新'}{credit.certified ? ' ✔' : ''}</td>
                      <td>{badges.map((x) => <span key={x} className="mr-1 inline-block rounded-full bg-almond-300 px-1 text-[9px]">{x}</span>)}</td>
                      <td><Btn size="sm" data-testid="award" onClick={() => award(bid.id)}>选TA</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-stone-400">等待投标中，也可以主动邀请上面推荐的供给方。</div>}
        </>
      )}
      {status === 'matching' && o.kind !== 'tender' && <div className="mt-2 text-stone-600">已在需求大厅展示，接单 / 投递会出现在这里。</div>}
      {deal && <DealBody deal={deal} o={o} />}
    </div>
  );
}

/** —— 我承接的：供给方视角 —— */
function Taken() {
  const bids = useOpp((s) => s.bids.filter((b) => b.mine));
  const deals = useOpp((s) => s.deals);
  const promos = useOpp((s) => s.promos);
  const apps = useOpp((s) => s.apps);
  const all = useOpp.getState().allOpps();
  const title = (id: string) => all.find((o) => o.id === id)?.title ?? id;
  return (
    <div className="mt-3 space-y-3 text-xs" data-testid="opp-taken">
      {bids.map((b) => {
        const o = all.find((x) => x.id === b.oppId);
        const d = deals[b.oppId];
        if (!o) return null;
        return (
          <div key={b.id} className="rounded-2xl bg-cream-100 p-3" data-testid={`deal-${o.id}`}>
            <div className="font-black text-cocoa-800">📣 {o.title}</div>
            <div className="text-stone-500">{o.poster} · 我的报价 ¥{b.quote}{b.team ? ` · 联合团队 ${b.team.map((t) => `${t.name} ${t.split}%`).join('、')}` : ''}</div>
            <Stepper status={d?.status ?? 'matching'} />
            {!d && <div className="mt-2">投标状态：<b>{BID_LABEL[b.status]}</b></div>}
            {d && <DealBody deal={d} o={o} />}
          </div>
        );
      })}
      {!bids.length && <div className="text-stone-400">还没有投标。去需求大厅看看适合你的需求。</div>}
      <section>
        <div className="font-black text-cocoa-800">📢 我接的推广</div>
        {promos.map((p) => <div key={p.oppId} className="mt-1">{title(p.oppId)} · 推广码 {p.code} · <b>{{ taken: '进行中', submitted: '待验收', approved: '已验收', rejected: '未通过' }[p.status]}</b></div>)}
        {!promos.length && <div className="text-stone-400">暂无</div>}
      </section>
      <section>
        <div className="font-black text-cocoa-800">🧰 我投递的岗位</div>
        {apps.map((a) => <div key={a.oppId} className="mt-1">{title(a.oppId)} · <b>{{ applied: '已投递', invited: '邀约沟通', declined: '未合适' }[a.status]}</b></div>)}
        {!apps.length && <div className="text-stone-400">暂无</div>}
      </section>
    </div>
  );
}

/** —— 对接 → 成交 → 履约 → 评价（买卖双方共用） —— */
function DealBody({ deal, o }: { deal: Deal; o: Opp }) {
  const update = useOpp((s) => s.updateContract);
  const confirm = useOpp((s) => s.confirmContract);
  const deliver = useOpp((s) => s.deliver);
  const accept = useOpp((s) => s.accept);
  const repeat = useOpp((s) => s.repeat);
  const [err, setErr] = useState<string[]>([]);
  const c = deal.contract;
  const buyer = deal.side === 'buyer';
  const iConfirmed = buyer ? c.confirmedA : c.confirmedB;
  const editable = deal.status === 'connecting' && buyer && !c.confirmedA;
  const set = (p: Partial<Contract>) => update(o.id, { ...c, ...p });
  return (
    <div className="mt-2 space-y-2">
      <div className="rounded-xl bg-cream-50 p-2.5" data-testid="contract">
        <div className="font-black">📝 成交确认单 {c.confirmedA && c.confirmedB ? <Pill tone="sage">双方已确认</Pill> : <Pill tone="almond">{iConfirmed ? '等待对方确认' : '待我确认'}</Pill>}</div>
        <div className="mt-1 grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-1">
          <span className="text-stone-400">甲方</span>{editable ? <input className="input !py-0.5" data-testid="c-partyA" value={c.partyA} onChange={(e) => set({ partyA: e.target.value })} /> : <span>{c.partyA}</span>}
          <span className="text-stone-400">乙方</span><span>{c.partyB}</span>
          <span className="text-stone-400">金额</span>{editable ? <input className="input !py-0.5" data-testid="c-amount" value={c.amount} onChange={(e) => set({ amount: Number(e.target.value) || 0 })} /> : <span>¥{c.amount}</span>}
          <span className="text-stone-400">交付范围</span>{editable ? <input className="input !py-0.5" value={c.scope.join('；')} onChange={(e) => set({ scope: e.target.value.split(/[；;]/) })} /> : <span>{c.scope.join('；')}</span>}
        </div>
        <div className="mt-1.5 text-stone-400">付款节点</div>
        {c.milestones.map((m, i) => (
          <div key={i} className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-cream-100 px-2 py-1" data-testid={`milestone-${i}`}>
            <span>{i + 1}. {m.name} · {editable ? <input className="input !inline !w-12 !py-0" value={m.pct} onChange={(e) => set({ milestones: c.milestones.map((x, k) => (k === i ? { ...x, pct: Number(e.target.value) || 0 } : x)) })} /> : m.pct}% · ¥{Math.round((c.amount * m.pct) / 100)}</span>
            <span className="shrink-0">
              {m.accepted ? <Pill tone="sage">已验收</Pill>
                : deal.status === 'delivering' && buyer && m.delivered ? <Btn size="sm" data-testid="ms-accept" onClick={() => accept(o.id, i)}>验收</Btn>
                : deal.status === 'delivering' && !buyer && !m.delivered && c.milestones.slice(0, i).every((x) => x.accepted) ? <Btn size="sm" data-testid="ms-deliver" onClick={() => deliver(o.id, i)}>提交交付</Btn>
                : m.delivered ? <Pill tone="almond">待验收</Pill> : <Pill tone="cream">未开始</Pill>}
            </span>
          </div>
        ))}
        {deal.status !== 'connecting' && <div className="mt-1 text-stone-500">已按节点结算 ¥{paidSoFar(c)} / ¥{c.amount}（双方自行付款，平台不代收）</div>}
        {deal.status === 'connecting' && !iConfirmed && <Btn size="sm" className="mt-2" data-testid="contract-confirm" onClick={() => setErr(confirm(o.id))}>本人确认成交（L3）</Btn>}
        {err.length > 0 && <div className="mt-1 text-brick-500">{err.join('；')}</div>}
      </div>
      {deal.status === 'done' && <RatingBox deal={deal} o={o} />}
      {deal.status === 'done' && buyer && <Btn size="sm" tone="haze" data-testid="repeat" onClick={() => repeat(o.id)}>🔁 再次合作（复购）</Btn>}
    </div>
  );
}

function RatingBox({ deal, o }: { deal: Deal; o: Opp }) {
  const rate = useOpp((s) => s.rate);
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [onTime, setOnTime] = useState(true);
  const [err, setErr] = useState<string[]>([]);
  return (
    <div className="rounded-xl bg-sakura-200/50 p-2.5" data-testid="rating">
      <div className="font-black">⭐ 评价</div>
      {deal.ratingGot && <div className="mt-1">对方给你：{'★'.repeat(deal.ratingGot.stars)} {deal.ratingGot.tags.join('、')} ·「{deal.ratingGot.text}」</div>}
      {deal.ratingGiven ? <div className="mt-1" data-testid="rated">你给对方：{'★'.repeat(deal.ratingGiven.stars)} {deal.ratingGiven.tags.join('、')}</div> : (
        <div className="mt-1 grid gap-1.5">
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} data-testid={`star-${n}`} onClick={() => setStars(n)} className={`text-lg ${n <= stars ? 'text-almond-500' : 'text-stone-300'}`}>★</button>)}</div>
          <div className="flex flex-wrap gap-1">{RATING_TAGS.map((t) => <button key={t} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} className={`rounded-full px-2 py-0.5 text-[10px] ${tags.includes(t) ? 'bg-almond-400 font-bold' : 'bg-cream-50'}`}>{t}</button>)}</div>
          <input className="input" placeholder={`说说和 ${deal.counterpart} 的合作`} value={text} onChange={(e) => setText(e.target.value)} />
          <label className="flex items-center gap-1"><input type="checkbox" checked={onTime} onChange={(e) => setOnTime(e.target.checked)} />按时完成</label>
          {err.length > 0 && <div className="text-brick-500">{err.join('；')}</div>}
          <Btn size="sm" data-testid="rate-submit" onClick={() => setErr(rate(o.id, { stars, tags, text, onTime }))}>提交评价</Btn>
          <div className="text-[10px] text-stone-400">评价只能在双方确认完成后提交；低分需写明原因，对方可以申诉。</div>
        </div>
      )}
    </div>
  );
}

/** —— 发布需求 —— */
function PostForm({ onDone }: { onDone: () => void }) {
  const myOpc = useTown((s) => s.myOpc);
  const profile = useTown((s) => s.profile);
  const post = useOpp((s) => s.post);
  const [kind, setKind] = useState<OppKind>('tender');
  const [industry, setIndustry] = useState<'ecommerce' | 'heritage' | 'education'>('ecommerce');
  const ind = INDUSTRY_CHAINS.find((x) => x.id === industry)!;
  const [stage, setStage] = useState(ind.stages[1].id);
  const [title, setTitle] = useState('');
  const [min, setMin] = useState('3000');
  const [max, setMax] = useState('6000');
  const [pay, setPay] = useState('');
  const [days, setDays] = useState('7');
  const [delivery, setDelivery] = useState('14');
  const [area, setArea] = useState('徐汇 · 武康路一带');
  const [mode, setMode] = useState<WorkMode>('hybrid');
  const [req, setReq] = useState('');
  const [deliv, setDeliv] = useState('');
  const [roles, setRoles] = useState('');
  const [err, setErr] = useState<string[]>([]);
  const poster = myOpc?.name ?? profile?.displayName;
  if (!poster) return <div className="mt-2"><Disclaimer>发布需求需要先开一家小店或在「我的生意」建立商业画像，保证需求方可追溯。访客可以直接投标、接单推广和投递岗位。</Disclaimer></div>;
  const submit = () => {
    const st = ind.stages.find((s) => s.id === stage);
    const roleList = roles.split(/[，,、]/).map((x) => x.trim()).filter(Boolean);
    const e = post({
      kind, title, poster, requester: myOpc ? 'opc' : 'individual', area, mode, industry, stage, deadlineDays: Number(days),
      deliveryDays: kind === 'tender' ? Number(delivery) : undefined,
      budget: kind === 'tender' ? { min: Number(min), max: Number(max) } : undefined,
      pay: kind === 'gig' ? pay : undefined, commission: kind === 'promo' ? pay : undefined,
      requirements: req.split(/[，,；;]/).map((x) => x.trim()).filter(Boolean), deliverables: deliv.split(/[，,；;]/).map((x) => x.trim()).filter(Boolean),
      tags: st?.caps ?? [],
      roles: kind === 'tender' && roleList.length > 1 ? roleList.map((name, i) => ({ id: `r${i}`, name, tags: ind.stages.find((s) => s.roles.some((r) => name.includes(r.slice(0, 2))))?.caps ?? st?.caps ?? [] })) : undefined,
    });
    setErr(e);
    if (!e.length) onDone();
  };
  return (
    <div className="mt-2 grid gap-1.5 rounded-2xl bg-cream-100 p-3 text-xs" data-testid="opp-post-form">
      <div className="font-black">以「{poster}」的名义发布（{myOpc ? 'OPC / 小店' : '个人'}）</div>
      <div className="flex gap-1.5">
        {(['tender', 'promo', 'gig'] as const).map((k) => <button key={k} type="button" data-testid={`post-kind-${k}`} onClick={() => setKind(k)} className={`rounded-full px-2 py-0.5 ${kind === k ? 'bg-almond-400 font-bold' : 'bg-cream-50'}`}>{OPP_LABEL[k]}</button>)}
      </div>
      <input className="input" data-testid="post-title" placeholder="具体内容（如：新品短视频 6 条招标）" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex gap-1.5">
        <select className="input" value={industry} onChange={(e) => { const v = e.target.value as typeof industry; setIndustry(v); setStage(INDUSTRY_CHAINS.find((x) => x.id === v)!.stages[1].id); }}>
          {INDUSTRY_CHAINS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
          {ind.stages.map((s) => <option key={s.id} value={s.id}>需要：{s.name}</option>)}
        </select>
      </div>
      {kind === 'tender'
        ? <div className="flex gap-1.5"><input className="input" data-testid="post-min" placeholder="预算下限" value={min} onChange={(e) => setMin(e.target.value)} /><input className="input" data-testid="post-max" placeholder="预算上限" value={max} onChange={(e) => setMax(e.target.value)} /><input className="input" placeholder="交付时间（天）" value={delivery} onChange={(e) => setDelivery(e.target.value)} /></div>
        : <input className="input" data-testid="post-pay" placeholder={kind === 'gig' ? '报酬（如：¥35/小时）' : '佣金（如：每条 ¥80 或成交 10%）'} value={pay} onChange={(e) => setPay(e.target.value)} />}
      <div className="flex gap-1.5">
        <input className="input" placeholder="地区" value={area} onChange={(e) => setArea(e.target.value)} />
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value as WorkMode)}>{(Object.keys(MODE_LABEL) as WorkMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</select>
        <input className="input" placeholder="截止（天）" value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      <input className="input" placeholder="要求（用逗号分隔）" value={req} onChange={(e) => setReq(e.target.value)} />
      <input className="input" placeholder="交付物（用逗号分隔）" value={deliv} onChange={(e) => setDeliv(e.target.value)} />
      {kind === 'tender' && <input className="input" data-testid="post-roles" placeholder="需要联合交付？写下角色，如：拍摄、设计、直播运营" value={roles} onChange={(e) => setRoles(e.target.value)} />}
      {err.length > 0 && <div className="text-brick-500" data-testid="post-errors">{err.join('；')}</div>}
      <div className="flex gap-2"><Btn size="sm" data-testid="post-submit" onClick={submit}>提交审核并发布</Btn><Btn size="sm" tone="cream" onClick={onDone}>取消</Btn></div>
      <div className="text-[10px] text-stone-400">发布即同意：信息真实；不收保证金 / 押金 / 培训费；推广需标注广告；合同与付款由双方本人确认，平台不代收款。</div>
    </div>
  );
}
