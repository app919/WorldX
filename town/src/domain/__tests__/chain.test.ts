import { describe, expect, it } from 'vitest';
import { INDUSTRY_CHAINS } from '../../data/chains';
import { entityById } from '../../data/seed';
import { CAPABILITIES } from '../taxonomy';
import { claimSlot, demoSlots, gaps, placeMe, speedMatch, SLOTS_PER_STAGE } from '../chain';
import { demoOpps, oppScore, validateBid, validateOpp } from '../opportunity';
import { compiledOf } from '../../world';
import type { BusinessProfile } from '../types';

const caps = new Set(CAPABILITIES.map((c) => c.id));

describe('三条产业链：数据完整', () => {
  it.each(INDUSTRY_CHAINS.map((x) => [x.name, x] as const))('「%s」有上游 / 中游 / 下游 / 服务支撑，环节之间连通，成员都在合法环节上', (_, ind) => {
    for (const l of ['upstream', 'midstream', 'downstream', 'service']) expect(ind.stages.some((s) => s.layer === l)).toBe(true);
    const ids = new Set(ind.stages.map((s) => s.id));
    for (const f of ind.flows) { expect(ids.has(f.from)).toBe(true); expect(ids.has(f.to)).toBe(true); }
    // 除服务支撑外每个环节都在流向图里
    for (const s of ind.stages.filter((x) => x.layer !== 'service')) expect(ind.flows.some((f) => f.from === s.id || f.to === s.id)).toBe(true);
    for (const s of ind.stages) for (const c of s.caps) expect(caps.has(c) || ['factory', 'materials', 'finance', 'legal'].includes(c)).toBe(true);
    for (const m of ind.members) {
      expect(ids.has(m.stage)).toBe(true);
      if (m.entityId) expect(entityById(m.entityId), m.id).toBeTruthy();
      else expect(m.city, m.id).toBeTruthy();
    }
    expect(ind.members.length).toBeGreaterThanOrEqual(8);
  });
});

describe('我在链上的位置与上下游速配', () => {
  const me: BusinessProfile = {
    userId: 'me', displayName: '阿岚', headline: '我会拍短视频和剪辑，也能做直播间视觉', industries: ['media'],
    capabilities: [{ tag: 'video', label: '短视频制作' }], needs: [{ tag: 'client', label: '客户' }], districts: ['xuhui'], mode: 'both', intents: ['project'], openToConnect: true, confirmed: true, source: 'self_described',
  };
  it('根据能力把我放到三条链的对应环节', () => {
    const p = placeMe(me, undefined);
    expect(p.some((x) => x.industry === 'ecommerce' && x.stage === 'ec_content')).toBe(true);
    expect(p.some((x) => x.industry === 'heritage' && x.stage === 'hc_media')).toBe(true);
    expect(p.some((x) => x.industry === 'education' && x.stage === 'ed_tech')).toBe(true);
  });
  it('手动登记的环节也算', () => {
    expect(placeMe(undefined, undefined, [{ industry: 'heritage', stage: 'hc_craft' }])[0]).toMatchObject({ stage: 'hc_craft', manual: true });
  });
  it('速配：上游供货、下游客户、同环节、服务商都有，并给出理由；对方正在找我能提供的会加分', () => {
    const m = speedMatch('ecommerce', 'ec_content', ['短视频制作'], []);
    expect(m.some((x) => x.relation === 'upstream' && x.member.id === 'cm_wutong')).toBe(true);
    expect(m.some((x) => x.relation === 'downstream' && x.member.id === 'cm_xiaobu')).toBe(true);
    expect(m.some((x) => x.relation === 'peer')).toBe(true);
    expect(m.every((x) => x.reason.length > 6)).toBe(true);
    const xiaobu = m.find((x) => x.member.id === 'cm_xiaobu')!;
    expect(xiaobu.reason).toContain('正在找');
  });
  it('缺口：只有未入驻公开信息的环节算缺口', () => {
    const ec = INDUSTRY_CHAINS[0];
    for (const g of gaps(ec)) expect(ec.members.filter((m) => m.stage === g.id).every((m) => m.kind === 'prospect')).toBe(true);
  });
});

describe('服务商展位（抢位）', () => {
  const now = 1_000_000_000_000;
  it('每个环节最多 2 个，满了提示候补；同一服务商不能重复占；禁止刷单 / 保证金类内容', () => {
    let slots = demoSlots(now);
    const full = slots.filter((s) => s.stage === 'ec_service').length;
    expect(full).toBe(SLOTS_PER_STAGE);
    const r1 = claimSlot(slots, { stage: 'ec_service', provider: '我', offer: '免费咨询', resource: 'legal' }, now);
    expect(r1.ok).toBe(false);
    const r2 = claimSlot(slots, { stage: 'ec_live', provider: '我', offer: '直播间设备租赁 8 折', resource: 'tools' }, now);
    expect(r2.ok).toBe(true);
    if (r2.ok) slots = r2.slots;
    expect(claimSlot(slots, { stage: 'ec_live', provider: '我', offer: '再来一个', resource: 'tools' }, now).ok).toBe(false);
    expect(claimSlot(slots, { stage: 'hc_craft', provider: '某公司', offer: '交保证金包过申报', resource: 'legal' }, now).ok).toBe(false);
    // 到期释放
    expect(claimSlot(slots, { stage: 'ec_service', provider: '我', offer: '记账', resource: 'legal' }, now + 8 * 86400000).ok).toBe(true);
  });
});

describe('机会广场', () => {
  it('演示公告三类都有，且覆盖三条产业链', () => {
    const o = demoOpps(Date.now());
    for (const k of ['tender', 'promo', 'gig'] as const) expect(o.some((x) => x.kind === k)).toBe(true);
    for (const i of ['ecommerce', 'heritage', 'education']) expect(o.some((x) => x.industry === i)).toBe(true);
    for (const x of o) expect(validateOpp(x)).toEqual([]);
  });
  it('发布校验：必填项、预算合理、禁止刷单 / 押金 / 培训费', () => {
    expect(validateOpp({ kind: 'tender', title: '做视频', deadlineDays: 7 }).length).toBeGreaterThan(0);
    expect(validateOpp({ kind: 'gig', title: '周末兼职助理', pay: '¥30/小时，需先交押金 200', deadlineDays: 7, requirements: [], deliverables: [] }).join()).toContain('不允许');
    expect(validateOpp({ kind: 'promo', title: '帮忙刷单好评', commission: '每单 5 元', deadlineDays: 3, requirements: [], deliverables: [] }).join()).toContain('不允许');
  });
  it('投标校验与匹配度', () => {
    const t = demoOpps(Date.now()).find((x) => x.id === 'op_t1')!;
    expect(validateBid({ quote: 5000, days: 10, plan: '分镜—拍摄—剪辑，两周交付' }, t)).toEqual([]);
    expect(validateBid({ quote: 99999, days: 10, plan: '分镜—拍摄—剪辑，两周交付' }, t).length).toBe(1);
    expect(oppScore(t, ['video'], ['ec_content'])).toBeGreaterThan(oppScore(t, [], []));
  });
  it('每个街区都有一块公告栏', () => {
    for (const d of ['wukang', 'yangjing', 'sichuan_n'] as const) expect(compiledOf(d).props.some((p) => p.kind === 'notice_board')).toBe(true);
  });
});
