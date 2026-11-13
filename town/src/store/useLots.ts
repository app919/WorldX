/**
 * 铺位与赞助：已登记的店主（姓名 + 手机号唯一）、黄金位赞助商（演示 + 我提交的申请）。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_OWNERS, SPONSOR_TIERS, checkOwner, demoSponsors, isGolden, validPhone, validUSCC, type Owner, type Sponsor, type SponsorTier } from '../domain/lots';
import { useTown } from './useTown';

interface LotsState {
  owners: Owner[];
  sponsors: Sponsor[];
  registry(): Owner[];
  register(o: Owner): string[];
  allSponsors(): Sponsor[];
  sponsorOf(lotId: string): Sponsor | undefined;
  applySponsor(a: { lotId: string; company: string; code: string; contact: string; phone: string; tier: SponsorTier['id'] }): string[];
}

export const useLots = create<LotsState>()(
  persist(
    (set, get) => ({
      owners: [],
      sponsors: [],
      registry: () => [...DEMO_OWNERS, ...get().owners],
      register(o) {
        const err = checkOwner(o, get().registry());
        if (err.length) return err;
        set((s) => ({ owners: [...s.owners, { name: o.name.trim(), phone: o.phone.trim() }] }));
        return [];
      },
      allSponsors: () => [...demoSponsors(Date.now()), ...get().sponsors],
      sponsorOf: (lotId) => get().allSponsors().find((x) => x.lotId === lotId),
      applySponsor(a) {
        const err: string[] = [];
        if (!isGolden(a.lotId)) err.push('只有黄金位可以申请赞助');
        if (get().sponsorOf(a.lotId)) err.push('这个黄金位已有赞助商');
        if (get().sponsors.some((x) => x.mine)) err.push('演示版每个账号只能申请一个黄金位');
        if (a.company.trim().length < 4) err.push('请填写赞助企业全称');
        if (!validUSCC(a.code)) err.push('统一社会信用代码不正确（18 位，含校验位）');
        if (a.contact.trim().length < 2) err.push('请填写联系人');
        if (!validPhone(a.phone)) err.push('请填写 11 位手机号');
        if (err.length) return err;
        const tier = SPONSOR_TIERS.find((t) => t.id === a.tier)!;
        const sp: Sponsor = { lotId: a.lotId, name: a.company.trim(), tier: a.tier, until: Date.now() + tier.months * 30 * 86400000, mine: true, status: 'reviewing' };
        set((s) => ({ sponsors: [...s.sponsors, sp] }));
        const t = useTown.getState();
        t.toast('赞助申请已提交，平台审核企业资质中', 'info');
        setTimeout(() => {
          set((s) => ({ sponsors: s.sponsors.map((x) => (x.lotId === a.lotId && x.mine ? { ...x, status: 'awaiting_payment' } : x)) }));
          useTown.getState().toast(`审核通过：请按合同对公转账 ¥${tier.price}（演示，不会真实扣款）`, 'ok');
          setTimeout(() => {
            set((s) => ({ sponsors: s.sponsors.map((x) => (x.lotId === a.lotId && x.mine ? { ...x, status: 'live' } : x)) }));
            useTown.getState().toast('到账确认，黄金位已上线（演示）', 'ok');
          }, 1500);
        }, 1500);
        return [];
      },
    }),
    { name: 'sanlinbang-lots', version: 1, partialize: (s) => ({ owners: s.owners, sponsors: s.sponsors }) },
  ),
);
