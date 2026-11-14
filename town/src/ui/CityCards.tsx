import { archiveById } from '../data/archives';
import { useState } from 'react';
import { SPONSOR_TIERS, isGolden, lotPlan } from '../domain/lots';
import { exampleById } from '../data/examples';
import { ROLE_COLORS, ROLE_DARK, ROLE_TINT } from '../domain/palette';
import { useLots } from '../store/useLots';
import { placeOfLot, useWork } from '../store/useWork';
import { COUNTERPARTIES, entityById, residentById, shopOfEntity } from '../data/seed';
import { BIZ_LABEL, ENTITY_KIND_LABEL, relationsWith } from '../domain/commerce';
import { capLabel, industryLabel } from '../domain/taxonomy';
import { allLots, districtName } from '../world';
import { streetOfDistrict, useTown } from '../store/useTown';
import { LIFE_TAG_LABEL, identityOf } from '../domain/identity';
import { Btn, Chip, Disclaimer, Pill, Panel } from './kit';

const REVIEW = { draft: '建模草稿', pending_review: '待人工审核', approved: '已审核' } as const;

export function CityCards() {
  const card = useTown((s) => s.card);
  const tab = useTown((s) => s.tab);
  if (tab !== 'city' || !card) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-24 z-20 flex justify-center md:inset-x-auto md:bottom-auto md:right-3 md:top-[10.5rem] md:max-h-[calc(100vh-17rem)] md:w-96">
      {card.kind === 'resident' && <ResidentCard id={card.id} />}
      {card.kind === 'entity' && <EntityCard id={card.id} />}
      {card.kind === 'landmark' && <LandmarkCard id={card.id} />}
      {card.kind === 'lot' && <LotCard id={card.id} />}
      {card.kind === 'example' && <ExampleCard id={card.id} />}
      {card.kind === 'door' && <DoorCard label={card.label} />}
    </div>
  );
}

