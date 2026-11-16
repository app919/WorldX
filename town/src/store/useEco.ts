/** 智能生态位：丢弃、收藏夹（自定义标签）、每个方向的计算范围（中国 / 本城市 / 全球）、手写的业务简介 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_ANSWERS, type EcoAnswers, type Scope } from '../domain/ecosystem';
import { track } from '../net/api';

export interface EcoFavorite { id: string; tags: string[]; at: number }

interface EcoState {
  dismissed: string[];
  favorites: EcoFavorite[];
  scopes: Record<string, Scope>;
  /** 3 个小问题 + 自由补充（没开店时存在这里；开了店同时记到店铺资料） */
  answers: EcoAnswers;
  view: 'eco' | 'chain';
  setView(v: 'eco' | 'chain'): void;
  setAnswers(a: EcoAnswers): void;
  dismiss(id: string): void;
  restore(id: string): void;
  favorite(id: string): void;
  unfavorite(id: string): void;
  addTag(id: string, tag: string): void;
  removeTag(id: string, tag: string): void;
  setScope(id: string, s: Scope): void;
  resetDismissed(): void;
}

export const TAG_PRESETS = ['先试试', '今年做', '找搭档', '需资质', '出海'];
export const cleanTag = (t: string) => t.replace(/[\s#，,。]/g, '').slice(0, 8);

export const useEco = create<EcoState>()(
  persist(
    (set) => ({
      dismissed: [], favorites: [], scopes: {}, answers: EMPTY_ANSWERS, view: 'eco',
      setView: (view) => set({ view }),
      setAnswers: (a) => set({ answers: { ...a, skills: a.skills.slice(0, 3), note: a.note.slice(0, 1000), updatedAt: Date.now() } }),
      dismiss(id) { set((s) => ({ dismissed: [...new Set([...s.dismissed, id])] })); track('action', 'eco', 'dismiss', { id }); },
      restore: (id) => set((s) => ({ dismissed: s.dismissed.filter((x) => x !== id) })),
      favorite(id) {
        set((s) => (s.favorites.some((f) => f.id === id) ? s : { favorites: [{ id, tags: [], at: Date.now() }, ...s.favorites] }));
        track('action', 'eco', 'favorite', { id });
      },
      unfavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
      addTag(id, tag) {
        const t = cleanTag(tag);
        if (!t) return;
        set((s) => ({ favorites: s.favorites.map((f) => (f.id === id && !f.tags.includes(t) && f.tags.length < 6 ? { ...f, tags: [...f.tags, t] } : f)) }));
      },
      removeTag: (id, tag) => set((s) => ({ favorites: s.favorites.map((f) => (f.id === id ? { ...f, tags: f.tags.filter((x) => x !== tag) } : f)) })),
      setScope: (id, sc) => set((s) => ({ scopes: { ...s.scopes, [id]: sc } })),
      resetDismissed: () => set({ dismissed: [] }),
    }),
    { name: 'sanlinbang-eco', version: 2, partialize: (s) => ({ dismissed: s.dismissed, favorites: s.favorites, scopes: s.scopes, answers: s.answers, view: s.view }), migrate: (p) => ({ ...(p as object), answers: { ...EMPTY_ANSWERS, note: (p as { brief?: string }).brief ?? '' } }) as never },
  ),
);
