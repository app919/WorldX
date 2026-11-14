import { describe, expect, it } from 'vitest';
import { EXAMPLE_OPCS, examplesOf } from '../../data/examples';
import { EXAMPLE_RATIO, demoRoleOfLot, exampleAtLot, isGolden, lotOfExample, lotPlan, takenByDemo } from '../lots';
import { COUNTERPARTIES, SHOPS } from '../../data/seed';
import { INDUSTRY_CHAINS } from '../../data/chains';
import { searchTown, needTerms } from '../search';
import { dress, identityOf, IDENTITIES, EXAMPLE_DRESS } from '../identity';
import { ROLE_COLORS } from '../palette';
import { lotById } from '../../world';
import type { DistrictKey } from '../commerce';

const DS: DistrictKey[] = ['wukang', 'yangjing', 'sichuan_n'];

describe('【例】示范 OPC', () => {
  it('每个街区约 10% 的铺位是【例】示范店，且有完整资料', () => {
    for (const d of DS) {
      const p = lotPlan(d);
      expect(p.examples.length).toBe(Math.round(p.total * EXAMPLE_RATIO));
      expect(p.examples.length).toBe(examplesOf(d).length);
    }
    for (const e of EXAMPLE_OPCS) {
      expect(e.about.length).toBeGreaterThan(30);
      expect(e.products.length).toBeGreaterThanOrEqual(3);
      expect(e.cases.length).toBeGreaterThan(0);
      expect(e.faqs.length).toBeGreaterThan(0);
      expect(e.process.length).toBeGreaterThan(2);
      expect(e.keywords.length).toBeGreaterThan(3);
    }
  });
  it('覆盖热门 OPC 方向：AI Agent、具身智能、直播、剪辑…', () => {
    const dirs = EXAMPLE_OPCS.map((e) => e.direction).join(' ');
    for (const k of ['AI Agent', '具身智能', '直播', '剪辑', '数字人', '独立开发', '跨境']) expect(dirs).toContain(k);
  });
  it('【例】只占 OPC 招租位：不占黄金位、不和演示店铺重叠、不能再被开店', () => {
    const base = new Set([...SHOPS.map((s) => s.lotId), ...COUNTERPARTIES.map((c) => c.place.lotId).filter(Boolean) as string[]]);
    const all = DS.flatMap((d) => lotPlan(d).examples);
    expect(new Set(all).size).toBe(all.length);
    for (const l of all) {
      expect(isGolden(l)).toBe(false);
      expect(base.has(l)).toBe(false);
      expect(takenByDemo().has(l)).toBe(true);
      expect(lotById(l)).toBeTruthy();
      expect(lotOfExample(exampleAtLot(l)!.id)).toBe(l);
    }
  });
  it('【例】不写进产业链（避免混淆）', () => {
    const names = new Set(INDUSTRY_CHAINS.flatMap((c) => c.members.map((m) => m.name)));
    const ids = new Set(INDUSTRY_CHAINS.flatMap((c) => c.members.map((m) => m.id)));
    for (const e of EXAMPLE_OPCS) { expect(names.has(e.name)).toBe(false); expect(ids.has(e.id)).toBe(false); }
  });
});

describe('今天来找什么', () => {
  const opts = { lotOfExample, districtOfLot: (l: string) => lotById(l)?.district };
  it('同义词：找剪辑 → 视频 / 后期；找拍摄 → 摄影', () => {
    expect(needTerms('找剪辑')).toEqual(expect.arrayContaining(['剪辑', '视频', '后期']));
    expect(needTerms('我想找拍摄')).toEqual(expect.arrayContaining(['拍摄', '摄影']));
  });
  it('找剪辑：能找到剪辑师（含【例】），并且带铺位可以“带我去”', () => {
    const hits = searchTown('找剪辑', opts);
    expect(hits.length).toBeGreaterThan(0);
    const ex = hits.find((h) => h.id === 'ex_ex_editor');
    expect(ex?.badge).toBe('例');
    expect(ex?.lotId).toBeTruthy();
  });
  it('找拍摄：真实入驻的摄影店排在【例】前面', () => {
    const hits = searchTown('找拍摄', opts);
    const iReal = hits.findIndex((h) => h.kind !== 'example');
    const iEx = hits.findIndex((h) => h.kind === 'example');
    expect(iReal).toBeGreaterThanOrEqual(0);
    if (iEx >= 0) expect(iReal).toBeLessThan(iEx + 1);
    expect(hits.some((h) => h.title.includes('光影小棚'))).toBe(true);
  });
  it('找投资人：列出服务中心的投资人', () => {
    const hits = searchTown('找投资人', opts);
    expect(hits.some((h) => h.kind === 'contact' && h.badge === '投资人')).toBe(true);
  });
  it('空输入不返回结果', () => { expect(searchTown('   ', opts)).toEqual([]); });
});

describe('身份与着装', () => {
  it('六种身份：投资人 / 在职看副业 / OPC 主理人 / 商业服务者 / 品牌方 / 游客，一类人一种着装', () => {
    expect(IDENTITIES.map((i) => i.label)).toEqual(['投资人', '在职看副业', 'OPC 主理人', '商业服务者', '品牌方', '游客']);
    expect(new Set(IDENTITIES.map((i) => i.outfit)).size).toBe(6);
  });
  it('全站身份色：例 粉 / 企 蓝 / 投 黑 / 品 金 / 其他 紫；服装与屋顶同色', () => {
    const base = { body: '#000000', skin: '#F6DCC8', hair: '#333333', accessory: 'none' as const };
    expect(dress(base, 'opc').outfit).toBe('overalls');
    expect(dress(base, 'opc').body).toBe(ROLE_COLORS.personal);
    expect(dress(base, 'investor').body).toBe(ROLE_COLORS.investor);
    expect(dress(base, 'brand').body).toBe(ROLE_COLORS.brand);
    expect(dress(base, 'opc', { company: true }).body).toBe(ROLE_COLORS.company);
    expect(EXAMPLE_DRESS.body).toBe(ROLE_COLORS.example);
    expect(identityOf('worker').tag).toBe('side_hustle');
    expect(Object.isFrozen(ROLE_COLORS)).toBe(true);
  });
  it('铺位身份色：示范店 = 例，投资机构 = 投，品牌 = 品，有执照 = 企，个人 = 紫', () => {
    const roles = new Set<string>();
    for (const d of DS) for (const l of lotPlan(d).examples) expect(demoRoleOfLot(l)).toBe('example');
    expect(demoRoleOfLot('wukang_lot30')).toBe('investor');
    expect(demoRoleOfLot('wk_w2')).toBe('brand');
    expect(demoRoleOfLot('wk_n1')).toBe('company');
    expect(demoRoleOfLot('wk_e2')).toBe('personal');
    for (const id of ['wk_w2', 'wk_n1', 'wk_e2', 'wukang_lot30', lotPlan('wukang').examples[0]]) roles.add(demoRoleOfLot(id)!);
    expect(roles.size).toBe(5);
  });
});
