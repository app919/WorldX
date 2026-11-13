/**
 * 全局状态（Zustand）V2。
 * - 业务状态持久化在浏览器（Demo）；正式版替换为 Supabase（见 supabase/migrations）。
 * - 玩家每帧坐标放在 playerRuntime，避免每帧触发 React 渲染。
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig, AgentReply, AuditLog, Avatar, BusinessProfile, Introduction, LifeTag, Meeting, OpcProfile, Wallet } from '../domain/types';
import { buildBusinessMap, type BizRelType, type DistrictKey } from '../domain/commerce';
import { emptyWallet, reward, type RewardEvent } from '../domain/economy';
import * as intro from '../domain/introductions';
import { agentRespond } from '../domain/agent';
import { COUNTERPARTIES, RESIDENTS, SHOPS, entityById, residentById } from '../data/seed';
import { EVENTS, type TownEvent } from '../data/events';
import { DISTRICTS, allLots, compiledOf, navOf, streetOfDoor } from '../world';

export const ME = 'me';
export type Tab = 'city' | 'biz' | 'chain' | 'opps' | 'center' | 'community' | 'messages' | 'me';

export type InboxKind = 'chat' | 'agent' | 'invite' | 'collab' | 'meeting' | 'event' | 'order' | 'system';
export const INBOX_LABEL: Record<InboxKind, string> = {
  chat: '真人私聊', agent: 'AI 接待记录', invite: '商业邀约', collab: '合作申请', meeting: '会议预约', event: '活动通知', order: '订单通知', system: '系统',
};

export interface InboxItem { id: string; kind: InboxKind; title: string; body: string; at: number; read: boolean; needsMe: boolean; handledByAgent?: boolean; ref?: string }
export interface Fx { id: string; kind: 'heart' | 'envelope' | 'handshake' | 'coins' | 'aroma' | 'bonk' | 'door'; from: { x: number; z: number }; to?: { x: number; z: number }; at: number }
export interface ChatMsg { from: 'visitor' | 'agent' | 'system'; text: string; reply?: AgentReply; at: number }
export interface TutorialState { walked: boolean; enteredShop: boolean; foundCustomer: boolean; saidHello: boolean; booked: boolean }

export type Card =
  | { kind: 'resident'; id: string }
  | { kind: 'entity'; id: string }
  | { kind: 'landmark'; id: string }
  | { kind: 'lot'; id: string }
  | { kind: 'door'; label: string };

interface TownState {
  phase: 'onboarding' | 'playing';
  avatar?: Avatar & { district: DistrictKey };
  profile?: BusinessProfile;
  myOpc?: OpcProfile;
  myAgent?: AgentConfig;
  intros: Introduction[];
  meetings: Meeting[];
  audit: AuditLog[];
  wallet: Wallet;
  inbox: InboxItem[];
  joinedEvents: string[];
  myEvents: TownEvent[];
  savedLeads: string[];
  chats: Record<string, ChatMsg[]>;
  collectedNeeds: { opcId: string; text: string; at: number }[];
  marketingOptIn: boolean;
  tutorial: TutorialState;
  friends: string[];
  visited: string[];

  // UI（不持久化）
  tab: Tab;
  district: DistrictKey;
  hour: number;
  timeFlow: boolean;
  card?: Card;
  chatOpc?: string;
  helloTarget?: string;
  wizardOpen: boolean;
  preferredLot?: string;
  bizType: BizRelType;
  bizFocus?: string;
  showMarkers: boolean;
  autoWalk: boolean;
  walkPath?: { x: number; z: number }[];
  streetName: string;
  fx: Fx[];
  toasts: { id: string; text: string; tone?: 'ok' | 'warn' | 'info' }[];
  eventFocus?: string;

  start(nickname: string, lifeTag: LifeTag, look: Avatar['look'], district: DistrictKey): void;
  setTab(t: Tab): void;
  goDistrict(d: DistrictKey, at?: { x: number; z: number }): void;
  setHour(h: number): void;
  toggleTimeFlow(): void;
  toggleNight(): void;
  openCard(c?: Card): void;
  openChat(opcId?: string): void;
  openHello(userId?: string): void;
  setWizard(open: boolean, lot?: string): void;
  setAutoWalk(v: boolean): void;
  walkTo(p: { x: number; z: number }): boolean;
  clearPath(): void;
  setStreet(n: string): void;
  setLifeTag(t: LifeTag): void;
  setBiz(type: BizRelType, focus?: string): void;
  setShowMarkers(v: boolean): void;
  focusEvent(id?: string): void;

  saveProfile(p: BusinessProfile): void;
  setOpenToConnect(v: boolean): void;
  openShop(opc: OpcProfile, agent: AgentConfig): void;
  updateAgent(patch: Partial<AgentConfig>): void;
  enterLot(lotId: string): void;

  sayHello(toUserId: string, message: string, relationshipId?: string): void;
  consentContact(introId: string): void;
  book(introId: string, minutes: 15 | 30 | 60, startsAt: number, topic: string): void;
  proposeCollab(introId: string): void;
  saveLead(entityId: string): void;

  askAgent(opcId: string, q: string): void;
  joinEvent(id: string): void;
  createEvent(e: TownEvent): void;

  visit(id: string): void;
  makeFriend(userId: string): void;
  earn(e: RewardEvent): void;
  fxPush(f: Omit<Fx, 'id' | 'at'>): void;
  toast(text: string, tone?: 'ok' | 'warn' | 'info'): void;
  markRead(kind?: InboxKind): void;
  setMarketing(v: boolean): void;
  markWalked(): void;
  reset(): void;
}

let n = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(n++).toString(36)}`;

export const shopById = (id: string, mine?: OpcProfile) => (mine?.id === id ? mine : SHOPS.find((s) => s.id === id));
export const streetOfDistrict = (d: DistrictKey) => DISTRICTS[d].name;

/** 人物在地图上的锚点：有店的站在店门口，没有店的在所属街区的人行道上 */
export function residentAnchor(r: { id: string; entityId: string; district: DistrictKey }): { district: DistrictKey; p: { x: number; z: number } } {
  const e = entityById(r.entityId);
  const lot = e?.place.lotId ? allLots().find((l) => l.door.lotId === e.place.lotId) : undefined;
  if (lot) return { district: lot.district, p: lot.door.trigger };
  const nav = navOf(r.district);
  const def = DISTRICTS[r.district];
  const k = r.id.length * 7.3;
  const guess = { x: def.spawn.x + Math.cos(k) * 9, z: def.spawn.z + Math.sin(k) * 9 };
  return { district: r.district, p: nav.nearestWalkable(guess, 20) ?? def.spawn };
}

