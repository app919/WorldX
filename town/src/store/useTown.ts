/**
 * 全局状态（Zustand）。只存“业务状态 + UI 状态”；
 * 玩家每帧坐标放在 playerRuntime（可变对象）里，避免每帧触发 React 渲染。
 *
 * 持久化：localStorage（本地 Demo）。正式版把 persist 层替换为 Supabase，
 * 表结构见 supabase/migrations/0001_init.sql。
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AgentConfig, AgentReply, AuditLog, Avatar, BusinessProfile, CommunityEvent, Introduction, LifeTag, Meeting, OpcProfile, Wallet,
} from '../domain/types';
import { buildOpportunityMap } from '../domain/matching';
import { emptyWallet, reward, type RewardEvent } from '../domain/economy';
import * as intro from '../domain/introductions';
import { agentRespond } from '../domain/agent';
import { RESIDENTS, DEMO_EVENTS, type Resident } from '../data/seed';
import { SHOP_LOTS, spawnPosition } from '../data/buildings';

export const ME = 'me';

export type Tab = 'city' | 'map' | 'community' | 'messages' | 'me';

export interface InboxItem {
  id: string;
  kind: 'intro' | 'agent' | 'meeting' | 'system' | 'invite';
  title: string;
  body: string;
  at: number;
  read: boolean;
  ref?: string;
}

export interface Fx {
  id: string;
  kind: 'heart' | 'envelope' | 'handshake' | 'coins' | 'aroma' | 'bonk';
  from: { x: number; z: number };
  to?: { x: number; z: number };
  at: number;
}

export interface ChatMsg { from: 'visitor' | 'agent' | 'system'; text: string; reply?: AgentReply; at: number }

export interface TutorialState { walked: boolean; metSomeone: boolean; foundOpportunity: boolean; saidHello: boolean; booked: boolean }

interface TownState {
  phase: 'onboarding' | 'playing';
  avatar?: Avatar;
  profile?: BusinessProfile;
  myOpc?: OpcProfile;
  myAgent?: AgentConfig;
  intros: Introduction[];
  meetings: Meeting[];
  audit: AuditLog[];
  wallet: Wallet;
  inbox: InboxItem[];
  events: CommunityEvent[];
  visited: string[];
  friends: string[];
  chats: Record<string, ChatMsg[]>;
  collectedNeeds: { opcId: string; text: string; at: number }[];
  marketingOptIn: boolean;
  tutorial: TutorialState;
  // —— 非持久化 UI 状态 ——
  tab: Tab;
  hour: number;
  timeFlow: boolean;
  selectedBuilding?: string;
  selectedResident?: string;
  selectedLot?: string;
  chatOpc?: string;
  helloTarget?: string;
  wizardOpen: boolean;
  focusRelation?: string;
  autoWalk: boolean;
  walkTarget?: { x: number; z: number };
  streetName: string;
  fx: Fx[];
  toasts: { id: string; text: string; tone?: 'ok' | 'warn' | 'info' }[];

  // —— actions ——
  start(nickname: string, lifeTag: LifeTag, look: Avatar['look'], spawnId: string): void;
  setTab(t: Tab): void;
  setHour(h: number): void;
  toggleTimeFlow(): void;
  toggleNight(): void;
  select(kind: 'building' | 'resident' | 'lot' | null, id?: string): void;
  openChat(opcId?: string): void;
  openHello(userId?: string): void;
  setWizard(open: boolean): void;
  setAutoWalk(v: boolean): void;
  setWalkTarget(p?: { x: number; z: number }): void;
  setStreet(n: string): void;
  setLifeTag(t: LifeTag): void;
  focus(relId?: string): void;

  saveProfile(p: BusinessProfile): void;
  setOpenToConnect(v: boolean): void;
  openShop(opc: OpcProfile, agent: AgentConfig): void;
  updateAgent(patch: Partial<AgentConfig>): void;

  sayHello(toUserId: string, message: string, relationshipId?: string): void;
  consentContact(introId: string): void;
  book(introId: string, minutes: 15 | 30 | 60, startsAt: number, topic: string): void;
  proposeCollab(introId: string): void;

  askAgent(opcId: string, q: string): void;
  joinEvent(id: string): void;
  createEvent(e: Omit<CommunityEvent, 'id' | 'attendees' | 'hostId'>): void;

  visit(buildingId: string): void;
  makeFriend(userId: string): void;
  earn(e: RewardEvent): void;
  fxPush(f: Omit<Fx, 'id' | 'at'>): void;
  toast(text: string, tone?: 'ok' | 'warn' | 'info'): void;
  markRead(): void;
  setMarketing(v: boolean): void;
  markWalked(): void;
  reset(): void;
}

let n = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(n++).toString(36)}`;

export const residentById = (id: string): Resident | undefined => RESIDENTS.find((r) => r.id === id);
export const opcById = (id: string, mine?: OpcProfile): OpcProfile | undefined =>
  mine?.id === id ? mine : RESIDENTS.find((r) => r.opc?.id === id)?.opc;

/** 每个 OPC 的铺位：演示数据指定的铺位若不存在则自动分配空铺 */
export function lotOf(opc: OpcProfile): string {
  if (SHOP_LOTS.some((l) => l.id === opc.lotId)) return opc.lotId;
  return SHOP_LOTS[0].id;
}

