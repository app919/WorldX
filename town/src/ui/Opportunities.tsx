/**
 * 机会广场（公告栏）：招标项目 / 推广接单 / 灵活用工 / 我的进度。
 * 商家发布案子，OPC 与访客投标、接单推广、找兼职；全部与产业链环节挂钩，并按我的能力推荐。
 */
import { useState } from 'react';
import { INDUSTRY_CHAINS, stageById } from '../data/chains';
import { OPP_LABEL, RULES, oppScore, type Opp, type OppKind } from '../domain/opportunity';
import { useOpp } from '../store/useOpp';
import { useTown } from '../store/useTown';
import { useMyChain } from './Chain';
import { Btn, Disclaimer, Drawer, Pill } from './kit';

const KIND_ICON: Record<OppKind, string> = { tender: '📣', promo: '📢', gig: '🧰' };

export function OppPanel() {
  const setTab = useTown((s) => s.setTab);
  const tab = useOpp((s) => s.oppTab);
  const setOppTab = useOpp((s) => s.setOppTab);
  const myOpps = useOpp((s) => s.myOpps);
  const [industry, setIndustry] = useState<string>('all');
  const [posting, setPosting] = useState(false);
  const profile = useTown((s) => s.profile);
  const { placements } = useMyChain();
  const myTags = (profile?.capabilities ?? []).map((c) => c.tag);
  const myStages = placements.map((p) => p.stage);
  const all = useOpp.getState().allOpps();
  void myOpps;
  const list = all.filter((o) => (tab === 'mine' ? false : o.kind === tab) && (industry === 'all' || o.industry === industry))
    .map((o) => ({ o, score: oppScore(o, myTags, myStages) })).sort((a, b) => Number(!!b.o.mine) - Number(!!a.o.mine) || b.score - a.score);
  return (
    <Drawer wide testId="opp-panel" title="📋 机会广场 · 公告栏" subtitle="商家发布案子招标 · 访客接单推广 · 灵活用工找机会" onClose={() => setTab('city')}>
      <div className="flex flex-wrap gap-1.5">
        {(['tender', 'promo', 'gig', 'mine'] as const).map((k) => (
          <button key={k} data-testid={`opp-tab-${k}`} onClick={() => setOppTab(k)}
            className={`rounded-full px-3 py-1 text-xs font-black ${tab === k ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-100 text-stone-600'}`}>
            {k === 'mine' ? '🗂️ 我的进度' : `${KIND_ICON[k]} ${OPP_LABEL[k]}`}
          </button>
        ))}
        <Btn size="sm" tone="sage" data-testid="opp-post-open" className="ml-auto" onClick={() => setPosting(!posting)}>＋ 发布</Btn>
      </div>
      {posting && <PostForm onDone={() => setPosting(false)} />}
      {tab !== 'mine' && (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <button onClick={() => setIndustry('all')} className={`rounded-full px-2 py-0.5 ${industry === 'all' ? 'bg-cocoa-800 text-cream-50' : 'bg-cream-100'}`}>全部行业</button>
            {INDUSTRY_CHAINS.map((x) => <button key={x.id} onClick={() => setIndustry(x.id)} className={`rounded-full px-2 py-0.5 ${industry === x.id ? 'bg-cocoa-800 text-cream-50' : 'bg-cream-100'}`}>{x.emoji} {x.name.split(' · ')[0]}</button>)}
          </div>
          <div className="mt-2"><Disclaimer>{RULES[tab].join('；')}</Disclaimer></div>
          <div className="mt-2 space-y-2">{list.map(({ o, score }) => <OppCard key={o.id} o={o} score={score} />)}</div>
        </>
      )}
      {tab === 'mine' && <Mine />}
    </Drawer>
  );
}