export function myAnchor(s: Pick<TownState, 'myOpc' | 'avatar'>): { district: DistrictKey; p: { x: number; z: number } } | undefined {
  if (s.myOpc) {
    const lot = allLots().find((l) => l.door.lotId === s.myOpc!.lotId);
    if (lot) return { district: lot.district, p: lot.door.trigger };
  }
  return s.avatar ? { district: s.avatar.district, p: s.avatar.position } : undefined;
}

const initialTutorial: TutorialState = { walked: false, enteredShop: false, foundCustomer: false, saidHello: false, booked: false };

export const useTown = create<TownState>()(
  persist(
    (set, get) => {
      const log = (l: Omit<AuditLog, 'id' | 'at'>) => set((s) => ({ audit: [{ ...l, id: uid('log'), at: Date.now() }, ...s.audit].slice(0, 200) }));
      const inbox = (i: Omit<InboxItem, 'id' | 'at' | 'read'>) => set((s) => ({ inbox: [{ ...i, id: uid('msg'), at: Date.now(), read: false }, ...s.inbox].slice(0, 120) }));
      const patchIntro = (next: Introduction) => set((s) => ({ intros: s.intros.map((i) => (i.id === next.id ? next : i)) }));

      const demoRespond = (introId: string) => {
        const it = get().intros.find((i) => i.id === introId);
        const r = it && residentById(it.toUserId);
        if (!it || !r) return;
        setTimeout(() => {
          const cur = get().intros.find((i) => i.id === introId);
          if (!cur || cur.status !== 'sent') return;
          if (!r.online) get().toast(`${r.nickname}上线了（演示）`, 'info');
          const res = intro.respond(cur, r.id, r.demoAcceptsHello);
          patchIntro(res.intro); log(res.log);
          if (r.demoAcceptsHello) {
            const c = intro.consentContact(res.intro, r.id);
            patchIntro(c.intro); log(c.log);
            inbox({ kind: 'invite', title: `${r.nickname} 接受了你的招呼`, body: '对方愿意交换联系方式。你确认后双方才能看到；也可以直接预约线上见面。', needsMe: true, ref: introId });
            get().fxPush({ kind: 'handshake', from: get().avatar!.position });
            get().toast(`${r.nickname} 接受了你的招呼`, 'ok');
          } else {
            inbox({ kind: 'invite', title: `${r.nickname} 暂时没空`, body: '对方礼貌地婉拒了。', needsMe: false, ref: introId });
          }
        }, r.online ? 1800 : 3200);
      };

      return {
        phase: 'onboarding', intros: [], meetings: [], audit: [], wallet: emptyWallet(), inbox: [], joinedEvents: [], myEvents: [], savedLeads: [],
        chats: {}, collectedNeeds: [], marketingOptIn: true, tutorial: initialTutorial, friends: [], visited: [],
        tab: 'city', district: 'wukang', hour: 14.5, timeFlow: true, wizardOpen: false, bizType: 'customer', showMarkers: true,
        autoWalk: false, streetName: '淮海中路', fx: [], toasts: [],

        start(nickname, lifeTag, look, district) {
          const spawn = navOf(district).nearestWalkable(DISTRICTS[district].spawn) ?? DISTRICTS[district].spawn;
          set({ avatar: { id: uid('av'), userId: ME, nickname: nickname || '小萌新', lifeTag, look, position: spawn, district }, district, phase: 'playing' });
          set((s) => ({ wallet: reward(s.wallet, 'daily_login') }));
          inbox({ kind: 'system', title: '欢迎来到三邻邦（OPC Town）', body: '在上海，逛着逛着，就可能找到下一位客户。走在人行道上，从斑马线过马路，从门口进店。', needsMe: false });
        },
        setTab: (tab) => set({ tab, card: undefined }),
        goDistrict(d, at) {
          const nav = navOf(d);
          const p = (at && nav.nearestWalkable(at, 6)) ?? nav.nearestWalkable(DISTRICTS[d].spawn) ?? DISTRICTS[d].spawn;
          set((s) => ({ district: d, card: undefined, walkPath: undefined, autoWalk: false, avatar: s.avatar ? { ...s.avatar, district: d, position: p } : s.avatar }));
          playerRuntime.x = p.x; playerRuntime.z = p.z; playerRuntime.teleported = true;
        },
        setHour: (hour) => set({ hour: ((hour % 24) + 24) % 24 }),
        toggleTimeFlow: () => set((s) => ({ timeFlow: !s.timeFlow })),
        toggleNight: () => set((s) => ({ hour: s.hour >= 6.5 && s.hour < 18 ? 20 : 10 })),
        openCard: (card) => set({ card }),
        openChat: (chatOpc) => {
          set({ chatOpc });
          if (chatOpc) set((s) => ({ tutorial: { ...s.tutorial, enteredShop: true } }));
        },
        openHello: (helloTarget) => set({ helloTarget }),
        setWizard: (wizardOpen, preferredLot) => set({ wizardOpen, preferredLot }),
        setAutoWalk: (autoWalk) => set({ autoWalk, walkPath: undefined }),
        walkTo(p) {
          const path = navOf(get().district).findPath(playerRuntime, p);
          if (!path) { get().toast('那里走不过去哦：请走人行道，从斑马线过马路', 'warn'); return false; }
          set({ walkPath: path, autoWalk: false });
          return true;
        },
        clearPath: () => set({ walkPath: undefined }),
        setStreet: (streetName) => { if (get().streetName !== streetName) set({ streetName }); },
        setLifeTag: (t) => set((s) => (s.avatar ? { avatar: { ...s.avatar, lifeTag: t } } : {})),
        setBiz: (bizType, bizFocus) => set({ bizType, bizFocus }),
        setShowMarkers: (showMarkers) => set({ showMarkers }),
        focusEvent: (eventFocus) => set({ eventFocus }),

        saveProfile(p) {
          set((s) => ({ profile: { ...p, confirmed: true }, tutorial: { ...s.tutorial, foundCustomer: true } }));
          log({ actor: ME, action: 'profile.confirmed' });
          const m = buildBusinessMap({ ...p, confirmed: true }, COUNTERPARTIES, streetOfDistrict);
          inbox({ kind: 'system', title: `找到 ${m.counts.customer} 个潜在客户`, body: '打开「我的生意」看看他们在哪里、可能需要什么。标注“系统推测”的需求尚未核实。', needsMe: false });
        },
        setOpenToConnect: (v) => set((s) => (s.profile ? { profile: { ...s.profile, openToConnect: v } } : {})),
        openShop(opc, agent) {
          set((s) => ({ myOpc: opc, myAgent: agent, wizardOpen: false, wallet: reward(s.wallet, 'shop_opened') }));
          log({ actor: ME, action: 'opc.opened', target: opc.id, detail: opc.entityStatus });
          const lot = allLots().find((l) => l.door.lotId === opc.lotId);
          if (lot) { get().goDistrict(lot.district, lot.door.trigger); get().fxPush({ kind: 'coins', from: lot.door.p }); }
          inbox({ kind: 'system', title: '开张啦！', body: `「${opc.name}」已上线。这是个人创业主页，不代表已注册公司或获得企业法人资格。`, needsMe: false });
          get().toast('开张啦！你的小店已上线', 'ok');
        },
        updateAgent(patch) {
          set((s) => (s.myAgent ? { myAgent: { ...s.myAgent, ...patch, enabledLevels: { ...s.myAgent.enabledLevels, ...(patch.enabledLevels ?? {}) } } } : {}));
          log({ actor: ME, action: 'agent.config', detail: JSON.stringify(patch) });
        },
        enterLot(lotId) {
          const s = get();
          if (s.myOpc?.lotId === lotId) return s.openChat(s.myOpc.id);
          const shop = SHOPS.find((x) => x.lotId === lotId);
          if (shop) { s.fxPush({ kind: 'door', from: playerRuntime }); return s.openChat(shop.id); }
          const ent = COUNTERPARTIES.find((c) => c.place.lotId === lotId);
          if (ent) return s.openCard({ kind: 'entity', id: ent.id });
          s.openCard({ kind: 'lot', id: lotId });
        },

        sayHello(toUserId, message, relationshipId) {
          try {
            const res = intro.sendHello(get().intros, ME, toUserId, message, relationshipId);
            set((s) => ({ intros: [res.intro, ...s.intros], helloTarget: undefined, wallet: reward(s.wallet, 'send_hello'), tutorial: { ...s.tutorial, saidHello: true } }));
            log(res.log);
            const r = residentById(toUserId);
            const a = r && residentAnchor(r);
            get().fxPush({ kind: 'envelope', from: playerRuntime, to: a && a.district === get().district ? a.p : undefined });
            get().toast(`奶油信封已送出`, 'ok');
            demoRespond(res.intro.id);
          } catch (e) { get().toast((e as Error).message, 'warn'); }
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
            inbox({ kind: 'meeting', title: `已预约 ${minutes} 分钟线上见面`, body: `与 ${other?.nickname ?? '对方'}：${topic}`, needsMe: false, ref: res.meeting.id });
            get().toast('预约成功！你们之间亮起了一条商业连接线', 'ok');
          } catch (e) { get().toast((e as Error).message, 'warn'); }
        },
        proposeCollab(introId) {
          const it = get().intros.find((i) => i.id === introId);
          if (!it) return;
          try {
            const res = intro.confirmCollab(it, ME);
            patchIntro(res.intro); log(res.log);
            inbox({ kind: 'collab', title: '已提出合作记录', body: '等待对方本人确认。AI 不会代为确认。', needsMe: false, ref: introId });
            const r = residentById(it.toUserId === ME ? it.fromUserId : it.toUserId);
            if (r?.demoAcceptsHello) setTimeout(() => {
              const cur = get().intros.find((i) => i.id === introId);
              if (!cur || cur.status === 'collab_confirmed') return;
              const c = intro.confirmCollab(cur, r.id);
              patchIntro(c.intro); log(c.log);
              set((s) => ({ wallet: reward(s.wallet, 'helped_match') }));
              inbox({ kind: 'collab', title: `${r.nickname} 确认了合作记录（演示）`, body: '双方本人确认的合作，会计入你的商业成长。', needsMe: false });
              const a = residentAnchor(r);
              if (a.district === get().district) get().fxPush({ kind: 'coins', from: a.p });
            }, 2000);
          } catch (e) { get().toast((e as Error).message, 'warn'); }
        },
        saveLead(entityId) {
          if (get().savedLeads.includes(entityId)) return;
          set((s) => ({ savedLeads: [...s.savedLeads, entityId] }));
          log({ actor: ME, action: 'lead.saved', target: entityId });
          get().toast('已收藏为线索', 'ok');
        },

        askAgent(opcId, q) {
          const opc = shopById(opcId, get().myOpc);
          if (!opc) return;
          const owner = residentById(opc.ownerId);
          const mine = opc.id === get().myOpc?.id;
          const cfg: AgentConfig = mine ? get().myAgent! : { id: `agent_${opc.id}`, opcId: opc.id, persona: '亲切', enabledLevels: { L1: true, L2: true }, autoReception: true, ownerOnline: !!owner?.online, ownerTakeover: false };
          const reply = agentRespond(opc, cfg, q);
          const now = Date.now();
          set((s) => ({ chats: { ...s.chats, [opcId]: [...(s.chats[opcId] ?? []), { from: 'visitor', text: q, at: now }, { from: 'agent', text: reply.text, reply, at: now + 1 }] } }));
          log({ actor: `agent:${cfg.id}`, action: `agent.reply.${reply.level}`, target: opcId, detail: reply.citations.join(',') });
          if (reply.action?.kind === 'collect_need') set((s) => ({ collectedNeeds: [{ opcId, text: q, at: now }, ...s.collectedNeeds] }));
          inbox({
            kind: 'agent', title: reply.handoff ? `「${opc.name}」AI 分身已转交主理人` : `「${opc.name}」AI 分身已回复`,
            body: `「${q}」→ ${reply.level}${reply.handoff ? '，等待主理人本人处理' : ''}`, needsMe: false, handledByAgent: !reply.handoff, ref: opcId,
          });
        },
        joinEvent(id) {
          const ev = [...EVENTS, ...get().myEvents].find((e) => e.id === id);
          if (!ev || get().joinedEvents.includes(id)) return;
          set((s) => ({ joinedEvents: [...s.joinedEvents, id], wallet: reward(s.wallet, 'event_joined') }));
          inbox({ kind: 'event', title: ev.needsApproval ? `已申请「${ev.title}」，等待主办方审核` : `已报名「${ev.title}」`, body: `${ev.date} ${ev.time} · ${ev.address}${ev.fee ? ` · ¥${ev.fee}（Demo 不发生真实支付）` : ''}`, needsMe: false });
          get().toast(ev.needsApproval ? '已提交申请' : '报名成功', 'ok');
        },
        createEvent(e) {
          set((s) => ({ myEvents: [e, ...s.myEvents], joinedEvents: [...s.joinedEvents, e.id] }));
          log({ actor: ME, action: 'event.created', target: e.id });
          get().toast('活动已发布', 'ok');
        },

        visit(id) {
          if (get().visited.includes(id)) return;
          set((s) => ({ visited: [...s.visited, id], wallet: reward(reward(s.wallet, 'building_visit'), 'citywalk_checkin') }));
          get().toast('打卡成功 +5 ⭐', 'ok');
        },
        makeFriend(userId) {
          if (get().friends.includes(userId)) return;
          set((s) => ({ friends: [...s.friends, userId], wallet: reward(s.wallet, 'make_friend') }));
          const r = residentById(userId);
          if (r) { const a = residentAnchor(r); if (a.district === get().district) get().fxPush({ kind: 'heart', from: a.p }); }
        },
        earn: (e) => set((s) => ({ wallet: reward(s.wallet, e) })),
        fxPush(f) {
          const fx: Fx = { ...f, from: { x: f.from.x, z: f.from.z }, id: uid('fx'), at: performance.now() };
          set((s) => ({ fx: [...s.fx, fx].slice(-20) }));
          setTimeout(() => set((s) => ({ fx: s.fx.filter((x) => x.id !== fx.id) })), 2600);
        },
        toast(text, tone = 'info') {
          const id = uid('t');
          set((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-3) }));
          setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
        },
        markRead: (kind) => set((s) => ({ inbox: s.inbox.map((i) => (!kind || i.kind === kind ? { ...i, read: true } : i)) })),
        setMarketing: (marketingOptIn) => set({ marketingOptIn }),
        markWalked: () => { if (!get().tutorial.walked) set((s) => ({ tutorial: { ...s.tutorial, walked: true } })); },
        reset() {
          try { localStorage.removeItem('opc-town-v2'); } catch { /* 存储不可用时忽略 */ }
          location.reload();
        },
      };
    },
    {
      name: 'opc-town-v2',
      version: 2,
      partialize: (s) => ({
        phase: s.phase, avatar: s.avatar, profile: s.profile, myOpc: s.myOpc, myAgent: s.myAgent, intros: s.intros, meetings: s.meetings,
        audit: s.audit, wallet: s.wallet, inbox: s.inbox, joinedEvents: s.joinedEvents, myEvents: s.myEvents, savedLeads: s.savedLeads,
        chats: s.chats, collectedNeeds: s.collectedNeeds, marketingOptIn: s.marketingOptIn, tutorial: s.tutorial, friends: s.friends,
        visited: s.visited, district: s.district,
      }),
    },
  ),
);

