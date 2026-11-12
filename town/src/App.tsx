import { Suspense, lazy } from 'react';
import { useTown } from './store/useTown';
import { Onboarding } from './ui/Onboarding';
import { BottomNav, Coach, Controls, Toasts, TopBar } from './ui/Hud';
import { CityCards } from './ui/CityCards';
import { BusinessMapPanel } from './ui/BusinessMap';
import { HelloComposer, MessagesPanel } from './ui/Connect';
import { AgentChat } from './ui/AgentChat';
import { OpcWizard } from './ui/OpcWizard';
import { CommunityPanel } from './ui/Community';
import { MePanel } from './ui/MePanel';

const CityScene = lazy(() => import('./scene/CityScene').then((m) => ({ default: m.CityScene })));

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
            <Coach />
            <Controls />
            <CityCards />
            {tab !== 'city' && (
              <div className="absolute inset-x-3 bottom-24 top-24 z-20 flex justify-center md:left-auto md:right-3 md:w-[min(46rem,60vw)]">
                {tab === 'map' && <BusinessMapPanel />}
                {tab === 'community' && <CommunityPanel />}
                {tab === 'messages' && <MessagesPanel />}
                {tab === 'me' && <MePanel />}
              </div>
            )}
            <BottomNav />
            <AgentChat />
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
  return <div className="grid h-full place-items-center bg-cream-100 text-sm font-bold text-cocoa-600">正在搭建微缩武康路… 🌳</div>;
}

function Backdrop() {
  return (
    <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,#F7DCDD_0,transparent_40%),radial-gradient(circle_at_80%_70%,#C5D6BE_0,transparent_45%),linear-gradient(#FBF6EC,#F4EBDA)]" />
  );
}
