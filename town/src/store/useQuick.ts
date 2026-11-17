/** 快速开张：身份选完后引导上传资料，提炼结果预填进开店向导 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Intro } from './useServer';

export interface DocState { id: string; filename: string; status: 'uploading' | 'parsing' | 'done' | 'failed'; summary?: Intro; error?: string; method?: string }
export interface Prefill {
  name?: string;
  tagline?: string;
  category?: string;
  products?: { name: string; description: string }[];
  needs?: string[];
  docs?: { company?: DocState; product?: DocState };
}

interface QuickState {
  dismissed: boolean;
  prefill?: Prefill;
  setPrefill(p?: Prefill): void;
  dismiss(): void;
}

export const useQuick = create<QuickState>()(persist((set) => ({
  dismissed: false,
  setPrefill: (prefill) => set({ prefill }),
  dismiss: () => set({ dismissed: true }),
}), { name: 'sanlinbang-quick', version: 1, partialize: (s) => ({ dismissed: s.dismissed }) }));
