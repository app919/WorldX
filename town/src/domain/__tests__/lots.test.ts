import { describe, expect, it } from 'vitest';
import { DEMO_OWNERS, GOLDEN_RATIO, checkOwner, demoSponsors, isGolden, lotPlan, maskPhone, takenByDemo, usccCheckChar, validPhone, validUSCC } from '../lots';
import { SHOPS } from '../../data/seed';

describe('铺位：60% OPC 招租位 + 40% 黄金赞助位', () => {
  it.each(['wukang', 'yangjing', 'sichuan_n'] as const)('「%s」比例正确，黄金位不占用已有店铺', (d) => {
    const p = lotPlan(d);
    expect(p.golden.length).toBe(Math.round(p.total * GOLDEN_RATIO));
    expect(p.golden.length + p.opc.length).toBe(p.total);
    expect(new Set([...p.golden, ...p.opc]).size).toBe(p.total);
    const taken = takenByDemo();
    for (const g of p.golden) expect(taken.has(g)).toBe(false);
  });
  it('演示赞助商只在黄金位上；已有 OPC 店铺都不在黄金位', () => {
    for (const s of demoSponsors(Date.now())) expect(isGolden(s.lotId)).toBe(true);
    for (const s of SHOPS) expect(isGolden(s.lotId)).toBe(false);
  });
});

describe('营业执照与店主实名', () => {
  it('统一社会信用代码校验位', () => {
    const code = '91310000MA1FL0000' + usccCheckChar('91310000MA1FL0000');
    expect(validUSCC(code)).toBe(true);
    expect(validUSCC(code.slice(0, 17) + (code[17] === 'A' ? 'B' : 'A'))).toBe(false);
    expect(validUSCC('123')).toBe(false);
  });
  it('手机号格式与脱敏', () => {
    expect(validPhone('13912345678')).toBe(true);
    expect(validPhone('1234')).toBe(false);
    expect(maskPhone('13912345678')).toBe('139****5678');
  });
  it('每人只能开一家店：姓名与手机号都不能重复', () => {
    expect(checkOwner({ name: '阿岚', phone: '13912345678' }, DEMO_OWNERS)).toEqual([]);
    expect(checkOwner({ name: '阿岚', phone: DEMO_OWNERS[0].phone }, DEMO_OWNERS).join()).toContain('手机号');
    expect(checkOwner({ name: DEMO_OWNERS[1].name, phone: '13912345678' }, DEMO_OWNERS).join()).toContain('姓名');
  });
});
