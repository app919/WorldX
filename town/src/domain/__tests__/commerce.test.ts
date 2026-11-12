import { describe, expect, it } from 'vitest';
import { BIZ_ORDER, buildBusinessMap, relationsWith, WEIGHTS } from '../commerce';
import { extractProfile, toProfile } from '../profileExtractor';
import { COUNTERPARTIES, STORY_INTRO_TEXT, entityById } from '../../data/seed';
import type { BusinessProfile } from '../types';

const me = (): BusinessProfile => ({ ...toProfile('me', '我', 'AI 视频制作人', extractProfile(STORY_INTRO_TEXT)), confirmed: true });

describe('商业撮合 V2：客户优先', () => {
  it('权重符合 S = 0.30I + 0.30C + 0.15G + 0.15B + 0.10W', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('客户是第一类关系，且是数量最多的一类', () => {
    const m = buildBusinessMap(me(), COUNTERPARTIES);
    expect(BIZ_ORDER[0]).toBe('customer');
    expect(m.counts.customer).toBeGreaterThan(0);
    expect(m.counts.customer).toBeGreaterThanOrEqual(Math.max(m.counts.supplier, m.counts.partner));
  });

  it('每个潜在客户都回答五个问题：是谁、在哪里、可能需要什么、我能提供什么、为什么推荐', () => {
    for (const r of buildBusinessMap(me(), COUNTERPARTIES).byType.customer) {
      for (const k of ['who', 'where', 'need', 'offer', 'why'] as const) expect(r.answers[k].length).toBeGreaterThan(2);
      expect(r.basis.length).toBe(5);
    }
  });

  it('已发布需求排在系统推测之前，并且标注不同', () => {
    const list = buildBusinessMap(me(), COUNTERPARTIES).byType.customer;
    const firstInferred = list.findIndex((r) => r.evidence === 'inferred');
    const lastPublished = list.map((r) => r.evidence).lastIndexOf('published');
    expect(lastPublished).toBeLessThan(firstInferred);
    const inferred = list.find((r) => r.evidence === 'inferred')!;
    expect(inferred.answers.need).toContain('尚未核实');
  });

  it('没有证据的需求不会被写成真实采购需求', () => {
    const r = relationsWith(me(), entityById('e_chunri')!).find((x) => x.type === 'customer')!;
    expect(r.evidence).toBe('inferred');
    expect(r.needs.every((n) => n.evidence === 'inferred')).toBe(true);
  });

  it('同一个主体可以同时有多条不同的商业关系（例如既是客户又是供应商）', () => {
    const rels = relationsWith(me(), entityById('e_guangying')!);
    const types = rels.map((r) => r.type);
    expect(types).toContain('customer');
    expect(types).toContain('supplier');
  });

  it('未入驻商家不能直接打招呼；个人不显示精确位置', () => {
    const prospect = relationsWith(me(), entityById('e_chunri')!)[0];
    expect(prospect.canContact).toBe(false);
    expect(prospect.nextStep).toContain('尚未入驻');
    const person = relationsWith(me(), entityById('e_asheng')!)[0];
    expect(person.answers.where).toContain('只显示到街区');
  });

  it('信息不足时不打分', () => {
    const r = relationsWith({ ...me(), districts: [] }, entityById('e_wutong')!)[0];
    expect(r.insufficientInfo).toBe(true);
    expect(r.score).toBeNull();
  });

  it('未确认画像 / 对方关闭推荐时没有任何关系', () => {
    expect(relationsWith({ ...me(), confirmed: false }, entityById('e_wutong')!)).toHaveLength(0);
    expect(relationsWith(me(), { ...entityById('e_wutong')!, openToConnect: false })).toHaveLength(0);
  });

  it('分数严格按公式（预算缺失时归一化）', () => {
    const r = relationsWith(me(), entityById('e_wutong')!).find((x) => x.type === 'customer')!;
    const b = r.breakdown;
    const s = b.budget === null
      ? (0.3 * b.industry + 0.3 * b.complement + 0.15 * b.geo + 0.1 * b.willingness) / 0.85
      : 0.3 * b.industry + 0.3 * b.complement + 0.15 * b.geo + 0.15 * b.budget + 0.1 * b.willingness;
    expect(r.score).toBe(Math.round(s));
  });
});