export function defaultAgent(opcId: string, ownerOnline: boolean): AgentConfig {
  return { id: `agent_${opcId}`, opcId, persona: '亲切、简洁', enabledLevels: { L1: true, L2: true }, autoReception: true, ownerOnline, ownerTakeover: false };
}

/** 我的商业地图（客户优先） */
export function useBusinessMap() {
  const profile = useTown((s) => s.profile);
  return useMemo(() => (profile ? buildBusinessMap(profile, COUNTERPARTIES, streetOfDistrict) : null), [profile]);
}

/** 街区活力指数：明确的计算依据，而不是一个没有解释的百分比 */
export function vitality(d: DistrictKey, st: Pick<TownState, 'myOpc' | 'intros' | 'myEvents'>) {
  const lots = allLots().filter((l) => l.district === d);
  const occupied = lots.filter((l) => SHOPS.some((s) => s.lotId === l.door.lotId) || COUNTERPARTIES.some((c) => c.place.lotId === l.door.lotId) || st.myOpc?.lotId === l.door.lotId);
  const settled = lots.filter((l) => SHOPS.some((s) => s.lotId === l.door.lotId) || st.myOpc?.lotId === l.door.lotId);
  const owners = RESIDENTS.filter((r) => r.district === d);
  const active = owners.filter((r) => r.online);
  const events = [...EVENTS, ...st.myEvents].filter((e) => e.district === d).length;
  const collabs = st.intros.filter((i) => i.status === 'collab_confirmed' && residentById(i.toUserId)?.district === d).length;
  const parts = [
    { label: '已入驻店铺', value: `${settled.length}/${lots.length} 个铺位`, score: lots.length ? (settled.length / lots.length) * 100 : 0, w: 0.35 },
    { label: '活跃主理人', value: `${active.length}/${owners.length} 人在线`, score: owners.length ? (active.length / owners.length) * 100 : 0, w: 0.25 },
    { label: '本周活动', value: `${events} 场`, score: Math.min(100, events * 35), w: 0.25 },
    { label: '已确认合作', value: `${collabs} 个`, score: Math.min(100, collabs * 50), w: 0.15 },
  ];
  return { score: Math.round(parts.reduce((s, p) => s + p.score * p.w, 0)), parts, occupied: occupied.length, total: lots.length };
}

export const playerRuntime = { x: 0, z: 0, heading: 0, moving: false, bumpUntil: 0, teleported: false, /** 点了「找到我」的时间（performance.now 毫秒） */ locateAt: 0 };
export { compiledOf, streetOfDoor };
