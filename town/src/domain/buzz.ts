/**
 * 「逛」和「跟」的氛围（纯逻辑，可单测）：
 * - 街区动态（逛）：大家此刻在做什么 —— 上新、开播、交付、开张、招人；点一下飞过去看；
 * - 正在进行的活动（跟）：市集 / 路演 / 对接会 / 直播，显示围观人数、报名人数，可以围观、报名、发弹幕。
 * 演示数据里的人数是按时间平滑变化的模拟值，界面上标注「演示」；真实上线后按真实围观 / 报名统计。
 */
import type { DistrictKey } from './commerce';
import { EVENTS } from '../data/events';
import { SHOPS } from '../data/seed';
import { EXAMPLE_OPCS } from '../data/examples';

export interface LiveEvent { id: string; district: DistrictKey; kind: '市集' | '路演' | '对接会' | '直播' | '门诊'; title: string; host: string; baseViewers: number; signed: number; capacity: number; eventId?: string; offset: { x: number; z: number } }

/** 每个街区都有正在进行的活动（上海的关联到社区活动详情） */
export const LIVE_EVENTS: LiveEvent[] = [
  { id: 'lv_wk_market', district: 'wukang', kind: '市集', title: '独立品牌产品体验日', host: '梧桐豆子', baseViewers: 260, signed: 46, capacity: 80, eventId: 'ev_brand_day', offset: { x: 10, z: 8 } },
  { id: 'lv_yj_night', district: 'yangjing', kind: '对接会', title: '周三 OPC 创业者交流会', host: '邻里会客厅', baseViewers: 120, signed: 17, capacity: 20, eventId: 'ev_opc_night', offset: { x: 12, z: 6 } },
  { id: 'lv_sc_qixi', district: 'sichuan_n', kind: '市集', title: '甜爱路七夕情书市集', host: '甜爱文创', baseViewers: 340, signed: 24, capacity: 30, eventId: 'ev_qixi', offset: { x: 10, z: 10 } },
  { id: 'lv_nl_drama', district: 'nanluo', kind: '路演', title: '胡同里的一人公司路演夜', host: '胡同文创基金（虚构）', baseViewers: 180, signed: 12, capacity: 15, offset: { x: 0, z: 14 } },
  { id: 'lv_hq_hw', district: 'huaqiang', kind: '对接会', title: '硬件打样 × 跨境出海对接会', host: '湾区智造产业园（虚构）', baseViewers: 420, signed: 38, capacity: 60, offset: { x: 0, z: 30 } },
  { id: 'lv_wy_live', district: 'wuyi', kind: '直播', title: '五一商圈夜宵直播节', host: '星城直播间', baseViewers: 980, signed: 52, capacity: 80, offset: { x: 0, z: 30 } },
  { id: 'lv_cx_design', district: 'chunxi', kind: '市集', title: '太古里设计师周末市集', host: '太古里视觉设计', baseViewers: 360, signed: 41, capacity: 60, offset: { x: 0, z: 20 } },
];

/** 围观人数：在基数附近按分钟平滑起伏（同一分钟内稳定，不会乱跳） */
export function viewersAt(e: LiveEvent, now: number, extra = 0): number {
  const m = Math.floor(now / 60000); // 按整分钟取值：同一分钟内稳定
  const wave = Math.sin(m / 7 + e.id.length) * 0.18 + Math.sin(m / 2.3 + e.title.length) * 0.07;
  return Math.max(1, Math.round(e.baseViewers * (1 + wave))) + extra;
}

export const eventDetail = (e: LiveEvent) => (e.eventId ? EVENTS.find((x) => x.id === e.eventId) : undefined);

/** 弹幕（现场氛围）：演示模板 */
const DANMU = ['来了来了！', '这个想合作，怎么报名？', '主理人好会讲 👍', '求链接～', '现场人好多', '有没有做剪辑的朋友？', '下次一定来现场', '求带我一个', '这个价格可以聊吗', '已报名！', '想认识做包装设计的', '刚从隔壁街飞过来 ✈️'];
export const danmuAt = (now: number, n = 6) => Array.from({ length: n }, (_, i) => DANMU[(Math.floor(now / 3000) + i * 5) % DANMU.length]);

export interface FeedItem { id: string; at: number; icon: string; text: string; who: string; district: DistrictKey; lotId?: string; liveId?: string; example?: boolean }

/** 街区动态：按时间生成“此刻大家在做什么”（每 10 分钟换一批，跨城市） */
export function feedAt(now: number, lotOfExample: (id: string) => string | undefined): FeedItem[] {
  const slot = Math.floor(now / 600000);
  const out: FeedItem[] = [];
  const pick = <T,>(arr: T[], k: number) => arr[(slot * 7 + k * 13) % arr.length];
  for (let k = 0; k < 4; k++) {
    const s = pick(SHOPS, k);
    const p = s.products[k % s.products.length];
    out.push({ id: `f_shop_${k}`, at: now - (k * 7 + 3) * 60000, icon: '🆕', text: `上新了「${p.name}」`, who: s.name, district: districtOfLot(s.lotId), lotId: s.lotId });
  }
  for (let k = 0; k < 5; k++) {
    const e = pick(EXAMPLE_OPCS, k + 3);
    const verbs = [`交付了一单「${e.products[0].name}」`, '更新了案例', `开放了本周的预约`, '正在找合作伙伴', '上传了新作品'];
    out.push({ id: `f_ex_${k}`, at: now - (k * 11 + 5) * 60000, icon: '例', text: verbs[(slot + k) % verbs.length], who: e.name, district: e.district, lotId: lotOfExample(e.id), example: true });
  }
  for (const [k, e] of LIVE_EVENTS.entries()) {
    if ((slot + k) % 2) continue;
    out.push({ id: `f_live_${e.id}`, at: now - (k + 1) * 60000, icon: e.kind === '直播' ? '🔴' : '🎪', text: `${e.kind}进行中：${e.title}`, who: e.host, district: e.district, liveId: e.id });
  }
  return out.sort((a, b) => b.at - a.at);
}

const SH: Record<string, DistrictKey> = { wk: 'wukang', yj: 'yangjing', sc: 'sichuan_n', ta: 'sichuan_n' };
function districtOfLot(lotId: string): DistrictKey {
  const k = lotId.split('_')[0];
  return SH[k] ?? (['wukang', 'yangjing', 'sichuan_n', 'nanluo', 'huaqiang', 'wuyi', 'chunxi'] as DistrictKey[]).find((d) => lotId.startsWith(d)) ?? 'wukang';
}
