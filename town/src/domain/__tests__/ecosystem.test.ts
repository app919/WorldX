import { describe, expect, it } from 'vitest';
import { EMPTY_ANSWERS, NICHES, allowedScopes, defaultScope, fmtYuan, generateNiches, marketValue, matchOne, reviewNiche } from '../ecosystem';

const photographer = { text: '我是摄影师，拍短视频和产品宣传片，武康路小工作室', city: 'shanghai' as const };

describe('智能生态位', () => {
  it('按匹配度降序给出 6 个，且都过了审核', () => {
    const r = generateNiches(photographer);
    expect(r.items).toHaveLength(6);
    for (let i = 1; i < r.items.length; i++) expect(r.items[i - 1].match).toBeGreaterThanOrEqual(r.items[i].match);
    expect(r.items.every((x) => x.review.status !== 'reject')).toBe(true);
    expect(r.items[0].match).toBeGreaterThanOrEqual(80);
    expect(r.items.every((x) => x.match >= 1 && x.match <= 99)).toBe(true);
  });

  it('丢弃一个就补一个新的；收藏移入收藏夹也补位', () => {
    const a = generateNiches(photographer);
    const gone = a.items[0].niche.id;
    const b = generateNiches(photographer, { dismissed: [gone] });
    expect(b.items).toHaveLength(6);
    expect(b.items.map((x) => x.niche.id)).not.toContain(gone);
    expect(b.items[5].niche.id).not.toBe(a.items[5].niche.id);
    const c = generateNiches(photographer, { favorites: [a.items[1].niche.id] });
    expect(c.items.map((x) => x.niche.id)).not.toContain(a.items[1].niche.id);
    expect(c.items).toHaveLength(6);
  });

  it('不同资料得到不同的方向', () => {
    const hw = generateNiches({ text: '深圳硬件工程师，做蓝牙小家电和 PCB 打样', city: 'shenzhen' });
    expect(hw.items[0].niche.industry).toBe('hardware');
    const cafe = generateNiches({ text: '咖啡馆主理人，自己烘焙咖啡豆', city: 'shanghai' });
    expect(cafe.items[0].niche.id).toBe('coffee_supply');
    expect(cafe.items[0].review.status).toBe('warn'); // 需要食品经营许可
  });

  it('审核：合规红线拦截，永不展示', () => {
    expect(reviewNiche(NICHES.find((n) => n.id === 'traffic_brush')!).status).toBe('reject');
    expect(reviewNiche(NICHES.find((n) => n.id === 'loan_lead')!).status).toBe('reject');
    const live = generateNiches({ text: '直播带货主播，做直播间场控和社群运营', city: 'changsha' });
    expect(live.items.map((x) => x.niche.id)).not.toContain('traffic_brush');
    expect(live.blocked.some((b) => b.title.includes('刷量'))).toBe(true);
  });

  it('知识库中所有可展示方向的两种算法相差不超过 2 倍', () => {
    for (const n of NICHES) {
      if (reviewNiche(n).status === 'reject') continue;
      const v = marketValue(n, 'shanghai', 'china');
      expect(v.divergence, n.id).toBeLessThanOrEqual(2);
      expect(v.tam).toBeGreaterThan(0);
      expect(v.som).toBeLessThanOrEqual(v.sam);
      expect(v.som).toBeLessThanOrEqual(v.capacityCap + 1);
    }
  });

  it('市场价值：TAM = √(自下而上 × 自上而下)，范围：中国 / 本城市 / 全球', () => {
    const n = NICHES.find((x) => x.id === 'ai_agent_smb')!;
    const cn = marketValue(n, 'shanghai', 'china');
    expect(cn.tam).toBeCloseTo(Math.sqrt(cn.bottomUp * cn.topDown), 0);
    const gl = marketValue(n, 'shanghai', 'global');
    expect(gl.tam / cn.tam).toBeCloseTo(1 / 0.2, 5);
    expect(allowedScopes(n)).toEqual(['china', 'global']);
    const local = NICHES.find((x) => x.id === 'restaurant_marketing')!;
    expect(defaultScope(local)).toBe('city');
    const city = marketValue(local, 'shanghai');
    const china = marketValue(local, 'shanghai', 'china');
    expect(city.scopeLabel).toContain('上海');
    expect(city.tam / china.tam).toBeCloseTo(0.037, 5);
    // 本地业务不能切全球
    expect(marketValue(local, 'shanghai', 'global').scope).toBe('city');
    expect(cn.steps.join('')).toContain('自下而上');
  });

  it('没有资料、或【例】示范店：不生成', () => {
    expect(generateNiches({ text: '', city: 'shanghai' }).items).toHaveLength(0);
    expect(generateNiches({ ...photographer, isExample: true }).items).toHaveLength(0);
  });

  it('单个方向可重新计算（收藏夹用）', () => {
    const m = matchOne('wedding_content', photographer)!;
    expect(m.value.scope).toBe('city');
    expect(fmtYuan(m.value.tam)).toMatch(/亿元|万元/);
  });

  it('回答问题让匹配更准：拿手能力、拓展方向、市场范围、自由补充都会改变排序', () => {
    const base = generateNiches(photographer);
    const out = generateNiches({ ...photographer, answers: { ...EMPTY_ANSWERS, reach: 'global', direction: 'cross', skills: ['crossborder'] } });
    expect(out.items.map((x) => x.niche.id)).not.toEqual(base.items.map((x) => x.niche.id));
    expect(out.items.some((x) => x.niche.id === 'crossborder_content')).toBe(true);
    // 只有补充说明，也能生成
    const onlyNote = generateNiches({ text: '', city: 'chengdu', answers: { ...EMPTY_ANSWERS, note: '成都做非遗蜀绣手作，想接游客体验课' } });
    expect(onlyNote.items[0].niche.id).toBe('craft_experience');
    // 想做本地 → 本地方向加分
    const loc = generateNiches({ ...photographer, answers: { ...EMPTY_ANSWERS, reach: 'local' } });
    const locShare = loc.items.filter((x) => x.niche.market.geo === 'local').length;
    expect(locShare).toBeGreaterThanOrEqual(base.items.filter((x) => x.niche.market.geo === 'local').length);
  });
});
