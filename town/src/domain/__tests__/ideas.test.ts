import { describe, expect, it } from 'vitest';
import { DEMO_IDEAS, coachIdea, reviewIdea, type ResourceHit } from '../ideas';
import { searchTown } from '../search';
import { lotOfExample } from '../lots';

const find = (q: string) => searchTown(q, { lotOfExample, districtOfLot: () => undefined }) as unknown as ResourceHit[];

describe('创意广场', () => {
  it('发布审核：太短、违规、留联系方式都会被拦截', () => {
    expect(reviewIdea('做个', '想做点东西').ok).toBe(false);
    expect(reviewIdea('直播间刷量服务', '帮直播间刷量提升排名，按场收费').ok).toBe(false);
    expect(reviewIdea('宠物写真', '给宠物拍写真，联系我 13912345678').reason).toContain('手机号');
    expect(reviewIdea('宠物写真', '给宠物拍写真 vx: abc_12345').ok).toBe(false);
    expect(reviewIdea('宠物店的 AI 客服', '给社区宠物店装一个 AI 客服回答洗护预约').ok).toBe(true);
  });

  it('AI 落地教练：一句话定位、5 步路线（每步有过关标准）、上下游、生态位与市场价值', () => {
    const p = coachIdea(DEMO_IDEAS[0], find);
    expect(p.position).toContain('给「');
    expect(p.steps).toHaveLength(5);
    expect(p.steps.every((s) => s.pass.length > 0 && s.system.length > 0)).toBe(true);
    expect(p.niches.length).toBeGreaterThan(0);
    expect(p.niches.every((n) => n.review.status !== 'reject')).toBe(true);
    expect(p.upstream.length + p.downstream.length).toBeGreaterThan(0);
  });

  it('系统资源来自入驻店铺 / 服务商 / 投资方，不含【例】示范店', () => {
    for (const idea of DEMO_IDEAS) {
      const p = coachIdea(idea, find);
      const res = [...p.upstream, ...p.downstream, ...p.peers].flatMap((l) => l.resources);
      expect(res.every((r) => r.kind !== 'example')).toBe(true);
      expect(p.resourceCount).toBeGreaterThan(0);
    }
  });
});
