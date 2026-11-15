/** 「跟」：围观正在进行的活动、报名、发弹幕（本机状态；报名关联到社区活动时走 useTown.joinEvent） */
import { create } from 'zustand';
import { LIVE_EVENTS } from '../domain/buzz';
import { useTown } from './useTown';
import { emitGame } from './gameEvents';
import { track } from '../net/api';

interface FollowState {
  watching?: string;
  joined: string[];
  danmu: Record<string, { text: string; at: number }[]>;
  feedOpen: boolean;
  setFeed(v: boolean): void;
  watch(id?: string): void;
  join(id: string): void;
  say(id: string, text: string): void;
}

export const useFollow = create<FollowState>()((set, get) => ({
  joined: [],
  danmu: {},
  feedOpen: false,
  setFeed(v) { set({ feedOpen: v }); if (v) { emitGame('follow_feed'); track('pv', 'browse', 'feed'); } },
  watch(id) {
    set({ watching: id });
    if (id) { emitGame('watch_event'); track('action', 'follow', 'watch', { id }); }
  },
  join(id) {
    const e = LIVE_EVENTS.find((x) => x.id === id);
    if (!e || get().joined.includes(id)) return;
    set((s) => ({ joined: [...s.joined, id] }));
    if (e.eventId) useTown.getState().joinEvent(e.eventId);
    else emitGame('join_event');
    useTown.getState().toast(`已报名「${e.title}」`, 'ok');
    track('action', 'follow', 'join', { id });
  },
  say(id, text) {
    const t = text.trim().slice(0, 40);
    if (!t) return;
    set((s) => ({ danmu: { ...s.danmu, [id]: [...(s.danmu[id] ?? []), { text: t, at: Date.now() }].slice(-30) } }));
  },
}));
