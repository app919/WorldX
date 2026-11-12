import { ECONOMY_NOTICE } from '../domain/economy';
import { useTown } from '../store/useTown';
import { LIFE_TAGS } from './Onboarding';
import { Btn, Card, Chip, Disclaimer, Drawer } from './kit';

export function MePanel() {
  const avatar = useTown((s) => s.avatar)!;
  const wallet = useTown((s) => s.wallet);
  const profile = useTown((s) => s.profile);
  const myOpc = useTown((s) => s.myOpc);
  const agent = useTown((s) => s.myAgent);
  const audit = useTown((s) => s.audit);
  const setLifeTag = useTown((s) => s.setLifeTag);
  const setTab = useTown((s) => s.setTab);
  const updateAgent = useTown((s) => s.updateAgent);
  const setWizard = useTown((s) => s.setWizard);
  const openChat = useTown((s) => s.openChat);
  const marketing = useTown((s) => s.marketingOptIn);
  const setMarketing = useTown((s) => s.setMarketing);
  const setOpen = useTown((s) => s.setOpenToConnect);
  const reset = useTown((s) => s.reset);

  return (
    <Drawer testId="me-panel" title={`🧸 ${avatar.nickname}`} subtitle="角色 · OPC · AI 分身 · 隐私设置" onClose={() => setTab('city')}>
      <div className="space-y-3">
        <Card className="!p-3">
          <div className="text-xs font-bold text-stone-600">我的生活标签（随时可换，不是职业审核）</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LIFE_TAGS.map((t) => (
              <button key={t.tag} onClick={() => setLifeTag(t.tag)} className={`chip ${avatar.lifeTag === t.tag ? 'bg-almond-400' : 'bg-cream-100 text-stone-600'}`}>{t.emoji} {t.label}</button>
            ))}
          </div>
        </Card>

        <Card className="!p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black">我的成长</div>
            <div className="flex gap-2 text-sm font-bold"><span>⭐ {wallet.stars}</span><span className="text-sage-700">🌱 {wallet.growth}</span></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {wallet.badges.map((b) => <Chip key={b} tone="almond">🏅 {b}</Chip>)}
            {wallet.stickers.map((b) => <Chip key={b} tone="sakura">🏷️ {b}</Chip>)}
            {!wallet.badges.length && !wallet.stickers.length && <span className="text-xs text-stone-400">去街上打卡、认识朋友吧～</span>}
          </div>
          <div className="mt-2"><Disclaimer>{ECONOMY_NOTICE}</Disclaimer></div>
        </Card>

        <Card className="!p-3">
          <div className="text-sm font-black">我的 OPC</div>
          {myOpc ? (
            <div className="mt-1 text-xs">
              <div className="font-bold">{myOpc.name}</div>
              <div className="text-stone-600">{myOpc.tagline}</div>
              <div className="mt-2 flex gap-2"><Btn size="sm" tone="haze" onClick={() => openChat(myOpc.id)}>以访客身份试试我的 AI 分身</Btn></div>
            </div>
          ) : (
            <div className="mt-1 text-xs text-stone-600">
              你还没有小店。不开店也完全可以玩～
              <Btn size="sm" className="mt-2 block" onClick={() => setWizard(true)}>🏪 五分钟开店</Btn>
            </div>
          )}
        </Card>

        {agent && (
          <Card className="!p-3" >
            <div className="text-sm font-black">🤖 AI 分身设置</div>
            <div className="mt-2 grid gap-1.5 text-xs">
              <label className="flex items-center gap-2"><input type="checkbox" checked={agent.ownerOnline} onChange={(e) => updateAgent({ ownerOnline: e.target.checked })} /> 我现在在线（离线时由 AI 分身接待）</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={agent.autoReception} onChange={(e) => updateAgent({ autoReception: e.target.checked })} /> 自动接待访客</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={agent.enabledLevels.L2} onChange={(e) => updateAgent({ enabledLevels: { L1: true, L2: e.target.checked } })} /> 允许 L2：收集需求、推荐服务、预约会议</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={agent.ownerTakeover} onChange={(e) => updateAgent({ ownerTakeover: e.target.checked })} /> 我亲自接管对话（AI 立即停止回复）</label>
              <div className="text-stone-400">L3（最终报价、折扣、合同、交付承诺、退款）永远需要你本人确认，不可授权给 AI。</div>
            </div>
          </Card>
        )}

        <Card className="!p-3">
          <div className="text-sm font-black">隐私与推荐</div>
          <div className="mt-2 grid gap-1.5 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!profile?.openToConnect} disabled={!profile} onChange={(e) => setOpen(e.target.checked)} /> 愿意被 AI 推荐给潜在伙伴</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> 接收赞助活动推荐（关闭不影响基础游戏体验）</label>
          </div>
        </Card>

        <Card className="!p-3">
          <div className="text-sm font-black">操作记录（审计日志）</div>
          <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-[10px] text-stone-600 scroll-soft" data-testid="audit-log">
            {audit.length === 0 && <div>暂无</div>}
            {audit.map((a) => <div key={a.id}>{new Date(a.at).toLocaleTimeString('zh-CN')} · {a.actor} · {a.action}{a.target ? ` → ${a.target}` : ''}</div>)}
          </div>
        </Card>
        <Btn tone="cream" size="sm" onClick={reset}>重置演示数据</Btn>
      </div>
    </Drawer>
  );
}
