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
import { playerRuntime, useTown } from './useTown';
import type { DistrictKey } from '../domain/commerce';
import { emitGame } from './gameEvents';
import { track } from '../net/api';
import { useCelebrate } from './useCelebrate';
import { registerPendingReplies } from './useQuests';

export interface LiveMsg { from: 'me' | 'them' | 'system'; text: string; at: number; need?: NeedNote }
export interface NeedNote { what: string; budget: string; when: string; how: '线上' | '线下' | '都可以' }
export interface Thread { ownerId: string; name: string; shopName?: string; msgs: LiveMsg[]; unread: number; agreed?: boolean }

export interface FlyTarget { title: string; lotId?: string; at?: { district: string; x: number; z: number }; then?: () => void }

interface LiveState {
  /** 打个飞的进行中：起飞 → 穿越云层（遮住换地图 / 渲染 / 网络的时间）→ 降落 → 我们到了 */
  flying?: FlyTarget & { started: number; phase: 'up' | 'clouds' | 'down' | 'arrived' };
  fly(t: FlyTarget): void;
  threads: Record<string, Thread>;
  open?: string;
  openLive(ownerId?: string): void;
  send(ownerId: string, text: string): void;
  leaveNeed(ownerId: string, n: NeedNote): void;
  /** 在「聊一聊」里双方达成初步合作意向（演示：对方在线时确认） */
  agree(ownerId: string): void;
}

/** 店主的店门位置（爱心动效用） */
export function shopDoorOf(ownerId: string) {
  const shop = SHOPS.find((s) => s.ownerId === ownerId);
  const lot = shop ? lotById(shop.lotId) : undefined;
  return lot ? { district: lot.district, p: lot.door.p } : undefined;
}
/** 有对聊的会话：至少一来一回，或已经把需求发给对方 */
export const chatStarted = (t: Thread) => t.msgs.some((m) => m.need) || (t.msgs.some((m) => m.from === 'me') && t.msgs.some((m) => m.from === 'them'));

