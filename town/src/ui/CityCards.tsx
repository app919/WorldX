import { archiveById } from '../data/archives';
import { placeOfLot, useWork } from '../store/useWork';
import { COUNTERPARTIES, entityById, residentById, shopOfEntity } from '../data/seed';
import { BIZ_LABEL, ENTITY_KIND_LABEL, relationsWith } from '../domain/commerce';
import { capLabel, industryLabel } from '../domain/taxonomy';
import { allLots, districtName } from '../world';
import { streetOfDistrict, useTown } from '../store/useTown';
import { LIFE_TAGS } from './Onboarding';
import { Btn, Chip, Disclaimer, Pill, Panel } from './kit';

const REVIEW = { draft: '建模草稿', pending_review: '待人工审核', approved: '已审核' } as const;

export function CityCards() {
  const card = useTown((s) => s.card);
  const tab = useTown((s) => s.tab);
  if (tab !== 'city' || !card) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-24 z-20 flex justify-center md:inset-x-auto md:bottom-auto md:right-3 md:top-24 md:w-96">
      {card.kind === 'resident' && <ResidentCard id={card.id} />}
      {card.kind === 'entity' && <EntityCard id={card.id} />}
      {card.kind === 'landmark' && <LandmarkCard id={card.id} />}
      {card.kind === 'lot' && <LotCard id={card.id} />}
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
  const tag = LIFE_TAGS.find((t) => t.tag === r.lifeTag);
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
  return (
    <Panel testId="lot-card" title="空铺 · 招租" subtitle={`${districtName(lot.district)} · ${lot.street} · 铺位 ${id}`} onClose={() => openCard(undefined)} className="w-full max-w-md">
      <p className="text-sm">这里还空着。免费创建个人创业主页，就能在这条街拥有自己的小店。这条街上已有 {nearby} 个经营主体。</p>
      <div className="mt-3">
        {myOpc ? <div className="text-xs text-stone-600">你已经有一家小店「{myOpc.name}」（第一版每人一家）。</div>
          : <Btn onClick={() => { openCard(undefined); setWizard(true, id); }} data-testid="open-wizard">🏪 在这里开店</Btn>}
      </div>
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
