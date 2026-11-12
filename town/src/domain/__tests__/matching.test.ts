import { describe, expect, it } from 'vitest';
import { buildOpportunityMap, matchPair, WEIGHTS } from '../matching';
import { extractProfile, toProfile } from '../profileExtractor';
import { RESIDENTS, STORY_INTRO_TEXT } from '../../data/seed';
import type { BusinessProfile } from '../types';

const me = (): BusinessProfile => ({ ...toProfile('me', '我', 'AI 视频制作人', extractProfile(STORY_INTRO_TEXT)), confirmed: true });
const byId = (id: string) => RESIDENTS.find((r) => r.id === id)!.profile;

describe('匹配权重', () => {
  it('权重之和为 1，且与公式 S=0.30I+0.30C+0.15G+0.15B+0.10W 一致', () => {
    expect(WEIGHTS).toEqual({ industry: 0.3, complement: 0.3, geo: 0.15, budget: 0.15, willingness: 0.1 });
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('商业可能性地图', () => {
  it('咖啡品牌（明确需要视频）被识别为下游客户，且分数可解释', () => {
    const rel = matchPair(me(), byId('u_xiaoman'))!;
    expect(rel.type).toBe('downstream');
    expect(rel.score).not.toBeNull();
    expect(rel.score!).toBeGreaterThanOrEqual(70);
    expect(rel.reasons.length).toBeGreaterThan(0);
    expect(rel.demandStatus).toBe('unconfirmed');
    expect(rel.fateReasons.some((f) => f.includes('徐汇'))).toBe(true);
    // 双方都有价格信息 → 预算维度参与计分
    expect(rel.breakdown.budget).not.toBeNull();
  });

  it('分数严格按公式计算', () => {
    const rel = matchPair(me(), byId('u_xiaoman'))!;
    const b = rel.breakdown;
    const s = 0.3 * b.industry + 0.3 * b.complement + 0.15 * b.geo + 0.15 * (b.budget ?? 0) + 0.1 * b.willingness;
    expect(rel.score).toBe(Math.round(s));
  });

  it('五种关系类型都能被发现', () => {
    const types = new Set(buildOpportunityMap(me(), RESIDENTS.map((r) => r.profile)).map((r) => r.type));
    expect(types).toContain('downstream');
    expect(types).toContain('upstream'); // 配音演员：做宣传片的人通常需要配音
    expect(types).toContain('peer');
    const more = { ...me(), needs: [...me().needs, { tag: 'channel', label: '销售渠道' }, { tag: 'venue', label: '场地' }] };
    const t2 = new Set(buildOpportunityMap(more, RESIDENTS.map((r) => r.profile)).map((r) => r.type));
    expect(t2).toContain('channel');
    expect(t2).toContain('resource');
  });

  it('信息不足时显示“信息不足”，不强行打分', () => {
    const thin: BusinessProfile = { ...byId('u_xiaoman'), userId: 'thin', districts: [], industries: [] };
    const rel = matchPair(me(), thin)!;
    expect(rel.insufficientInfo).toBe(true);
    expect(rel.score).toBeNull();
    expect(rel.missing.join()).toContain('所在区域');
  });

  it('预算缺失时该项不计分并归一化，同时写明缺失', () => {
    const rel = matchPair(me(), byId('u_zhou'))!; // 周老师有预算，但我们改成无预算
    const noBudget = matchPair(me(), { ...byId('u_zhou'), budgetRange: undefined })!;
    expect(rel.breakdown.budget).not.toBeNull();
    expect(noBudget.breakdown.budget).toBeNull();
    expect(noBudget.score).not.toBeNull();
    expect(noBudget.missing.join()).toContain('预算');
  });

  it('未确认的画像、或对方关闭“愿意被连接”时，不产生任何推荐', () => {
    expect(matchPair({ ...me(), confirmed: false }, byId('u_xiaoman'))).toBeNull();
    expect(matchPair(me(), { ...byId('u_xiaoman'), openToConnect: false })).toBeNull();
  });

  it('不会推荐自己', () => {
    expect(matchPair(me(), me())).toBeNull();
  });
});
