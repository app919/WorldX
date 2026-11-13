/**
 * 产业链与机会广场的状态：我登记的环节、抢到的服务商展位、我发布的公告、投标 / 接单 / 投递进度。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { claimSlot, demoSlots, type Join, type ResourceKind, type Slot } from '../domain/chain';
import { demoBidsFor, demoOpps, promoCode, validateBid, validateOpp, type Application, type Bid, type Opp, type PromoTask } from '../domain/opportunity';
import { useTown } from './useTown';

interface OppState {
  joins: Join[];
  slots: Slot[];
  myOpps: Opp[];
  bids: Bid[];
  promos: PromoTask[];
  apps: Application[];
  /** 产业链面板当前选中的行业 / 环节 */
  industry: 'ecommerce' | 'heritage' | 'education';
  stage?: string;
  oppTab: 'tender' | 'promo' | 'gig' | 'mine';

  setIndustry(i: OppState['industry'], stage?: string): void;
  setStage(stage?: string): void;
  setOppTab(t: OppState['oppTab']): void;
  join(j: Join): void;
  leave(j: Join): void;
  claim(req: { stage: string; provider: string; offer: string; resource: ResourceKind }): boolean;
  allOpps(): Opp[];
  post(o: Omit<Opp, 'id' | 'postedAt' | 'mine'>): string[];
  bid(oppId: string, b: { quote: number; days: number; plan: string }): string[];
  award(bidId: string): void;
  takePromo(oppId: string): void;
  submitPromo(oppId: string, link: string): void;
  apply(oppId: string, note: string): void;
}

const now = () => Date.now();

export const useOpp = create<OppState>()(
  persist(
    (set, get) => ({
      joins: [], slots: demoSlots(now()), myOpps: [], bids: [], promos: [], apps: [], industry: 'ecommerce', oppTab: 'tender',

      setIndustry: (industry, stage) => set({ industry, stage }),
      setStage: (stage) => set({ stage }),
      setOppTab: (oppTab) => set({ oppTab }),
      join(j) {
        if (get().joins.some((x) => x.industry === j.industry && x.stage === j.stage)) return;
        set((s) => ({ joins: [...s.joins, j] }));
        useTown.getState().toast('已登记到这个环节，上下游速配会把你算进去', 'ok');
      },
      leave: (j) => set((s) => ({ joins: s.joins.filter((x) => !(x.industry === j.industry && x.stage === j.stage)) })),
      claim(req) {
        const r = claimSlot(get().slots, req, now());
        const t = useTown.getState();
        if (!r.ok) { t.toast(r.why, 'warn'); return false; }
        set({ slots: r.slots });
        t.toast('抢位成功！展位 7 天，标注为「服务商展位 · 推广」', 'ok');
        return true;
      },
      allOpps: () => [...get().myOpps, ...demoOpps(now())],
      post(o) {
        const err = validateOpp(o);
        if (err.length) return err;
        const id = `my_${o.kind}_${Date.now().toString(36)}`;
        const opp: Opp = { ...o, id, postedAt: now(), mine: true };
        set((s) => ({ myOpps: [opp, ...s.myOpps] }));
        const t = useTown.getState();
        t.toast('已发布到机会广场', 'ok');
        if (o.kind === 'tender') {
          // 演示：链上成员陆续投标
          setTimeout(() => {
            set((s) => ({ bids: [...demoBidsFor(opp, now()), ...s.bids] }));
            useTown.getState().toast(`「${opp.title}」收到 3 份投标`, 'info');
          }, 1500);
        }
        return [];
      },
      bid(oppId, b) {
        const opp = get().allOpps().find((x) => x.id === oppId);
        if (!opp) return ['公告不存在'];
        if (get().bids.some((x) => x.oppId === oppId && x.mine)) return ['你已经投过这个标了'];
        const err = validateBid(b, opp);
        if (err.length) return err;
        set((s) => ({ bids: [{ id: `bid_${Date.now().toString(36)}`, oppId, bidder: '我', ...b, status: 'submitted', at: now(), mine: true }, ...s.bids] }));
        useTown.getState().toast('投标已提交，发布方选标后会通知你', 'ok');
        // 演示：2.5 秒后进入候选
        setTimeout(() => set((s) => ({ bids: s.bids.map((x) => (x.oppId === oppId && x.mine ? { ...x, status: 'shortlisted' } : x)) })), 2500);
        return [];
      },
      award(bidId) {
        const b = get().bids.find((x) => x.id === bidId);
        if (!b) return;
        set((s) => ({ bids: s.bids.map((x) => (x.oppId === b.oppId ? { ...x, status: x.id === bidId ? 'won' : 'lost' } : x)) }));
        useTown.getState().toast(`已选定「${b.bidder}」中标。合同与付款需双方本人确认（L3）`, 'ok');
      },
      takePromo(oppId) {
        if (get().promos.some((p) => p.oppId === oppId)) return;
        set((s) => ({ promos: [...s.promos, { oppId, code: promoCode(oppId, Date.now()), status: 'taken', at: now() }] }));
        useTown.getState().toast('接单成功！拿到专属推广码，发布内容时记得标注「广告 / 推广」', 'ok');
      },
      submitPromo(oppId, link) {
        if (!link.trim()) { useTown.getState().toast('请先贴上作品链接', 'warn'); return; }
        set((s) => ({ promos: s.promos.map((p) => (p.oppId === oppId ? { ...p, status: 'submitted', link } : p)) }));
        setTimeout(() => {
          set((s) => ({ promos: s.promos.map((p) => (p.oppId === oppId ? { ...p, status: 'approved' } : p)) }));
          useTown.getState().toast('商家验收通过（演示），佣金按约定结算', 'ok');
        }, 2000);
      },
      apply(oppId, note) {
        if (get().apps.some((a) => a.oppId === oppId)) return;
        set((s) => ({ apps: [...s.apps, { oppId, note, status: 'applied', at: now() }] }));
        useTown.getState().toast('已投递，商家看到后会邀约你', 'ok');
        setTimeout(() => {
          set((s) => ({ apps: s.apps.map((a) => (a.oppId === oppId ? { ...a, status: 'invited' } : a)) }));
          useTown.getState().toast('商家邀请你明天下午到店沟通（演示）', 'info');
        }, 2500);
      },
    }),
    { name: 'sanlinbang-opp', version: 1, partialize: (s) => ({ joins: s.joins, slots: s.slots, myOpps: s.myOpps, bids: s.bids, promos: s.promos, apps: s.apps }) },
  ),
);
