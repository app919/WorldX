/**
 * 前端与后端的连接层：
 * - 后端可用时（同源 /api/health 正常）进入「正式模式」：必须登录，所有数据保存到服务端数据库；
 * - 打不开后端（例如双击本地 HTML 文件）时进入「离线演示模式」：和以前一样只存在本机浏览器。
 * - 埋点：自动记录每个模块的浏览（PV）和每个按钮 / 链接的点击，批量上报。
 * - 进度同步：各模块的本地状态（zustand persist）变化后 2 秒内同步到服务端；登录时从服务端恢复。
 */
export type Mode = 'checking' | 'online' | 'offline';

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const r = await fetch(url, {
    credentials: 'include', ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError((body as { error?: string }).error ?? `请求失败（${r.status}）`, r.status);
  return body as T;
}

export async function detectBackend(): Promise<Mode> {
  if (typeof location === 'undefined' || !location.protocol.startsWith('http') || location.search.includes('offline')) return 'offline';
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('/api/health', { signal: ctl.signal, credentials: 'include' });
    clearTimeout(t);
    return r.ok && (await r.json()).ok ? 'online' : 'offline';
  } catch { return 'offline'; }
}

/* ———————————————— 埋点 ———————————————— */
interface Ev { type: 'pv' | 'click' | 'action'; module?: string; target?: string; path?: string; ts: number; meta?: Record<string, string | number | boolean> }
let queue: Ev[] = [];
let trackingOn = false;
let moduleOf: () => string = () => 'app';

export function track(type: Ev['type'], module?: string, target?: string, meta?: Ev['meta']) {
  if (!trackingOn) return;
  queue.push({ type, module, target: target?.slice(0, 80), path: location.pathname, ts: Date.now(), meta });
  if (queue.length >= 40) flush();
}
function flush(beacon = false) {
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const body = JSON.stringify({ events });
  if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
  else fetch('/api/track', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
}

/** 自动点击埋点：带 data-testid 的元素用它作为按钮名，否则用按钮 / 链接上的文字 */
export function startTracking(currentModule: () => string) {
  if (trackingOn) return;
  trackingOn = true;
  moduleOf = currentModule;
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-testid], button, a') as HTMLElement | null;
    if (!el) return;
    const id = el.getAttribute('data-testid') ?? `${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 16)}`;
    track('click', moduleOf(), id);
  }, { capture: true });
  setInterval(() => flush(), 4000);
  addEventListener('pagehide', () => flush(true));
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
}

/* ———————————————— 进度同步 ———————————————— */
/** 前端各模块在 localStorage 里的键 → 服务端 state key */
export const STORE_KEYS: Record<string, string> = { 'opc-town-v2': 'town', 'sanlinbang-opp': 'opp', 'sanlinbang-center': 'center', 'opc-town-work': 'work', 'sanlinbang-lots': 'lots' };
const OWNER_KEY = 'slb-owner';

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 存储不可用 */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* 存储不可用 */ } },
};

/** 登录后：服务端有数据就用服务端的（换设备也能接着玩）；服务端没有、且本机数据属于同一个人时上传本机数据 */
export async function restoreState(userId: string): Promise<boolean> {
  const owner = ls.get(OWNER_KEY);
  if (owner && owner !== userId) for (const k of Object.keys(STORE_KEYS)) ls.del(k); // 换了账号：清掉上一个人的本机数据
  ls.set(OWNER_KEY, userId);
  const { state } = await api<{ state: Record<string, { data: unknown }> }>('/api/me/state');
  let restored = false;
  for (const [lsKey, key] of Object.entries(STORE_KEYS)) {
    if (state[key]) { ls.set(lsKey, JSON.stringify(state[key].data)); restored = true; }
    else { const local = ls.get(lsKey); if (local) await api(`/api/me/state/${key}`, { method: 'PUT', json: JSON.parse(local) }).catch(() => {}); }
  }
  return restored;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const lastSent: Record<string, string> = {};
/** 本地状态有变化就排队同步（2 秒去抖） */
export function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    for (const [lsKey, key] of Object.entries(STORE_KEYS)) {
      const v = ls.get(lsKey);
      if (!v || lastSent[key] === v) continue;
      lastSent[key] = v;
      await api(`/api/me/state/${key}`, { method: 'PUT', json: JSON.parse(v) }).catch(() => { delete lastSent[key]; });
    }
  }, 2000);
}
export function clearLocalState() { for (const k of Object.keys(STORE_KEYS)) ls.del(k); ls.del(OWNER_KEY); }
