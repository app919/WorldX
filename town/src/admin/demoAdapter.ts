/**
 * 离线演示版的管理后台数据：界面与正式版完全一致，数据是演示数据（内存中，刷新即重置）。
 * 正式版（连接后端）会直接读写服务器，不会用到这里。
 */
import { SHOPS } from '../data/seed';
import { useTown } from '../store/useTown';

const DAY = 86400_000;
const day = (k: number) => new Date(Date.now() - k * DAY).toISOString().slice(0, 10);
let seed = 7;
const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

interface DemoShop { id: string; name: string; lotId: string; status: string; closedReason: string | null; owner: string; createdAt: number; products: { idx: number; name: string; description: string; removed: string | null }[]; media: { id: string; kind: string; title: string; filename: string; size: number; status: string; removedReason: string | null; url: string }[] }
let shops: DemoShop[] | null = null;
const audit: { id: number; admin: string; action: string; target: string; ts: number }[] = [];

function demoShops(): DemoShop[] {
  if (shops) return shops;
  const my = useTown.getState().myOpc;
  const base = [...(my ? [my] : []), ...SHOPS.slice(0, 8)];
  shops = base.map((s, i) => ({
    id: s.id, name: s.name, lotId: s.lotId, status: 'active', closedReason: null, owner: my && s.id === my.id ? '我（演示）' : `演示店主 ${i + 1}`, createdAt: Date.now() - (i * 2 + 1) * DAY,
    products: s.products.map((p, k) => ({ idx: k, name: p.name, description: p.description, removed: null })),
    media: i % 3 === 0 ? [{ id: `dm${i}v`, kind: 'video', title: '公司介绍视频（演示）', filename: 'intro.mp4', size: 18_400_000, status: 'live', removedReason: null, url: '#' }, { id: `dm${i}d`, kind: 'deck', title: '融资路演 PPT（演示）', filename: 'deck.pptx', size: 4_200_000, status: 'live', removedReason: null, url: '#' }] : [],
  }));
  return shops;
}

const series = (days: number) => Array.from({ length: days }, (_, k) => { const d = days - k; const u = Math.round(40 + R() * 30 + (days - d) * 2); return { day: day(d - 1), pv: u * 6 + Math.round(R() * 40), uv: u, dau: u, signups: Math.round(R() * 8) }; });

export async function demoAdminApi(url: string, init?: RequestInit): Promise<unknown> {
  const u = new URL(url, 'http://demo');
  const p = u.pathname;
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const post = (init?.method ?? 'GET') === 'POST';
  const log = (action: string, target: string) => audit.unshift({ id: audit.length + 1, admin: '演示管理员', action, target, ts: Date.now() });
  if (p === '/api/me') return { user: { role: 'admin', nickname: '演示管理员（离线演示）' } };
  if (p === '/api/health') return {};
  if (p === '/api/admin/overview') {
    const days = Number(u.searchParams.get('days') ?? 30);
    return { totals: { users: 186, usersToday: 9, phoneUsers: 171, dau: 64, wau: 132, mau: 186, pvToday: 1240, uvToday: 64, shops: demoShops().length, messages: 412, conversations: 96, wechatClicks: 23, wechatUsers: 17 }, series: series(days) };
  }
  if (p === '/api/admin/modules') return { modules: [['city', 3200], ['biz', 860], ['chain', 540], ['opps', 720], ['center', 310], ['community', 260], ['messages', 640], ['me', 420], ['shop', 980]].map(([m, pv]) => ({ module: m as string, pv: pv as number, uv: Math.round((pv as number) / 4.2), clicks: Math.round((pv as number) * 1.6), clickUv: Math.round((pv as number) / 5) })) };
  if (p === '/api/admin/clicks') return { clicks: [['city', 'need_box:search', 420], ['city', 'autowalk', 260], ['shop', 'live-chat', 180], ['opps', 'idea-coach', 96], ['chain', 'eco:favorite', 74]].map(([m, t, n]) => ({ module: m as string, target: t as string, pv: n as number, uv: Math.round((n as number) / 3) })) };
  if (p === '/api/admin/wechat-button') return { total: { n: 23, u: 17 }, byDay: Array.from({ length: 14 }, (_, k) => ({ day: day(k), n: Math.round(R() * 4), u: Math.round(R() * 3) })) };
  if (p === '/api/admin/conversations') return { conversations: [{ id: 'c1', aName: '阿岚', bName: '光影小棚', messages: 12, flagged: 0, wechatClicks: 1, lastBody: '周三下午可以来棚里看看样片', lastMsgAt: Date.now() - 3600_000, origin: 'shop' }, { id: 'c2', aName: '小林', bName: '梧桐豆子', messages: 5, flagged: 1, wechatClicks: 0, lastBody: '（含联系方式，已隐藏）', lastMsgAt: Date.now() - 7200_000, origin: 'search' }] };
  if (p.startsWith('/api/admin/conversations/')) { log('conversation.view', p.split('/').pop()!); return { messages: [{ id: 'm1', sender: '阿岚', body: '你好，想拍一组新品图', hasContact: 0, createdAt: Date.now() - 7200_000 }, { id: 'm2', sender: '光影小棚', body: '周三下午可以来棚里看看样片', hasContact: 0, createdAt: Date.now() - 3600_000 }] }; }
  if (p === '/api/admin/users') return { users: demoShops().map((s, i) => ({ nickname: s.owner, phoneMasked: `139****${String(1000 + i * 37).slice(-4)}`, wechatBound: i % 2 === 0, role: 'user', shopName: s.name, messages: Math.round(R() * 30), createdAt: s.createdAt, lastSeenAt: Date.now() - Math.round(R() * DAY) })) };
  if (p === '/api/admin/shops') return { shops: demoShops().map((s) => ({ name: s.name, lotId: s.lotId, category: '演示', licensed: 0, licenseCompany: null, owner: s.owner, ownerPhone: '139****0000', hasCompanyIntro: 1, hasProductIntro: 1, createdAt: s.createdAt })) };
  if (p === '/api/admin/docs') return { docs: [{ filename: '公司介绍.pptx', kind: 'company', status: 'done', method: 'rules', error: null, owner: '演示店主 1', createdAt: Date.now() - DAY }] };
  if (p === '/api/admin/audit') return { audit };
  if (p === '/api/admin/governance') return { shops: demoShops() };
  // —— 治理操作（演示里同样生效）——
  const m = /^\/api\/admin\/shops\/([^/]+)\/(close|reopen)$/.exec(p);
  if (m && post) { const s = demoShops().find((x) => x.id === m[1])!; s.status = m[2] === 'close' ? 'closed' : 'active'; s.closedReason = m[2] === 'close' ? body.reason : null; log(`shop.${m[2]}`, `${s.name}${body.reason ? `：${body.reason}` : ''}`); return { ok: true }; }
  const pm = /^\/api\/admin\/shops\/([^/]+)\/products\/(\d+)\/(takedown|restore)$/.exec(p);
  if (pm && post) { const s = demoShops().find((x) => x.id === pm[1])!; const pr = s.products[Number(pm[2])]; pr.removed = pm[3] === 'takedown' ? body.reason : null; log(`product.${pm[3]}`, `${s.name} · ${pr.name}`); return { ok: true }; }
  const mm = /^\/api\/admin\/media\/([^/]+)\/takedown$/.exec(p);
  if (mm && post) { for (const s of demoShops()) for (const x of s.media) if (x.id === mm[1]) { x.status = 'removed'; x.removedReason = body.reason; log('media.takedown', `${s.name} · ${x.title}`); } return { ok: true }; }
  return {};
}
