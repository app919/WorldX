/**
 * AI 能力的可替换接口。
 *
 * - RuleBasedProvider：默认实现，离线、确定性、可单测（当前 Demo 使用）。
 * - HttpProvider：指向未来的 Python + FastAPI AI 服务（/api/ai/*），可接入国内合规的大模型 API。
 *
 * 不论使用哪种实现：
 *   画像必须经用户确认；关系由结构化数据生成；Agent 回答必须带 citations。
 */
import { agentRespond } from '../domain/agent';
import { buildOpportunityMap } from '../domain/matching';
import { extractProfile, type ExtractionResult } from '../domain/profileExtractor';
import type { AgentConfig, AgentReply, BusinessProfile, OpcProfile, Relationship } from '../domain/types';

export interface AiProvider {
  name: string;
  extract(text: string): Promise<ExtractionResult>;
  match(me: BusinessProfile, others: BusinessProfile[]): Promise<Relationship[]>;
  agent(opc: OpcProfile, cfg: AgentConfig, question: string): Promise<AgentReply>;
}

export const RuleBasedProvider: AiProvider = {
  name: 'rule-based-v1',
  extract: async (text) => extractProfile(text),
  match: async (me, others) => buildOpportunityMap(me, others),
  agent: async (opc, cfg, q) => agentRespond(opc, cfg, q),
};

export function HttpProvider(baseUrl: string): AiProvider {
  const post = async <T,>(path: string, body: unknown): Promise<T> => {
    const r = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`AI 服务错误 ${r.status}`);
    return r.json() as Promise<T>;
  };
  return {
    name: `http:${baseUrl}`,
    extract: (text) => post('/extract', { text }),
    match: (me, others) => post('/match', { me, others }),
    // 服务端也必须执行同样的 L1/L2/L3 权限校验；这里额外在客户端兜底一次 L3。
    agent: async (opc, cfg, question) => {
      const local = agentRespond(opc, cfg, question);
      if (local.level === 'L3') return local;
      return post('/agent', { opc, cfg, question });
    },
  };
}

export const ai: AiProvider = import.meta.env?.VITE_AI_BASE_URL ? HttpProvider(import.meta.env.VITE_AI_BASE_URL) : RuleBasedProvider;
