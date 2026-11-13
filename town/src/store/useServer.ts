/**
 * 与后端相关的运行时状态：连接模式、登录用户、公开店铺（真实用户开的店）、私信面板。
 */
import { create } from 'zustand';
import { api, type Mode } from '../net/api';

export interface Me { id: string; role: string; nickname: string | null; phoneMasked: string | null; wechatBound: boolean; lifeTag: string | null; look: Record<string, string> | null; shopId: string | null }
export interface Intro { title: string; oneLiner: string; about: string; highlights: string[]; products: { name: string; desc: string }[]; customers: string[] }
export interface PublicShop {
  id: string; lotId: string; name: string; tagline: string; category: string; facade: 'cafe' | 'studio' | 'shikumen' | 'kiosk';
  licensed: boolean; licenseCompany: string | null; ownerUserId: string; ownerNickname: string;
  products: { name: string; description: string; priceFrom?: number; unit?: string; priceConfirmed: boolean }[]; needs: string[]; faqs: { q: string; a: string }[];
  companyIntro: Intro | null; productIntro: Intro | null; createdAt: number;
}

interface ServerState {
  mode: Mode;
  me: Me | null;
  ready: boolean;
  shops: PublicShop[];
  /** 正在查看的真实店铺 */
  shopView?: string;
  /** 正在聊天的会话 */
  dm?: { id: string; peer: { id: string; nickname: string; shopName: string | null } };
  setMode(m: Mode): void;
  setMe(me: Me | null): void;
  refreshMe(): Promise<Me | null>;
  loadShops(): Promise<void>;
  openShop(id?: string): void;
  openDm(peerId: string, origin?: string): Promise<void>;
  closeDm(): void;
}

export const useServer = create<ServerState>()((set, get) => ({
  mode: 'checking', me: null, ready: false, shops: [],
  setMode: (mode) => set({ mode }),
  setMe: (me) => set({ me }),
  async refreshMe() { const { user } = await api<{ user: Me | null }>('/api/me'); set({ me: user }); return user; },
  async loadShops() { if (get().mode !== 'online') return; const { shops } = await api<{ shops: PublicShop[] }>('/api/shops'); set({ shops }); },
  openShop: (shopView) => set({ shopView }),
  async openDm(peerId, origin) {
    const { conversation } = await api<{ conversation: ServerState['dm'] }>('/api/conversations', { method: 'POST', json: { peerId, origin } });
    set({ dm: conversation, shopView: undefined });
  },
  closeDm: () => set({ dm: undefined }),
}));

export const shopAtLot = (lotId: string) => useServer.getState().shops.find((s) => s.lotId === lotId);
export const isOnline = () => useServer.getState().mode === 'online';
