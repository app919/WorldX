/**
 * 「买」的快速通道：
 * - 打个飞的：一键飞到店门口，落地直接打开店铺 AI 分身；
 * - 聊一聊：店主在线 → 直接实时聊；店主不在线 → 写下需求发给对方（对方上线后在消息里收到）。
 * 演示店主的回复是模拟的（明确标注“演示”）；真实用户的店走后端私信（DmPanel）。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { lotById } from '../world';
import { residentById, SHOPS } from '../data/seed';
import { useTown } from './useTown';
import { emitGame } from './gameEvents';
import { track } from '../net/api';

export interface LiveMsg { from: 'me' | 'them' | 'system'; text: string; at: number; need?: NeedNote }
export interface NeedNote { what: string; budget: string; when: string; how: '线上' | '线下' | '都可以' }
export interface Thread { ownerId: string; name: string; shopName?: string; msgs: LiveMsg[]; unread: number }

export interface FlyTarget { title: string; lotId?: string; at?: { district: string; x: number; z: number }; then?: () => void }

interface LiveState {
  flying?: FlyTarget & { started: number };
  fly(t: FlyTarget): void;
  threads: Record<string, Thread>;
  open?: string;
  openLive(ownerId?: string): void;
  send(ownerId: string, text: string): void;
  leaveNeed(ownerId: string, n: NeedNote): void;
}

export const FLY_MS = 1100;

/** 演示店主的模拟回复（不承诺价格，只做初步沟通） */
function demoReply(text: string, shopName?: string): string {
  if (/多少钱|价格|报价|预算/.test(text)) return `你好！具体报价要看需求细节，我先了解一下：大概要做多少量、什么时候要？${shopName ? `「${shopName}」` : ''}会在确认后给正式报价单。（演示回复）`;
  if (/时间|多久|什么时候|工期/.test(text)) return '一般一周内可以开始，急单可以加急，我们约个 15 分钟线上聊聊细节？（演示回复）';
  if (/案例|作品/.test(text)) return '有的，我把最近两个案例发你看看；你也可以在店里的「案例」里先看看。（演示回复）';
  return '你好～我在的！说说你的需求吧：想做什么、预算区间、希望什么时候交付？（演示回复）';
}

export const useLive = create<LiveState>()(
  persist(
    (set, get) => ({
      threads: {},
      fly(t) {
        set({ flying: { ...t, started: Date.now() } });
        emitGame('fly');
        track('action', 'buy', 'fly', { to: t.title.slice(0, 30) });
        setTimeout(() => {
          const town = useTown.getState();
          const lot = t.lotId ? lotById(t.lotId) : undefined;
          if (lot) {
            town.goDistrict(lot.district, lot.door.trigger ?? lot.door.p);
            setTimeout(() => { town.enterLot(lot.door.lotId!); t.then?.(); }, 120);
          } else if (t.at) {
            town.goDistrict(t.at.district as never, { x: t.at.x, z: t.at.z });
            setTimeout(() => t.then?.(), 120);
          } else t.then?.();
          set({ flying: undefined });
        }, FLY_MS);
      },
      openLive(ownerId) {
        if (!ownerId) return set({ open: undefined });
        const r = residentById(ownerId);
        const shop = SHOPS.find((s) => s.ownerId === ownerId);
        const th = get().threads[ownerId] ?? { ownerId, name: r?.nickname ?? '店主', shopName: shop?.name, msgs: [], unread: 0 };
        set((s) => ({ open: ownerId, threads: { ...s.threads, [ownerId]: { ...th, unread: 0 } } }));
        emitGame('live_chat');
        track('action', 'buy', r?.online ? 'live_chat_online' : 'live_chat_offline');
      },
      send(ownerId, text) {
        const t = text.trim();
        if (!t) return;
        const th = get().threads[ownerId];
        if (!th) return;
        const push = (m: LiveMsg) => set((s) => ({ threads: { ...s.threads, [ownerId]: { ...s.threads[ownerId], msgs: [...s.threads[ownerId].msgs, m] } } }));
        push({ from: 'me', text: t, at: Date.now() });
        if (residentById(ownerId)?.online) setTimeout(() => push({ from: 'them', text: demoReply(t, th.shopName), at: Date.now() }), 1200);
      },
      leaveNeed(ownerId, n) {
        const th = get().threads[ownerId];
        if (!th) return;
        const body = `【需求】${n.what}｜预算：${n.budget || '待沟通'}｜时间：${n.when || '待沟通'}｜方式：${n.how}`;
        set((s) => ({ threads: { ...s.threads, [ownerId]: { ...th, msgs: [...th.msgs, { from: 'me', text: body, at: Date.now(), need: n }, { from: 'system', text: `已发送给 ${th.name}。对方上线后会在「消息」里收到这条需求，回复会通知你。`, at: Date.now() }] } } }));
        useTown.getState().notify({ kind: 'chat', title: `已把需求发给「${th.shopName ?? th.name}」`, body, needsMe: false, ref: ownerId });
        emitGame('leave_need');
        track('action', 'buy', 'leave_need');
      },
    }),
    { name: 'sanlinbang-live', version: 1, partialize: (s) => ({ threads: s.threads }) },
  ),
);
