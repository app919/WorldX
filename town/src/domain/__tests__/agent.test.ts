import { describe, expect, it } from 'vitest';
import { agentRespond, transparencyNotice } from '../agent';
import type { AgentConfig, OpcProfile } from '../types';

const opc: OpcProfile = {
  id: 'o1', ownerId: 'u1', name: 'AI 视频工作室', tagline: 'AI 创意策划与企业宣传片', category: '内容与传媒',
  entityStatus: 'personal_page', stage: 'has_product', facade: 'studio', lotId: 'x',
  products: [
    { id: 'p1', opcId: 'o1', name: '企业宣传片', description: 'AI 创意策划 + 视频制作', priceFrom: 5000, unit: '支', priceConfirmed: true },
    { id: 'p2', opcId: 'o1', name: '短视频代运营', description: '月度代运营', priceFrom: 9999, priceConfirmed: false },
  ],
  cases: ['某咖啡品牌新品短片'], faqs: [{ q: '可以远程合作吗', a: '可以，远程线下都行。' }], openNeeds: [], createdAt: 0,
};
const cfg: AgentConfig = { id: 'a1', opcId: 'o1', persona: '', enabledLevels: { L1: true, L2: true }, autoReception: true, ownerOnline: false, ownerTakeover: false };

describe('AI 分身权限边界', () => {
  it('透明：访客知道在和 AI 分身交流', () => {
    expect(transparencyNotice('X')).toContain('AI 分身');
    const r = agentRespond(opc, cfg, '你是真人吗？');
    expect(r.text).toContain('AI 分身');
  });

  it('L1：产品介绍可以直接回答，并带依据', () => {
    const r = agentRespond(opc, cfg, '你们能做企业宣传片吗？');
    expect(r.level).toBe('L1');
    expect(r.citations).toContain('product:p1');
    expect(r.text).toContain('可以呀');
  });

  it('价格只引用主理人确认过的资料', () => {
    const r = agentRespond(opc, cfg, '企业宣传片多少钱？');
    expect(r.text).toContain('5000');
    expect(r.citations).toContain('product:p1.priceFrom');
  });

  it('未确认的价格绝不报出', () => {
    const r = agentRespond(opc, cfg, '短视频代运营多少钱');
    expect(r.text).not.toContain('9999');
    expect(r.text).toContain('不能替 TA 报价');
  });

  it.each(['能打个折吗', '可以签合同吗', '保证三天交付吗', '我要退款', '最终报价是多少'])('L3「%s」→ 必须本人确认并转交', (q) => {
    const r = agentRespond(opc, cfg, q);
    expect(r.level).toBe('L3');
    expect(r.handoff).toBe(true);
  });

  it('L2 关闭后，预约请求转交主理人', () => {
    const r = agentRespond(opc, { ...cfg, enabledLevels: { L1: true, L2: false } }, '想预约聊聊');
    expect(r.handoff).toBe(true);
    expect(r.action).toBeUndefined();
  });

  it('主理人接管后 AI 停止回答', () => {
    const r = agentRespond(opc, { ...cfg, ownerTakeover: true }, '你们做什么的');
    expect(r.text).toContain('接管');
    expect(r.citations).toHaveLength(0);
  });

  it('不确定的问题不乱说', () => {
    const r = agentRespond(opc, cfg, '明天会下雨吗');
    expect(r.handoff).toBe(true);
    expect(r.citations).toHaveLength(0);
  });
});
