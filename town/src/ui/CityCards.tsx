import { GAME_LANDMARKS, SHOP_LOTS } from '../data/buildings';
import { realDistanceMeters } from '../data/geo';
import { matchPair, RELATION_LABEL } from '../domain/matching';
import { capLabel } from '../domain/taxonomy';
import { playerRuntime, residentAnchor, residentById, useTown } from '../store/useTown';
import { LIFE_TAGS } from './Onboarding';
import { Btn, Chip, Disclaimer, Panel } from './kit';

const REVIEW_LABEL = { draft: '建模草稿', pending_review: '待人工审核', approved: '已审核' } as const;

export function CityCards() {
  const b = useTown((s) => s.selectedBuilding);
  const r = useTown((s) => s.selectedResident);
  const lot = useTown((s) => s.selectedLot);
  const tab = useTown((s) => s.tab);
  if (tab !== 'city') return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-24 z-20 flex justify-center md:inset-x-auto md:bottom-auto md:right-3 md:top-28 md:w-96">
      {b && <BuildingCard id={b} />}
      {r && <ResidentCard id={r} />}
      {lot && <LotCard id={lot} />}
    </div>
  );
}

function BuildingCard({ id }: { id: string }) {
  const b = GAME_LANDMARKS.find((x) => x.id === id)!;
  const select = useTown((s) => s.select);
  const visited = useTown((s) => s.visited.includes(id));
  const dist = Math.round(realDistanceMeters(playerRuntime, b.pos));
  return (
    <Panel testId="building-card" title={b.name} subtitle={b.nameEn} onClose={() => select(null)} className="w-full max-w-md">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="haze">{b.businessRole}</Chip>
        <Chip tone={b.reviewStatus === 'approved' ? 'sage' : 'sakura'}>模型 {b.modelVersion} · {REVIEW_LABEL[b.reviewStatus]}</Chip>
        {visited && <Chip tone="almond">已打卡 ⭐</Chip>}
      </div>
      <p className="mt-3 text-sm leading-relaxed">{b.story}</p>
      <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs">
        <dt className="text-stone-400">地址</dt><dd>{b.address}</dd>
        <dt className="text-stone-400">年代</dt><dd>{b.era}</dd>
        {b.architect && (<><dt className="text-stone-400">建筑师</dt><dd>{b.architect}</dd></>)}
        <dt className="text-stone-400">风格</dt><dd>{b.style}</dd>
        <dt className="text-stone-400">立面特征</dt><dd>{b.facadeFeatures.join('；')}</dd>
        <dt className="text-stone-400">坐标</dt><dd>{b.geo.lat.toFixed(4)}, {b.geo.lng.toFixed(4)}（{b.geo.crs}，近似值）</dd>
        <dt className="text-stone-400">离你</dt><dd>约 {dist} 米（按微缩比例换算）</dd>
      </dl>
      <div className="mt-3"><Disclaimer>{b.reviewNotes}</Disclaimer></div>
    </Panel>
  );
}

function ResidentCard({ id }: { id: string }) {
  const r = residentById(id)!;
  const profile = useTown((s) => s.profile);
  const select = useTown((s) => s.select);
  const setTab = useTown((s) => s.setTab);
  const openHello = useTown((s) => s.openHello);
  const openChat = useTown((s) => s.openChat);
  const setWalkTarget = useTown((s) => s.setWalkTarget);
  const focus = useTown((s) => s.focus);
  const intro = useTown((s) => s.intros.find((i) => i.toUserId === id || i.fromUserId === id));
  const rel = profile ? matchPair(profile, r.profile) : null;
  const tag = LIFE_TAGS.find((t) => t.tag === r.lifeTag);

  return (
    <Panel testId="resident-card" title={<span>{r.nickname} <span className="text-sm font-semibold text-stone-600">{tag?.emoji} {tag?.label}</span></span>} subtitle={r.profile.headline} onClose={() => select(null)} className="w-full max-w-md">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="cream">演示角色</Chip>
        <Chip tone={r.online ? 'sage' : 'cream'}>{r.online ? '在线' : '离线'}</Chip>
        {r.profile.capabilities.map((c) => <Chip key={c.tag} tone="haze">能提供 · {c.label}</Chip>)}
        {r.profile.needs.map((n) => <Chip key={n.tag} tone="sakura">在找 · {capLabel(n.tag)}</Chip>)}
      </div>
      <p className="mt-3 text-sm leading-relaxed">{r.bio}</p>

      <div className="mt-3 rounded-2xl bg-almond-300/40 p-3" data-testid="ai-oneliner">
        <div className="text-xs font-black text-cocoa-600">✨ AI 小声说</div>
        {!profile ? (
          <div className="mt-1 text-sm">告诉 AI 你会什么、在找什么，看看你们有没有合作的可能～
            <Btn size="sm" className="mt-2 block" onClick={() => setTab('map')}>去告诉 AI</Btn>
          </div>
        ) : rel ? (
          <div className="mt-1 text-sm">
            根据双方的业务标签，系统推测你们可能是 <b>{RELATION_LABEL[rel.type]}</b> 关系（匹配 {rel.score ?? '信息不足'}{rel.score !== null && '%，系统估算'}）。
            <div className="mt-1 text-xs text-stone-600">{rel.reasons[0]}</div>
          </div>
        ) : (
          <div className="mt-1 text-sm">暂时没发现明显的合作点，不过交个朋友也很好呀 💗</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {rel && !intro && <Btn onClick={() => openHello(id)} data-testid="hello-btn">💌 打个招呼</Btn>}
        {intro && <Btn tone="cream" onClick={() => setTab('messages')}>查看连接进度</Btn>}
        {rel && <Btn tone="cream" onClick={() => { setTab('map'); focus(rel.id); }}>为什么推荐？</Btn>}
        {r.opc && <Btn tone="haze" onClick={() => openChat(r.opc!.id)} data-testid="visit-shop">🏪 逛 TA 的小店</Btn>}
        <Btn tone="cream" onClick={() => { const a = residentAnchor(r); setWalkTarget(a); }}>走过去</Btn>
      </div>
      {rel && <div className="mt-3"><Disclaimer>推荐基于双方公开的业务介绍，对方的需求状态：未确认。</Disclaimer></div>}
    </Panel>
  );
}

function LotCard({ id }: { id: string }) {
  const lot = SHOP_LOTS.find((l) => l.id === id)!;
  const select = useTown((s) => s.select);
  const myOpc = useTown((s) => s.myOpc);
  const setWizard = useTown((s) => s.setWizard);
  return (
    <Panel title="空铺" subtitle={`${lot.road} · 铺位 ${lot.id}`} onClose={() => select(null)} className="w-full max-w-md">
      <p className="text-sm">这里还空着。免费创建一个个人创业主页，就能在街上拥有自己的小店。</p>
      <div className="mt-3">
        {myOpc ? <div className="text-xs text-stone-600">你已经有一家小店「{myOpc.name}」啦（第一版每人一家）。</div>
          : <Btn onClick={() => { useTown.setState({ selectedLot: undefined }); setWizard(true); try { sessionStorage.setItem('preferredLot', id); } catch { /* ignore */ } }} data-testid="open-wizard">🏪 五分钟开店</Btn>}
      </div>
    </Panel>
  );
}
