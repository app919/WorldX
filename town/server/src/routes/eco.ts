/**
 * 智能生态位（后台生成）：根据 OPC 的资料生成上下游 / 供应链 / 多元化方向，
 * 规则与前端同一套（src/domain/ecosystem.ts）：匹配度降序取 6 个、生成即审核、市场价值三角验证。
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateNiches } from '../../../src/domain/ecosystem';

const City = z.enum(['shanghai', 'beijing', 'shenzhen', 'changsha', 'chengdu']);
const Body = z.object({
  text: z.string().max(20_000).default(''),
  capabilities: z.array(z.string().max(40)).max(40).optional(),
  industries: z.array(z.string().max(40)).max(20).optional(),
  city: City.default('shanghai'),
  dismissed: z.array(z.string().max(60)).max(200).optional(),
  favorites: z.array(z.string().max(60)).max(200).optional(),
  scopes: z.record(z.string().max(60), z.enum(['china', 'city', 'global'])).optional(),
  count: z.number().int().min(1).max(12).optional(),
});

export async function ecoRoutes(app: FastifyInstance) {
  app.post('/api/eco/niches', async (req) => {
    const b = Body.parse(req.body ?? {});
    const r = generateNiches({ text: b.text, capabilities: b.capabilities, industries: b.industries, city: b.city }, { dismissed: b.dismissed, favorites: b.favorites, scopes: b.scopes, count: b.count });
    return {
      items: r.items.map((m) => ({
        id: m.niche.id, title: m.niche.title, industry: m.niche.industry, relation: m.relation, match: m.match, breakdown: m.breakdown, why: m.why,
        pitch: m.niche.pitch, firstStep: m.niche.firstStep, review: m.review,
        value: { scope: m.value.scope, scopeLabel: m.value.scopeLabel, tam: Math.round(m.value.tam), sam: Math.round(m.value.sam), som: Math.round(m.value.som), tam3y: Math.round(m.value.tam3y), confidence: m.value.confidence, steps: m.value.steps },
      })),
      blocked: r.blocked, remaining: r.remaining, capabilities: r.profile.caps,
    };
  });
}
