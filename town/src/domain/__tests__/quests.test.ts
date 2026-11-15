import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { QUEST_PLANS, dayIndex, planFor } from '../quests';

const src = (dir: string): string => readdirSync(dir).map((f) => join(dir, f)).map((p) => (statSync(p).isDirectory() ? (p.includes('__tests__') ? '' : src(p)) : p.endsWith('.ts') || p.endsWith('.tsx') ? readFileSync(p, 'utf8') : '')).join('\n');
const code = src(join(__dirname, '..', '..'));

describe('新手 7 天任务', () => {
  it('六种身份各 7 天，每天 3 件事，覆盖买 / 逛 / 跟，奖励与徽章齐全', () => {
    for (const [tag, plan] of Object.entries(QUEST_PLANS)) {
      expect(plan.map((d) => d.day), tag).toEqual([1, 2, 3, 4, 5, 6, 7]);
      for (const d of plan) {
        expect(d.quests.length).toBe(3);
        expect(d.badge.length).toBeGreaterThan(1);
        for (const q of d.quests) { expect(q.stars).toBeGreaterThan(0); expect(q.hint.length).toBeGreaterThan(1); }
      }
      const kinds = new Set(plan.flatMap((d) => d.quests.map((q) => q.kind)));
      expect([...kinds].sort()).toEqual(['买', '跟', '逛'].sort());
      // 每天都不一样
      expect(new Set(plan.map((d) => d.theme)).size).toBe(7);
    }
  });
  it('不同身份的任务不一样', () => {
    const sig = (t: keyof typeof QUEST_PLANS) => QUEST_PLANS[t].map((d) => d.theme).join('|');
    expect(new Set((Object.keys(QUEST_PLANS) as (keyof typeof QUEST_PLANS)[]).map(sig)).size).toBe(6);
    expect(planFor('worker')).toBe(QUEST_PLANS.side_hustle);
  });
  it('每个任务对应的行为在游戏里真的会发生（代码里有 emitGame / 动作钩子）', () => {
    const events = new Set(Object.values(QUEST_PLANS).flatMap((p) => p.flatMap((d) => d.quests.map((q) => q.event))));
    for (const e of events) expect(code.includes(`'${e}'`) && (code.includes(`emitGame('${e}'`) || new RegExp(`(wrap\\([A-Z], '\\w+', '${e}'\\)|'${e}' :)`).test(code)), e).toBe(true);
  });
  it('第 N 天在首次进入后的第 N 个自然日解锁，最多 7 天', () => {
    expect(dayIndex('2026-11-15', '2026-11-15')).toBe(1);
    expect(dayIndex('2026-11-15', '2026-11-17')).toBe(3);
    expect(dayIndex('2026-11-15', '2026-12-30')).toBe(7);
  });
});

describe('逛与跟的氛围', () => {
  it('每个街区都有正在进行的活动；围观人数平滑变化、同一分钟内稳定', async () => {
    const { LIVE_EVENTS, viewersAt, feedAt } = await import('../buzz');
    const { DISTRICT_ORDER } = await import('../../world');
    for (const d of DISTRICT_ORDER) expect(LIVE_EVENTS.some((e) => e.district === d), d).toBe(true);
    const e = LIVE_EVENTS[0];
    const t = Date.parse('2026-11-15T10:00:10Z');
    expect(viewersAt(e, t)).toBe(viewersAt(e, t + 20000));
    expect(Math.abs(viewersAt(e, t) - e.baseViewers)).toBeLessThan(e.baseViewers * 0.3);
    const feed = feedAt(t, () => 'wk_w2');
    expect(feed.length).toBeGreaterThan(5);
    expect(feed.some((f) => f.example)).toBe(true);
    for (let i = 1; i < feed.length; i++) expect(feed[i - 1].at).toBeGreaterThanOrEqual(feed[i].at);
  });
});
