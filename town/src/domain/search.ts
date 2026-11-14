/**
 * 「今天来找什么」：街区右下角的需求搜索（纯逻辑，可单测）。
 *
 * 输入一句话或点快捷词（找剪辑、找拍摄、找投资人……），在这些地方里找人：
 * - 已入驻的小店与主体（演示数据）、真实用户开的店（后端）；
 * -【例】示范店（标注“例”，虚构示例）；
 * - 服务中心的认证服务商、投资人 / 园区 / 专家。
 * 同义词扩展：剪辑 ≈ 视频 / 后期；拍摄 ≈ 摄影 / 拍照；投资人 ≈ 投资 / 融资……
 */
import { COUNTERPARTIES, SHOPS } from '../data/seed';
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
  score: number;
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

export interface RemoteLike { id: string; lotId: string; name: string; tagline?: string; category?: string; licensed?: boolean }

export function searchTown(q: string, opts: { lotOfExample: (id: string) => string | undefined; districtOfLot: (lotId: string) => DistrictKey | undefined; remote?: RemoteLike[] }): SearchHit[] {
  const terms = needTerms(q);
  if (!terms.length) return [];
  const hits: SearchHit[] = [];
  const push = (h: Omit<SearchHit, 'score'>, hay: string, boost = 0) => { const sc = scoreText(hay, terms); if (sc > 0) hits.push({ ...h, score: sc + boost }); };

  for (const r of opts.remote ?? []) {
    push({ id: `remote_${r.id}`, kind: 'remote', title: r.name, sub: r.tagline || r.category || '', badge: r.licensed ? '企' : undefined, lotId: r.lotId, district: opts.districtOfLot(r.lotId) }, `${r.name} ${r.tagline ?? ''} ${r.category ?? ''}`, 2);
  }
  for (const s of SHOPS) {
    const ent = COUNTERPARTIES.find((c) => c.ownerId === s.ownerId);
    const caps = (ent?.capabilities ?? []).map((c) => `${capLabel(c)} ${(getCap(c)?.keywords ?? []).join(' ')}`).join(' ');
    push({ id: `shop_${s.id}`, kind: 'shop', title: s.name, sub: s.tagline, badge: badgeOf(s.lotId), lotId: s.lotId, district: opts.districtOfLot(s.lotId) },
      `${s.name} ${s.tagline} ${s.category} ${s.products.map((p) => `${p.name} ${p.description}`).join(' ')} ${caps}`, 1);
  }
  for (const c of COUNTERPARTIES) {
    if (SHOPS.some((s) => s.lotId && s.lotId === c.place.lotId)) continue;
    const caps = c.capabilities.map((x) => `${capLabel(x)} ${(getCap(x)?.keywords ?? []).join(' ')}`).join(' ');
    push({ id: `ent_${c.id}`, kind: 'entity', title: c.name.replace('（虚构）', '').replace('（示意）', ''), sub: c.summary, badge: c.place.lotId ? badgeOf(c.place.lotId) : c.badge, lotId: c.place.lotId, district: c.place.district },
      `${c.name} ${c.summary} ${caps}`, 1);
  }
  for (const e of EXAMPLE_OPCS) {
    const lotId = opts.lotOfExample(e.id);
    push({ id: `ex_${e.id}`, kind: 'example', title: e.name, sub: `${e.direction} · ${e.tagline}`, badge: '例', lotId, district: e.district },
      `${e.name} ${e.direction} ${e.tagline} ${e.keywords.join(' ')} ${e.products.map((p) => p.name).join(' ')}`);
  }
  for (const p of SERVICE_PROVIDERS) {
    push({ id: `sv_${p.id}`, kind: 'provider', title: p.name.replace('（虚构）', ''), sub: `${SERVICE_CAT[p.cat]} · ${p.summary}`, badge: p.certified ? '认证' : undefined },
      `${p.name} ${SERVICE_CAT[p.cat]} ${p.summary} ${p.packages.map((k) => k.name).join(' ')}`);
  }
  for (const c of CONTACTS) {
    push({ id: `ct_${c.id}`, kind: 'contact', title: `${c.name.replace('（虚构）', '')} · ${c.org.replace('（虚构）', '')}`, sub: c.summary, badge: CONTACT_LABEL[c.kind] },
      `${CONTACT_LABEL[c.kind]} ${c.name} ${c.org} ${c.summary} ${c.offers.join(' ')} ${c.ticket ?? ''}`, 1);
  }
  // 真实入驻优先，其次【例】，同分按标题
  const order = { remote: 0, shop: 1, entity: 2, provider: 3, contact: 3, example: 4 } as const;
  return hits.sort((a, b) => b.score - a.score || order[a.kind] - order[b.kind] || a.title.localeCompare(b.title)).slice(0, 12);
}
