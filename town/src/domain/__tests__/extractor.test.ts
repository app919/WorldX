import { describe, expect, it } from 'vitest';
import { extractProfile, suggestDirections } from '../profileExtractor';
import { STORY_INTRO_TEXT } from '../../data/seed';

describe('画像提取', () => {
  it('从示例自述中提取：提供视频/AI 宣传片/策划，需要客户，地域徐汇静安', () => {
    const x = extractProfile('我会做短视频，也会用 AI 做宣传片。我现在没有固定工作，希望接一些企业宣传片的业务。');
    const caps = x.capabilities.map((c) => c.tag);
    expect(caps).toEqual(expect.arrayContaining(['video', 'ai_video', 'planning']));
    expect(x.needs.map((n) => n.tag)).toContain('client');
    expect(x.needs.map((n) => n.tag)).not.toContain('video'); // “接宣传片业务”不是需要视频
    expect(x.intents).toContain('part_time');
    // AI 推测的上游需求（配音、文案、摄影）只作为建议
    expect(x.suggestedNeeds.map((n) => n.tag)).toEqual(expect.arrayContaining(['voice']));
  });

  it('识别区域、合作方式与报价', () => {
    const x = extractProfile(STORY_INTRO_TEXT);
    expect(x.districts).toEqual(expect.arrayContaining(['xuhui', 'jingan']));
    expect(x.mode).toBe('both');
    expect(x.priceRange).toEqual({ min: 3000, max: 12000 });
  });

  it('“需要”语句中的能力被识别为需求', () => {
    const x = extractProfile('我是做咖啡的。我需要平面设计和摄影。');
    expect(x.capabilities.map((c) => c.tag)).toContain('coffee');
    expect(x.needs.map((n) => n.tag)).toEqual(expect.arrayContaining(['graphic', 'photo']));
  });

  it('创新一：从“会做饭、拍视频、认识社区老人、有车”推测三个方向', () => {
    const x = extractProfile('我会做饭。我喜欢拍视频。我认识一些社区里的老人。我有一辆车。');
    const tags = x.capabilities.map((c) => c.tag);
    expect(tags).toEqual(expect.arrayContaining(['cooking', 'video', 'community_ops', 'driving']));
    const titles = suggestDirections(tags).map((d) => d.title);
    expect(titles).toEqual(['社区美食短视频服务', '老年生活内容记录服务', '社区团购 / 本地生活服务']);
  });
});
