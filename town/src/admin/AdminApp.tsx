/**
 * 三邻邦管理后台（仅管理员）：
 * 概览（注册用户、DAU/WAU/MAU、PV/UV 趋势）· 模块 PV/UV · 按钮与链接点击 PV/UV · 留微信号按钮 · 消息审查 · 用户 · 店铺 · 上传资料 · 审计日志
 */
import { useEffect, useState } from 'react';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j as { error?: string }).error ?? `HTTP ${r.status}`), { status: r.status });
  return j as T;
}

type Tab = 'overview' | 'modules' | 'clicks' | 'wechat' | 'messages' | 'users' | 'shops' | 'docs' | 'audit';
const TABS: [Tab, string][] = [['overview', '概览'], ['modules', '模块 PV/UV'], ['clicks', '点击 PV/UV'], ['wechat', '留微信号按钮'], ['messages', '消息审查'], ['users', '用户'], ['shops', '店铺'], ['docs', '上传资料'], ['audit', '审计日志']];
const MODULE_LABEL: Record<string, string> = { city: '我的上海（街区）', biz: '我的生意', chain: '产业链', opps: '需求大厅', center: '服务中心', community: '我的社区', messages: '消息', me: '我的', login: '登录页', shop: '店铺', onboarding: '新手引导' };
const fmt = (ts?: number | null) => (ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—');

export function AdminApp() {
  const [me, setMe] = useState<{ role: string; nickname: string | null } | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => { api<{ user: { role: string; nickname: string | null } | null }>('/api/me').then((r) => setMe(r.user)).catch(() => setMe(null)); }, []);
  if (me === undefined) return <div className="p-8 text-sm text-stone-500">加载中…</div>;
  if (!me) return <AdminLogin onDone={() => api<{ user: { role: string; nickname: string | null } }>('/api/me').then((r) => setMe(r.user))} />;
  if (me.role !== 'admin') return <div className="p-8 text-sm">当前账号没有管理员权限。请用 ADMIN_PHONES 里配置的手机号登录。<button className="ml-2 underline" onClick={() => api('/api/auth/logout', { method: 'POST' }).then(() => setMe(null))}>换个账号</button></div>;
  return (
    <div className="viz-root min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
      <style>{TOKENS}</style>
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
        <b className="mr-3">三邻邦（OPC Town）· 管理后台</b>
        {TABS.map(([k, l]) => <button key={k} data-testid={`admin-tab-${k}`} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-sm ${tab === k ? 'bg-[var(--series-1)] text-white' : 'hover:bg-[var(--surface-2)]'}`}>{l}</button>)}
        <span className="ml-auto text-xs text-[var(--text-secondary)]">{me.nickname ?? '管理员'}</span>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        {tab === 'overview' && <Overview />}
        {tab === 'modules' && <Modules />}
        {tab === 'clicks' && <Clicks />}
        {tab === 'wechat' && <Wechat />}
        {tab === 'messages' && <Messages />}
        {tab === 'users' && <Table url="/api/admin/users" pick="users" cols={[['nickname', '昵称'], ['phoneMasked', '手机号（脱敏）'], ['wechatBound', '微信'], ['role', '角色'], ['shopName', '小店'], ['messages', '发出消息'], ['createdAt', '注册时间'], ['lastSeenAt', '最近活跃']]} />}
        {tab === 'shops' && <Table url="/api/admin/shops" pick="shops" cols={[['name', '店名'], ['lotId', '铺位'], ['category', '类别'], ['licensed', '营业执照'], ['licenseCompany', '企业名称'], ['owner', '店主昵称'], ['ownerPhone', '店主手机（脱敏）'], ['hasCompanyIntro', '公司简介'], ['hasProductIntro', '产品简介'], ['createdAt', '开店时间']]} />}
        {tab === 'docs' && <Table url="/api/admin/docs" pick="docs" cols={[['filename', '文件'], ['kind', '类型'], ['status', '解析状态'], ['method', '提炼方式'], ['error', '错误'], ['owner', '上传人'], ['createdAt', '上传时间']]} />}
        {tab === 'audit' && <Table url="/api/admin/audit" pick="audit" cols={[['admin', '管理员'], ['action', '操作'], ['target', '对象'], ['ts', '时间']]} />}
      </main>
    </div>
  );
}

/** 颜色令牌：参考调色板的前两个分类色（已通过色盲 / 对比校验），浅色与深色各一套 */
const TOKENS = `
.viz-root { color-scheme: light; --surface-0:#f6f5f2; --surface-1:#fcfcfb; --surface-2:#efeeea; --border:#e2e0da; --grid:#ebe9e4; --text-primary:#0b0b0b; --text-secondary:#52514e; --series-1:#2a78d6; --series-2:#eb6834; }
@media (prefers-color-scheme: dark) { :root:where(:not([data-theme="light"])) .viz-root { color-scheme: dark; --surface-0:#121211; --surface-1:#1a1a19; --surface-2:#262624; --border:#33332f; --grid:#2c2c29; --text-primary:#f0efec; --text-secondary:#c3c2b7; --series-1:#3987e5; --series-2:#d95926; } }
:root[data-theme="dark"] .viz-root { color-scheme: dark; --surface-0:#121211; --surface-1:#1a1a19; --surface-2:#262624; --border:#33332f; --grid:#2c2c29; --text-primary:#f0efec; --text-secondary:#c3c2b7; --series-1:#3987e5; --series-2:#d95926; }
`;

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div className="mx-auto mt-20 max-w-sm rounded-2xl bg-white p-6 shadow">
      <div className="text-lg font-black">三邻邦 · 管理后台登录</div>
      <input className="input mt-3" data-testid="admin-phone" placeholder="管理员手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <input className="input" data-testid="admin-code" placeholder="验证码" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="rounded-xl bg-stone-200 px-3 text-sm" data-testid="admin-send" onClick={() => api<{ devCode?: string }>('/api/auth/sms/send', { method: 'POST', body: JSON.stringify({ phone }) }).then((r) => { setMsg(r.devCode ? `开发模式验证码：${r.devCode}` : '验证码已发送'); if (r.devCode) setCode(r.devCode); }).catch((e) => setMsg(e.message))}>获取</button>
      </div>
      <button className="mt-3 w-full rounded-xl bg-[#2a78d6] py-2 text-white" data-testid="admin-login" onClick={() => api('/api/auth/sms/verify', { method: 'POST', body: JSON.stringify({ phone, code, agree: true }) }).then(onDone).catch((e) => setMsg(e.message))}>登录</button>
      {msg && <div className="mt-2 text-xs text-stone-600">{msg}</div>}
    </div>
  );
}

function useData<T>(url: string, deps: unknown[] = []) {
  const [d, setD] = useState<T | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { setD(null); api<T>(url).then(setD).catch((e) => setErr(e.message)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [url, ...deps]);
  return { d, err };
}

function Tile({ label, value, hint, testId }: { label: string; value: number | string; hint?: string; testId?: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-1)] p-3 ring-1 ring-[var(--border)]" data-testid={testId}>
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="mt-0.5 text-2xl font-black tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-[var(--text-secondary)]">{hint}</div>}
    </div>
  );
}

interface Series { day: string; pv: number; uv: number; dau: number; signups: number }
function Overview() {
  const [days, setDays] = useState(14);
  const { d, err } = useData<{ totals: Record<string, number>; series: Series[] }>(`/api/admin/overview?days=${days}`, [days]);
  if (err) return <div className="text-red-600">{err}</div>;
  if (!d) return <div>加载中…</div>;
  const t = d.totals;
  return (
    <div className="space-y-4" data-testid="admin-overview">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile testId="kpi-users" label="注册用户" value={t.users} hint={`今日新增 ${t.usersToday} · 手机 ${t.phoneUsers} · 微信 ${t.wechatUsers}`} />
        <Tile testId="kpi-dau" label="活跃用户 DAU" value={t.dau} hint={`WAU ${t.wau} · MAU ${t.mau}`} />
        <Tile testId="kpi-pv" label="今日 PV" value={t.pvToday} hint={`今日 UV ${t.uvToday}`} />
        <Tile testId="kpi-wechat" label="「留微信号」点击" value={t.wechatClicks} hint="功能未开放，只统计点击" />
        <Tile label="店铺" value={t.shops} />
        <Tile label="会话" value={t.conversations} />
        <Tile label="消息" value={t.messages} />
      </div>
      <div className="rounded-xl bg-[var(--surface-1)] p-3 ring-1 ring-[var(--border)]">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold">PV / UV 趋势
          {[7, 14, 30].map((n) => <button key={n} onClick={() => setDays(n)} className={`rounded-full px-2 text-xs ${days === n ? 'bg-[var(--surface-2)] font-bold' : ''}`}>{n} 天</button>)}
        </div>
        <LineChart series={d.series} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-[var(--surface-1)] p-3 ring-1 ring-[var(--border)]"><div className="mb-2 text-sm font-bold">每日活跃用户（DAU）</div><Bars rows={d.series.map((s) => ({ label: s.day.slice(5), value: s.dau }))} /></div>
        <div className="rounded-xl bg-[var(--surface-1)] p-3 ring-1 ring-[var(--border)]"><div className="mb-2 text-sm font-bold">每日新注册</div><Bars rows={d.series.map((s) => ({ label: s.day.slice(5), value: s.signups }))} /></div>
      </div>
      <details className="text-xs"><summary className="cursor-pointer text-[var(--text-secondary)]">表格视图</summary>
        <table className="mt-2 w-full text-left"><thead><tr><th>日期</th><th>PV</th><th>UV</th><th>DAU</th><th>新注册</th></tr></thead>
          <tbody>{d.series.map((s) => <tr key={s.day} className="border-t border-[var(--border)]"><td>{s.day}</td><td>{s.pv}</td><td>{s.uv}</td><td>{s.dau}</td><td>{s.signups}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}

/** 折线图：两条线（PV / UV），一根 y 轴，十字线 + 提示框，图例 + 末端直接标注 */
function LineChart({ series }: { series: Series[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 220, L = 40, R = 40, T = 12, B = 26;
  const max = Math.max(1, ...series.flatMap((s) => [s.pv, s.uv]));
  // 刻度取 1 / 2 / 5 × 10^n 的整数步长，4 格
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((k) => k * mag).find((x) => x >= raw) ?? mag * 10);
  const nice = step * 4;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, series.length - 1);
  const y = (v: number) => T + (1 - v / nice) * (H - T - B);
  const path = (k: 'pv' | 'uv') => series.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s[k])}`).join(' ');
  const last = series.length - 1;
  return (
    <div className="relative">
      <div className="mb-1 flex gap-4 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-[var(--series-1)]" />PV（浏览次数）</span>
        <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-[var(--series-2)]" />UV（独立设备）</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(last, Math.round(((px - L) / (W - L - R)) * last)))); }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={y(nice * f)} y2={y(nice * f)} stroke="var(--grid)" /><text x={L - 6} y={y(nice * f) + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{Math.round(nice * f)}</text></g>)}
        {series.map((s, i) => (i % Math.ceil(series.length / 7) === 0 || i === last) && <text key={s.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{s.day.slice(5)}</text>)}
        <path d={path('pv')} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
        <path d={path('uv')} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeLinejoin="round" />
        {last >= 0 && <>
          <text x={x(last) + 4} y={y(series[last].pv) + 4} fontSize="10" fill="var(--text-primary)">PV {series[last].pv}</text>
          <text x={x(last) + 4} y={y(series[last].uv) + 14} fontSize="10" fill="var(--text-primary)">UV {series[last].uv}</text>
        </>}
        {hover !== null && <g>
          <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--text-secondary)" strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(series[hover].pv)} r="4" fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
          <circle cx={x(hover)} cy={y(series[hover].uv)} r="4" fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth="2" />
        </g>}
      </svg>
      {hover !== null && <div className="pointer-events-none absolute right-2 top-6 rounded-lg bg-[var(--surface-1)] px-2 py-1 text-xs shadow ring-1 ring-[var(--border)]">{series[hover].day} · PV {series[hover].pv} · UV {series[hover].uv} · DAU {series[hover].dau}</div>}
    </div>
  );
}

/** 单系列柱状图：一个颜色，柱间 2px 间隔，悬停显示数值 */
function Bars({ rows, horizontal }: { rows: { label: string; value: number }[]; horizontal?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (horizontal) return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs" title={`${r.label}：${r.value}`}>
          <span className="w-40 shrink-0 truncate text-[var(--text-secondary)]">{r.label}</span>
          <div className="h-3 flex-1 rounded-sm bg-[var(--surface-2)]"><div className="h-3 rounded-r" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--series-1)' }} /></div>
          <span className="w-10 text-right tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="flex h-28 items-end gap-[2px]">
      {rows.map((r) => (
        <div key={r.label} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${r.label}：${r.value}`}>
          {r.value > 0 && <span className="text-[9px] tabular-nums text-[var(--text-secondary)] opacity-0 group-hover:opacity-100">{r.value}</span>}
          <div className="w-full rounded-t" style={{ height: `${(r.value / max) * 85}%`, minHeight: r.value ? 2 : 0, background: 'var(--series-1)' }} />
          <span className="mt-1 text-[9px] text-[var(--text-secondary)]">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function Modules() {
  const [days, setDays] = useState(7);
  const { d } = useData<{ modules: { module: string; pv: number; uv: number; clicks: number; clickUv: number }[] }>(`/api/admin/modules?days=${days}`, [days]);
  if (!d) return <div>加载中…</div>;
  return (
    <div className="space-y-3" data-testid="admin-modules">
      <div className="flex gap-2 text-xs">{[1, 7, 30].map((n) => <button key={n} onClick={() => setDays(n)} className={`rounded-full px-2 ${days === n ? 'bg-[var(--surface-2)] font-bold' : ''}`}>近 {n} 天</button>)}</div>
      <div className="rounded-xl bg-[var(--surface-1)] p-3 ring-1 ring-[var(--border)]"><div className="mb-2 text-sm font-bold">各模块 PV</div><Bars horizontal rows={d.modules.map((m) => ({ label: MODULE_LABEL[m.module] ?? m.module, value: m.pv }))} /></div>
      <table className="w-full rounded-xl bg-[var(--surface-1)] text-left text-sm ring-1 ring-[var(--border)]">
        <thead className="text-xs text-[var(--text-secondary)]"><tr><th className="p-2">模块</th><th>浏览 PV</th><th>浏览 UV</th><th>点击 PV</th><th>点击 UV</th></tr></thead>
        <tbody>{d.modules.map((m) => <tr key={m.module} className="border-t border-[var(--border)]"><td className="p-2">{MODULE_LABEL[m.module] ?? m.module}</td><td>{m.pv}</td><td>{m.uv}</td><td>{m.clicks}</td><td>{m.clickUv}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Clicks() {
  const [module, setModule] = useState('');
  const { d } = useData<{ clicks: { module: string; target: string; pv: number; uv: number }[] }>(`/api/admin/clicks?days=30${module ? `&module=${module}` : ''}`, [module]);
  return (
    <div className="space-y-3" data-testid="admin-clicks">
      <select className="input !w-auto" value={module} onChange={(e) => setModule(e.target.value)}>
        <option value="">全部模块</option>{Object.entries(MODULE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {!d ? <div>加载中…</div> : (
        <table className="w-full rounded-xl bg-[var(--surface-1)] text-left text-sm ring-1 ring-[var(--border)]">
          <thead className="text-xs text-[var(--text-secondary)]"><tr><th className="p-2">模块</th><th>按钮 / 链接</th><th>点击 PV</th><th>点击 UV</th></tr></thead>
          <tbody>{d.clicks.map((c, i) => <tr key={i} className="border-t border-[var(--border)]"><td className="p-2">{MODULE_LABEL[c.module] ?? c.module}</td><td className="font-mono text-xs">{c.target}</td><td>{c.pv}</td><td>{c.uv}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

function Wechat() {
  const { d } = useData<{ total: { n: number; u: number }; byDay: { day: string; n: number; u: number }[] }>('/api/admin/wechat-button');
  if (!d) return <div>加载中…</div>;
  return (
    <div className="space-y-3" data-testid="admin-wechat">
      <div className="grid grid-cols-2 gap-3 md:w-1/2"><Tile label="累计点击" value={d.total.n} /><Tile label="点击人数" value={d.total.u} /></div>
      <div className="rounded-xl bg-[var(--surface-1)] p-3 ring-1 ring-[var(--border)]"><div className="mb-2 text-sm font-bold">每日点击</div><Bars rows={[...d.byDay].reverse().map((r) => ({ label: r.day.slice(5), value: r.n }))} /></div>
      <div className="text-xs text-[var(--text-secondary)]">「留微信号」按钮在私信界面里；功能尚未开放，点击只记录意向。每个会话的点击数见「消息审查」。</div>
    </div>
  );
}

interface ConvRow { id: string; aName: string; bName: string; messages: number; flagged: number; wechatClicks: number; lastBody: string | null; lastMsgAt: number | null; origin: string | null }
function Messages() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { d } = useData<{ conversations: ConvRow[] }>(`/api/admin/conversations?q=${encodeURIComponent(query)}${flagged ? '&flagged=1' : ''}`, [query, flagged]);
  const conv = useData<{ messages: { id: string; sender: string; body: string; hasContact: number; createdAt: number }[] }>(open ? `/api/admin/conversations/${open}` : '/api/health', [open]);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]" data-testid="admin-messages">
      <div>
        <div className="flex gap-2">
          <input className="input" data-testid="admin-msg-q" placeholder="搜索昵称或消息内容" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setQuery(q)} />
          <button className="whitespace-nowrap rounded-xl bg-[var(--surface-2)] px-3 text-sm" onClick={() => setQuery(q)}>搜索</button>
        </div>
        <label className="mt-2 flex items-center gap-1 text-xs"><input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />只看含联系方式的会话</label>
        <div className="mt-2 space-y-1">
          {d?.conversations.map((c) => (
            <button key={c.id} data-testid="admin-conv" onClick={() => setOpen(c.id)} className={`w-full rounded-xl p-2 text-left text-sm ring-1 ring-[var(--border)] ${open === c.id ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface-1)]'}`}>
              <div className="flex justify-between"><b>{c.aName ?? '用户'} ↔ {c.bName ?? '用户'}</b><span className="text-xs text-[var(--text-secondary)]">{fmt(c.lastMsgAt)}</span></div>
              <div className="truncate text-xs text-[var(--text-secondary)]">{c.lastBody ?? '（还没有消息）'}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">{c.messages} 条{c.flagged ? ` · ⚠ ${c.flagged} 条含联系方式` : ''}{c.wechatClicks ? ` · 留微信点击 ${c.wechatClicks}` : ''}{c.origin ? ` · 来自 ${c.origin}` : ''}</div>
            </button>
          ))}
          {d && !d.conversations.length && <div className="text-xs text-[var(--text-secondary)]">没有符合条件的会话</div>}
        </div>
      </div>
      <div className="rounded-xl bg-[var(--surface-1)] p-3 ring-1 ring-[var(--border)]">
        {!open ? <div className="text-sm text-[var(--text-secondary)]">选择左侧会话查看完整聊天记录（每次查看都会记入审计日志）。</div> : (
          <div className="space-y-2" data-testid="admin-conv-detail">
            {(conv.d?.messages ?? []).map((m) => (
              <div key={m.id} className="text-sm"><span className="text-xs text-[var(--text-secondary)]">{fmt(m.createdAt)} · {m.sender}</span>
                <div className={`rounded-lg px-2 py-1 ${m.hasContact ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-[var(--surface-2)]'}`}>{m.body}{m.hasContact ? ' ⚠' : ''}</div></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Table({ url, pick, cols }: { url: string; pick: string; cols: [string, string][] }) {
  const { d, err } = useData<Record<string, Record<string, unknown>[]>>(url);
  if (err) return <div className="text-red-600">{err}</div>;
  if (!d) return <div>加载中…</div>;
  const rows = d[pick] ?? [];
  const show = (k: string, v: unknown) => (typeof v === 'number' && /At$|^ts$/.test(k) ? fmt(v) : typeof v === 'number' && /licensed|wechatBound|has/.test(k) ? (v ? '✔' : '—') : v == null ? '—' : String(v));
  return (
    <div className="overflow-x-auto" data-testid={`admin-table-${pick}`}>
      <table className="w-full rounded-xl bg-[var(--surface-1)] text-left text-sm ring-1 ring-[var(--border)]">
        <thead className="text-xs text-[var(--text-secondary)]"><tr>{cols.map(([, l]) => <th key={l} className="p-2">{l}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-[var(--border)]">{cols.map(([k]) => <td key={k} className="p-2">{show(k, r[k])}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <div className="p-3 text-sm text-[var(--text-secondary)]">暂无数据</div>}
    </div>
  );
}
