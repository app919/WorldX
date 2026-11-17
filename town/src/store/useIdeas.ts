/** 创意广场：我的创意（可选公开）、点赞、正在查看的创意 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_IDEAS, reviewIdea, type Idea } from '../domain/ideas';
import type { CityId } from '../domain/weather';
import { track } from '../net/api';

interface IdeasState {
  mine: Idea[];
  liked: string[];
  viewing?: string;
  view(id?: string): void;
  add(x: { title: string; desc: string; city: CityId; tags: string[]; public: boolean; author: string }): { ok: boolean; reason?: string; id?: string };
  setPublic(id: string, v: boolean): void;
  remove(id: string): void;
  like(id: string): void;
}

export const useIdeas = create<IdeasState>()(
  persist(
    (set, get) => ({
      mine: [], liked: [],
      view: (viewing) => { set({ viewing }); if (viewing) track('action', 'ideas', 'coach', { id: viewing }); },
      add(x) {
        const r = reviewIdea(x.title, x.desc);
        if (!r.ok) return r;
        const id = `idea_me_${Date.now().toString(36)}`;
        set((s) => ({ mine: [{ id, title: x.title.trim().slice(0, 40), desc: x.desc.trim().slice(0, 500), author: x.author, city: x.city, tags: x.tags.slice(0, 4), public: x.public, at: Date.now(), likes: 0, mine: true }, ...s.mine] }));
        track('action', 'ideas', x.public ? 'publish_public' : 'publish_private');
        return { ok: true, id };
      },
      setPublic: (id, v) => set((s) => ({ mine: s.mine.map((i) => (i.id === id ? { ...i, public: v } : i)) })),
      remove: (id) => set((s) => ({ mine: s.mine.filter((i) => i.id !== id), viewing: s.viewing === id ? undefined : s.viewing })),
      like: (id) => { if (!get().liked.includes(id)) set((s) => ({ liked: [...s.liked, id] })); },
    }),
    { name: 'sanlinbang-ideas', version: 1, partialize: (s) => ({ mine: s.mine, liked: s.liked }) },
  ),
);

export function allIdeas(mine: Idea[]): Idea[] { return [...mine, ...DEMO_IDEAS]; }
