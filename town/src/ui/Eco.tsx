/**
 * 智能生态位：根据你的一切资料自动生成上下游 / 供应链 / 多元化方向，按匹配度降序给 6 个；
 * 不感兴趣 → 丢弃并补位；收藏 → 进收藏夹（可打标签）并补位；每个方向都已审核，并给出市场价值（年营收，人民币）。
 */
import { useMemo, useState } from 'react';
import { DIRECTION_LABEL, REACH_LABEL, RELATION_LABEL, RELATION_TONE, WEIGHTS, type EcoAnswers, allowedScopes, fmtYuan, generateNiches, matchOne, type EcoInput, type MatchBreakdown, type NicheMatch, type Scope } from '../domain/ecosystem';
import { cityOfDistrict } from '../domain/cities';
import { lotById } from '../world';
import { TAG_PRESETS, useEco } from '../store/useEco';
import { useServer } from '../store/useServer';
import { useTown } from '../store/useTown';
import { Btn, Disclaimer } from './kit';
import { CAPABILITIES } from '../domain/taxonomy';
import { api } from '../net/api';

/** 把我所有的资料拼成一段：营业范围、产品介绍、公司介绍、上传资料提炼、能力画像、正在找 */
export function useEcoInput(): EcoInput & { sources: string[] } {
  const myOpc = useTown((s) => s.myOpc);
  const profile = useTown((s) => s.profile);
  const home = useTown((s) => s.home);
  const avatar = useTown((s) => s.avatar);
  const me = useServer((s) => s.me);
  const shops = useServer((s) => s.shops);
  const localAnswers = useEco((s) => s.answers);
  return useMemo(() => {
    const parts: string[] = [];
    const sources: string[] = [];
    if (myOpc) {
      sources.push('小店资料');
      parts.push(myOpc.name, myOpc.tagline, myOpc.category, ...myOpc.products.map((p) => `${p.name} ${p.description}`), ...myOpc.cases, ...myOpc.openNeeds, ...myOpc.faqs.map((f) => f.a));
      if (myOpc.license) parts.push(myOpc.license.company);
    }
    if (profile) {
      sources.push('生意画像');
      parts.push(profile.headline, ...profile.capabilities.map((c) => `${c.label} ${c.detail ?? ''}`), ...profile.needs.map((n) => n.label));
    }
    const mine = me?.shopId ? shops.find((s) => s.id === me.shopId) : undefined;
    for (const intro of [mine?.companyIntro, mine?.productIntro]) {
      if (!intro) continue;
      sources.push(intro === mine?.companyIntro ? '公司介绍（上传资料提炼）' : '产品介绍（上传资料提炼）');
      parts.push(intro.oneLiner, intro.about, ...intro.highlights, ...intro.products.map((p) => `${p.name} ${p.desc}`), ...intro.customers);
    }
    // 开了店：以店铺里记下的问答为准；没开店：用本机记下的
    const answers = myOpc?.eco ?? localAnswers;
    if (answers.note.trim() || answers.skills.length || answers.direction !== 'any') sources.push('我回答的问题与补充');
    const district = (myOpc && lotById(myOpc.lotId)?.district) || home?.district || avatar?.district || 'wukang';
    return {
      name: myOpc?.name ?? profile?.displayName,
      text: parts.filter(Boolean).join('。'),
      capabilities: profile?.capabilities.map((c) => c.tag),
      industries: profile?.industries,
      city: cityOfDistrict(district).id,
      isExample: !!myOpc?.isDemo,
      answers,
      sources,
    };
  }, [myOpc, profile, home, avatar, me, shops, localAnswers]);
}

const BREAK_LABEL: Record<keyof MatchBreakdown, string> = { strength: '核心实力', text: '资料命中', industry: '行业相关', opportunity: '赛道机会', opcFit: '一人适配', geo: '地域' };
const SCOPE_LABEL: Record<Scope, string> = { china: '🇨🇳 中国', city: '📍 本城市', global: '🌍 全球' };

