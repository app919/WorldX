/**
 * 三邻邦服务中心的状态（P1 / P2）：服务预约、认证、案例审核、投诉申诉、交易型活动报名、价格意向、
 * 运营视角开关、项目资料页与投资人预约、论坛帖子与小组。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CONTACTS, DEAL_EVENTS, SERVICE_PROVIDERS, demoPosts, type ForumPost, type PostCat } from '../data/center';
import {
  validateBooking, validateCase, validateCompany, validateComplaint, validatePost, validateProject, validateRealName,
  type Booking, type CaseItem, type Certs, type Complaint, type ComplaintKind, type ProjectPage,
} from '../domain/center';
import { useTown } from './useTown';

interface CenterState {
  section: 'services' | 'trust' | 'events' | 'pricing' | 'ops' | 'funding' | 'forum';
  setSection(s: CenterState['section']): void;
  bookings: Booking[];
  certs: Certs;
  cases: CaseItem[];
  complaints: Complaint[];
  signups: string[];
  intents: string[];
  opsMode: boolean;
  project?: ProjectPage;
  investorReqs: { contactId: string; status: 'requested' | 'accepted'; at: number }[];
  posts: ForumPost[];
  liked: string[];
  groups: string[];

  book(b: Omit<Booking, 'id' | 'status' | 'at'>): string[];
  certifyPerson(name: string, idTail: string): string[];
  certifyCompany(name: string, code: string): string[];
  submitCase(c: Omit<CaseItem, 'id' | 'status' | 'at'>): string[];
  complain(c: { kind: ComplaintKind; target: string; detail: string }): string[];
  signup(eventId: string): void;
  intent(tierId: string): void;
  setOps(v: boolean): void;
  saveProject(p: ProjectPage): string[];
  requestInvestor(contactId: string): void;
  allPosts(): ForumPost[];
  post(p: { title: string; body: string; cat: PostCat; group: string; dealId?: string }): string[];
  like(id: string): void;
  joinGroup(id: string): void;
}

const T = () => useTown.getState();
const later = (ms: number, fn: () => void) => setTimeout(fn, ms);
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

export const useCenter = create<CenterState>()(
  persist(
    (set, get) => ({
      section: 'services', setSection: (section) => set({ section }),
      bookings: [], certs: {}, cases: [], complaints: [], signups: [], intents: [], opsMode: false, investorReqs: [], posts: [], liked: [], groups: [],

      book(b) {
        const e = validateBooking(b);
        if (e.length) return e;
        const id = uid('bk');
        set((s) => ({ bookings: [{ ...b, id, status: 'pending', at: Date.now() }, ...s.bookings] }));
        const p = SERVICE_PROVIDERS.find((x) => x.id === b.providerId)!;
        T().toast(`已向 ${p.name} 预约 ${b.slot}，等待对方确认`, 'info');
        later(1500, () => { set((s) => ({ bookings: s.bookings.map((x) => (x.id === id ? { ...x, status: 'confirmed' } : x)) })); T().toast(`${p.name} 确认了你的预约（演示）`, 'ok'); });
        return [];
      },
      certifyPerson(name, idTail) {
        const e = validateRealName(name, idTail);
        if (e.length) return e;
        set((s) => ({ certs: { ...s.certs, realName: { name: name.trim(), idTail: idTail.trim().toUpperCase(), at: Date.now() } } }));
        T().toast('实名认证通过（演示：正式版接入第三方实名核验）', 'ok');
        return [];
      },
      certifyCompany(name, code) {
        const e = validateCompany(name, code);
        if (e.length) return e;
        set((s) => ({ certs: { ...s.certs, company: { name: name.trim(), code: code.trim().toUpperCase(), at: Date.now() } } }));
        T().toast('企业认证通过（演示：正式版接入工商信息核验）', 'ok');
        return [];
      },
      submitCase(c) {
        const e = validateCase(c);
        if (e.length) return e;
        const id = uid('case');
        set((s) => ({ cases: [{ ...c, id, status: 'reviewing', at: Date.now() }, ...s.cases] }));
        T().toast('案例已提交审核', 'info');
        later(1500, () => { set((s) => ({ cases: s.cases.map((x) => (x.id === id ? { ...x, status: 'approved', note: '交付链接可访问，客户信息已脱敏' } : x)) })); T().toast('案例审核通过，已展示在你的主页', 'ok'); });
        return [];
      },
      complain(c) {
        const e = validateComplaint(c);
        if (e.length) return e;
        const id = uid('cp');
        set((s) => ({ complaints: [{ ...c, id, status: 'open', at: Date.now() }, ...s.complaints] }));
        T().toast('已提交，平台会在 48 小时内联系双方（演示）', 'info');
        later(1200, () => set((s) => ({ complaints: s.complaints.map((x) => (x.id === id ? { ...x, status: 'processing' } : x)) })));
        later(2600, () => set((s) => ({ complaints: s.complaints.map((x) => (x.id === id ? { ...x, status: 'resolved', result: x.kind === 'rating_appeal' ? '已核实沟通记录，评价改为“待补充说明”，不计入信用分' : '已联系双方，按合同约定补交付 / 补付款，结果记入双方履约记录' } : x)) })));
        return [];
      },
      signup(eventId) {
        if (get().signups.includes(eventId)) return;
        set((s) => ({ signups: [...s.signups, eventId] }));
        const ev = DEAL_EVENTS.find((x) => x.id === eventId);
        T().toast(`已报名「${ev?.title}」`, 'ok');
        T().earn('event_joined');
      },
      intent(tierId) {
        if (get().intents.includes(tierId)) return;
        set((s) => ({ intents: [...s.intents, tierId] }));
        T().toast('已登记付费意向（测试阶段不收费，用于验证价格）', 'ok');
      },
      setOps: (opsMode) => set({ opsMode }),
      saveProject(p) {
        const e = validateProject(p);
        if (e.length) return e;
        set({ project: p });
        T().toast('项目资料页已保存，已为你匹配投资人', 'ok');
        return [];
      },
      requestInvestor(contactId) {
        if (get().investorReqs.some((r) => r.contactId === contactId)) return;
        set((s) => ({ investorReqs: [...s.investorReqs, { contactId, status: 'requested', at: Date.now() }] }));
        const c = CONTACTS.find((x) => x.id === contactId);
        T().toast(`已向 ${c?.name} 发送沟通预约（只发送项目资料页，不公开你的联系方式）`, 'info');
        later(1600, () => { set((s) => ({ investorReqs: s.investorReqs.map((r) => (r.contactId === contactId ? { ...r, status: 'accepted' } : r)) })); T().toast(`${c?.name} 同意 30 分钟线上沟通（演示）`, 'ok'); });
      },
      allPosts: () => [...get().posts, ...demoPosts(Date.now())],
      post(p) {
        const e = validatePost(p);
        if (e.length) return e;
        set((s) => ({ posts: [{ ...p, id: uid('fp'), author: T().myOpc?.name ?? T().profile?.displayName ?? T().avatar?.nickname ?? '我', likes: 0, at: Date.now(), mine: true }, ...s.posts] }));
        T().toast('已发布', 'ok');
        return [];
      },
      like: (id) => set((s) => (s.liked.includes(id) ? { liked: s.liked.filter((x) => x !== id) } : { liked: [...s.liked, id] })),
      joinGroup: (id) => set((s) => (s.groups.includes(id) ? {} : { groups: [...s.groups, id] })),
    }),
    { name: 'sanlinbang-center', version: 1, partialize: (s) => { const { section: _s, ...rest } = s; void _s; return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as never; } },
  ),
);
