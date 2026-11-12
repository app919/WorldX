import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { playerRuntime, useTown } from './store/useTown';
import { allLots, navOf } from './world';

// 自动化测试钩子：只在 URL 带 ?e2e 时暴露，用于把角色放到门口附近（仍然走导航与门口触发规则）
if (typeof location !== 'undefined' && location.search.includes('e2e')) {
  (window as unknown as Record<string, unknown>).__town = {
    useTown,
    playerRuntime,
    /** 把角色放到某个铺位门口附近（约 r 个单位、可步行、可寻路到达的位置） */
    nearLot(lotId: string, r = 7) {
      const lot = allLots().find((l) => l.door.lotId === lotId);
      if (!lot) return false;
      useTown.getState().goDistrict(lot.district);
      const nav = navOf(lot.district);
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        const p = { x: lot.door.trigger.x + Math.cos(a) * r, z: lot.door.trigger.z + Math.sin(a) * r };
        const path = nav.walkable(p) ? nav.findPath(p, lot.door.trigger) : null;
        if (path && path.length < 6) { playerRuntime.x = p.x; playerRuntime.z = p.z; playerRuntime.teleported = true; return true; }
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
