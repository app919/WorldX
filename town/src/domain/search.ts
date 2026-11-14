/**
 * 「今天来找什么」：街区右下角的需求搜索（纯逻辑，可单测）。
 *
 * 输入一句话或点快捷词（找剪辑、找拍摄、找投资人……），在这些地方里找人：
 * - 已入驻的小店与主体（演示数据）、真实用户开的店（后端）；
 * -【例】示范店（标注“例”，虚构示例）；
 * - 服务中心的认证服务商、投资人 / 园区 / 专家。
 * 同义词扩展：剪辑 ≈ 视频 / 后期；拍摄 ≈ 摄影 / 拍照；投资人 ≈ 投资 / 融资……
 */
import { COUNTERPARTIES, RESIDENTS, SHOPS } from '../data/seed';
import { INDUSTRY_CHAINS } from '../data/chains';
import { creditOf } from './deal';
import { reputationOf, type Reputation } from './reputation';
import { EXAMPLE_OPCS } from '../data/examples';
import { CONTACTS, CONTACT_LABEL, SERVICE_CAT, SERVICE_PROVIDERS } from '../data/center';
import { capLabel, getCap } from './taxonomy';
import type { DistrictKey } from './commerce';
import { demoRoleOfLot } from './lots';
import { ROLE_BADGE } from './palette';

const badgeOf = (lotId: string) => { const r = demoRoleOfLot(lotId); return r && ROLE_BADGE[r] ? ROLE_BADGE[r] : undefined; };

export const QUICK_NEEDS = ['找剪辑', '找拍摄', '找投资人', '找设计', '找直播', '找 AI 开发', '找场地', '找财税'];

const SYN: Record<string, string[]> = {
  剪辑: ['剪辑', '视频', '后期', '短视频', '口播'],
  拍摄: ['拍摄', '摄影', '拍照', '写真', '跟拍', '摄影棚'],
  投资人: ['投资', '投资人', '融资', '天使', '基金'],
  投资: ['投资', '投资人', '融资', '天使', '基金'],
  设计: ['设计', '平面', '视觉', 'logo', '包装', '海报'],
  直播: ['直播', '带货', '主播'],
  ai: ['ai', 'agent', '智能体', '大模型', '数字人', '机器人', '具身智能'],
  开发: ['开发', '小程序', '软件', '程序', 'saas', '网站', '技术'],
  场地: ['场地', '会议室', '空间', '工位', '办公', '沙龙'],
  财税: ['财税', '记账', '报税', '会计', '注册公司', '发票'],
  法务: ['法务', '律师', '合同', '协议'],
  运营: ['运营', '小红书', '私域', '社群', '种草'],
  配音: ['配音', '旁白', '声音', '播客', '录音'],
  出海: ['出海', '跨境', '海外', '外贸', '翻译', '本地化'],
};

export interface SearchHit {
  id: string;
  kind: 'example' | 'shop' | 'entity' | 'remote' | 'provider' | 'contact';
  title: string;
  sub: string;
  /** 角标：例 / 企 / 认证 / 投资人… */
  badge?: string;
  district?: DistrictKey;
  lotId?: string;
  /** 与搜索词的相关度 */
  score: number;
  /** 评价分（排序依据）：评分 + 信用等级 + 活跃度 */
  rep: Reputation;
  /** 店主（演示角色 id）；有店主才能「聊一聊」 */
  ownerId?: string;
  /** 能不能交易：【例】示范店、未入驻商家不能 */
  canTrade: boolean;
}

/** 把一句话拆成要找的词（去掉“找、我要、有没有”等），并做同义词扩展 */
export function needTerms(q: string): string[] {
  const s = q.toLowerCase().replace(/[找寻要想请问有没没有的个位一下吗呢？?！!，,。.\s]/g, ' ').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    out.add(p);
    for (const [k, v] of Object.entries(SYN)) if (p.includes(k) || k.includes(p)) v.forEach((x) => out.add(x));
  }
  return [...out].filter((x) => x.length >= 1);
}

const scoreText = (hay: string, terms: string[]) => {
  const h = hay.toLowerCase();
  return terms.reduce((a, t) => a + (h.includes(t) ? (t.length >= 2 ? 2 : 1) : 0), 0);
};

export interface RemoteLike { id: string; lotId: string; name: string; tagline?: string; category?: string; licensed?: boolean; ownerUserId?: string }

