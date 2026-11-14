import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { playerRuntime, useTown } from './store/useTown';
import { useWork } from './store/useWork';
import { useLots } from './store/useLots';
import { useCenter } from './store/useCenter';
import { trafficRuntime } from './world/traffic';
import { lotPlan } from './domain/lots';
import { allLots, compiledOf, navOf, DISTRICT_ORDER } from './world';
import { cam } from './scene/input';
import { signFor } from './scene/Buildings';

// 自动化测试钩子：只在 URL 带 ?e2e 时暴露，用于把角色放到门口附近（仍然走导航与门口触发规则）
/** 放置角色：同时更新存档位置与运行时位置（切换街区时也不会被重置回出生点） */
function place(d: Parameters<ReturnType<typeof useTown.getState>['goDistrict']>[0], p: { x: number; z: number }) {
  const st = useTown.getState();
  st.goDistrict(d, p);
  useTown.setState((s) => (s.avatar ? { avatar: { ...s.avatar, position: { x: playerRuntime.x, z: playerRuntime.z } } } : {}));
}

if (typeof location !== 'undefined' && location.search.includes('e2e')) {
  (window as unknown as Record<string, unknown>).__town = {
    useTown,
    useWork,
    useLots,
    useCenter,
    signals: () => { const tr = trafficRuntime.tr; return tr ? { junctions: [...tr.signals.values()].filter((s) => s.roads.length > 1).length, pedCrossings: tr.cwSignal.filter(Boolean).length, centers: [...tr.signals.values()].filter((s) => s.roads.length > 1).map((s) => s.center) } : null; },
    lotPlan: (d: string) => lotPlan(d as 'wukang'),
    cam,
    roofs: () => { const out: Record<string, number> = {}; for (const d of DISTRICT_ORDER) for (const l of allLots().filter((x) => x.district === d)) { const c = signFor(l.door.lotId)?.cat; if (c) out[c] = (out[c] ?? 0) + 1; } return out; },
    playerRuntime,
    props: (d: string) => compiledOf(d as 'wukang').props.map((p) => ({ kind: p.kind, x: p.p.x, z: p.p.z })),
    parks: (d: string) => compiledOf(d as 'wukang').parks.map((p) => ({ id: p.id, label: p.label, cx: p.box.cx, cz: p.box.cz })),
    /** 把角色放到某扇门附近（按门 id，例如 wukang_mansion#0） */
    nearDoor(doorId: string, r = 4, walk = true) {
      for (const d of DISTRICT_ORDER) {
        const door = compiledOf(d).doors.find((x) => x.id === doorId);
        if (!door) continue;
        const nav = navOf(d);
        for (let k = 0; k < 36; k++) {
          const a = (k / 36) * Math.PI * 2;
          const p = { x: door.trigger.x + Math.cos(a) * r, z: door.trigger.z + Math.sin(a) * r };
          if (nav.walkable(p) && (nav.findPath(p, door.trigger)?.length ?? 99) < 6) { place(d, p); if (walk) useTown.getState().walkTo(door.trigger); return true; }
        }
      }
      return false;
    },
    doors: (d: string) => compiledOf(d as 'wukang').doors.map((x) => ({ id: x.id, lotId: x.lotId, label: x.label })),
    /** 把角色放到某个铺位门口附近（约 r 个单位、可步行、可寻路到达的位置） */
    nearLot(lotId: string, r = 7, walk = true) {
      const lot = allLots().find((l) => l.door.lotId === lotId);
      if (!lot) return false;
      const nav = navOf(lot.district);
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        const p = { x: lot.door.trigger.x + Math.cos(a) * r, z: lot.door.trigger.z + Math.sin(a) * r };
        const path = nav.walkable(p) ? nav.findPath(p, lot.door.trigger) : null;
        if (path && path.length < 6) { place(lot.district, p); if (walk) useTown.getState().walkTo(lot.door.trigger); return true; }
      }
      return false;
    },
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
