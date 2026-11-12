import { useMemo, useState } from 'react';
import { MATCH_DISCLAIMER, RELATION_HINT, RELATION_LABEL, WEIGHTS } from '../domain/matching';
import { extractProfile, suggestDirections, toProfile, type ExtractionResult } from '../domain/profileExtractor';
import { CAPABILITIES, DISTRICT_LABEL, capLabel } from '../domain/taxonomy';
import type { DistrictId, Relationship, RelationType } from '../domain/types';
import { RESIDENTS, STORY_INTRO_TEXT } from '../data/seed';
import { ME, residentById, useOpportunities, useTown } from '../store/useTown';
import { Btn, Card, Chip, Disclaimer, Panel } from './kit';

type View = 'map' | 'directions' | 'team' | 'growth';

export function BusinessMapPanel() {
  const profile = useTown((s) => s.profile);
  const setTab = useTown((s) => s.setTab);
  const [view, setView] = useState<View>('map');
  const [editing, setEditing] = useState(false);
  return (
    <Panel testId="map-panel" title="🗺️ 我的商业可能性地图" subtitle="AI 根据供需、行业、技能、地域和合作意向，推测你身边可能的合作关系" onClose={() => setTab('city')} className="h-full w-full">
      {!profile || editing ? (
        <ProfileSetup onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {([['map', '关系地图'], ['directions', '生意灵感'], ['team', '组队地图'], ['growth', '成长地图']] as [View, string][]).map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} className={`chip ${view === v ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-100 text-stone-600'}`}>{l}</button>
            ))}
            <button className="chip ml-auto bg-cream-100 text-stone-600" onClick={() => setEditing(true)}>✏️ 修改画像</button>
          </div>
          {view === 'map' && <OpportunityMap />}
          {view === 'directions' && <Directions />}
          {view === 'team' && <TeamMap />}
          {view === 'growth' && <GrowthMap />}
        </>
      )}
    </Panel>
  );
}