function ResidentCard({ id }: { id: string }) {
  const r = residentById(id)!;
  const e = entityById(r.entityId)!;
  const profile = useTown((s) => s.profile);
  const openCard = useTown((s) => s.openCard);
  const openHello = useTown((s) => s.openHello);
  const openChat = useTown((s) => s.openChat);
  const setTab = useTown((s) => s.setTab);
  const setBiz = useTown((s) => s.setBiz);
  const intro = useTown((s) => s.intros.find((i) => i.toUserId === id));
  const rels = profile ? relationsWith(profile, e, streetOfDistrict) : [];
  const shop = shopOfEntity(e.id);
  const tag = { emoji: identityOf(r.lifeTag).emoji, label: LIFE_TAG_LABEL[r.lifeTag] };
  return (
    <Panel testId="resident-card" title={<span>{r.nickname} <span className="text-sm font-semibold text-stone-600">{tag?.emoji} {tag?.label}</span></span>} subtitle={e.name} onClose={() => openCard(undefined)} className="w-full max-w-md">
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="cream">演示角色</Pill><Pill tone={r.online ? 'sage' : 'cream'}>{r.online ? '在线' : '离线'}</Pill>
        <Pill tone="haze">{ENTITY_KIND_LABEL[e.kind]}</Pill>
      </div>
      <p className="mt-2 text-sm">{r.bio} {e.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {e.capabilities.map((c) => <Chip key={c} tone="haze">能提供 · {capLabel(c)}</Chip>)}
        {e.publishedNeeds.map((n) => <Chip key={n.tag} tone="sakura">已发布需求 · {n.detail ?? capLabel(n.tag)}</Chip>)}
      </div>
      <div className="mt-3 rounded-2xl bg-almond-300/40 p-3 text-sm" data-testid="ai-oneliner">
        <div className="text-xs font-black text-cocoa-600">和你的生意有什么关系？</div>
        {!profile ? <div className="mt-1">先在「我的生意」告诉 AI 你能提供什么。<Btn size="sm" className="mt-2 block" onClick={() => setTab('biz')}>去告诉 AI</Btn></div>
          : rels.length ? rels.map((x) => <div key={x.id} className="mt-1"><b>{BIZ_LABEL[x.type]}</b>（{x.score ?? '信息不足'}{x.score !== null && '%'}）：{x.answers.why}</div>)
          : <div className="mt-1">暂时没有发现业务上的关系，交个朋友也很好。</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {rels.length > 0 && !intro && <Btn onClick={() => openHello(id)} data-testid="hello-btn">💌 打个招呼</Btn>}
        {intro && <Btn tone="sage" onClick={() => setTab('messages')}>已联系 · 看进度</Btn>}
        {rels[0] && <Btn tone="cream" onClick={() => { setBiz(rels[0].type, rels[0].id); setTab('biz'); }}>查看商业详情</Btn>}
        {shop && <Btn tone="haze" onClick={() => openChat(shop.id)}>🏪 进 TA 的店</Btn>}
      </div>
    </Panel>
  );
}

/** 经营主体名片（店铺 / 未入驻商家） */
function EntityCard({ id }: { id: string }) {
  const e = entityById(id)!;
  const profile = useTown((s) => s.profile);
  const openCard = useTown((s) => s.openCard);
  const saveLead = useTown((s) => s.saveLead);
  const saved = useTown((s) => s.savedLeads.includes(id));
  const setTab = useTown((s) => s.setTab);
  const setBiz = useTown((s) => s.setBiz);
  const rels = profile ? relationsWith(profile, e, streetOfDistrict) : [];
  return (
    <Panel testId="entity-card" title={e.name} subtitle={`${districtName(e.place.district)} · ${e.place.street}`} onClose={() => openCard(undefined)} className="w-full max-w-md">
      <div className="flex flex-wrap gap-1.5"><Pill tone="cream">{ENTITY_KIND_LABEL[e.kind]}</Pill><Pill tone="cream">演示数据</Pill>{e.industries.map((i) => <Pill key={i} tone="haze">{industryLabel(i)}</Pill>)}</div>
      <p className="mt-2 text-sm">{e.summary}</p>
      {e.kind === 'prospect' && <div className="mt-2"><Disclaimer>该商家尚未入驻平台，这里只展示公开的商业信息（演示）。平台不会把它包装成会员，也无法代你联系对方。</Disclaimer></div>}
      {rels.map((r) => (
        <div key={r.id} className="mt-2 rounded-xl bg-almond-300/40 p-2 text-xs">
          <b>{BIZ_LABEL[r.type]} {r.score ?? '—'}%</b> · {r.answers.need}
          <div className="text-stone-600">{r.answers.why}</div>
        </div>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        {e.place.lotId && placeOfLot(e.place.lotId) && <Btn tone="sage" data-testid="entity-counter" onClick={() => { openCard(undefined); useWork.getState().openCounter(e.place.lotId); }}>🛍️ 进店消费 / 打短工</Btn>}
        <Btn tone="cream" disabled={saved} onClick={() => saveLead(id)}>{saved ? '已收藏线索' : '⭐ 收藏为线索'}</Btn>
        {rels[0] && <Btn tone="cream" onClick={() => { setBiz(rels[0].type, rels[0].id); setTab('biz'); }}>在「我的生意」中查看</Btn>}
      </div>
    </Panel>
  );
}

/** 【例】示范 OPC：一家完整的 OPC 店长什么样（全部为虚构示例） */
function ExampleCard({ id }: { id: string }) {
  const e = exampleById(id)!;
  const openCard = useTown((s) => s.openCard);
  const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <div className="mt-3"><div className="text-xs font-black text-cocoa-800">{t}</div><div className="mt-1 text-xs text-stone-700">{children}</div></div>
  );
  return (
    <Panel testId="example-card" title={<span><span data-testid="example-badge" className="mr-1 rounded px-1 align-middle text-xs font-black text-white" style={{ background: ROLE_COLORS.example }}>例</span>{e.name}</span>}
      subtitle={`${e.direction} · ${e.tagline}`} onClose={() => openCard(undefined)} className="max-h-[60vh] w-full max-w-md md:max-h-[calc(100vh-17rem)]">
      <div className="flex flex-wrap gap-1.5"><Pill tone="haze">示范 OPC · 虚构示例</Pill><Pill tone="cream">主理人 {e.owner.nickname}</Pill><Pill tone="cream">{e.direction}</Pill></div>
      <div className="mt-2 rounded-2xl p-2 text-[11px]" style={{ background: ROLE_TINT.example, color: ROLE_DARK.example }}>这是一家【例】示范店（粉色 = 系统设置，无法交易），用来展示一家完整的 OPC 小店应该写清楚哪些内容。店名、主理人、案例与数据都是虚构的，不进入产业链，也不能下单。</div>
      <Sec t="公司简介"><p>{e.about}</p><p className="mt-1 text-stone-500">{e.status}</p></Sec>
      <Sec t="主理人">{e.owner.nickname} · {e.owner.title}</Sec>
      <Sec t="亮点"><ul className="list-disc pl-4">{e.highlights.map((h) => <li key={h}>{h}</li>)}</ul></Sec>
      <Sec t="产品 / 服务与价格">
        <div className="grid gap-1.5" data-testid="example-products">
          {e.products.map((p) => (
            <div key={p.name} className="flex items-start justify-between gap-2 rounded-xl bg-cream-100 px-3 py-1.5">
              <span><b>{p.name}</b> · {p.desc}</span><span className="shrink-0 font-bold text-cocoa-600">{p.price}</span>
            </div>
          ))}
        </div>
      </Sec>
      <Sec t="服务流程">{e.process.map((x, i) => <span key={x}>{i ? ' → ' : ''}{x}</span>)}</Sec>
      <Sec t="案例">{e.cases.map((c) => <div key={c}>· {c}</div>)}</Sec>
      <Sec t="常用工具"><div className="flex flex-wrap gap-1">{e.tools.map((t) => <Chip key={t} tone="cream">{t}</Chip>)}</div></Sec>
      <Sec t="常见问题">{e.faqs.map((f) => <div key={f.q} className="mt-1"><b>问：{f.q}</b><div>答：{f.a}</div></div>)}</Sec>
      <Sec t="正在寻找">{e.lookingFor.join('、')}</Sec>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn tone="cream" onClick={() => { openCard(undefined); useTown.getState().setWizard(true); }}>照着它，开一家我的小店</Btn>
      </div>
    </Panel>
  );
}

function LandmarkCard({ id }: { id: string }) {
  const a = archiveById(id)!;
  const openCard = useTown((s) => s.openCard);
  return (
    <Panel testId="building-card" title={a.name} subtitle={a.nameEn} onClose={() => openCard(undefined)} className="w-full max-w-md">
      <div className="flex flex-wrap gap-1.5"><Pill tone="sakura">模型 {a.modelVersion} · {REVIEW[a.reviewStatus]}</Pill>{!a.commercial && <Pill tone="cream">文保 / 参观，不设商业铺位</Pill>}</div>
      <p className="mt-2 text-sm">{a.story}</p>
      <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs">
        <dt className="text-stone-400">地址</dt><dd>{a.address}</dd>
        <dt className="text-stone-400">年代</dt><dd>{a.era}</dd>
        {a.architect && (<><dt className="text-stone-400">建筑师</dt><dd>{a.architect}</dd></>)}
        <dt className="text-stone-400">风格</dt><dd>{a.style}</dd>
        <dt className="text-stone-400">立面特征</dt><dd>{a.features.join('；')}</dd>
        <dt className="text-stone-400">坐标</dt><dd>{a.geo.lat.toFixed(4)}, {a.geo.lng.toFixed(4)}（{a.geo.crs}，近似值）</dd>
      </dl>
      <div className="mt-2"><Disclaimer>{a.reviewNotes}</Disclaimer></div>
    </Panel>
  );
}

function LotCard({ id }: { id: string }) {
  const lot = allLots().find((l) => l.door.lotId === id)!;
  const openCard = useTown((s) => s.openCard);
  const myOpc = useTown((s) => s.myOpc);
  const setWizard = useTown((s) => s.setWizard);
  const nearby = COUNTERPARTIES.filter((c) => c.place.district === lot.district && c.kind !== 'individual').length;
  const plan = lotPlan(lot.district);
  if (isGolden(id)) return <GoldenCard id={id} />;
  return (
    <Panel testId="lot-card" title="空铺 · 招租" subtitle={`${districtName(lot.district)} · ${lot.street} · 铺位 ${id}`} onClose={() => openCard(undefined)} className="w-full max-w-md">
      <p className="text-sm">这里是 <b>OPC 招租位</b>，还空着。无论有没有营业执照都可以开店（有执照的店铺显示「企」角标）。这条街上已有 {nearby} 个经营主体。</p>
      <div className="mt-2 text-xs text-stone-600" data-testid="lot-plan">本街区共 {plan.total} 个铺位：OPC 招租位 {plan.opc.length} 个（60%）· 黄金赞助位 {plan.golden.length} 个（40%）</div>
      <div className="mt-3">
        {myOpc ? <div className="text-xs text-stone-600">你已经有一家小店「{myOpc.name}」（第一版每人一家）。</div>
          : <Btn onClick={() => { openCard(undefined); setWizard(true, id); }} data-testid="open-wizard">🏪 在这里开店</Btn>}
      </div>
    </Panel>
  );
}

/** 黄金位：赞助商专属，OPC 不能在这里开店 */
function GoldenCard({ id }: { id: string }) {
  const lot = allLots().find((l) => l.door.lotId === id)!;
  const openCard = useTown((s) => s.openCard);
  const sponsor = useLots((s) => s.sponsorOf(id));
  const apply = useLots((s) => s.applySponsor);
  const plan = lotPlan(lot.district);
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<'season' | 'year'>('season');
  const [company, setCompany] = useState('');
  const [code, setCode] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string[]>([]);
  const STATUS = { live: '已上线', reviewing: '资质审核中', awaiting_payment: '待对公付款' } as const;
  return (
    <Panel testId="golden-card" title={sponsor ? `🏅 ${sponsor.name}` : '🏅 黄金位 · 赞助招商'} subtitle={`${districtName(lot.district)} · ${lot.street} · 铺位 ${id}`} onClose={() => openCard(undefined)} className="w-full max-w-md">
      <div className="text-xs text-stone-600" data-testid="lot-plan">本街区 {plan.total} 个铺位中，40%（{plan.golden.length} 个）是黄金位：离街区入口近、在主街或路口，留给赞助商付资金赞助；赞助资金用于街区运营与社区活动。OPC 请到「OPC 招租」铺位开店。</div>
      {sponsor ? (
        <div className="mt-2 rounded-2xl bg-almond-300/50 p-3 text-sm">
          <b>{sponsor.name}</b> · {SPONSOR_TIERS.find((t) => t.id === sponsor.tier)?.name} · <span data-testid="sponsor-status">{STATUS[sponsor.status]}</span>
          <div className="text-xs text-stone-600">赞助期至 {new Date(sponsor.until).toLocaleDateString()}{sponsor.demo ? '（演示赞助商）' : ''}；招牌显示「赞」角标，明确标注为赞助。</div>
        </div>
      ) : (
        <>
          <div className="mt-2 grid gap-2">
            {SPONSOR_TIERS.map((t) => (
              <button key={t.id} onClick={() => setTier(t.id)} className={`rounded-2xl p-2.5 text-left text-xs ring-1 ${tier === t.id ? 'bg-almond-300 ring-almond-500' : 'bg-cream-100 ring-cream-300'}`}>
                <b>{t.name} · ¥{t.price.toLocaleString()}</b>（{t.months} 个月）<div className="text-stone-600">{t.perks.join(' · ')}</div>
              </button>
            ))}
          </div>
          {!open ? <Btn className="mt-3" data-testid="sponsor-open" onClick={() => setOpen(true)}>💰 申请赞助这个黄金位</Btn> : (
            <div className="mt-3 grid gap-1.5" data-testid="sponsor-form">
              <input className="input" data-testid="sp-company" placeholder="赞助企业全称" value={company} onChange={(e) => setCompany(e.target.value)} />
              <input className="input" data-testid="sp-code" placeholder="统一社会信用代码（18 位）" maxLength={18} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <div className="grid grid-cols-2 gap-1.5"><input className="input" data-testid="sp-contact" placeholder="联系人" value={contact} onChange={(e) => setContact(e.target.value)} /><input className="input" data-testid="sp-phone" placeholder="手机号" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} /></div>
              {err.length > 0 && <div className="text-xs text-brick-500" data-testid="sp-errors">{err.join('；')}</div>}
              <Btn data-testid="sp-submit" onClick={() => setErr(apply({ lotId: id, company, code, contact, phone, tier }))}>提交赞助申请</Btn>
              <Disclaimer>流程：提交申请 → 平台审核企业资质 → 签约并对公付款 → 黄金位上线。演示版不会真实扣款。</Disclaimer>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function DoorCard({ label }: { label: string }) {
  const openCard = useTown((s) => s.openCard);
  return (
    <Panel title={label} subtitle="住宅 / 公共建筑入口" onClose={() => openCard(undefined)} className="w-full max-w-md">
      <p className="text-sm text-stone-600">这是居民楼或公共建筑的入口，游戏里不进入室内。</p>
    </Panel>
  );
}