const initialTutorial: TutorialState = { walked: false, metSomeone: false, foundOpportunity: false, saidHello: false, booked: false };

export const useTown = create<TownState>()(
  persist(
    (set, get) => {
      const log = (l: AuditLog) => set((s) => ({ audit: [l, ...s.audit].slice(0, 200) }));
      const inbox = (i: Omit<InboxItem, 'id' | 'at' | 'read'>) =>
        set((s) => ({ inbox: [{ ...i, id: uid('msg'), at: Date.now(), read: false }, ...s.inbox].slice(0, 100) }));
      const patchIntro = (next: Introduction) => set((s) => ({ intros: s.intros.map((i) => (i.id === next.id ? next : i)) }));

      /** 演示角色的回应（真实系统中由对方本人操作） */
      const demoRespond = (introId: string) => {
        const it = get().intros.find((i) => i.id === introId);
        if (!it) return;
        const r = residentById(it.toUserId);
        if (!r) return;
        const delay = r.online ? 1800 : 3200;
        setTimeout(() => {
          const cur = get().intros.find((i) => i.id === introId);
          if (!cur || cur.status !== 'sent') return;
          if (!r.online) get().toast(`${r.nickname}上线了（演示）`, 'info');
          const res = intro.respond(cur, r.id, r.demoAcceptsHello);
          patchIntro(res.intro); log(res.log);
          if (r.demoAcceptsHello) {
            const c = intro.consentContact(res.intro, r.id); // 演示：对方也愿意交换联系方式
            patchIntro(c.intro); log(c.log);
            inbox({ kind: 'intro', title: `${r.nickname} 接受了你的招呼 🤝`, body: '对方愿意交换联系方式，你确认后双方即可看到。也可以直接预约线上见面。', ref: introId });
            get().fxPush({ kind: 'handshake', from: get().avatar!.position });
            get().toast(`${r.nickname} 接受了你的招呼！`, 'ok');
          } else {
            inbox({ kind: 'intro', title: `${r.nickname} 暂时没空`, body: '对方礼貌地婉拒了，没关系，商业地图里还有其他可能～', ref: introId });
          }
        }, delay);
      };

      return {
        phase: 'onboarding',
        intros: [], meetings: [], audit: [], wallet: emptyWallet(), inbox: [], events: DEMO_EVENTS,
        visited: [], friends: [], chats: {}, collectedNeeds: [], marketingOptIn: true, tutorial: initialTutorial,
        tab: 'city', hour: 14.5, timeFlow: true, wizardOpen: false, autoWalk: false, streetName: '武康路', fx: [], toasts: [],

        start(nickname, lifeTag, look, spawnId) {
          const avatar: Avatar = { id: uid('av'), userId: ME, nickname: nickname || '小萌新', lifeTag, look, position: spawnPosition(spawnId) };
          set({ avatar, phase: 'playing' });
          set((s) => ({ wallet: reward(s.wallet, 'daily_login') }));
          inbox({ kind: 'system', title: '欢迎来到沪上软萌生意街 ☕', body: '先随便走走吧！遇到有趣的人点一下 TA，AI 会悄悄告诉你你们有没有合作的可能。' });
        },
        setTab: (tab) => set({ tab, selectedBuilding: undefined, selectedResident: undefined, selectedLot: undefined }),
        setHour: (hour) => set({ hour: ((hour % 24) + 24) % 24 }),
        toggleTimeFlow: () => set((s) => ({ timeFlow: !s.timeFlow })),
        toggleNight: () => set((s) => ({ hour: s.hour >= 6.5 && s.hour < 18 ? 20 : 10 })),
        select(kind, id) {
          set({ selectedBuilding: kind === 'building' ? id : undefined, selectedResident: kind === 'resident' ? id : undefined, selectedLot: kind === 'lot' ? id : undefined });
          if (kind === 'resident') set((s) => ({ tutorial: { ...s.tutorial, metSomeone: true } }));
        },
        openChat: (chatOpc) => set({ chatOpc }),
        openHello: (helloTarget) => set({ helloTarget }),
        setWizard: (wizardOpen) => set({ wizardOpen }),
        setAutoWalk: (autoWalk) => set({ autoWalk, walkTarget: undefined }),
        setWalkTarget: (walkTarget) => set({ walkTarget, autoWalk: false }),
        setStreet: (streetName) => { if (get().streetName !== streetName) set({ streetName }); },
        setLifeTag: (t) => set((s) => (s.avatar ? { avatar: { ...s.avatar, lifeTag: t } } : {})),
        focus: (focusRelation) => set({ focusRelation }),

        saveProfile(p) {
          set((s) => ({ profile: { ...p, confirmed: true }, tutorial: { ...s.tutorial, foundOpportunity: true } }));
          log({ id: uid('log'), at: Date.now(), actor: ME, action: 'profile.confirmed' });
          const rels = buildOpportunityMap({ ...p, confirmed: true }, RESIDENTS.map((r) => r.profile));
          if (rels.length) inbox({ kind: 'system', title: `AI 发现了 ${rels.length} 条商业可能性 ✨`, body: '打开「商业地图」看看你身边可能与你合作的人。这些都是推测，需要你们自己确认。' });
        },
        setOpenToConnect: (v) => set((s) => (s.profile ? { profile: { ...s.profile, openToConnect: v } } : {})),

        openShop(opc, agent) {
          set((s) => ({ myOpc: opc, myAgent: agent, wizardOpen: false, wallet: reward(s.wallet, 'shop_opened') }));
          log({ id: uid('log'), at: Date.now(), actor: ME, action: 'opc.opened', target: opc.id, detail: opc.entityStatus });
          const lot = SHOP_LOTS.find((l) => l.id === opc.lotId);
          if (lot) get().fxPush({ kind: 'coins', from: lot.pos });
          inbox({ kind: 'system', title: '开张啦！🎉', body: `你的第一家虚拟 OPC 店铺「${opc.name}」已经上线。注意：这是个人创业主页，不代表已注册公司或获得企业法人资格。` });
          get().toast('开张啦！你的小店已上线', 'ok');
        },
        updateAgent(patch) {
          set((s) => (s.myAgent ? { myAgent: { ...s.myAgent, ...patch, enabledLevels: { ...s.myAgent.enabledLevels, ...(patch.enabledLevels ?? {}) } } } : {}));
          log({ id: uid('log'), at: Date.now(), actor: ME, action: 'agent.config', detail: JSON.stringify(patch) });
        },

        sayHello(toUserId, message, relationshipId) {
          try {
            const res = intro.sendHello(get().intros, ME, toUserId, message, relationshipId);
            set((s) => ({ intros: [res.intro, ...s.intros], helloTarget: undefined, wallet: reward(s.wallet, 'send_hello'), tutorial: { ...s.tutorial, saidHello: true } }));
            log(res.log);
            const r = residentById(toUserId);
            const target = r ? residentAnchor(r) : undefined;
            get().fxPush({ kind: 'envelope', from: get().avatar!.position, to: target });
            get().toast(`奶油信封已飞向 ${r?.nickname ?? '对方'} 💌`, 'ok');
            demoRespond(res.intro.id);
          } catch (e) {
            get().toast((e as Error).message, 'warn');
          }
        },
        consentContact(introId) {
          const it = get().intros.find((i) => i.id === introId);
          if (!it) return;
          try {
            const res = intro.consentContact(it, ME);
            patchIntro(res.intro); log(res.log);
            get().toast(intro.canSeeContact(res.intro) ? '双方都同意了，联系方式已互相可见' : '已同意，等待对方同意', 'ok');
          } catch (e) { get().toast((e as Error).message, 'warn'); }
        },
        book(introId, minutes, startsAt, topic) {
          const it = get().intros.find((i) => i.id === introId);
          if (!it) return;
          try {
            const res = intro.bookMeeting(it, ME, minutes, startsAt, topic);
            patchIntro(res.intro); log(res.log);
            set((s) => ({ meetings: [res.meeting, ...s.meetings], wallet: reward(s.wallet, 'meeting_booked'), tutorial: { ...s.tutorial, booked: true } }));
            const other = residentById(res.meeting.guestId);
            inbox({ kind: 'meeting', title: `已预约 ${minutes} 分钟线上见面`, body: `与 ${other?.nickname ?? '对方'}：${topic}。你们的店铺之间亮起了一条商业连接线 ✨`, ref: res.meeting.id });
            get().toast('预约成功！你们之间出现了一条发光的连接线', 'ok');
          } catch (e) { get().toast((e as Error).message, 'warn'); }
        },
        proposeCollab(introId) {
          const it = get().intros.find((i) => i.id === introId);
          if (!it) return;
          try {
            const res = intro.confirmCollab(it, ME);
            patchIntro(res.intro); log(res.log);
            get().toast('已提出合作记录，需要对方本人确认', 'info');
            const r = residentById(it.toUserId === ME ? it.fromUserId : it.toUserId);
            if (r?.demoAcceptsHello) {
              setTimeout(() => {
                const cur = get().intros.find((i) => i.id === introId);
                if (!cur || cur.status === 'collab_confirmed') return;
                const c = intro.confirmCollab(cur, r.id);
                patchIntro(c.intro); log(c.log);
                set((s) => ({ wallet: reward(s.wallet, 'helped_match') }));
                inbox({ kind: 'intro', title: `${r.nickname} 确认了合作记录（演示）`, body: '合作记录由双方本人确认，AI 不会擅自认定。' });
                get().fxPush({ kind: 'coins', from: residentAnchor(r) });
              }, 2000);
            }
          } catch (e) { get().toast((e as Error).message, 'warn'); }
        },

        askAgent(opcId, q) {
          const opc = opcById(opcId, get().myOpc);
          if (!opc) return;
          const owner = residentById(opc.ownerId);
          const cfg = opc.id === get().myOpc?.id ? get().myAgent! : owner?.agent ?? defaultAgent(opc.id, !!owner?.online);
          const reply = agentRespond(opc, cfg, q);
          const now = Date.now();
          set((s) => ({
            chats: { ...s.chats, [opcId]: [...(s.chats[opcId] ?? []), { from: 'visitor', text: q, at: now }, { from: 'agent', text: reply.text, reply, at: now + 1 }] },
          }));
          log({ id: uid('log'), at: now, actor: `agent:${cfg.id}`, action: `agent.reply.${reply.level}`, target: opcId, detail: reply.citations.join(',') });
          if (reply.action?.kind === 'collect_need') set((s) => ({ collectedNeeds: [{ opcId, text: q, at: now }, ...s.collectedNeeds] }));
          if (reply.handoff) inbox({ kind: 'agent', title: `AI 分身已把问题转交「${opc.name}」主理人`, body: `「${q}」—— 主理人上线后会亲自回复。`, ref: opcId });
        },
        joinEvent(id) {
          const ev = get().events.find((e) => e.id === id);
          if (!ev) return;
          if (ev.attendees.includes(ME)) return get().toast('你已经报名啦', 'info');
          if (ev.attendees.length >= ev.capacity) return get().toast('人数已满', 'warn');
          set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, attendees: [...e.attendees, ME] } : e)), wallet: reward(s.wallet, 'event_joined') }));
          inbox({ kind: 'invite', title: ev.needsApproval ? `已申请「${ev.title}」，等待主理人审核` : `已报名「${ev.title}」`, body: `${ev.weekday} ${ev.time} · ${ev.online ? '线上' : '线下'}${ev.fee ? ` · ¥${ev.fee}（Demo 不发生真实支付）` : ' · 免费'}` });
          get().toast('报名成功', 'ok');
        },
        createEvent(e) {
          const ev: CommunityEvent = { ...e, id: uid('ev'), attendees: [ME], hostId: ME };
          set((s) => ({ events: [ev, ...s.events] }));
          log({ id: uid('log'), at: Date.now(), actor: ME, action: 'event.created', target: ev.id });
          get().toast('活动已发布', 'ok');
        },

        visit(buildingId) {
          if (get().visited.includes(buildingId)) return;
          set((s) => ({ visited: [...s.visited, buildingId], wallet: reward(reward(s.wallet, 'building_visit'), 'citywalk_checkin') }));
          get().toast('打卡成功 +5 ⭐', 'ok');
        },
        makeFriend(userId) {
          if (get().friends.includes(userId)) return;
          set((s) => ({ friends: [...s.friends, userId], wallet: reward(s.wallet, 'make_friend') }));
          const r = residentById(userId);
          if (r) get().fxPush({ kind: 'heart', from: residentAnchor(r) });
        },
        earn: (e) => set((s) => ({ wallet: reward(s.wallet, e) })),
        fxPush(f) {
          const fx: Fx = { ...f, id: uid('fx'), at: performance.now() };
          set((s) => ({ fx: [...s.fx, fx].slice(-20) }));
          setTimeout(() => set((s) => ({ fx: s.fx.filter((x) => x.id !== fx.id) })), 2600);
        },
        toast(text, tone = 'info') {
          const id = uid('t');
          set((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-4) }));
          setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
        },
        markRead: () => set((s) => ({ inbox: s.inbox.map((i) => ({ ...i, read: true })) })),
        setMarketing: (marketingOptIn) => set({ marketingOptIn }),
        markWalked: () => { if (!get().tutorial.walked) set((s) => ({ tutorial: { ...s.tutorial, walked: true } })); },
        reset() {
          try { localStorage.removeItem('opc-town'); } catch { /* 存储不可用时忽略 */ }
          location.reload();
        },
      } as TownState;
    },
    {
      name: 'opc-town',
      version: 1,
      partialize: (s) => ({
        phase: s.phase, avatar: s.avatar, profile: s.profile, myOpc: s.myOpc, myAgent: s.myAgent, intros: s.intros,
        meetings: s.meetings, audit: s.audit, wallet: s.wallet, inbox: s.inbox, events: s.events, visited: s.visited,
        friends: s.friends, chats: s.chats, collectedNeeds: s.collectedNeeds, marketingOptIn: s.marketingOptIn, tutorial: s.tutorial,
      }),
    },
  ),
);