/** 打个飞的节奏（毫秒）：起飞 → 云层（至少这么久，等新地图渲染好）→ 降落 → 「我们到了」 */
export const FLY = { up: 320, clouds: 750, down: 380, arrived: 2200 } as const;
export const FLY_MS = FLY.up + FLY.clouds + FLY.down;

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
        if (get().flying && get().flying!.phase !== 'arrived') return;
        emitGame('fly');
        track('action', 'buy', 'fly', { to: t.title.slice(0, 30) });
        const town = useTown.getState();
        const lot = t.lotId ? lotById(t.lotId) : undefined;
        const dest = lot ? { district: lot.district, p: lot.door.trigger ?? lot.door.p } : t.at ? { district: t.at.district as DistrictKey, p: { x: t.at.x, z: t.at.z } } : undefined;
        const phase = (p: 'up' | 'clouds' | 'down' | 'arrived') => set({ flying: { ...t, started: Date.now(), phase: p } });
        const land = () => {
          phase('arrived');
          if (lot) useTown.getState().enterLot(lot.door.lotId!);
          t.then?.();
          setTimeout(() => { if (get().flying?.phase === 'arrived') set({ flying: undefined }); }, FLY.arrived);
        };
        if (!dest) { land(); return; }
        town.openCard(undefined); town.openChat(undefined); town.clearPath();
        const here = { x: playerRuntime.x, z: playerRuntime.z };
        phase('up');
        // 1）小飞机载着角色起飞
        playerRuntime.fly = {
          mode: 'up', from: here, to: here, t0: performance.now(), dur: FLY.up,
          done: () => {
            // 2）穿越云层：这时候换地图 / 瞬移，云层挡住渲染与加载
            phase('clouds');
            playerRuntime.flyY = 16;
            const t0 = performance.now();
            if (dest.district !== useTown.getState().district) useTown.getState().goDistrict(dest.district, dest.p);
            else { playerRuntime.x = dest.p.x; playerRuntime.z = dest.p.z; playerRuntime.teleported = true; }
            // 等两帧确认新画面已经渲染，再保证云层至少停留 FLY.clouds
            requestAnimationFrame(() => requestAnimationFrame(() => {
              setTimeout(() => {
                // 3）从天而降
                phase('down');
                playerRuntime.fly = { mode: 'down', from: dest.p, to: dest.p, t0: performance.now(), dur: FLY.down, done: land };
              }, Math.max(0, FLY.clouds - (performance.now() - t0)));
            }));
          },
        };
        // 保险：画面没在渲染（切到别的页面）时也要按时落地
        setTimeout(() => { for (let i = 0; i < 2 && playerRuntime.fly; i++) { const f = playerRuntime.fly; playerRuntime.fly = null; playerRuntime.flyY = 0; f.done?.(); } }, FLY_MS * 3);
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
        if (residentById(ownerId)?.online) setTimeout(() => {
          const first = !get().threads[ownerId].msgs.some((m) => m.from === 'them');
          push({ from: 'them', text: demoReply(t, th.shopName), at: Date.now() });
          // 对聊开始：店铺上方冒出小爱心
          const door = shopDoorOf(ownerId);
          if (first && door && door.district === useTown.getState().district) useTown.getState().fxPush({ kind: 'heart', from: door.p });
        }, 1200);
      },
      leaveNeed(ownerId, n) {
        const th = get().threads[ownerId];
        if (!th) return;
        const body = `【需求】${n.what}｜预算：${n.budget || '待沟通'}｜时间：${n.when || '待沟通'}｜方式：${n.how}`;
        set((s) => ({ threads: { ...s.threads, [ownerId]: { ...th, msgs: [...th.msgs, { from: 'me', text: body, at: Date.now(), need: n }, { from: 'system', text: `已发送给 ${th.name}。对方上线后会在「消息」里收到这条需求，回复会通知你。`, at: Date.now() }] } } }));
        useTown.getState().notify({ kind: 'chat', title: `已把需求发给「${th.shopName ?? th.name}」`, body, needsMe: false, ref: ownerId });
        emitGame('leave_need');
        track('action', 'buy', 'leave_need');
        const door = shopDoorOf(ownerId);
        if (door && door.district === useTown.getState().district) useTown.getState().fxPush({ kind: 'heart', from: door.p });
      },
      agree(ownerId) {
        const th = get().threads[ownerId];
        if (!th) return;
        set((s) => ({ threads: { ...s.threads, [ownerId]: { ...th, agreed: true, msgs: [...th.msgs, { from: 'system', text: `🎉 你和 ${th.name} 达成了初步合作意向。下一步：在「机会」里发起需求单或成交确认单（合同与付款由双方本人确认）。`, at: Date.now() }] } } }));
        useCelebrate.getState().celebrate(`和「${th.shopName ?? th.name}」达成初步合作`);
        useTown.getState().notify({ kind: 'collab', title: `与「${th.shopName ?? th.name}」达成初步合作意向`, body: '可以在「机会」里继续发起需求单 / 成交确认单。', needsMe: false, ref: ownerId });
        track('action', 'buy', 'agree');
      },
    }),
    { name: 'sanlinbang-live', version: 1, partialize: (s) => ({ threads: s.threads }) },
  ),
);

/** 回来时：不在线的店主回复了你之前留下的需求（演示回复），并在「消息」里通知 */
registerPendingReplies(() => {
  const st = useLive.getState();
  const out: { name: string; shop?: string }[] = [];
  const threads = { ...st.threads };
  for (const [id, th] of Object.entries(threads)) {
    const needAt = th.msgs.filter((m) => m.need).map((m) => m.at).pop();
    if (!needAt || th.msgs.some((m) => m.from === 'them' && m.at > needAt)) continue;
    threads[id] = { ...th, unread: th.unread + 1, msgs: [...th.msgs, { from: 'them', text: `你好！刚看到你的需求，我们可以做。方便的话约个 15 分钟线上聊聊细节？（演示回复）`, at: Date.now() }] };
    useTown.getState().notify({ kind: 'chat', title: `${th.name} 回复了你的需求`, body: th.shopName ? `来自「${th.shopName}」` : '点「聊一聊」继续沟通', needsMe: true, ref: id });
    out.push({ name: th.name, shop: th.shopName });
  }
  useLive.setState({ threads });
  return out;
});
