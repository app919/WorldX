import { describe, expect, it } from 'vitest';
import { buy, canWork, COST, deliveryPay, emptyPurse, getPaid, INGREDIENTS, jobsFor, makeOrders, matches, MENUS, rest, shiftPay, startWork } from '../work';
import { workPlaces } from '../../store/useWork';

describe('打工挣钞票与消费', () => {
  it('每个街区都有能打工的店，今天的活稳定（同一天不会无限刷新）', () => {
    for (const d of ['wukang', 'yangjing', 'sichuan_n']) {
      const places = workPlaces(d);
      expect(places.length).toBeGreaterThan(1);
      const a = jobsFor(d, places, 20000), b = jobsFor(d, places, 20000);
      expect(a.map((j) => j.id)).toEqual(b.map((j) => j.id));
      expect(a.some((j) => j.kind === 'delivery')).toBe(true);
      expect(a.some((j) => j.kind === 'shift')).toBe(true);
      for (const j of a) if (j.kind === 'delivery') expect(j.from.lotId).not.toBe(j.to.lotId);
    }
  });

  it('打工消耗体力，体力不够不能接单；挣到的钞票计入钱包', () => {
    const job = jobsFor('wukang', workPlaces('wukang'), 1).find((j) => j.kind === 'delivery')!;
    let p = emptyPurse();
    p = startWork(p, job);
    expect(p.stamina).toBe(80 - COST.delivery);
    expect(canWork({ ...p, stamina: 3 }, job).ok).toBe(false);
    p = getPaid(p, deliveryPay(job, 10));
    expect(p.cash).toBe(30 + job.pay);
    expect(deliveryPay(job, 99999)).toBeLessThan(job.pay);
  });

  it('帮工小游戏：每个订单的原料都在原料台上，配齐才算做对', () => {
    for (const g of Object.keys(INGREDIENTS) as (keyof typeof INGREDIENTS)[]) {
      const ids = INGREDIENTS[g].map((x) => x.id);
      for (const o of makeOrders(g, 20, 7)) {
        expect(o.need.every((n) => ids.includes(n))).toBe(true);
        expect(matches(o, [...o.need].reverse())).toBe(true);
        expect(matches(o, o.need.slice(1))).toBe(false);
      }
      expect(MENUS[g].length).toBeGreaterThan(1);
    }
    const shift = jobsFor('wukang', workPlaces('wukang'), 1).find((j) => j.kind === 'shift')!;
    if (shift.kind === 'shift') expect(shiftPay(shift, shift.orders)).toBe(shift.orders * shift.payPerOrder + 6);
  });

  it('消费：钱不够买不了；吃喝补体力，纪念品进背包；公园休息恢复体力', () => {
    const latte = MENUS.coffee.find((m) => m.id === 'm_latte')!;
    const beans = MENUS.coffee.find((m) => m.id === 'm_beans')!;
    const poor = { ...emptyPurse(), cash: 5 };
    expect(buy(poor, latte).ok).toBe(false);
    const r = buy({ ...emptyPurse(), stamina: 50, cash: 100 }, latte);
    expect(r.ok).toBe(true);
    expect(r.purse.stamina).toBe(72);
    expect(r.purse.cash).toBe(78);
    const k = buy({ ...emptyPurse(), cash: 100 }, beans);
    expect(k.purse.bag).toContain('m_beans');
    expect(rest({ ...emptyPurse(), stamina: 10 }, 4).stamina).toBe(20);
    expect(rest({ ...emptyPurse(), stamina: 99 }, 40).stamina).toBe(100);
  });
});
