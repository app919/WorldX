/**
 * 产业链与需求大厅的状态：
 * - 我登记的环节、抢到的服务商展位；
 * - 我发布的需求单（作为需求方）与我承接的需求单（作为供给方），每一单都走完
 *   发布 → 审核 → 匹配 → 对接 → 成交 → 履约 → 评价；
 * - 演示：对方（链上的演示成员）会按真实节奏回应——投标、确认成交单、交付、验收、评价。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { claimSlot, demoSlots, type Join, type ResourceKind, type Slot } from '../domain/chain';
import { demoBidsFor, demoOpps, promoCode, validateBid, validateOpp, type Application, type Bid, type DealStatus, type Opp, type PromoTask, type TeamMember } from '../domain/opportunity';
import { creditOf, draftContract, recommendProviders, repeatDraft, validateContract, validateRating, validateTeam, type Contract, type Rating } from '../domain/deal';
import { INDUSTRY_CHAINS } from '../data/chains';
import { useTown } from './useTown';

export interface Deal { oppId: string; side: 'buyer' | 'seller'; bidId: string; counterpart: string; counterpartMember?: string; status: DealStatus; contract: Contract; ratingGiven?: Rating; ratingGot?: Rating }

interface OppState {
  joins: Join[];
  slots: Slot[];
  myOpps: Opp[];
  bids: Bid[];
  promos: PromoTask[];
  apps: Application[];
  deals: Record<string, Deal>;
  invited: Record<string, string[]>;
  teams: Record<string, TeamMember[]>;
  industry: 'ecommerce' | 'heritage' | 'education';
  stage?: string;
  oppTab: 'hall' | 'posted' | 'taken';
  focusOpp?: string;

  setIndustry(i: OppState['industry'], stage?: string): void;
  setStage(stage?: string): void;
  setOppTab(t: OppState['oppTab'], focus?: string): void;
  join(j: Join): void;
  leave(j: Join): void;
  claim(req: { stage: string; provider: string; offer: string; resource: ResourceKind }): boolean;
  allOpps(): Opp[];
  statusOf(o: Opp): DealStatus;
  post(o: Omit<Opp, 'id' | 'postedAt' | 'mine' | 'status'>): string[];
  invite(oppId: string, memberId: string): void;
  bid(oppId: string, b: { quote: number; days: number; plan: string }, team?: TeamMember[]): string[];
  award(bidId: string): void;
  updateContract(oppId: string, c: Contract): void;
  confirmContract(oppId: string): string[];
  deliver(oppId: string, idx: number): void;
  accept(oppId: string, idx: number): void;
  rate(oppId: string, r: Omit<Rating, 'by' | 'at'>): string[];
  repeat(oppId: string): void;
  startTeam(oppId: string): void;
  inviteRole(oppId: string, roleId: string, name: string, memberId?: string): void;
  setSplit(oppId: string, roleId: string, split: number): void;
  takePromo(oppId: string): void;
  submitPromo(oppId: string, link: string): void;
  apply(oppId: string, note: string): void;
}

const now = () => Date.now();
const later = (ms: number, fn: () => void) => setTimeout(fn, ms);
const T = () => useTown.getState();
const myName = () => T().myOpc?.name ?? T().profile?.displayName ?? '我';
const myTags = () => (T().profile?.capabilities ?? []).map((c) => c.tag);

export const useOpp = create<OppState>()(
  persist(
    (set, get) => {
      const patchDeal = (oppId: string, p: Partial<Deal>) => set((s) => (s.deals[oppId] ? { deals: { ...s.deals, [oppId]: { ...s.deals[oppId], ...p } } } : {}));
      const setOppStatus = (oppId: string, status: DealStatus) => set((s) => ({ myOpps: s.myOpps.map((o) => (o.id === oppId ? { ...o, status } : o)) }));
      const memberName = (id: string) => INDUSTRY_CHAINS.flatMap((x) => x.members).find((m) => m.id === id)?.name ?? id;
      const opp = (id: string) => get().allOpps().find((o) => o.id === id);

      /** 双方都确认后进入履约；演示对方按节点交付 / 验收 */
      const afterContract = (oppId: string) => {
        patchDeal(oppId, { status: 'contracted' });
        if (get().deals[oppId]?.side === 'buyer') setOppStatus(oppId, 'contracted');
        T().toast('成交！双方已确认成交确认单（合同与付款由双方按约定执行，平台不代收款）', 'ok');
        later(900, () => {
          patchDeal(oppId, { status: 'delivering' });
          if (get().deals[oppId]?.side === 'buyer') { setOppStatus(oppId, 'delivering'); demoSellerDeliver(oppId); }
        });
      };
      const demoSellerDeliver = (oppId: string) => later(1300, () => {
        const d = get().deals[oppId];
        if (!d || d.side !== 'buyer') return;
        const i = d.contract.milestones.findIndex((m) => !m.delivered);
        if (i < 0) return;
        const ms = d.contract.milestones.map((m, k) => (k === i ? { ...m, delivered: true } : m));
        patchDeal(oppId, { contract: { ...d.contract, milestones: ms } });
        T().toast(`${d.counterpart} 提交了「${ms[i].name}」，请验收`, 'info');
      });
      const finish = (oppId: string) => {
        const d = get().deals[oppId];
        if (!d) return;
        patchDeal(oppId, { status: 'done' });
        if (d.side === 'buyer') setOppStatus(oppId, 'done');
        T().toast('全部节点验收完成，去给对方评价吧', 'ok');
        later(1000, () => patchDeal(oppId, { ratingGot: { stars: 5, tags: d.side === 'buyer' ? ['需求清晰', '付款及时'] : ['按时交付', '沟通顺畅', '愿意再合作'], text: '合作愉快，下次还找你。', onTime: true, by: d.counterpart, at: now() } }));
      };

      return {
        joins: [], slots: demoSlots(now()), myOpps: [], bids: [], promos: [], apps: [], deals: {}, invited: {}, teams: {}, industry: 'ecommerce', oppTab: 'hall',

        setIndustry: (industry, stage) => set({ industry, stage }),
        setStage: (stage) => set({ stage }),
        setOppTab: (oppTab, focusOpp) => set({ oppTab, focusOpp }),
        join(j) {
          if (get().joins.some((x) => x.industry === j.industry && x.stage === j.stage)) return;
          set((s) => ({ joins: [...s.joins, j] }));
          T().toast('已登记到这个环节，上下游速配会把你算进去', 'ok');
        },
        leave: (j) => set((s) => ({ joins: s.joins.filter((x) => !(x.industry === j.industry && x.stage === j.stage)) })),
        claim(req) {
          const r = claimSlot(get().slots, req, now());
          if (!r.ok) { T().toast(r.why, 'warn'); return false; }
          set({ slots: r.slots });
          T().toast('抢位成功！展位 7 天，标注为「服务商展位 · 推广」', 'ok');
          return true;
        },
        allOpps: () => [...get().myOpps, ...demoOpps(now())],
        statusOf: (o) => get().deals[o.id]?.status ?? o.status,

        post(o) {
          const draft = { ...o, status: 'reviewing' as DealStatus };
          const err = validateOpp(draft);
          if (err.length) return err;
          const id = `my_${o.kind}_${Date.now().toString(36)}`;
          const mine: Opp = { ...draft, id, postedAt: now(), mine: true };
          set((s) => ({ myOpps: [mine, ...s.myOpps] }));
          T().toast('已提交，正在审核（身份与需求真实性）', 'info');
          later(1200, () => {
            setOppStatus(id, 'matching');
            const recos = recommendProviders(mine);
            T().toast(`审核通过，已发布。平台为你推荐了 ${recos.length} 位供给方`, 'ok');
            if (o.kind === 'tender') {
              // 演示：推荐之外，也会有链上成员主动投标
              later(1300, () => {
                set((s) => ({ bids: [...demoBidsFor(mine, now()).slice(0, 2), ...s.bids] }));
                T().toast(`「${mine.title}」收到新的投标`, 'info');
              });
            }
          });
          return [];
        },
        invite(oppId, memberId) {
          if ((get().invited[oppId] ?? []).includes(memberId)) return;
          set((s) => ({ invited: { ...s.invited, [oppId]: [...(s.invited[oppId] ?? []), memberId] } }));
          T().toast(`已邀请 ${memberName(memberId)} 投标`, 'ok');
          const o = opp(oppId);
          later(1200, () => {
            const base = o?.budget ? Math.round((o.budget.min + o.budget.max) / 2) : 3000;
            const b: Bid = { id: `${oppId}_inv_${memberId}`, oppId, bidder: memberName(memberId), memberId, quote: Math.round(base * (0.85 + (memberId.length % 5) * 0.05)), days: 7 + (memberId.length % 8), plan: '收到邀请，按需求拆解了交付节点，附过往案例。', status: 'submitted', at: now() };
            set((s) => ({ bids: [b, ...s.bids.filter((x) => x.id !== b.id)] }));
            T().toast(`${b.bidder} 接受邀请并提交了投标`, 'info');
          });
        },
        bid(oppId, b, team) {
          const o = opp(oppId);
          if (!o) return ['需求不存在'];
          if (get().bids.some((x) => x.oppId === oppId && x.mine)) return ['你已经投过这个标了'];
          const err = validateBid(b, o);
          if (team && o.roles) err.push(...validateTeam(o.roles, team));
          if (err.length) return err;
          const id = `bid_${Date.now().toString(36)}`;
          set((s) => ({ bids: [{ id, oppId, bidder: '我', ...b, status: 'submitted', at: now(), mine: true, team }, ...s.bids] }));
          T().toast(team ? '联合投标已提交' : '投标已提交，发布方比选后会通知你', 'ok');
          later(1500, () => set((s) => ({ bids: s.bids.map((x) => (x.id === id ? { ...x, status: 'shortlisted' } : x)) })));
          // 演示：发布方比选后选中了我
          later(3500, () => {
            const cur = get().bids.find((x) => x.id === id);
            if (!cur || cur.status === 'lost') return;
            set((s) => ({ bids: s.bids.map((x) => (x.oppId === oppId ? { ...x, status: x.id === id ? 'won' : 'lost' } : x)) }));
            const c = draftContract(o, cur, o.poster);
            c.partyB = myName();
            c.confirmedA = true;
            set((s) => ({ deals: { ...s.deals, [oppId]: { oppId, side: 'seller', bidId: id, counterpart: o.poster, counterpartMember: o.memberId, status: 'connecting', contract: c } } }));
            T().toast(`🎉 中标「${o.title}」！对方已发来成交确认单，请核对后确认`, 'ok');
          });
          return [];
        },
        award(bidId) {
          const b = get().bids.find((x) => x.id === bidId);
          const o = b && opp(b.oppId);
          if (!b || !o) return;
          set((s) => ({ bids: s.bids.map((x) => (x.oppId === b.oppId ? { ...x, status: x.id === bidId ? 'won' : 'lost' } : x)) }));
          const c = draftContract(o, b, myName());
          set((s) => ({ deals: { ...s.deals, [o.id]: { oppId: o.id, side: 'buyer', bidId, counterpart: b.bidder, counterpartMember: b.memberId, status: 'connecting', contract: c } } }));
          setOppStatus(o.id, 'connecting');
          T().toast(`已选定「${b.bidder}」。请填写成交确认单（合同主体 / 金额 / 交付范围 / 付款节点）`, 'ok');
        },
        updateContract: (oppId, contract) => patchDeal(oppId, { contract }),
        confirmContract(oppId) {
          const d = get().deals[oppId];
          if (!d) return ['没有找到这笔交易'];
          const err = validateContract(d.contract);
          if (err.length) return err;
          const c = { ...d.contract, ...(d.side === 'buyer' ? { confirmedA: true } : { confirmedB: true }) };
          patchDeal(oppId, { contract: c });
          if (c.confirmedA && c.confirmedB) afterContract(oppId);
          else {
            T().toast('你已确认，等待对方本人确认', 'info');
            later(1200, () => { patchDeal(oppId, { contract: { ...get().deals[oppId].contract, confirmedA: true, confirmedB: true } }); afterContract(oppId); });
          }
          return [];
        },
        deliver(oppId, idx) {
          const d = get().deals[oppId];
          if (!d || d.side !== 'seller') return;
          const ms = d.contract.milestones.map((m, k) => (k === idx ? { ...m, delivered: true } : m));
          patchDeal(oppId, { contract: { ...d.contract, milestones: ms } });
          T().toast(`已提交「${ms[idx].name}」，等待对方验收`, 'info');
          later(1200, () => {
            const cur = get().deals[oppId];
            const ms2 = cur.contract.milestones.map((m, k) => (k === idx ? { ...m, accepted: true } : m));
            patchDeal(oppId, { contract: { ...cur.contract, milestones: ms2 } });
            T().toast(`对方验收了「${ms2[idx].name}」，按约定付款 ¥${Math.round((cur.contract.amount * ms2[idx].pct) / 100)}（演示）`, 'ok');
            if (ms2.every((m) => m.accepted)) finish(oppId);
          });
        },
        accept(oppId, idx) {
          const d = get().deals[oppId];
          if (!d || d.side !== 'buyer' || !d.contract.milestones[idx]?.delivered) return;
          const ms = d.contract.milestones.map((m, k) => (k === idx ? { ...m, accepted: true } : m));
          patchDeal(oppId, { contract: { ...d.contract, milestones: ms } });
          T().toast(`已验收「${ms[idx].name}」，请按约定付款给对方（平台不代收款）`, 'ok');
          if (ms.every((m) => m.accepted)) finish(oppId);
          else demoSellerDeliver(oppId);
        },
        rate(oppId, r) {
          const err = validateRating(r);
          if (err.length) return err;
          patchDeal(oppId, { ratingGiven: { ...r, by: myName(), at: now() } });
          T().toast('评价已提交，会沉淀到双方的信用记录', 'ok');
          T().earn('verified_review');
          return [];
        },
        repeat(oppId) {
          const o = opp(oppId);
          const d = get().deals[oppId];
          if (!o || !d) return;
          const draft = repeatDraft(o);
          const id = `my_${o.kind}_${Date.now().toString(36)}`;
          set((s) => ({ myOpps: [{ ...draft, id, postedAt: now(), status: 'matching' }, ...s.myOpps] }));
          T().toast('已发布复购需求，并直接邀请原合作方', 'ok');
          if (d.counterpartMember) get().invite(id, d.counterpartMember);
          else later(1200, () => set((s) => ({ bids: [{ id: `${id}_re`, oppId: id, bidder: d.counterpart, quote: d.contract.amount, days: 10, plan: '老搭档，按上次的流程来。', status: 'submitted', at: now() }, ...s.bids] })));
        },
        startTeam(oppId) {
          const o = opp(oppId);
          if (!o?.roles || get().teams[oppId]) return;
          const tags = myTags();
          const mine = o.roles.find((r) => r.tags.some((t) => tags.includes(t))) ?? o.roles[0];
          const each = Math.floor(100 / o.roles.length);
          set((s) => ({ teams: { ...s.teams, [oppId]: [{ role: mine.id, name: myName(), split: 100 - each * (o.roles!.length - 1), state: 'me' }] } }));
          T().toast(`已发起组队，你负责「${mine.name}」。按角色邀请伙伴吧`, 'ok');
        },
        inviteRole(oppId, roleId, name, memberId) {
          const o = opp(oppId);
          const team = get().teams[oppId] ?? [];
          if (!o?.roles) return;
          const each = Math.floor(100 / o.roles.length);
          const next = [...team.filter((t) => t.role !== roleId), { role: roleId, name, memberId, split: each, state: 'invited' as const }];
          set((s) => ({ teams: { ...s.teams, [oppId]: next } }));
          T().toast(`已邀请 ${name} 加入团队`, 'info');
          later(1100, () => {
            set((s) => ({ teams: { ...s.teams, [oppId]: (s.teams[oppId] ?? []).map((t) => (t.role === roleId ? { ...t, state: 'accepted' } : t)) } }));
            T().toast(`${name} 同意加入（信用 ★${creditOf(memberId).rating || '新'}）`, 'ok');
          });
        },
        setSplit: (oppId, roleId, split) => set((s) => ({ teams: { ...s.teams, [oppId]: (s.teams[oppId] ?? []).map((t) => (t.role === roleId ? { ...t, split } : t)) } })),

        takePromo(oppId) {
          if (get().promos.some((p) => p.oppId === oppId)) return;
          set((s) => ({ promos: [...s.promos, { oppId, code: promoCode(oppId, Date.now()), status: 'taken', at: now() }] }));
          T().toast('接单成功！拿到专属推广码，发布内容时记得标注「广告 / 推广」', 'ok');
        },
        submitPromo(oppId, link) {
          if (!link.trim()) { T().toast('请先贴上作品链接', 'warn'); return; }
          set((s) => ({ promos: s.promos.map((p) => (p.oppId === oppId ? { ...p, status: 'submitted', link } : p)) }));
          later(2000, () => {
            set((s) => ({ promos: s.promos.map((p) => (p.oppId === oppId ? { ...p, status: 'approved' } : p)) }));
            T().toast('商家验收通过（演示），佣金按约定结算', 'ok');
          });
        },
        apply(oppId, note) {
          if (get().apps.some((a) => a.oppId === oppId)) return;
          set((s) => ({ apps: [...s.apps, { oppId, note, status: 'applied', at: now() }] }));
          T().toast('已投递，商家看到后会邀约你', 'ok');
          later(2500, () => {
            set((s) => ({ apps: s.apps.map((a) => (a.oppId === oppId ? { ...a, status: 'invited' } : a)) }));
            T().toast('商家邀请你明天下午到店沟通（演示）', 'info');
          });
        },
      };
    },
    { name: 'sanlinbang-opp', version: 2, partialize: (s) => ({ joins: s.joins, slots: s.slots, myOpps: s.myOpps, bids: s.bids, promos: s.promos, apps: s.apps, deals: s.deals, invited: s.invited, teams: s.teams }), migrate: () => ({}) as never },
  ),
);