function OppCard({ o, score }: { o: Opp; score: number }) {
  const [open, setOpen] = useState(false);
  const st = o.stage ? stageById(o.stage) : undefined;
  const ind = INDUSTRY_CHAINS.find((x) => x.id === o.industry);
  const setIndustry = useOpp((s) => s.setIndustry);
  const setTab = useTown((s) => s.setTab);
  return (
    <div className="rounded-2xl bg-cream-100 p-3 text-xs" data-testid={`opp-${o.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-black text-cocoa-800">{KIND_ICON[o.kind]} {o.title}</div>
          <div className="mt-0.5 text-stone-600">{o.poster}{o.mine ? '（我发布的）' : ''} · {o.deadlineDays} 天后截止</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-black text-almond-600">{o.budget ? `¥${o.budget.min}–${o.budget.max}` : o.pay ?? o.commission}</div>
          {score > 0 && <Pill tone="sage">与你匹配 {score}%</Pill>}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {ind && <button className="chip bg-haze-300 !py-0 text-[10px]" onClick={() => { setIndustry(ind.id, o.stage); setTab('chain'); }}>🔗 {ind.name.split(' · ')[0]}{st ? ` · ${st.name}` : ''}</button>}
        {o.quota && <span className="chip bg-cream-50 !py-0 text-[10px]">名额 {o.quota}</span>}
        {o.isDemo && <span className="chip bg-cream-50 !py-0 text-[10px] text-stone-400">演示</span>}
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
        {o.mine && <span className="text-stone-400">在「我的进度」里查看投标 / 报名</span>}
      </div>
    </div>
  );
}

function BidAction({ o }: { o: Opp }) {
  const bid = useOpp((s) => s.bids.find((b) => b.oppId === o.id && b.mine));
  const submit = useOpp((s) => s.bid);
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState(o.budget ? String(o.budget.min) : '');
  const [days, setDays] = useState('10');
  const [plan, setPlan] = useState('');
  const [err, setErr] = useState<string[]>([]);
  if (bid) return <Pill tone={bid.status === 'won' ? 'sage' : 'almond'}>已投标 · {BID_LABEL[bid.status]}</Pill>;
  if (!open) return <Btn size="sm" data-testid="bid-open" onClick={() => setOpen(true)}>投标</Btn>;
  return (
    <form className="mt-1 grid w-full gap-1.5" onSubmit={(e) => { e.preventDefault(); setErr(submit(o.id, { quote: Number(quote), days: Number(days), plan })); }}>
      <div className="flex gap-1.5"><input className="input" data-testid="bid-quote" placeholder="报价（元）" value={quote} onChange={(e) => setQuote(e.target.value)} /><input className="input" placeholder="工期（天）" value={days} onChange={(e) => setDays(e.target.value)} /></div>
      <textarea className="input" data-testid="bid-plan" rows={2} placeholder="方案：怎么做、交付什么、有什么案例" value={plan} onChange={(e) => setPlan(e.target.value)} />
      {err.length > 0 && <div className="text-brick-500">{err.join('；')}</div>}
      <div className="flex gap-2"><Btn size="sm" type="submit" data-testid="bid-submit">提交投标</Btn><Btn size="sm" tone="cream" type="button" onClick={() => setOpen(false)}>取消</Btn></div>
    </form>
  );
}
const BID_LABEL = { submitted: '已提交', shortlisted: '进入候选', won: '中标 🎉', lost: '未中标' } as const;

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

function Mine() {
  const bids = useOpp((s) => s.bids);
  const promos = useOpp((s) => s.promos);
  const apps = useOpp((s) => s.apps);
  const myOpps = useOpp((s) => s.myOpps);
  const award = useOpp((s) => s.award);
  const all = useOpp.getState().allOpps();
  const title = (id: string) => all.find((o) => o.id === id)?.title ?? id;
  return (
    <div className="mt-3 space-y-3 text-xs" data-testid="opp-mine">
      <section>
        <div className="font-black text-cocoa-800">📣 我发布的案子</div>
        {!myOpps.length && <div className="text-stone-400">还没有发布。点右上角「＋ 发布」。</div>}
        {myOpps.map((o) => (
          <div key={o.id} className="mt-1 rounded-xl bg-cream-100 p-2">
            <b>{o.title}</b> <Pill tone="cream">{OPP_LABEL[o.kind]}</Pill>
            {bids.filter((b) => b.oppId === o.id && !b.mine).map((b) => (
              <div key={b.id} className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-cream-50 px-2 py-1" data-testid="incoming-bid">
                <span><b>{b.bidder}</b> · ¥{b.quote} · {b.days} 天 · {b.plan}</span>
                {b.status === 'won' ? <Pill tone="sage">已中标</Pill> : b.status === 'lost' ? <Pill tone="cream">未中标</Pill> : <Btn size="sm" data-testid="award" onClick={() => award(b.id)}>选TA中标</Btn>}
              </div>
            ))}
          </div>
        ))}
      </section>
      <section>
        <div className="font-black text-cocoa-800">🧾 我的投标</div>
        {bids.filter((b) => b.mine).map((b) => <div key={b.id} className="mt-1">{title(b.oppId)} · ¥{b.quote} · <b>{BID_LABEL[b.status]}</b></div>)}
        {!bids.some((b) => b.mine) && <div className="text-stone-400">暂无</div>}
      </section>
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
      <Disclaimer>信用记录只来自双方确认完成的合作（不能刷）。合同、报价确认与付款属于 L3，需本人确认；演示版平台不代收款、不担保交易。</Disclaimer>
    </div>
  );
}

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
  const [req, setReq] = useState('');
  const [deliv, setDeliv] = useState('');
  const [err, setErr] = useState<string[]>([]);
  const poster = myOpc?.name ?? profile?.displayName;
  if (!poster) return <div className="mt-2"><Disclaimer>发布案子需要先开一家小店或在「我的生意」建立商业画像，保证发布方可追溯。访客可以直接投标、接单推广和投递岗位。</Disclaimer></div>;
  const submit = () => {
    const st = ind.stages.find((s) => s.id === stage);
    const e = post({
      kind, title, poster, industry, stage, deadlineDays: Number(days),
      budget: kind === 'tender' ? { min: Number(min), max: Number(max) } : undefined,
      pay: kind === 'gig' ? pay : undefined, commission: kind === 'promo' ? pay : undefined,
      requirements: req.split(/[，,；;]/).map((x) => x.trim()).filter(Boolean), deliverables: deliv.split(/[，,；;]/).map((x) => x.trim()).filter(Boolean),
      tags: st?.caps ?? [],
    });
    setErr(e);
    if (!e.length) onDone();
  };
  return (
    <div className="mt-2 grid gap-1.5 rounded-2xl bg-cream-100 p-3 text-xs" data-testid="opp-post-form">
      <div className="font-black">以「{poster}」的名义发布</div>
      <div className="flex gap-1.5">
        {(['tender', 'promo', 'gig'] as const).map((k) => <button key={k} type="button" data-testid={`post-kind-${k}`} onClick={() => setKind(k)} className={`rounded-full px-2 py-0.5 ${kind === k ? 'bg-almond-400 font-bold' : 'bg-cream-50'}`}>{OPP_LABEL[k]}</button>)}
      </div>
      <input className="input" data-testid="post-title" placeholder="标题（如：新品短视频 6 条招标）" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex gap-1.5">
        <select className="input" value={industry} onChange={(e) => { const v = e.target.value as typeof industry; setIndustry(v); setStage(INDUSTRY_CHAINS.find((x) => x.id === v)!.stages[1].id); }}>
          {INDUSTRY_CHAINS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
          {ind.stages.map((s) => <option key={s.id} value={s.id}>需要：{s.name}</option>)}
        </select>
      </div>
      {kind === 'tender'
        ? <div className="flex gap-1.5"><input className="input" data-testid="post-min" placeholder="预算下限" value={min} onChange={(e) => setMin(e.target.value)} /><input className="input" data-testid="post-max" placeholder="预算上限" value={max} onChange={(e) => setMax(e.target.value)} /></div>
        : <input className="input" data-testid="post-pay" placeholder={kind === 'gig' ? '报酬（如：¥35/小时）' : '佣金（如：每条 ¥80 或成交 10%）'} value={pay} onChange={(e) => setPay(e.target.value)} />}
      <input className="input" placeholder="截止（天）" value={days} onChange={(e) => setDays(e.target.value)} />
      <input className="input" placeholder="要求（用逗号分隔）" value={req} onChange={(e) => setReq(e.target.value)} />
      <input className="input" placeholder="交付物（用逗号分隔）" value={deliv} onChange={(e) => setDeliv(e.target.value)} />
      {err.length > 0 && <div className="text-brick-500" data-testid="post-errors">{err.join('；')}</div>}
      <div className="flex gap-2"><Btn size="sm" data-testid="post-submit" onClick={submit}>发布到机会广场</Btn><Btn size="sm" tone="cream" onClick={onDone}>取消</Btn></div>
      <div className="text-[10px] text-stone-400">发布即同意：信息真实；不收保证金 / 押金 / 培训费；推广需标注广告；合同与付款由双方本人确认。</div>
    </div>
  );
}
