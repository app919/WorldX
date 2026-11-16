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

describe('留存机制：每日委托 / 主题周 / 签到 / 推演', () => {
  it('第 8 天起每日委托：每天买 / 逛 / 跟各一件，换一天就换；周一和周四有主题城市任务', async () => {
    const { dailyFor, themeOfWeek } = await import('../quests');
    const a = dailyFor('opc', '2026-11-18'), b = dailyFor('opc', '2026-11-19');
    expect(a.quests.map((q) => q.kind)).toEqual(['买', '逛', '跟']);
    expect(a.quests.map((q) => q.id)).not.toEqual(b.quests.map((q) => q.id));
    const mon = dailyFor('opc', '2026-11-16'); // 2026-11-16 是周一
    expect(mon.quests[1].event).toBe('switch_city');
    expect(themeOfWeek('2026-11-16').week).toBe(themeOfWeek('2026-11-22').week);
    expect(themeOfWeek('2026-11-23').week).toBe(themeOfWeek('2026-11-16').week + 1);
  });
  it('签到：30 天一季，里程碑 3 / 7 / 14 / 21 / 30；连续天数断了重新算', async () => {
    const { seasonOf, streakOf } = await import('../quests');
    expect(seasonOf(7)).toMatchObject({ season: 1, inSeason: 7, next: { n: 14 } });
    expect(seasonOf(31)).toMatchObject({ season: 2, inSeason: 1 });
    expect(streakOf(['2026-11-14', '2026-11-15', '2026-11-16'], '2026-11-16')).toBe(3);
    expect(streakOf(['2026-11-13', '2026-11-15'], '2026-11-16')).toBe(1);
  });
  it('留存推演：现在的系统在第 8 天断崖、30 天内趋近于 0；补上机制后 30 天留存明显提升', async () => {
    const { simulate, CURRENT, IMPROVED, at, dropDays, PERSONA_LABEL } = await import('../retention');
    for (const p of Object.keys(PERSONA_LABEL) as (keyof typeof PERSONA_LABEL)[]) {
      const cur = simulate(p, CURRENT), imp = simulate(p, IMPROVED);
      expect(dropDays(cur)[0]).toBe(8);
      expect(at(cur, 30)).toBeLessThan(0.02);
      expect(at(imp, 30)).toBeGreaterThan(at(cur, 30) * 4);
      expect(at(imp, 8) / at(imp, 7)).toBeGreaterThan(at(cur, 8) / at(cur, 7));
      expect(at(imp, 90)).toBeGreaterThan(0.03);
    }
  });
});
