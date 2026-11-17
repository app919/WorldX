import { ECONOMY_NOTICE } from '../domain/economy';
import { useServer } from '../store/useServer';
import { api, clearLocalState } from '../net/api';
import { useCenter } from '../store/useCenter';
import { useWork } from '../store/useWork';
import { useTown } from '../store/useTown';
import { LOW_GFX, ULTRA_GFX, setLowGfx, setUltraGfx } from '../scene/quality';
import { LIFE_TAGS } from './Onboarding';
import { Btn, Card, Chip, Disclaimer, Drawer } from './kit';
import { Suspense, lazy, useState } from 'react';
import { ShopMediaManager } from './ShopMediaManager';

const AdminAppLazy = lazy(async () => {
  const [{ AdminApp, setAdminAdapter }, { demoAdminApi }] = await Promise.all([import('../admin/AdminApp'), import('../admin/demoAdapter')]);
  setAdminAdapter(demoAdminApi);
  return { default: AdminApp };
});

/** 管理后台入口：正式版管理员直接打开 /admin.html；离线演示版在游戏里打开同一套界面（演示数据） */
function AdminEntry() {
  const mode = useServer((s) => s.mode);
  const me = useServer((s) => s.me);
  const [demo, setDemo] = useState(false);
  if (mode === 'online' && me?.role !== 'admin') return null;
  return (
    <Card className="!p-3">
      <div className="text-sm font-black">🛠️ 管理后台</div>
      <div className="mt-1 text-xs text-stone-600">数据看板（注册 / 活跃 / PV·UV / 点击）、消息审查、店铺治理（下架商品与视频、关店整改，并给店主发委婉的整改提醒）、审计日志。</div>
      {mode === 'online'
        ? <Btn size="sm" className="mt-2" data-testid="open-admin" onClick={() => window.open('/admin.html', '_blank')}>打开管理后台</Btn>
        : <><Btn size="sm" className="mt-2" data-testid="open-admin-demo" onClick={() => setDemo(true)}>打开管理后台（演示）</Btn>
          <div className="mt-1 text-[10px] text-stone-400">离线演示用的是演示数据。正式版：用 ADMIN_PHONES 里配置的手机号登录后，访问 /admin.html。</div></>}
      {demo && (
        <div className="pointer-events-auto fixed inset-0 z-[90] overflow-y-auto bg-white" data-testid="admin-demo">
          <button className="fixed right-3 top-3 z-[91] rounded-full bg-stone-800 px-3 py-1 text-sm text-white" onClick={() => setDemo(false)}>✕ 回到游戏</button>
          <div className="bg-[#FFF4D6] px-4 py-1.5 text-xs text-[#7A5A12]">离线演示 · 以下为演示数据，操作只在本次打开期间生效，不会影响任何真实用户</div>
          <Suspense fallback={<div className="p-8 text-sm">正在打开管理后台…</div>}><AdminAppLazy /></Suspense>
        </div>
      )}
    </Card>
  );
}

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
  const lifeOn = useWork((s) => s.enabled);
  const account = useServer((s) => s.me);
  const opsOn = useCenter((s) => s.opsMode);
  const setOps = useCenter((s) => s.setOps);
  const setLife = useWork((s) => s.setEnabled);
  const setMarketing = useTown((s) => s.setMarketing);
  const setOpen = useTown((s) => s.setOpenToConnect);
  const reset = useTown((s) => s.reset);

  return (
    <Drawer testId="me-panel" title={`🧸 ${avatar.nickname}`} subtitle="角色 · OPC · AI 分身 · 隐私设置" onClose={() => setTab('city')}>
      <div className="space-y-3">
        <AdminEntry />
        {myOpc && <ShopMediaManager />}
        <Card className="!p-3">
          <div className="text-xs font-bold text-stone-600">我的身份（随时可换，不是职业审核；着装跟身份走）</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LIFE_TAGS.map((t) => (
              <button key={t.tag} data-testid={`me-identity-${t.tag}`} onClick={() => setLifeTag(t.tag)} className={`chip ${avatar.lifeTag === t.tag ? 'bg-almond-400' : 'bg-cream-100 text-stone-600'}`}>{t.emoji} {t.label}</button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-stone-600">性别</span>
            {(['f', 'm'] as const).map((g) => <button key={g} onClick={() => useTown.getState().setLook({ gender: g })} className={`chip ${(avatar.look.gender ?? 'f') === g ? 'bg-almond-400' : 'bg-cream-100 text-stone-600'}`}>{g === 'f' ? '👧 女生' : '👦 男生'}</button>)}
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
        <Card className="!p-3">
          <div className="text-sm font-black">画质</div>
          <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={LOW_GFX} onChange={(e) => setLowGfx(e.target.checked)} /> 流畅模式（关闭阴影、降低分辨率，适合低端手机；切换后重新加载）</label>
          <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" data-testid="ultra-gfx" checked={ULTRA_GFX} onChange={(e) => setUltraGfx(e.target.checked)} /> 极致画质（4K 阴影、高质量环境光遮蔽、更远视距与更高分辨率，建议电脑独显；切换后重新加载）</label>
        </Card>
        <Card className="!p-3">
          <div className="text-sm font-black">运营视角（平台运营人员）</div>
          <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" data-testid="ops-toggle" checked={opsOn} onChange={(e) => setOps(e.target.checked)} /> 打开后，服务中心出现「运营后台」：新需求先进入人工审核队列，可以人工撮合，并查看试运营 KPI 看板。</label>
        </Card>
        <Card className="!p-3">
          <div className="text-sm font-black">街区生活（小游戏）</div>
          <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" data-testid="life-toggle" checked={lifeOn} onChange={(e) => setLife(e.target.checked)} /> 开启「打工挣游戏钞票 / 小店消费 / 公园歇脚」。这是街区里的休闲玩法，游戏钞票不能兑换、不能用于商业撮合，与需求大厅的真实机会完全分开。</label>
        </Card>
        {account && (
          <Card className="!p-3">
            <div className="text-sm font-black">账号</div>
            <div className="mt-1 text-xs text-stone-600" data-testid="account">手机号：{account.phoneMasked ?? '未绑定'} · 微信：{account.wechatBound ? '已绑定' : '未绑定'}{account.role === 'admin' && <> · <a className="font-bold text-almond-600 underline" href="/admin.html" target="_blank" rel="noreferrer">管理后台</a></>}</div>
            <Btn tone="cream" size="sm" className="mt-2" data-testid="logout" onClick={async () => { await api('/api/auth/logout', { method: 'POST', json: {} }).catch(() => {}); clearLocalState(); location.reload(); }}>退出登录</Btn>
          </Card>
        )}
        {!account && <Btn tone="cream" size="sm" onClick={reset}>重置演示数据</Btn>}
      </div>
    </Drawer>
  );
}