/** 用一段话让 AI 认识你 —— 提取结果必须经你确认 */
function ProfileSetup({ onDone }: { onDone: () => void }) {
  const avatar = useTown((s) => s.avatar)!;
  const saveProfile = useTown((s) => s.saveProfile);
  const existing = useTown((s) => s.profile);
  const [text, setText] = useState('');
  const [x, setX] = useState<ExtractionResult | null>(null);
  const [caps, setCaps] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [sugg, setSugg] = useState<string[]>([]);
  const [districts, setDistricts] = useState<DistrictId[]>([]);
  const [headline, setHeadline] = useState('');

  const run = (t: string) => {
    const r = extractProfile(t);
    setX(r);
    setCaps(r.capabilities.map((c) => c.tag));
    setNeeds(r.needs.map((n) => n.tag));
    setSugg([]);
    setDistricts(r.districts.length ? r.districts : ['xuhui']);
    setHeadline(t.split(/[。！？\n]/)[0].slice(0, 40));
  };

  const confirm = () => {
    if (!x) return;
    const base = toProfile(ME, `${avatar.nickname}`, headline, {
      ...x,
      capabilities: caps.map((tag) => ({ tag, label: capLabel(tag) })),
      needs: needs.map((tag) => ({ tag, label: capLabel(tag) })),
      districts,
    }, sugg);
    saveProfile({ ...base, industries: [...new Set(caps.map((c) => CAPABILITIES.find((d) => d.id === c)?.industry).filter(Boolean) as string[])] });
    onDone();
  };

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((a) => a !== v) : [...arr, v]);

  return (
    <div data-testid="profile-setup">
      <div className="rounded-2xl bg-cream-100 p-3 text-sm">
        <b>🤖 AI 向导：</b>用一两句话介绍你自己吧——你会什么、想找什么、在哪个区。不需要懂商业术语。
        {existing && <div className="mt-1 text-xs text-stone-600">（重新填写会替换你当前的画像）</div>}
      </div>
      <textarea data-testid="profile-input" className="input mt-2 h-24 resize-none" placeholder={`例如：${STORY_INTRO_TEXT}`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Btn onClick={() => run(text)} disabled={!text.trim()} data-testid="extract-btn">✨ 让 AI 理解我</Btn>
        <Btn tone="cream" onClick={() => { setText(STORY_INTRO_TEXT); run(STORY_INTRO_TEXT); }} data-testid="use-example">用示例：AI 视频制作人</Btn>
      </div>

      {x && (
        <Card className="mt-3 wobble-in">
          <div className="text-sm font-black">我理解到的你 👇 <span className="text-xs font-normal text-stone-600">点标签可以增删，确认后才会用于匹配</span></div>
          <div className="mt-2 space-y-2 text-xs">
            <Row label="我能提供">
              {CAPABILITIES.filter((c) => caps.includes(c.id) || x.capabilities.some((k) => k.tag === c.id)).map((c) => (
                <Toggle key={c.id} on={caps.includes(c.id)} onClick={() => toggle(caps, setCaps, c.id)}>{c.label}</Toggle>
              ))}
              <AddCap exclude={caps} onAdd={(t) => setCaps([...caps, t])} />
            </Row>
            <Row label="我需要">
              {[...new Set([...x.needs.map((n) => n.tag), ...needs])].map((t) => (
                <Toggle key={t} on={needs.includes(t)} onClick={() => toggle(needs, setNeeds, t)}>{capLabel(t)}</Toggle>
              ))}
            </Row>
            {x.suggestedNeeds.length > 0 && (
              <Row label="AI 猜你可能还需要">
                {x.suggestedNeeds.map((n) => (
                  <Toggle key={n.tag} on={sugg.includes(n.tag)} onClick={() => toggle(sugg, setSugg, n.tag)} dashed>{n.label}</Toggle>
                ))}
              </Row>
            )}
            <Row label="我的地域">
              {(Object.keys(DISTRICT_LABEL) as DistrictId[]).filter((d) => d !== 'other').map((d) => (
                <Toggle key={d} on={districts.includes(d)} onClick={() => setDistricts(districts.includes(d) ? districts.filter((x) => x !== d) : [...districts, d])}>{DISTRICT_LABEL[d]}</Toggle>
              ))}
            </Row>
            <div className="text-stone-600">{x.summary.filter((s) => s.startsWith('我希望') || s.startsWith('合作方式')).join(' · ')}
              {x.priceRange && ` · 报价 ${x.priceRange.min}–${x.priceRange.max} 元`}
            </div>
          </div>
          <input className="input mt-2" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="一句话介绍（公开展示）" />
          <Btn className="mt-3 w-full" onClick={confirm} disabled={!caps.length && !needs.length} data-testid="confirm-profile">✅ 确认，这就是我（公开给可能的伙伴）</Btn>
          <div className="mt-2"><Disclaimer>只有你确认的标签会公开并用于匹配。AI 不会读取你的聊天记录来推测隐私信息。你可以随时在「我的」里关闭“愿意被连接”。</Disclaimer></div>
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
function AddCap({ exclude, onAdd }: { exclude: string[]; onAdd: (t: string) => void }) {
  return (
    <select className="chip bg-white/70 text-stone-600" value="" onChange={(e) => e.target.value && onAdd(e.target.value)}>
      <option value="">+ 添加能力</option>
      {CAPABILITIES.filter((c) => !exclude.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select>
  );
}

const TYPE_COLOR: Record<RelationType, string> = {
  upstream: '#9DB6CA', downstream: '#E8C77A', peer: '#A9C2A0', channel: '#E6A3A7', resource: '#A47B5B',
};
const TYPE_ANGLE: Record<RelationType, number> = { downstream: -90, peer: -18, channel: 54, resource: 126, upstream: 198 };

function OpportunityMap() {
  const rels = useOpportunities();
  const focus = useTown((s) => s.focusRelation);
  const setFocus = useTown((s) => s.focus);
  const intros = useTown((s) => s.intros);
  const avatar = useTown((s) => s.avatar)!;
  const sel = rels.find((r) => r.id === focus) ?? rels[0];

  const nodes = useMemo(() => {
    const byType = new Map<RelationType, Relationship[]>();
    rels.forEach((r) => byType.set(r.type, [...(byType.get(r.type) ?? []), r]));
    const out: { r: Relationship; x: number; y: number }[] = [];
    for (const [t, list] of byType) {
      list.forEach((r, i) => {
        const a = ((TYPE_ANGLE[t] + (i - (list.length - 1) / 2) * 24) * Math.PI) / 180;
        const dist = Math.min(148, 88 + (100 - (r.score ?? 40)) * 1.3 + (i % 2) * 16);
        out.push({ r, x: 200 + Math.cos(a) * dist, y: 185 + Math.sin(a) * dist });
      });
    }
    return out;
  }, [rels]);

  if (!rels.length) return <div className="text-sm text-stone-600">暂时没有发现可能的关系。试试补充你的能力或需求？</div>;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <svg viewBox="0 0 400 370" className="w-full rounded-2xl bg-gradient-to-b from-cream-100 to-cream-200" data-testid="opportunity-svg">
          {(Object.keys(TYPE_ANGLE) as RelationType[]).map((t) => {
            const a = (TYPE_ANGLE[t] * Math.PI) / 180;
            return <text key={t} x={200 + Math.cos(a) * 172} y={185 + Math.sin(a) * 168 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={TYPE_COLOR[t]}>{RELATION_LABEL[t]}</text>;
          })}
          {nodes.map(({ r, x, y }) => {
            const connected = intros.some((i) => (i.toUserId === r.toUserId) && !['sent', 'declined'].includes(i.status));
            return (
              <line key={`l${r.id}`} x1={200} y1={185} x2={x} y2={y} stroke={TYPE_COLOR[r.type]} strokeWidth={sel?.id === r.id ? 5 : connected ? 4 : 2.5}
                strokeDasharray={connected ? undefined : '6 6'} strokeLinecap="round" opacity={sel?.id === r.id ? 1 : 0.7}
                className="cursor-pointer" onClick={() => setFocus(r.id)} />
            );
          })}
          <circle cx={200} cy={185} r={26} fill={avatar.look.body} stroke="#FFFDF8" strokeWidth={4} />
          <text x={200} y={189} textAnchor="middle" fontSize="12" fontWeight="900" fill="#4A3426">我</text>
          {nodes.map(({ r, x, y }) => {
            const p = residentById(r.toUserId)!;
            return (
              <g key={r.id} className="cursor-pointer" onClick={() => setFocus(r.id)} data-testid={`node-${r.toUserId}`}>
                <circle cx={x} cy={y} r={sel?.id === r.id ? 21 : 18} fill={p.look.body} stroke={sel?.id === r.id ? '#4A3426' : '#FFFDF8'} strokeWidth={3} />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#4A3426">{p.nickname.slice(0, 2)}</text>
                <rect x={x - 17} y={y + 20} width={34} height={14} rx={7} fill="#FFFDF8" />
                <text x={x} y={y + 30.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#7A5539">{r.score ?? '?'}{r.score !== null && '%'}</text>
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-stone-600">
          <span>虚线 = AI 推测</span><span>·</span><span>实线 = 已建立联系</span><span>·</span><span>越靠近中心匹配越高</span>
        </div>
      </div>
      {sel && <RelationDetail r={sel} />}
      <div className="lg:col-span-2"><Disclaimer>{MATCH_DISCLAIMER}</Disclaimer></div>
    </div>
  );
}

const DIM: { k: keyof Relationship['breakdown']; label: string; w: number }[] = [
  { k: 'industry', label: 'I 行业关联', w: WEIGHTS.industry },
  { k: 'complement', label: 'C 能力互补', w: WEIGHTS.complement },
  { k: 'geo', label: 'G 地域适配', w: WEIGHTS.geo },
  { k: 'budget', label: 'B 预算适配', w: WEIGHTS.budget },
  { k: 'willingness', label: 'W 合作意愿', w: WEIGHTS.willingness },
];

function RelationDetail({ r }: { r: Relationship }) {
  const p = residentById(r.toUserId)!;
  const openHello = useTown((s) => s.openHello);
  const intro = useTown((s) => s.intros.find((i) => i.toUserId === r.toUserId));
  const setTab = useTown((s) => s.setTab);
  const openChat = useTown((s) => s.openChat);
  return (
    <Card className="wobble-in" key={r.id}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-black">{p.profile.displayName}</div>
          <div className="text-xs text-stone-600">{RELATION_LABEL[r.type]} · {RELATION_HINT[r.type]}</div>
        </div>
        <Chip tone="cream">演示角色</Chip>
      </div>
      <table className="mt-2 w-full text-xs" data-testid="relation-table">
        <tbody className="[&_td]:py-1 [&_td:first-child]:w-20 [&_td:first-child]:font-bold [&_td:first-child]:text-stone-600">
          <tr><td>匹配程度</td><td>{r.score === null ? '信息不足，暂不打分' : <><b className="text-sm">{r.score}%</b>（系统估算）</>}</td></tr>
          <tr><td>推荐理由</td><td>{r.reasons.join('；')}</td></tr>
          <tr><td>可能的合作</td><td>{r.possibleCollabs.join('、')}</td></tr>
          <tr><td>信息来源</td><td>{r.source}</td></tr>
          <tr><td>需求状态</td><td><Chip tone="sakura">未确认</Chip></td></tr>
          <tr><td>推荐动作</td><td>{r.suggestedAction}</td></tr>
        </tbody>
      </table>
      <div className="mt-2 space-y-1">
        {DIM.map((d) => {
          const v = r.breakdown[d.k];
          return (
            <div key={d.k} className="flex items-center gap-2 text-[10px]">
              <span className="w-20 text-stone-600">{d.label} ×{d.w}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-200">
                {v !== null && <div className="h-full rounded-full bg-almond-400" style={{ width: `${v}%` }} />}
              </div>
              <span className="w-12 text-right tabular-nums">{v === null ? '未计分' : v}</span>
            </div>
          );
        })}
      </div>
      {r.missing.length > 0 && <div className="mt-2 text-[11px] text-brick-500">缺少信息：{r.missing.join('；')}</div>}
      <div className="mt-3 rounded-2xl bg-sakura-200/60 p-2.5">
        <div className="text-xs font-black text-brick-500">💞 商业缘分值</div>
        <ul className="mt-1 space-y-0.5 text-xs">{r.fateReasons.map((f) => <li key={f}>· {f}</li>)}</ul>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {intro ? <Btn tone="sage" onClick={() => setTab('messages')}>已联系 · 查看进度</Btn>
          : <Btn onClick={() => openHello(r.toUserId)} data-testid="detail-hello">💌 打招呼 / 发邀请函</Btn>}
        {p.opc && <Btn tone="cream" onClick={() => openChat(p.opc!.id)}>🏪 逛 TA 的小店</Btn>}
      </div>
    </Card>
  );
}

/** 创新一：AI 帮你发现你自己没有想到的生意 */
function Directions() {
  const profile = useTown((s) => s.profile)!;
  const [text, setText] = useState('');
  const [tags, setTags] = useState(profile.capabilities.map((c) => c.tag));
  const ideas = suggestDirections(tags);
  return (
    <div className="space-y-3">
      <div className="text-sm">根据你自己填写的技能、兴趣和资源，你可能有这些适合发展的商业方向：</div>
      {ideas.map((d, i) => (
        <Card key={d.title} className="!p-3">
          <div className="font-black">{i + 1}. {d.title}</div>
          <div className="text-xs text-stone-600">{d.why}</div>
        </Card>
      ))}
      <div className="rounded-2xl bg-cream-100 p-3">
        <div className="text-xs font-bold">换个角度试试：说说你会的、喜欢的、拥有的</div>
        <textarea className="input mt-1 h-16 resize-none" placeholder="例如：我会做饭。我喜欢拍视频。我认识一些社区里的老人。我有一辆车。" value={text} onChange={(e) => setText(e.target.value)} />
        <Btn size="sm" className="mt-1" onClick={() => setTags(extractProfile(text).capabilities.map((c) => c.tag))} disabled={!text.trim()}>重新探索</Btn>
      </div>
      <Disclaimer>这些是探索建议，不代表一定能赚钱，也不构成任何投资或经营建议。</Disclaimer>
    </div>
  );
}

/** 创新二：AI 帮你组建一个虚拟创业团队 */
function TeamMap() {
  const profile = useTown((s) => s.profile)!;
  const intros = useTown((s) => s.intros);
  const sayHello = useTown((s) => s.sayHello);
  const projects = [
    ...(profile.intents.includes('team_up') || profile.needs.length ? [{ owner: ME, name: '我的项目', needs: profile.needs.map((n) => n.tag) }] : []),
    ...RESIDENTS.filter((r) => r.profile.intents.includes('team_up')).map((r) => ({ owner: r.id, name: `${r.nickname}：${r.profile.headline}`, needs: r.profile.needs.map((n) => n.tag) })),
  ];
  const myCaps = profile.capabilities.map((c) => c.tag);
  return (
    <div className="space-y-3">
      {projects.map((p) => {
        const roles = p.needs.filter((t) => CAPABILITIES.some((c) => c.id === t));
        return (
          <Card key={p.owner} className="!p-3">
            <div className="font-black">{p.name}</div>
            <div className="mt-2 space-y-1.5">
              {roles.length === 0 && <div className="text-xs text-stone-600">还没有列出需要的角色</div>}
              {roles.map((role) => {
                const cands = RESIDENTS.filter((r) => r.id !== p.owner && r.profile.capabilities.some((c) => c.tag === role));
                const iFit = p.owner !== ME && myCaps.includes(role);
                const joined = intros.some((i) => i.toUserId === p.owner);
                return (
                  <div key={role} className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Chip tone="sakura">需要 · {capLabel(role)}</Chip>
                    {cands.map((c) => <Chip key={c.id} tone="haze">{c.nickname}</Chip>)}
                    {iFit && <Chip tone="almond">⭐ 你也符合</Chip>}
                    {iFit && !joined && (
                      <Btn size="sm" onClick={() => sayHello(p.owner, `嗨，我看到你的项目需要「${capLabel(role)}」，我愿意加入这个项目，要不要聊聊？`)}>我愿意加入这个项目</Btn>
                    )}
                    {cands.length === 0 && !iFit && <span className="text-stone-400">暂时没有找到合适的人</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      <Disclaimer>组队需要双方确认。AI 只根据公开能力标签列出候选人，不代表对方已同意加入。</Disclaimer>
    </div>
  );
}

/** 创新三：每个人都有一张自己的商业成长地图 —— 根据真实进展更新 */
function GrowthMap() {
  const profile = useTown((s) => s.profile);
  const myOpc = useTown((s) => s.myOpc);
  const intros = useTown((s) => s.intros);
  const accepted = intros.filter((i) => !['sent', 'declined'].includes(i.status));
  const steps = [
    { t: '发现自己能够提供什么', done: !!profile?.capabilities.length },
    { t: '建立个人工作室', done: !!myOpc },
    { t: '找到第一个合作伙伴', done: accepted.length > 0 },
    { t: '完成第一个客户项目', done: intros.some((i) => i.status === 'collab_confirmed') },
    { t: '建立稳定的上下游关系', done: accepted.length >= 3 },
    { t: '组建自己的小团队', done: intros.filter((i) => i.status === 'collab_confirmed').length >= 3 },
  ];
  const cur = steps.findIndex((s) => !s.done);
  return (
    <div className="relative space-y-2 pl-6" data-testid="growth-map">
      <div className="absolute bottom-3 left-[11px] top-3 w-1 rounded-full bg-cream-300" />
      {steps.map((s, i) => (
        <div key={s.t} className="relative">
          <span className={`absolute -left-6 top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-black ${s.done ? 'bg-sage-400 text-white' : i === cur ? 'bg-almond-400 text-cocoa-800 animate-pulse' : 'bg-cream-200 text-stone-400'}`}>{s.done ? '✓' : i + 1}</span>
          <Card className={`!p-3 ${i === cur ? 'ring-2 ring-almond-400' : ''}`}>
            <div className={`text-sm font-bold ${s.done ? 'text-sage-700' : ''}`}>第{i + 1}步：{s.t}</div>
          </Card>
        </div>
      ))}
      <div className="pt-1"><Disclaimer>“完成客户项目”只统计双方本人确认的合作记录。</Disclaimer></div>
    </div>
  );
}
