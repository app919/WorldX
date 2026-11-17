/**
 * 创意广场：把创意（可选公开）展示出来；点开任一创意 → 🤖 AI 落地教练：
 * 一句话定位、从想法到真实的 5 步、上下游怎么做、系统里每个环节有哪些资源（可一键打个飞的过去）。
 */
import { useMemo, useState } from 'react';
import { coachIdea, type Idea, type IdeaAction, type ResourceHit } from '../domain/ideas';
import { RELATION_LABEL, fmtYuan } from '../domain/ecosystem';
import { CITIES, cityOfDistrict } from '../domain/cities';
import type { CityId } from '../domain/weather';
import { allIdeas, useIdeas } from '../store/useIdeas';
import { useTown } from '../store/useTown';
import { useServer } from '../store/useServer';
import { useCenter } from '../store/useCenter';
import { useOpp } from '../store/useOpp';
import { useEco } from '../store/useEco';
import { goToHit, searchAllTown } from './NeedBox';
import { REAL_BLUE } from '../domain/palette';
import { Btn, Disclaimer } from './kit';
import type { SearchHit } from '../domain/search';

const cityName = (c: CityId) => CITIES.find((x) => x.id === c)?.name ?? '';

export function IdeasPlaza() {
  const mine = useIdeas((s) => s.mine);
  const liked = useIdeas((s) => s.liked);
  const viewing = useIdeas((s) => s.viewing);
  const [city, setCity] = useState<CityId | 'all'>('all');
  const [posting, setPosting] = useState(false);
  const list = allIdeas(mine).filter((i) => (i.public || i.mine) && (city === 'all' || i.city === city));
  const idea = viewing ? allIdeas(mine).find((i) => i.id === viewing) : undefined;
  if (idea) return <Coach idea={idea} />;
  return (
    <div className="mt-3" data-testid="ideas-plaza">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-stone-500">有个想法？发出来，AI 教你怎么落地，并找到系统里的上下游资源。</span>
        <Btn size="sm" tone="sage" className="ml-auto" data-testid="idea-post-open" onClick={() => setPosting(!posting)}>💡 发布创意</Btn>
      </div>
      {posting && <IdeaForm onDone={(id) => { setPosting(false); if (id) useIdeas.getState().view(id); }} />}
      <div className="mt-2 flex gap-1 overflow-x-auto text-[11px]">
        {(['all', ...CITIES.map((c) => c.id)] as const).map((c) => (
          <button key={c} onClick={() => setCity(c)} className={`chip shrink-0 ${city === c ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-100 text-stone-600'}`}>{c === 'all' ? '全部城市' : cityName(c)}</button>
        ))}
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2" data-testid="idea-list">
        {list.map((i) => (
          <div key={i.id} className="rounded-2xl bg-cream-50 p-3 text-xs shadow-soft ring-1 ring-cream-200" data-testid={`idea-${i.id}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-cocoa-800" style={i.mine ? { color: REAL_BLUE } : undefined}>{i.title}</div>
                <div className="mt-0.5 text-[10px] text-stone-400">{i.mine ? '我' : i.author} · {cityName(i.city)}{i.mine && !i.public ? ' · 🔒 仅自己可见' : ''}</div>
              </div>
              <button className="chip shrink-0 bg-cream-100 text-stone-600" onClick={() => useIdeas.getState().like(i.id)}>{liked.includes(i.id) ? '❤️' : '🤍'} {i.likes + (liked.includes(i.id) ? 1 : 0)}</button>
            </div>
            <div className="mt-1 line-clamp-2 text-stone-600">{i.desc}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {i.tags.map((t) => <span key={t} className="rounded-full bg-cream-100 px-1.5 py-0.5 text-[10px] text-stone-500">#{t}</span>)}
              <Btn size="sm" className="ml-auto" data-testid="idea-coach" onClick={() => useIdeas.getState().view(i.id)}>🤖 怎么落地</Btn>
            </div>
          </div>
        ))}
      </div>
      <Disclaimer>公开的创意所有人可见，可随时改为仅自己可见；创意不要写手机号、微信，平台内可直接聊。示范创意的作者为演示角色。</Disclaimer>
    </div>
  );
}

function IdeaForm({ onDone }: { onDone(id?: string): void }) {
  const district = useTown((s) => s.district);
  const nick = useTown((s) => s.avatar?.nickname) ?? '我';
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [pub, setPub] = useState(true);
  const [err, setErr] = useState('');
  const submit = () => {
    const r = useIdeas.getState().add({ title, desc, tags: tags.split(/[\s,，#]+/).filter(Boolean), public: pub, city: cityOfDistrict(district).id, author: nick });
    if (!r.ok) { setErr(r.reason ?? '没有通过审核'); return; }
    useTown.getState().toast(pub ? '创意已公开到创意广场' : '创意已保存（仅自己可见）', 'ok');
    onDone(r.id);
  };
  return (
    <form className="mt-2 grid gap-1.5 rounded-2xl bg-cream-100 p-3 text-xs" data-testid="idea-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input className="input" data-testid="idea-title" maxLength={40} placeholder="一句话说你的创意（例：宠物店的 AI 客服）" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input min-h-[60px]" data-testid="idea-desc" maxLength={500} placeholder="想做什么、给谁、怎么赚钱？（至少 10 个字）" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <input className="input" maxLength={40} placeholder="标签，用空格分开（选填）" value={tags} onChange={(e) => setTags(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1"><input type="checkbox" data-testid="idea-public" checked={pub} onChange={(e) => setPub(e.target.checked)} /> 公开展示到创意广场</label>
        {err && <span className="text-brick-500" data-testid="idea-error">{err}</span>}
        <Btn size="sm" type="submit" className="ml-auto" data-testid="idea-submit">发布并让 AI 教我落地</Btn>
      </div>
    </form>
  );
}

function Coach({ idea }: { idea: Idea }) {
  const remote = useServer((s) => s.shops);
  const plan = useMemo(() => coachIdea(idea, (q) => searchAllTown(q, remote.map((r) => ({ id: r.id, lotId: r.lotId, name: r.name, tagline: r.tagline, category: r.category, licensed: r.licensed, ownerUserId: r.ownerUserId }))) as (ResourceHit & SearchHit)[]), [idea, remote]);
  const back = () => useIdeas.getState().view(undefined);
  const doAction = (a: IdeaAction) => {
    const t = useTown.getState();
    if (a === 'post_need') { useOpp.getState().setOppTab('hall'); t.toast('点右上角「＋ 发布需求」，写「征集试用」', 'info'); back(); return; }
    if (a === 'open_shop') { if (t.myOpc) t.toast('你已经有小店了：去「我的小店」上架产品', 'info'); else { t.setTab('city'); t.setWizard(true); } return; }
    if (a === 'center_services' || a === 'center_funding') { useCenter.getState().setSection(a === 'center_services' ? 'services' : 'funding'); t.setTab('center'); return; }
    if (a === 'community') { t.setTab('community'); return; }
    if (a === 'eco') { useEco.getState().setView('eco'); t.setTab('chain'); }
  };
  return (
    <div className="mt-3 text-xs" data-testid="idea-coach-view">
      <button className="text-stone-500" data-testid="idea-back" onClick={back}>← 返回创意广场</button>
      <div className="mt-1 text-base font-black text-cocoa-800">🤖 AI 落地教练 · {idea.title}</div>
      <div className="mt-1 rounded-2xl bg-almond-300/40 p-2.5 text-cocoa-800" data-testid="idea-position"><b>一句话定位：</b>{plan.position}</div>
      {idea.mine && (
        <label className="mt-1 flex items-center gap-1 text-[11px] text-stone-500">
          <input type="checkbox" checked={idea.public} onChange={(e) => useIdeas.getState().setPublic(idea.id, e.target.checked)} /> 公开展示到创意广场
        </label>
      )}

      <Section title="从想法到真实：5 步">
        <div className="space-y-1.5" data-testid="idea-steps">
          {plan.steps.map((s) => (
            <div key={s.title} className="rounded-2xl bg-cream-50 p-2.5 ring-1 ring-cream-200">
              <div className="font-black text-cocoa-800">{s.title}</div>
              <div className="mt-0.5 text-stone-600">{s.detail}</div>
              <div className="mt-0.5 text-[11px] text-sage-700">✅ 过关标准：{s.pass}</div>
              <div className="mt-1 flex flex-wrap gap-1">{s.system.map((x) => <button key={x.label} className="chip bg-cream-100 text-cocoa-700" onClick={() => doAction(x.action)}>→ {x.label}</button>)}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`上下游怎么做 · 系统里有 ${plan.resourceCount} 个资源可以帮你`}>
        <div className="grid gap-2 md:grid-cols-3" data-testid="idea-chain">
          <Links title="⬆️ 上游：向谁采购" links={plan.upstream} empty="暂时不需要外部采购" />
          <Links title="⬇️ 下游：卖给谁" links={plan.downstream} empty="先从身边的朋友开始" />
          <Links title="↔️ 同行：和谁联合" links={plan.peers} empty="可以先自己做" />
        </div>
      </Section>

      {plan.niches.length > 0 && (
        <Section title="最接近的生态位（已审核）">
          <div className="space-y-1" data-testid="idea-niches">
            {plan.niches.map((m) => (
              <div key={m.niche.id} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-cream-50 px-2 py-1.5 ring-1 ring-cream-200">
                <b className="text-cocoa-800">{m.match}%</b><span className="font-bold">{m.niche.title}</span>
                <span className="text-[10px] text-stone-500">{RELATION_LABEL[m.relation]} · {m.review.status === 'pass' ? '✅' : '⚠️ 需资质'}</span>
                <span className="ml-auto text-[11px] text-stone-600">市场 {fmtYuan(m.value.tam)} · 你 3 年可获得 {fmtYuan(m.value.som)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      <Disclaimer>落地教练在标签体系与生态位知识库上推理，资源来自本系统的入驻店铺、服务商与投资方（不含【例】示范店）；市场价值为估算，仅供方向判断。</Disclaimer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-3"><div className="mb-1 text-sm font-black text-cocoa-800">{title}</div>{children}</div>;
}

function Links({ title, links, empty }: { title: string; links: { label: string; why: string; resources: ResourceHit[] }[]; empty: string }) {
  return (
    <div className="rounded-2xl bg-cream-100 p-2.5">
      <div className="font-black text-cocoa-800">{title}</div>
      {links.length === 0 && <div className="mt-1 text-stone-500">{empty}</div>}
      {links.map((l) => (
        <div key={l.label} className="mt-1.5">
          <div className="font-bold text-cocoa-800">{l.label}</div>
          <div className="text-[11px] text-stone-500">{l.why}</div>
          <div className="mt-1 flex flex-col gap-1">
            {l.resources.length === 0 && <span className="text-[11px] text-stone-400">系统里暂时还没有，入驻后会出现在这里</span>}
            {l.resources.map((r) => (
              <button key={r.id} data-testid="idea-resource" onClick={() => goToHit(r as unknown as SearchHit)} className="flex items-center gap-1 rounded-xl bg-cream-50 px-2 py-1 text-left hover:bg-almond-300/50">
                {r.badge && <span className="rounded bg-cocoa-800 px-1 text-[9px] text-cream-50">{r.badge}</span>}
                <span className="min-w-0 flex-1 truncate font-bold">{r.title}</span>
                <span className="shrink-0 text-[10px] text-almond-600">✈️ 去看看</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
