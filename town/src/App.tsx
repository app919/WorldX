import { Suspense, lazy } from 'react';
import { useTown } from './store/useTown';
import { Onboarding } from './ui/Onboarding';
import { BottomNav, Coach, Controls, DistrictSwitcher, Toasts, TopBar } from './ui/Hud';
import { CityCards } from './ui/CityCards';
import { MyBusiness } from './ui/MyBusiness';
import { HelloComposer, MessagesPanel } from './ui/Connect';
import { AgentChat } from './ui/AgentChat';
import { OpcWizard } from './ui/OpcWizard';
import { CommunityPanel } from './ui/Community';
import { MePanel } from './ui/MePanel';
import { MiniMap } from './ui/MiniMap';
import { ChainPanel } from './ui/Chain';
import { OppPanel } from './ui/Opportunities';
import { ActiveJobBar, Counter, JobBoard, ShiftGame } from './ui/Work';

const CityScene = lazy(() => import('./scene/CityScene').then((m) => ({ default: m.CityScene })));

/** 三个核心界面：我的上海（城市）· 我的生意（商业引擎）· 我的社区（关系孵化器）。城市地图始终是视觉主体。 */
export default function App() {
  const phase = useTown((s) => s.phase);
  const tab = useTown((s) => s.tab);
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
            {tab === 'community' && <CommunityPanel />}
            {tab === 'messages' && <MessagesPanel />}
            {tab === 'me' && <MePanel />}
            <BottomNav />
            <AgentChat />
            <ActiveJobBar />
            <JobBoard />
            <ShiftGame />
            <Counter />
            <HelloComposer />
            <OpcWizard />
            <Toasts />
          </>
        )}
      </div>
    </div>
  );
}

function Loading() {
  return <div className="grid h-full place-items-center bg-cream-100 text-sm font-bold text-cocoa-600">正在搭建微缩上海街道…</div>;
}

function Backdrop() {
  return <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,#F7DCDD_0,transparent_40%),radial-gradient(circle_at_80%_70%,#C5D6BE_0,transparent_45%),linear-gradient(#FBF6EC,#F4EBDA)]" />;
}
