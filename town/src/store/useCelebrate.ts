/**
 * 庆祝：达成初步合作（双方确认合作记录 / 聊一聊里达成初步合作意向 / 成交确认单双方确认）时放一组小礼花。
 */
import { create } from 'zustand';
import { emitGame } from './gameEvents';
import { track } from '../net/api';

interface Burst { id: number; title: string; at: number }
interface CelebrateState { bursts: Burst[]; celebrate(title: string): void }
let n = 0;
export const useCelebrate = create<CelebrateState>()((set) => ({
  bursts: [],
  celebrate(title) {
    const b = { id: ++n, title, at: Date.now() };
    set((s) => ({ bursts: [...s.bursts, b].slice(-3) }));
    setTimeout(() => set((s) => ({ bursts: s.bursts.filter((x) => x.id !== b.id) })), 3200);
    emitGame('deal');
    track('action', 'follow', 'celebrate', { title: title.slice(0, 30) });
  },
}));