export function EcoView() {
  const input = useEcoInput();
  const { dismissed, favorites, scopes, dismiss, favorite, resetDismissed } = useEco();
  const [tagFilter, setTagFilter] = useState<string | undefined>();
  const res = useMemo(() => generateNiches(input, { dismissed, favorites: favorites.map((f) => f.id), scopes }), [input, dismissed, favorites, scopes]);
  return (
    <div data-testid="eco-view">
      <div className="rounded-2xl bg-cream-100 p-3 text-xs text-stone-600">
        <div className="font-black text-cocoa-800">✨ 智能生态位 · 帮你找多元化经营路线</div>
        <div className="mt-1">根据{input.sources.length ? `「${input.sources.join('、')}」` : '你的资料'}，从生态位知识库里生成上游、下游、供应链与跨界方向，
          按 <b>核心实力 · 赛道机会 · 一人适配 · 地域</b> 打分，匹配度从高到低给 6 个。每个方向都经过审核，并估算市场价值（年营收，人民币）。</div>
        {res.profile.caps.length > 0 && <div className="mt-1">识别到的能力：{res.profile.caps.length} 项 · 计算城市：{cityLabel(input.city)}</div>}
      </div>

      <Questions answers={input.answers!} detected={res.profile.caps} />

      {input.isExample ? (
        <div className="mt-3 rounded-2xl bg-cream-100 p-3 text-xs">【例】示范店不生成生态位。</div>
      ) : res.items.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-cream-100 p-4 text-center text-xs text-stone-600" data-testid="eco-empty">
          还没有你的资料。写一句你做什么、开一家小店，或在「我的生意」里确认画像，就能生成你的生态位。
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2" data-testid="eco-list">
          {res.items.map((m, i) => <NicheCard key={m.niche.id} m={m} rank={i + 1} city={input.city} onDismiss={() => dismiss(m.niche.id)} onFav={() => favorite(m.niche.id)} />)}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
        {res.items.length > 0 && <span data-testid="eco-remaining">候选池还有 {res.remaining} 个方向可以补位</span>}
        {res.blocked.length > 0 && <span data-testid="eco-blocked" title={res.blocked.map((b) => `${b.title}：${b.reason}`).join('\n')}>· 🛡️ 审核已拦截 {res.blocked.length} 个不合规方向（{res.blocked.map((b) => b.title).join('、')}）</span>}
        {dismissed.length > 0 && <button className="underline" data-testid="eco-reset" onClick={resetDismissed}>恢复已丢弃的 {dismissed.length} 个</button>}
      </div>

      <Favorites input={input} tagFilter={tagFilter} setTagFilter={setTagFilter} />

      <Disclaimer>市场价值按「自下而上（客户数 × 渗透率 × 频次 × 客单价）」与「自上而下（行业规模 × 细分占比）」两种方法三角验证，参数取公开统计口径约 2024 年量级，用于方向判断，不构成投资建议。匹配度由规则引擎在标签体系上计算，可点「怎么算的」查看每一步。</Disclaimer>
    </div>
  );
}

function cityLabel(c: EcoInput['city']) { return { shanghai: '上海', beijing: '北京', shenzhen: '深圳', changsha: '长沙', chengdu: '成都' }[c]; }

function NicheCard({ m, rank, city, onDismiss, onFav, fav }: { m: NicheMatch; rank: number; city: EcoInput['city']; onDismiss?: () => void; onFav?: () => void; fav?: React.ReactNode }) {
  const setScope = useEco((s) => s.setScope);
  const [open, setOpen] = useState(false);
  const n = m.niche, v = m.value;
  const scopes = allowedScopes(n);
  return (
    <div className="rounded-2xl bg-cream-50 p-3 text-xs shadow-soft ring-1 ring-cream-200" data-testid={`niche-${n.id}`}>
      <div className="flex items-start gap-2">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-almond-300 text-center leading-none text-cocoa-800">
          <div><div className="text-lg font-black" data-testid="niche-match">{m.match}%</div><div className="text-[9px]">匹配度</div></div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            {rank > 0 && <span className="text-[10px] text-stone-400">#{rank}</span>}
            <span className="text-sm font-black text-cocoa-800">{n.title}</span>
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: RELATION_TONE[m.relation] }}>{RELATION_LABEL[m.relation]}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${m.review.status === 'pass' ? 'bg-sage-200 text-sage-700' : 'bg-[#FFE7C2] text-[#9A5B00]'}`} data-testid="niche-review"
              title={m.review.checks.map((c) => `${c.name}：${c.note}`).join('\n')}>{m.review.status === 'pass' ? '✅ 已审核' : '⚠️ 已审核 · 需资质'}</span>
          </div>
          <div className="mt-0.5 text-stone-600">{n.pitch}</div>
        </div>
      </div>
      <div className="mt-2 rounded-xl bg-cream-100 p-2" data-testid="niche-value">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-black text-cocoa-800">市场价值（年营收）</span>
          <span className="ml-auto flex gap-1">
            {scopes.map((s) => (
              <button key={s} data-testid={`scope-${s}`} onClick={() => setScope(n.id, s)}
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${v.scope === s ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-50 text-stone-500'}`}>{s === 'city' ? `📍 ${cityLabel(city)}` : SCOPE_LABEL[s]}</button>
            ))}
          </span>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1 text-center">
          <Stat label={`市场规模 · ${v.scopeLabel}`} value={fmtYuan(v.tam)} testId="niche-tam" />
          <Stat label="可服务市场" value={fmtYuan(v.sam)} />
          <Stat label="你 3 年可获得" value={fmtYuan(v.som)} strong />
        </div>
        {v.scope === 'city' && <div className="mt-1 text-[10px] text-stone-500" data-testid="niche-local">📍 需要本地线下交付，按{v.scopeLabel.replace('本城市 · ', '')}计算</div>}
      </div>
      <div className="mt-1.5 text-stone-600"><b>为什么推荐：</b>{m.why}</div>
      <div className="mt-1 text-stone-600"><b>第一步：</b>{n.firstStep}</div>
      {open && (
        <div className="mt-2 space-y-1 rounded-xl bg-cream-100 p-2 text-[11px] text-stone-600" data-testid="niche-how">
          <div className="font-black text-cocoa-800">匹配度 {m.match}% 怎么算的</div>
          {(Object.keys(WEIGHTS) as (keyof MatchBreakdown)[]).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-14 shrink-0">{BREAK_LABEL[k]}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-200"><span className="block h-full rounded-full bg-almond-400" style={{ width: `${Math.round(m.breakdown[k] * 100)}%` }} /></span>
              <span className="w-16 shrink-0 text-right">{Math.round(m.breakdown[k] * 100)} × {Math.round(WEIGHTS[k] * 100)}%</span>
            </div>
          ))}
          <div className="pt-1 font-black text-cocoa-800">市场价值怎么算的</div>
          {v.steps.map((s, i) => <div key={i}>{i + 1}. {s}</div>)}
          <div className="pt-1 font-black text-cocoa-800">审核记录</div>
          {m.review.checks.map((c) => <div key={c.name}>{c.level === 'pass' ? '✅' : c.level === 'warn' ? '⚠️' : '⛔'} {c.name}：{c.note}</div>)}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className="chip bg-cream-100 text-stone-600" data-testid="niche-how-btn" onClick={() => setOpen(!open)}>{open ? '收起' : '🧮 怎么算的'}</button>
        {onFav && <Btn size="sm" tone="sage" data-testid="niche-fav" onClick={onFav}>⭐ 收藏</Btn>}
        {onDismiss && <Btn size="sm" tone="cream" data-testid="niche-dismiss" onClick={onDismiss}>🗑 不感兴趣</Btn>}
        {fav}
      </div>
    </div>
  );
}

