/**
 * 随便逛逛（城市漫步）的驱动与讲解卡：
 * - 自动切到跟随视角，一站一站走过去（过马路照样看红绿灯）；
 * - 到站停下面向目标，弹出讲解卡：进去看看 / 继续逛 / 停止；几秒后自动去下一站；
 * - 按方向键、摇杆或点「停止逛逛」随时接管，结束后恢复原来的视角。
 */
import { useEffect, useState } from 'react';
import { PAUSE_MS, STOP_ICON, planStroll, useStroll, type StrollStop } from '../store/useStroll';
import { playerRuntime, useTown } from '../store/useTown';
import { useFollow } from '../store/useFollow';
import { cam, input, setView, type ViewMode } from '../scene/input';
import { emitGame } from '../store/gameEvents';
import { track } from '../net/api';
import { dist } from '../world/geom';
import { Btn } from './kit';

let prevView: ViewMode | null = null;

/** 开始 / 停止漫步（「随便逛逛」按钮） */
export function toggleStroll() {
  const s = useStroll.getState();
  if (s.active) { endStroll('已停止逛逛'); return; }
  const t = useTown.getState();
  const stops = planStroll(t.district, { x: playerRuntime.x, z: playerRuntime.z }, 5, Math.floor(Date.now() / 60000));
  if (!stops.length) { t.toast('附近暂时没有可以逛的地方', 'info'); return; }
  t.openCard(undefined); t.openChat(undefined);
  prevView = cam.mode;
  if (cam.mode === 'top') setView('chase', playerRuntime.heading);
  s.start(stops);
  emitGame('stroll');
  track('action', 'browse', 'stroll_start', { stops: stops.length });
  t.toast(`🚶 开始逛逛：${stops.length} 站，按方向键随时接管`, 'info');
}

function endStroll(msg?: string) {
  useStroll.getState().stop();
  useTown.getState().clearPath();
  if (prevView && cam.mode !== prevView) setView(prevView);
  prevView = null;
  if (msg) useTown.getState().toast(msg, 'info');
}

function openStop(st: StrollStop) {
  const t = useTown.getState();
  endStroll();
  if (st.lotId) t.enterLot(st.lotId);
  else if (st.eventId) useFollow.getState().watch(st.eventId);
  else if (st.archiveId) { t.openCard({ kind: 'landmark', id: st.archiveId }); t.visit(st.archiveId); }
}

export function StrollDriver() {
  const active = useStroll((s) => s.active);
  useEffect(() => {
    if (!active) return;
    // 手动操作就接管（方向键 / WASD / 摇杆）
    const keys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (keys.has(e.key.toLowerCase())) endStroll('你接管了方向，漫步结束');
    };
    window.addEventListener('keydown', onKey);
    let lastWalk = 0;
    const tick = setInterval(() => {
      const s = useStroll.getState();
      if (!s.active) return;
      if (Math.hypot(input.joyX, input.joyY) > 0.2) { endStroll('你接管了方向，漫步结束'); return; }
      const t = useTown.getState();
      if (t.card || t.chatOpc) return; // 路过的门口弹出了名片：等玩家看完 / 关掉
      const st = s.stops[s.i];
      if (!st) { endStroll(); return; }
      const now = performance.now();
      if (s.phase === 'walking') {
        const d = dist(st.at, playerRuntime);
        if (d < 1.3) {
          t.clearPath();
          playerRuntime.heading = Math.atan2(st.look.x - playerRuntime.x, st.look.z - playerRuntime.z);
          s.arrive();
          track('action', 'browse', 'stroll_stop', { kind: st.kind });
        } else if (!t.walkPath && now - lastWalk > 1500) {
          lastWalk = now;
          if (!t.walkTo(st.at)) s.next(); // 走不过去就跳过这一站
        }
      } else if (now > s.until) {
        if (s.i + 1 >= s.stops.length) endStroll(`🎉 逛完啦！一共逛了 ${s.stops.length} 个地方`);
        else s.next();
      }
    }, 250);
    return () => { clearInterval(tick); window.removeEventListener('keydown', onKey); };
  }, [active]);
  return null;
}

/** 漫步进度条 + 到站讲解卡 */
export function StrollCard() {
  const s = useStroll();
  const [, tick] = useState(0);
  useEffect(() => { if (!s.active) return; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, [s.active]);
  if (!s.active) return null;
  const st = s.stops[s.i];
  if (!st) return null;
  const left = Math.max(0, Math.ceil((s.until - performance.now()) / 1000));
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.4rem] z-30 flex justify-center px-3 md:top-16" data-testid="stroll">
      {s.phase === 'walking' ? (
        <div className="pointer-events-auto glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-cocoa-800">
          <span>🚶 第 {s.i + 1}/{s.stops.length} 站 · 正在走向 {STOP_ICON[st.kind]} {st.title}</span>
          <button className="chip bg-cream-100 text-stone-600" data-testid="stroll-stop" onClick={() => endStroll('已停止逛逛')}>⏹ 停止</button>
        </div>
      ) : (
        <div className="wobble-in pointer-events-auto w-full max-w-sm rounded-3xl bg-cream-50/95 p-3 shadow-soft ring-1 ring-cream-200" data-testid="stroll-card">
          <div className="text-[11px] font-bold text-stone-500">第 {s.i + 1}/{s.stops.length} 站</div>
          <div className="text-base font-black text-cocoa-800">{STOP_ICON[st.kind]} {st.title}</div>
          <div className="mt-1 text-xs text-stone-600">{st.blurb}</div>
          <div className="mt-2 flex items-center gap-1.5">
            {(st.lotId || st.eventId || st.archiveId) && <Btn size="sm" data-testid="stroll-open" onClick={() => openStop(st)}>进去看看</Btn>}
            <Btn size="sm" tone="cream" data-testid="stroll-next" onClick={() => (s.i + 1 >= s.stops.length ? endStroll('🎉 逛完啦！') : s.next())}>{s.i + 1 >= s.stops.length ? '逛完了' : `继续逛（${left}s）`}</Btn>
            <button className="ml-auto text-[11px] text-stone-400" onClick={() => endStroll('已停止逛逛')}>停止</button>
          </div>
        </div>
      )}
    </div>
  );
}

export const STROLL_PAUSE_S = PAUSE_MS / 1000;
