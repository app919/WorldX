import { describe, expect, it } from 'vitest';
import { DEAL_EVENTS, PRICE_TIERS, SERVICE_PROVIDERS, demoPosts } from '../../data/center';
import { creditScore, kpis, matchInvestors, priceCompare, validateBooking, validateCase, validateCompany, validateComplaint, validatePost, validateProject, validateRealName } from '../center';
import { usccCheckChar } from '../lots';

describe('P1-5 创业服务市场', () => {
  it('五类服务都有服务商，同名套餐比价并标出最低价，认证服务商排前面', () => {
    for (const c of ['legal', 'tax', 'ip', 'ai', 'space'] as const) expect(SERVICE_PROVIDERS.some((p) => p.cat === c)).toBe(true);
    const law = priceCompare('legal').find((r) => r.name === '合同审查')!;
    expect(law.offers.length).toBe(2);
    expect(law.min).toBe(400);
    expect(law.offers[0].provider.certified).toBe(true);
  });
  it('预约必须选可预约时间段并写明问题', () => {
    expect(validateBooking({ providerId: 'sv_law1', slot: '周二 14:00', topic: '合伙协议怎么写' })).toEqual([]);
    expect(validateBooking({ providerId: 'sv_law1', slot: '周日 3:00', topic: '合伙协议怎么写' }).length).toBe(1);
  });
});

describe('P1-6 信用与保障', () => {
  it('实名只收后 4 位；企业认证校验信用代码；案例需要可核验链接；投诉需写明经过', () => {
    expect(validateRealName('阿岚', '123X')).toEqual([]);
    expect(validateRealName('阿岚', '310101199001011234').length).toBe(1);
    const code = '91310000MA1FL0000' + usccCheckChar('91310000MA1FL0000');
    expect(validateCompany('三邻邦测试有限公司', code)).toEqual([]);
    expect(validateCompany('三邻邦测试有限公司', '91310000MA1FL0000A').length).toBeGreaterThanOrEqual(code.endsWith('A') ? 0 : 1);
    expect(validateCase({ title: '咖啡新品短视频', client: '某咖啡品牌', proof: 'https://example.com/v' })).toEqual([]);
    expect(validateCase({ title: '咖啡新品短视频', client: '某咖啡品牌', proof: '口头说过' }).length).toBe(1);
    expect(validateComplaint({ kind: 'no_delivery', target: '某工作室', detail: '太短' }).length).toBe(1);
  });
  it('信用分由认证、案例、评价构成，未结投诉扣分，范围 0–100', () => {
    const base = creditScore({ certs: {}, approvedCases: 0, ratings: [] }).score;
    const full = creditScore({ certs: { realName: { name: 'a', idTail: '1234', at: 0 }, company: { name: 'b', code: 'c', at: 0 } }, approvedCases: 3, ratings: [{ stars: 5, onTime: true }, { stars: 5, onTime: true }] }).score;
    expect(base).toBe(0);
    expect(full).toBeGreaterThan(70);
    expect(full).toBeLessThanOrEqual(100);
    expect(creditScore({ certs: { realName: { name: 'a', idTail: '1234', at: 0 } }, approvedCases: 0, ratings: [], openComplaintsAgainst: 1 }).score).toBe(5);
  });
});

describe('P1-7 / P1-8 交易型活动与价格测试', () => {
  it('六种交易型活动都有，且有流程与容量；需求发布会关联真实需求', () => {
    for (const k of ['demand_day', 'matchmaking', 'team_up', 'clinic', 'roadshow', 'closed_door'] as const) {
      const e = DEAL_EVENTS.find((x) => x.kind === k)!;
      expect(e.flow.length).toBeGreaterThan(1);
      expect(e.capacity).toBeGreaterThan(e.signed);
    }
    expect(DEAL_EVENTS.find((x) => x.kind === 'demand_day')!.linkedOpps!.length).toBeGreaterThan(0);
  });
  it('四类付费方都有测试价格', () => {
    for (const p of ['opc', 'enterprise', 'provider', 'park']) expect(PRICE_TIERS.some((t) => t.payer === p)).toBe(true);
  });
});

describe('P1-9 运营看板', () => {
  it('按 PPT 的 KPI 目标与核心看板指标计算', () => {
    const k = kpis({ users: 100, profiles: 50, demands: 10, connections: 20, paid: 2, demandsWithResponse: 8, connectionsEffective: 15, deals: 3, dealDays: [6, 9], repeats: 1, doneDeals: 2, dealAmounts: [4000, 6000] });
    expect(k.targets.map((t) => t.target)).toEqual([500, 200, 30, 50, 10]);
    const b = Object.fromEntries(k.board.map((x) => [x.label, x.value]));
    expect(b['需求响应率']).toBe('80%'); expect(b['有效对接率']).toBe('75%'); expect(b['成交转化率']).toBe('30%');
    expect(b['平均撮合周期']).toBe('7.5 天'); expect(b['复购率']).toBe('50%'); expect(b['单笔服务收入']).toBe('¥5000');
  });
});

describe('P2 融资资源与论坛', () => {
  it('项目资料页校验；按行业与阶段匹配投资人', () => {
    expect(validateProject({ name: 'x' }).length).toBeGreaterThan(2);
    const p = { name: '挂耳咖啡出海', industry: 'ecommerce', stage: 'mvp' as const, traction: '3 个月 120 位付费客户，复购 35%', ask: 100, use: '海外店铺与库存', deck: '' };
    expect(validateProject(p)).toEqual([]);
    const m = matchInvestors(p);
    expect(m[0].c.industries).toContain('ecommerce');
    expect(m[0].score).toBeGreaterThan(80);
  });
  it('论坛：拦截广告与违规；演示帖子覆盖多个分类', () => {
    expect(validatePost({ title: '一人公司如何定价', body: '加微信领取定价模板，日赚 1000 不是梦，私信领取资料', cat: 'sales', group: 'g_opc' }).join()).toContain('广告');
    expect(validatePost({ title: '一人公司如何定价', body: '我按项目拆成三段报价：需求访谈、交付、售后，客户更容易接受。', cat: 'sales', group: 'g_opc' })).toEqual([]);
    expect(new Set(demoPosts(0).map((p) => p.cat)).size).toBeGreaterThanOrEqual(4);
  });
});
