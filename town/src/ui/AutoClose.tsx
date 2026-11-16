/**
 * 走开就收起：进店 / 点人 / 走到门口弹出的信息牌、店铺 AI 分身、真实用户的店铺页，
 * 角色离开打开时的位置超过 4 个单位（往前走、往后走都算）就自动收起，不用手动点 ✕。
 * 正在聊天（「聊一聊」、私信）的窗口不受影响。
 */
import { useEffect } from 'react';
import { playerRuntime, useTown } from '../store/useTown';
import { useServer } from '../store/useServer';

export const WALK_AWAY = 4;

export function AutoClose() {
  useEffect(() => {
    let anchor: { x: number; z: number } | null = null;
    let raf = 0;
    const isOpen = () => { const t = useTown.getState(); return !!(t.card || t.chatOpc || useServer.getState().shopView); };
    const sync = () => { anchor = isOpen() ? anchor ?? { x: playerRuntime.x, z: playerRuntime.z } : null; };
    const u1 = useTown.subscribe((s, p) => { if (s.card !== p.card || s.chatOpc !== p.chatOpc) { anchor = null; sync(); } });
    const u2 = useServer.subscribe((s, p) => { if (s.shopView !== p.shopView) { anchor = null; sync(); } });
    const loop = () => {
      if (anchor && Math.hypot(playerRuntime.x - anchor.x, playerRuntime.z - anchor.z) > WALK_AWAY) {
        const t = useTown.getState();
        if (t.card) t.openCard(undefined);
        if (t.chatOpc) t.openChat(undefined);
        if (useServer.getState().shopView) useServer.getState().openShop(undefined);
        anchor = null;
      }
      raf = requestAnimationFrame(loop);
    };
    sync();
    loop();
    return () => { u1(); u2(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