export function defaultAgent(opcId: string, ownerOnline: boolean): AgentConfig {
  return { id: `agent_${opcId}`, opcId, persona: '亲切、简洁', enabledLevels: { L1: true, L2: true }, autoReception: true, ownerOnline, ownerTakeover: false };
}

/** 居民在地图上的“锚点”：有店铺则在店门口，否则在常驻地点 */
export function residentAnchor(r: Resident): { x: number; z: number } {
  const lotId = r.opc ? lotOf(r.opc) : r.haunt;
  const lot = SHOP_LOTS.find((l) => l.id === lotId);
  if (lot) return { x: lot.pos.x + Math.sin(lot.rotation) * 2.2, z: lot.pos.z + Math.cos(lot.rotation) * 2.2 };
  return spawnPosition(r.haunt);
}

/** 我的店铺/小人在地图上的锚点（连接线起点） */
export function myAnchor(s: Pick<TownState, 'myOpc' | 'avatar'>): { x: number; z: number } {
  if (s.myOpc) {
    const lot = SHOP_LOTS.find((l) => l.id === s.myOpc!.lotId);
    if (lot) return lot.pos;
  }
  return s.avatar?.position ?? { x: 0, z: 0 };
}

/** 选择器：我的商业可能性地图 */
export function useOpportunities() {
  const profile = useTown((s) => s.profile);
  return useMemo(() => (profile ? buildOpportunityMap(profile, RESIDENTS.map((r) => r.profile)) : []), [profile]);
}

/** 玩家每帧运行时状态（非 React） */
export const playerRuntime = { x: 0, z: 0, heading: 0, moving: false, bumpUntil: 0 };