function Stat({ label, value, strong, testId }: { label: string; value: string; strong?: boolean; testId?: string }) {
  return (
    <div className="rounded-lg bg-cream-50 px-1 py-1">
      <div className={`text-[13px] font-black ${strong ? 'text-[#C2410C]' : 'text-cocoa-800'}`} data-testid={testId}>{value}</div>
      <div className="text-[9px] text-stone-500">{label}</div>
    </div>
  );
}

function Favorites({ input, tagFilter, setTagFilter }: { input: EcoInput; tagFilter?: string; setTagFilter(t?: string): void }) {
  const { favorites, scopes, unfavorite, addTag, removeTag } = useEco();
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(true);
  if (!favorites.length) return null;
  const allTags = [...new Set(favorites.flatMap((f) => f.tags))];
  const shown = favorites.filter((f) => !tagFilter || f.tags.includes(tagFilter));
  return (
    <div className="mt-4 rounded-2xl bg-[#FFF6E0] p-3 ring-1 ring-[#D9A62E]/40" data-testid="eco-favorites">
      <button className="flex w-full items-center text-left text-sm font-black text-cocoa-800" onClick={() => setOpen(!open)}>
        ⭐ 我的收藏夹（{favorites.length}）<span className="ml-auto text-xs text-stone-500">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <>
          {allTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
              <button className={`chip ${!tagFilter ? 'bg-almond-400' : 'bg-cream-50 text-stone-600'}`} onClick={() => setTagFilter(undefined)}>全部</button>
              {allTags.map((t) => <button key={t} data-testid={`fav-filter-${t}`} className={`chip ${tagFilter === t ? 'bg-almond-400' : 'bg-cream-50 text-stone-600'}`} onClick={() => setTagFilter(t)}>#{t}</button>)}
            </div>
          )}
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {shown.map((f) => {
              const m = matchOne(f.id, input, scopes[f.id]);
              if (!m) return null;
              return (
                <NicheCard key={f.id} m={m} rank={0} city={input.city} fav={
                  <div className="flex w-full flex-wrap items-center gap-1 pt-1" data-testid={`fav-tags-${f.id}`}>
                    {f.tags.map((t) => <button key={t} className="chip bg-[#FFE7C2] text-[#9A5B00]" title="点击移除" onClick={() => removeTag(f.id, t)}>#{t} ✕</button>)}
                    {TAG_PRESETS.filter((t) => !f.tags.includes(t)).slice(0, 3).map((t) => <button key={t} className="chip bg-cream-50 text-stone-500" onClick={() => addTag(f.id, t)}>+{t}</button>)}
                    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); addTag(f.id, tagDraft[f.id] ?? ''); setTagDraft({ ...tagDraft, [f.id]: '' }); }}>
                      <input className="input h-6 w-20 px-1.5 py-0 text-[11px]" data-testid="fav-tag-input" placeholder="自定义标签" maxLength={8} value={tagDraft[f.id] ?? ''} onChange={(e) => setTagDraft({ ...tagDraft, [f.id]: e.target.value })} />
                      <button className="chip bg-almond-300" type="submit" data-testid="fav-tag-add">＋</button>
                    </form>
                    <button className="chip ml-auto bg-cream-50 text-stone-500" data-testid="fav-remove" onClick={() => unfavorite(f.id)}>移出收藏</button>
                  </div>
                } />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** 匹配前的 3 个小问题 + 自由补充；开了店会记到店铺资料里（正式版同步到服务器，只给店主自己用于匹配） */
function Questions({ answers, detected }: { answers: EcoAnswers; detected: string[] }) {
  const myOpc = useTown((s) => s.myOpc);
  const me = useServer((s) => s.me);
  const [a, setA] = useState<EcoAnswers>(answers);
  const [open, setOpen] = useState(!answers.updatedAt);
  const [more, setMore] = useState(false);
  const pool = more ? CAPABILITIES : CAPABILITIES.filter((c) => detected.includes(c.id) || a.skills.includes(c.id)).concat(CAPABILITIES.filter((c) => !detected.includes(c.id) && !a.skills.includes(c.id)).slice(0, Math.max(0, 8 - detected.length)));
  const toggleSkill = (id: string) => setA({ ...a, skills: a.skills.includes(id) ? a.skills.filter((x) => x !== id) : [...a.skills, id].slice(-3) });
  const save = async () => {
    const next = { ...a, skills: a.skills.slice(0, 3), note: a.note.slice(0, 1000), updatedAt: Date.now() };
    useEco.getState().setAnswers(next);
    if (myOpc && !myOpc.isDemo) {
      useTown.getState().setMyOpcEco(next);
      if (me?.shopId) await api('/api/shops/mine', { method: 'PUT', json: { eco: { skills: next.skills, direction: next.direction, reach: next.reach, note: next.note } } }).catch(() => {});
      useTown.getState().toast(`已记到「${myOpc.name}」的店铺资料里，匹配已更新`, 'ok');
    } else useTown.getState().toast('已更新匹配（开店后这些回答会自动记到店铺资料里）', 'ok');
    setOpen(false);
  };
  if (!open) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-2xl bg-cream-100 px-3 py-2 text-[11px] text-stone-600" data-testid="eco-answers">
        <span>🎯 拿手：{a.skills.length ? a.skills.map((id) => CAPABILITIES.find((c) => c.id === id)?.label).join('、') : '自动识别'} · 方向：{DIRECTION_LABEL[a.direction]} · 范围：{REACH_LABEL[a.reach]}{a.note ? ' · 已补充资料' : ''}{myOpc && !myOpc.isDemo ? ' · 已记到店铺' : ''}</span>
        <button className="chip ml-auto bg-almond-300" data-testid="eco-edit" onClick={() => setOpen(true)}>修改 / 补充</button>
      </div>
    );
  }
  return (
    <form className="mt-2 space-y-2 rounded-2xl bg-cream-100 p-3 text-xs" data-testid="eco-questions" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="font-black text-cocoa-800">🎯 回答 3 个小问题，匹配更准（约 20 秒）</div>
      <div>
        <div className="mb-1 font-bold text-cocoa-800">1. 你最拿手的是？（选 1–3 个）</div>
        <div className="flex flex-wrap gap-1">
          {pool.map((c) => <button type="button" key={c.id} data-testid={`eco-skill-${c.id}`} onClick={() => toggleSkill(c.id)} className={`chip ${a.skills.includes(c.id) ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-50 text-stone-600'}`}>{c.label}{detected.includes(c.id) && !a.skills.includes(c.id) ? ' ·识别' : ''}</button>)}
          {!more && <button type="button" className="chip bg-cream-50 text-stone-500" onClick={() => setMore(true)}>更多…</button>}
        </div>
      </div>
      <div>
        <div className="mb-1 font-bold text-cocoa-800">2. 你最想往哪拓展？</div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(DIRECTION_LABEL) as EcoAnswers['direction'][]).map((d) => <button type="button" key={d} data-testid={`eco-dir-${d}`} onClick={() => setA({ ...a, direction: d })} className={`chip ${a.direction === d ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-50 text-stone-600'}`}>{DIRECTION_LABEL[d]}</button>)}
        </div>
      </div>
      <div>
        <div className="mb-1 font-bold text-cocoa-800">3. 你的生意能做多远？</div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(REACH_LABEL) as EcoAnswers['reach'][]).map((r) => <button type="button" key={r} data-testid={`eco-reach-${r}`} onClick={() => setA({ ...a, reach: r })} className={`chip ${a.reach === r ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-50 text-stone-600'}`}>{REACH_LABEL[r]}</button>)}
        </div>
      </div>
      <div>
        <div className="mb-1 font-bold text-cocoa-800">还想补充什么？（选填）</div>
        <textarea className="input min-h-[44px] w-full text-xs" data-testid="eco-brief" maxLength={1000} value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })}
          placeholder="营业范围、产品、公司介绍、手上的资源……（例：武康路摄影工作室，拍产品图和短视频，也做品牌宣传片）不要写手机号 / 微信" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-stone-500">{myOpc && !myOpc.isDemo ? `保存后记到「${myOpc.name}」的店铺资料（只用于匹配，不公开）` : '开店后这些回答会自动记到店铺资料里'}</span>
        <Btn type="submit" size="sm" className="ml-auto" data-testid="eco-generate">保存并重新匹配</Btn>
      </div>
    </form>
  );
}
