import { describe, expect, it } from 'vitest';
import { compare, draftContract, myCredit, paidSoFar, recommendProviders, repeatDraft, stepOf, suggestForRole, validateContract, validateRating, validateTeam } from '../deal';
import { demoBidsFor, demoOpps, validateOpp } from '../opportunity';

const opps = demoOpps(Date.now());
const t1 = opps.find((o) => o.id === 'op_t1')!;

describe('需求单字段（PPT：需求方身份｜内容｜预算｜交付时间｜地区｜合作方式｜截止｜状态）', () => {
  it('每条演示需求单都有完整字段', () => {
    for (const o of opps) {
      expect(o.requester).toBeTruthy(); expect(o.area).toBeTruthy(); expect(o.mode).toBeTruthy(); expect(o.status).toBe('matching');
      expect(o.budget || o.pay || o.commission).toBeTruthy();
      if (o.kind === 'tender') expect(o.deliveryDays).toBeGreaterThan(0);
    }
  });
  it('缺地区 / 合作方式 / 交付时间时不能发布', () => {
    const e = validateOpp({ kind: 'tender', title: '新品短视频招标', budget: { min: 1000, max: 2000 }, deadlineDays: 7, requirements: [], deliverables: [] });
    expect(e.join()).toContain('地区'); expect(e.join()).toContain('合作方式'); expect(e.join()).toContain('交付时间');
  });
  it('七步链路的进度', () => {
    expect(stepOf('reviewing')).toBe(1); expect(stepOf('matching')).toBe(2); expect(stepOf('done')).toBe(6);
  });
});

describe('匹配与比选', () => {
  it('为需求推荐 3 位供给方，不推荐未入驻主体，写明理由', () => {
    const r = recommendProviders(t1);
    expect(r).toHaveLength(3);
    for (const x of r) { expect(x.member.kind).not.toBe('prospect'); expect(x.reason.length).toBeGreaterThan(4); }
    expect(r.some((x) => x.member.stage === 'ec_content')).toBe(true);
  });
  it('比选表标出最低价 / 最短工期 / 信用最好 / 联合团队', () => {
    const bids = demoBidsFor(t1, Date.now());
    bids[0].team = [{ role: 'r_video', name: '我', split: 50, state: 'me' }, { role: 'r_visual', name: '鹿鹿', split: 50, state: 'accepted' }];
    const rows = compare(bids);
    const all = rows.flatMap((r) => r.badges).join();
    for (const b of ['报价最低', '工期最短', '信用最好', '联合团队']) expect(all).toContain(b);
  });
});

describe('联合交付组队', () => {
  it('每个角色都有推荐人选；角色没人 / 未确认 / 分成不是 100% 都不能提交', () => {
    for (const r of t1.roles!) expect(suggestForRole(r).length).toBeGreaterThan(0);
    expect(validateTeam(t1.roles!, [{ role: 'r_video', name: '我', split: 100, state: 'me' }]).join()).toContain('还没有人');
    const team = [
      { role: 'r_video', name: '我', split: 40, state: 'me' as const },
      { role: 'r_visual', name: '鹿鹿', split: 30, state: 'accepted' as const },
      { role: 'r_live', name: '小步营销', split: 20, state: 'invited' as const },
    ];
    const e = validateTeam(t1.roles!, team).join();
    expect(e).toContain('还没确认'); expect(e).toContain('100%');
    expect(validateTeam(t1.roles!, team.map((t) => ({ ...t, state: t.state === 'invited' ? 'accepted' as const : t.state, split: t.role === 'r_live' ? 30 : t.split })))).toEqual([]);
  });
});

describe('成交、履约、评价、复购', () => {
  it('成交确认单：主体、金额、范围、付款节点合计 100%', () => {
    const b = demoBidsFor(t1, Date.now())[0];
    const c = draftContract(t1, b, '梧桐豆子');
    expect(validateContract(c)).toEqual([]);
    expect(validateContract({ ...c, milestones: c.milestones.map((m, i) => (i ? m : { ...m, pct: 10 })) }).join()).toContain('100%');
    expect(validateContract({ ...c, partyA: '' }).length).toBeGreaterThan(0);
    const half = { ...c, milestones: c.milestones.map((m, i) => (i < 2 ? { ...m, delivered: true, accepted: true } : m)) };
    expect(paidSoFar(half)).toBe(Math.round(c.amount * 0.7));
  });
  it('评价：1–5 星；低分必须写原因；信用由收到的评价计算', () => {
    expect(validateRating({ stars: 5 })).toEqual([]);
    expect(validateRating({ stars: 2, text: '' }).length).toBe(1);
    expect(myCredit([{ stars: 5, onTime: true }, { stars: 4, onTime: false }])).toMatchObject({ rating: 4.5, done: 2, onTime: 0.5 });
  });
  it('复购草稿沿用原需求并标记', () => {
    const r = repeatDraft({ ...t1, mine: true });
    expect(r.title.startsWith('【复购】')).toBe(true);
    expect(r.status).toBe('reviewing');
  });
});
