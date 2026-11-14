import { Suspense, lazy, useEffect, useState } from 'react';
import { Login } from './ui/Login';
import { DmPanel } from './ui/DirectMessages';
import { RemoteShopPanel } from './ui/RemoteShop';
import { useServer, type Me, type PublicShop } from './store/useServer';
import { api, detectBackend, restoreState, scheduleSync, startTracking, track } from './net/api';
import { useOpp } from './store/useOpp';
import { useCenter } from './store/useCenter';
import { useWork } from './store/useWork';
import { useLots } from './store/useLots';
import { remoteToOpc } from './net/shopMap';
import { useTown } from './store/useTown';
import { Onboarding } from './ui/Onboarding';
import { BottomNav, Coach, Controls, DistrictSwitcher, Toasts, TopBar } from './ui/Hud';
import { CityCards } from './ui/CityCards';
import { MyBusiness } from './ui/MyBusiness';
import { HelloComposer, MessagesPanel } from './ui/Connect';
import { AgentChat } from './ui/AgentChat';
import { FlyOverlay, LiveChat } from './ui/LiveChat';
import { OpcWizard } from './ui/OpcWizard';
import { CommunityPanel } from './ui/Community';
import { MePanel } from './ui/MePanel';
import { MiniMap } from './ui/MiniMap';
import { ChainPanel } from './ui/Chain';
import { OppPanel } from './ui/Opportunities';
import { CenterPanel } from './ui/Center';
import { ActiveJobBar, Counter, JobBoard, ShiftGame } from './ui/Work';

const CityScene = lazy(() => import('./scene/CityScene').then((m) => ({ default: m.CityScene })));

/** 三个核心界面：我的上海（城市）· 我的生意（商业引擎）· 我的社区（关系孵化器）。城市地图始终是视觉主体。 */
export default function App() {
  const phase = useTown((s) => s.phase);
  const tab = useTown((s) => s.tab);
  const mode = useServer((s) => s.mode);
  const me = useServer((s) => s.me);
  const [ready, setReady] = useState(false);
  useEffect(() => { boot().then(() => setReady(true)); }, []);
  if (!ready || mode === 'checking') return <Loading text="正在连接三邻邦…" />;
  if (mode === 'online' && !me) return <div className="relative h-full w-full"><Backdrop /><Login onLoggedIn={(u) => afterLogin(u).then(() => setReady(true))} /></div>;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <Suspense fallback={<Loading />}>{phase === 'playing' ? <CityScene /> : <Backdrop />}</Suspense>
      </div>
      <div className="pointer-events-none absolute inset-0">
        {phase === 'onboarding' && <Onboarding />}
        {phase === 'playing' && (
          <>
            <TopBar />
            <DistrictSwitcher />
            <Coach />
            <MiniMap />
            <Controls />
            <CityCards />
            {tab === 'biz' && <MyBusiness />}
            {tab === 'chain' && <ChainPanel />}
            {tab === 'opps' && <OppPanel />}
            {tab === 'center' && <CenterPanel />}
            {tab === 'community' && <CommunityPanel />}
            {tab === 'messages' && <MessagesPanel />}
            {tab === 'me' && <MePanel />}
            <BottomNav />
            <AgentChat />
            <LiveChat />
            <FlyOverlay />
            <ActiveJobBar />
            <JobBoard />
            <ShiftGame />
            <Counter />
            <HelloComposer />
            <OpcWizard />
            <RemoteShopPanel />
            <DmPanel />
            <Toasts />
          </>
        )}
      </div>
    </div>
  );
}

function Loading({ text = '正在搭建微缩上海街道…' }: { text?: string }) {
  return <div className="grid h-full place-items-center bg-cream-100 text-sm font-bold text-cocoa-600">{text}</div>;
}

/** 启动：检测后端；正式模式下检查登录态、恢复进度、开始埋点与同步 */
async function boot() {
  const mode = await detectBackend();
  useServer.getState().setMode(mode);
  if (mode !== 'online') return;
  startTracking(() => {
    const s = useServer.getState();
    if (!s.me) return 'login';
    const t = useTown.getState();
    if (t.phase === 'onboarding') return 'onboarding';
    if (s.dm) return 'messages';
    if (s.shopView || t.chatOpc) return 'shop';
    return t.tab;
  });
  const me = await useServer.getState().refreshMe().catch(() => null);
  if (!me) { track('pv', 'login'); return; }
  await afterLogin(me);
}

let wired = false;
async function afterLogin(me: Me) {
  await restoreState(me.id).catch(() => false);
  // 从服务端恢复的进度写回各模块
  await Promise.all([useTown, useOpp, useCenter, useWork, useLots].map((s) => s.persist.rehydrate()));
  // 服务端的开店记录为准：自己的店铺
  if (me.shopId && !useTown.getState().myOpc) {
    const { shop } = await api<{ shop: PublicShop | null }>('/api/shops/mine').catch(() => ({ shop: null }));
    if (shop) useTown.setState({ myOpc: remoteToOpc(shop, me.id) });
  }
  await useServer.getState().loadShops().catch(() => {});
  if (wired) return;
  wired = true;
  setInterval(() => useServer.getState().loadShops().catch(() => {}), 30_000);
  // 任何模块的进度变化 → 同步到服务端
  for (const s of [useTown, useOpp, useCenter, useWork, useLots]) (s as { subscribe: (fn: () => void) => void }).subscribe(() => scheduleSync());
  // 浏览埋点：切换模块、打开店铺、进入游戏
  const pv = () => track('pv', useTown.getState().phase === 'onboarding' ? 'onboarding' : useTown.getState().tab);
  pv();
  useTown.subscribe((s, p) => {
    if (s.tab !== p.tab || s.phase !== p.phase) pv();
    if (s.chatOpc && s.chatOpc !== p.chatOpc) track('pv', 'shop', s.chatOpc);
    // 资料保存到服务端
    if (s.avatar && (s.avatar.nickname !== p.avatar?.nickname || s.avatar.lifeTag !== p.avatar?.lifeTag)) {
      api('/api/me/profile', { method: 'PUT', json: { nickname: s.avatar.nickname, lifeTag: s.avatar.lifeTag, look: s.avatar.look } }).catch(() => {});
    }
  });
  useServer.subscribe((s, p) => {
    if (s.shopView && s.shopView !== p.shopView) track('pv', 'shop', s.shopView);
    if (s.dm && s.dm.id !== p.dm?.id) track('pv', 'messages', 'dm');
  });
}

function Backdrop() {
  return <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,#F7DCDD_0,transparent_40%),radial-gradient(circle_at_80%_70%,#C5D6BE_0,transparent_45%),linear-gradient(#FBF6EC,#F4EBDA)]" />;
}