export function searchTown(q: string, opts: { lotOfExample: (id: string) => string | undefined; districtOfLot: (lotId: string) => DistrictKey | undefined; remote?: RemoteLike[] }): SearchHit[] {
  const terms = needTerms(q);
  if (!terms.length) return [];
  const hits: SearchHit[] = [];
  const push = (h: Omit<SearchHit, 'score'>, hay: string, boost = 0) => { const sc = scoreText(hay, terms); if (sc > 0) hits.push({ ...h, score: sc + boost }); };
  const ownerOnline = (ownerId?: string) => !!RESIDENTS.find((r) => r.id === ownerId)?.online;
  const memberCredit = (entityId?: string) => { const m = entityId ? INDUSTRY_CHAINS.flatMap((x) => x.members).find((mm) => mm.entityId === entityId) : undefined; return m ? creditOf(m.id) : undefined; };

  for (const r of opts.remote ?? []) {
    push({ id: `remote_${r.id}`, kind: 'remote', title: r.name, sub: r.tagline || r.category || '', badge: r.licensed ? '企' : undefined, lotId: r.lotId, district: opts.districtOfLot(r.lotId),
      rep: reputationOf(r.id, { isNew: true, certified: r.licensed }), ownerId: r.ownerUserId, canTrade: true }, `${r.name} ${r.tagline ?? ''} ${r.category ?? ''}`, 2);
  }
  for (const s of SHOPS) {
    const ent = COUNTERPARTIES.find((c) => c.ownerId === s.ownerId);
    const caps = (ent?.capabilities ?? []).map((c) => `${capLabel(c)} ${(getCap(c)?.keywords ?? []).join(' ')}`).join(' ');
    const cr = memberCredit(ent?.id);
    push({ id: `shop_${s.id}`, kind: 'shop', title: s.name, sub: s.tagline, badge: badgeOf(s.lotId), lotId: s.lotId, district: opts.districtOfLot(s.lotId),
      rep: reputationOf(s.id, { online: ownerOnline(s.ownerId), certified: s.entityStatus === 'verified_company' || cr?.certified, done: cr?.done || undefined, rating: cr?.rating || undefined }), ownerId: s.ownerId, canTrade: true },
      `${s.name} ${s.tagline} ${s.category} ${s.products.map((p) => `${p.name} ${p.description}`).join(' ')} ${caps}`, 1);
  }
  for (const c of COUNTERPARTIES) {
    if (SHOPS.some((s) => s.lotId && s.lotId === c.place.lotId)) continue;
    const caps = c.capabilities.map((x) => `${capLabel(x)} ${(getCap(x)?.keywords ?? []).join(' ')}`).join(' ');
    const cr = memberCredit(c.id);
    push({ id: `ent_${c.id}`, kind: 'entity', title: c.name.replace('（虚构）', '').replace('（示意）', ''), sub: c.summary, badge: c.place.lotId ? badgeOf(c.place.lotId) : c.badge, lotId: c.place.lotId, district: c.place.district,
      rep: reputationOf(c.id, { online: ownerOnline(c.ownerId), certified: cr?.certified || c.kind === 'merchant', done: cr?.done || undefined, rating: cr?.rating || undefined, isNew: c.kind === 'prospect' }), ownerId: c.ownerId, canTrade: c.kind !== 'prospect' },
      `${c.name} ${c.summary} ${caps}`, 1);
  }
  for (const e of EXAMPLE_OPCS) {
    const lotId = opts.lotOfExample(e.id);
    push({ id: `ex_${e.id}`, kind: 'example', title: e.name, sub: `${e.direction} · ${e.tagline}`, badge: '例', lotId, district: e.district, rep: reputationOf(e.id), canTrade: false },
      `${e.name} ${e.direction} ${e.tagline} ${e.keywords.join(' ')} ${e.products.map((p) => p.name).join(' ')}`);
  }
  for (const p of SERVICE_PROVIDERS) {
    push({ id: `sv_${p.id}`, kind: 'provider', title: p.name.replace('（虚构）', ''), sub: `${SERVICE_CAT[p.cat]} · ${p.summary}`, badge: p.certified ? '认证' : undefined,
      rep: reputationOf(p.id, { rating: p.rating, done: p.done, certified: p.certified, online: true }), canTrade: true },
      `${p.name} ${SERVICE_CAT[p.cat]} ${p.summary} ${p.packages.map((k) => k.name).join(' ')}`);
  }
  for (const c of CONTACTS) {
    push({ id: `ct_${c.id}`, kind: 'contact', title: `${c.name.replace('（虚构）', '')} · ${c.org.replace('（虚构）', '')}`, sub: c.summary, badge: CONTACT_LABEL[c.kind], rep: reputationOf(c.id, { online: true }), canTrade: true },
      `${CONTACT_LABEL[c.kind]} ${c.name} ${c.org} ${c.summary} ${c.offers.join(' ')} ${c.ticket ?? ''}`, 1);
  }
  // 先筛相关（去掉只沾一点边的），再按「评价分」排序；【例】示范店无法交易，排在最后
  const top = Math.max(0, ...hits.map((h) => h.score));
  const relevant = hits.filter((h) => h.score >= Math.max(1, Math.ceil(top * 0.3)));
  return relevant.sort((a, b) => Number(a.kind === 'example') - Number(b.kind === 'example') || b.rep.score - a.rep.score || b.score - a.score || a.title.localeCompare(b.title)).slice(0, 12);
}
