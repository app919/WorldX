/**
 * 新手 7 天 → 每日委托 · 签到 · 毕业礼 · 回访摘要（本机保存）。
 * 监听 gameEvents：做了对应的事，已解锁的任务自动累计进度；完成后手动领取奖励。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CHECKIN_MILESTONES, GRADUATION, dailyFor, dayIndex, planFor, rawDay, seasonOf, streakOf, themeOfWeek, type Quest, type QuestDay } from '../domain/quests';
import { cnDate } from '../domain/weather';
import { onGameEvent } from './gameEvents';
import { useTown } from './useTown';
import { track } from '../net/api';

export interface ReturnSummary { hours: number; replies: { name: string; shop?: string }[]; feed: number; theme: string; streak: number; todayTitles: string[] }

interface QuestState {
  startDay?: string;
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
  checkins: string[];
  graduated?: boolean;
  lastSeen?: number;
  summary?: ReturnSummary;
  view?: number;
  setView(d?: number): void;
  claim(questId: string): void;
  checkIn(): void;
  closeSummary(): void;
  reset(): void;
}

export const today = () => cnDate();

const addWallet = (stars: number, growth = 0, badge?: string) => useTown.setState((s) => ({ wallet: { ...s.wallet, stars: s.wallet.stars + stars, growth: s.wallet.growth + growth, badges: badge && !s.wallet.badges.includes(badge) ? [...s.wallet.badges, badge] : s.wallet.badges } }));

/** 当前应该做的任务（第 1–7 天：新手任务；第 8 天起：每日委托） */
export function currentQuests(): { mode: 'newbie' | 'daily'; day: number; raw: number; plan: QuestDay[]; today: QuestDay } {
  const s = useQuests.getState();
  const tag = useTown.getState().avatar?.lifeTag ?? 'visitor';
  const start = s.startDay ?? today();
  const raw = rawDay(start, today());
  const plan = planFor(tag);
  if (raw <= 7) return { mode: 'newbie', day: dayIndex(start, today()), raw, plan, today: plan[dayIndex(start, today()) - 1] };
  return { mode: 'daily', day: 7, raw, plan, today: dailyFor(tag, today()) };
}

const findQuest = (id: string): { q: Quest; day?: QuestDay } | undefined => {
  const { plan, today: t } = currentQuests();
  for (const d of [...plan, t]) { const q = d.quests.find((x) => x.id === id); if (q) return { q, day: d }; }
  return undefined;
};

export const useQuests = create<QuestState>()(
  persist(
    (set, get) => ({
      progress: {},
      claimed: {},
      checkins: [],
      setView: (view) => set({ view }),
      claim(id) {
        const f = findQuest(id);
        if (!f || get().claimed[id] || (get().progress[id] ?? 0) < f.q.count) return;
        const claimed = { ...get().claimed, [id]: true };
        set({ claimed });
        const allDone = !!f.day?.badge && f.day.quests.every((x) => claimed[x.id]);
        addWallet(f.q.stars, f.q.growth, allDone ? f.day!.badge : undefined);
        useTown.getState().toast(allDone ? `第 ${f.day!.day} 天完成！获得徽章「${f.day!.badge}」` : `任务完成：⭐ +${f.q.stars}`, 'ok');
        track('action', 'quest', 'claim', { id });
      },
      /** 每天第一次进来：签到 + 第 8 天毕业礼 + “你不在的时候”摘要 */
      checkIn() {
        const t = today();
        const s = get();
        if (!s.startDay) set({ startDay: t });
        const now = Date.now();
        const away = s.lastSeen ? now - s.lastSeen : 0;
        if (away > 8 * 3600_000) set({ summary: buildSummary(away) });
        set({ lastSeen: now });
        if (s.checkins.includes(t)) return;
        const checkins = [...s.checkins, t];
        set({ checkins });
        const { inSeason, season } = seasonOf(checkins.length);
        const m = CHECKIN_MILESTONES.find((x) => x.n === inSeason);
        addWallet(5 + (m?.stars ?? 0), 0, m?.n === 30 ? `🏅 第 ${season} 季全勤` : undefined);
        useTown.getState().toast(m ? `签到里程碑「${m.label}」：⭐ +${5 + m.stars}` : '今日签到 ⭐ +5', 'ok');
        if (!s.graduated && rawDay(get().startDay ?? t, t) >= 8) {
          set({ graduated: true });
          addWallet(GRADUATION.stars, 0, GRADUATION.badge);
          useTown.getState().toast(`🎓 新手毕业！⭐ +${GRADUATION.stars}，解锁「每日委托」和「主题周」`, 'ok');
        }
        track('action', 'quest', 'checkin', { n: checkins.length });
      },
      closeSummary: () => set({ summary: undefined }),
      reset: () => set({ startDay: undefined, progress: {}, claimed: {}, checkins: [], graduated: false, view: undefined, summary: undefined }),
    }),
    { name: 'sanlinbang-quests', version: 2, partialize: (s) => ({ startDay: s.startDay, progress: s.progress, claimed: s.claimed, checkins: s.checkins, graduated: s.graduated, lastSeen: s.lastSeen }), migrate: (p) => ({ checkins: [], ...(p as object) }) as never },
  ),
);

/** 回访摘要：离开期间不在线的店主回复了你留下的需求（演示）、街区动态有更新、本周主题城市、连续签到 */
function buildSummary(away: number): ReturnSummary {
  const replies = pendingReplies?.() ?? [];
  const t = today();
  return {
    hours: Math.round(away / 3600_000),
    replies,
    feed: Math.min(30, Math.max(3, Math.round(away / 3600_000) * 2)),
    theme: `${themeOfWeek(t).name} · ${themeOfWeek(t).theme}`,
    streak: streakOf(useQuests.getState().checkins, t),
    todayTitles: currentQuests().today.quests.map((q) => q.title),
  };
}
let pendingReplies: (() => { name: string; shop?: string }[]) | undefined;
export const registerPendingReplies = (fn: () => { name: string; shop?: string }[]) => { pendingReplies = fn; };

// 行为事件 → 任务进度
onGameEvent((e) => {
  const town = useTown.getState();
  if (town.phase !== 'playing' || !town.avatar) return;
  if (!useQuests.getState().startDay) useQuests.setState({ startDay: today() });
  const { mode, plan, day, today: td } = currentQuests();
  const lists = mode === 'newbie' ? plan.filter((x) => x.day <= day) : [td];
  const progress = { ...useQuests.getState().progress };
  let changed = false;
  for (const d of lists) for (const q of d.quests) {
    if (q.event !== e) continue;
    const cur = progress[q.id] ?? 0;
    if (cur < q.count) { progress[q.id] = cur + 1; changed = true; if (cur + 1 === q.count) town.toast(`✅ 任务达成：${q.title}（去领取奖励）`, 'ok'); }
  }
  if (changed) useQuests.setState({ progress });
});
