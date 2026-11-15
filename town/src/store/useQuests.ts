/**
 * 新手 7 天任务进度（本机保存；在线模式随账号同步，见 net/api 的 STORE_KEYS）。
 * 监听 gameEvents：做了对应的事，已解锁天数里的任务自动累计进度；完成后手动领取奖励，三件都领完得当天徽章。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dayIndex, planFor } from '../domain/quests';
import { cnDate } from '../domain/weather';
import { onGameEvent } from './gameEvents';
import { useTown } from './useTown';
import { track } from '../net/api';

interface QuestState {
  startDay?: string;
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
  /** 预览第几天（UI 用） */
  view?: number;
  setView(d?: number): void;
  claim(questId: string): void;
  reset(): void;
}

export const today = () => cnDate();

export const useQuests = create<QuestState>()(
  persist(
    (set, get) => ({
      progress: {},
      claimed: {},
      setView: (view) => set({ view }),
      claim(id) {
        const tag = useTown.getState().avatar?.lifeTag;
        const plan = planFor(tag);
        const day = plan.find((d) => d.quests.some((q) => q.id === id));
        const q = day?.quests.find((x) => x.id === id);
        if (!q || get().claimed[id] || (get().progress[id] ?? 0) < q.count) return;
        const claimed = { ...get().claimed, [id]: true };
        set({ claimed });
        const allDone = day!.quests.every((x) => claimed[x.id]);
        useTown.setState((s) => ({ wallet: { ...s.wallet, stars: s.wallet.stars + q.stars, growth: s.wallet.growth + q.growth, badges: allDone && !s.wallet.badges.includes(day!.badge) ? [...s.wallet.badges, day!.badge] : s.wallet.badges } }));
        useTown.getState().toast(allDone ? `第 ${day!.day} 天完成！获得徽章「${day!.badge}」` : `任务完成：⭐ +${q.stars} 🌱 +${q.growth}`, 'ok');
        track('action', 'quest', 'claim', { id, day: day!.day });
      },
      reset: () => set({ startDay: undefined, progress: {}, claimed: {}, view: undefined }),
    }),
    { name: 'sanlinbang-quests', version: 1, partialize: (s) => ({ startDay: s.startDay, progress: s.progress, claimed: s.claimed }) },
  ),
);

/** 当前身份、已解锁到第几天 */
export function questToday() {
  const s = useQuests.getState();
  const start = s.startDay ?? today();
  return { plan: planFor(useTown.getState().avatar?.lifeTag), day: dayIndex(start, today()) };
}

// 行为事件 → 任务进度（只累计已解锁的天）
onGameEvent((e) => {
  const town = useTown.getState();
  if (town.phase !== 'playing' || !town.avatar) return;
  const st = useQuests.getState();
  if (!st.startDay) useQuests.setState({ startDay: today() });
  const { plan, day } = questToday();
  const progress = { ...useQuests.getState().progress };
  let changed = false;
  for (const d of plan.filter((x) => x.day <= day)) for (const q of d.quests) {
    if (q.event !== e) continue;
    const cur = progress[q.id] ?? 0;
    if (cur < q.count) { progress[q.id] = cur + 1; changed = true; if (cur + 1 === q.count) town.toast(`✅ 任务达成：${q.title}（去领取奖励）`, 'ok'); }
  }
  if (changed) useQuests.setState({ progress });
});
