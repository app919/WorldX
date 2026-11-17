/**
 * 小地图：标出当前街区所有道路的路名、斑马线、自己的位置与朝向（上方为北）。
 * 点击小地图上的位置，角色会沿人行道寻路走过去。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { lotsOf, compiledOf } from '../world';
import { lotPlan } from '../domain/lots';
import { playerRuntime, useTown } from '../store/useTown';
import { placeOfLot, useWork } from '../store/useWork';
import { jobTargetLot } from '../scene/JobTarget';
import { ROLE_COLORS, ROLE_LABEL } from '../domain/palette';
import { getPref, setPref } from './uiPrefs';
import { overviewAll, overviewOf, type RealShop } from '../domain/overview';
import { REAL_BLUE, REAL_NOTE } from '../domain/palette';
import { useServer } from '../store/useServer';
import { useLots } from '../store/useLots';
import { useLive } from '../store/useLive';
import { DISTRICTS } from '../world';
import { create } from 'zustand';

/** 小地图上被“标出”的铺位（来自纵览里的本周新增） */
export const useMapHighlight = create<{ lots: string[]; set(l: string[]): void }>()((set) => ({ lots: [], set: (lots) => set({ lots }) }));

/** 真实用户开的店：后端的店铺 + 我自己的店（离线演示里只有我自己的） */
function useRealShops(): RealShop[] {
  const remote = useServer((s) => s.shops);
  const me = useServer((s) => s.me);
  const myOpc = useTown((s) => s.myOpc);
  return useMemo(() => {
    const out: RealShop[] = remote.map((r) => ({ id: r.id, lotId: r.lotId, name: r.name, createdAt: r.createdAt, mine: r.ownerUserId === me?.id }));
    if (myOpc && !myOpc.isDemo && !out.some((o) => o.lotId === myOpc.lotId)) out.push({ id: myOpc.id, lotId: myOpc.lotId, name: myOpc.name, createdAt: myOpc.createdAt || Date.now(), mine: true });
    return out;
  }, [remote, me, myOpc]);
}

function useSponsorLots() {
  const sponsors = useLots((s) => s.sponsors);
  return useMemo(() => new Set(sponsors.filter((x) => x.status === 'live').map((x) => x.lotId)), [sponsors]);
}

/** 纵览按钮：本街区 OPC 数量 + 本周新增（红点），点开看全城纵览 */
export function OverviewChip({ district }: { district: Parameters<typeof overviewOf>[0] }) {
  const real = useRealShops();
  const sp = useSponsorLots();
  const [open, setOpen] = useState(false);
  const ov = useMemo(() => overviewOf(district, real, sp), [district, real, sp]);
  const total = ov.real + ov.demo + ov.examples;
  return (
    <>
      <button data-testid="overview-open" onClick={() => setOpen(true)} className="glass flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-cocoa-700" title="地图纵览：这里有多少 OPC、本周新增">
        🏪 {total}
        {ov.newThisWeek.length > 0 && <span className="rounded-full px-1.5 text-[10px] font-black text-white" style={{ background: REAL_BLUE }} data-testid="overview-new-badge">新 +{ov.newThisWeek.length}</span>}
      </button>
      {open && <OverviewPanel district={district} real={real} sp={sp} onClose={() => setOpen(false)} />}
    </>
  );
}

function OverviewPanel({ district, real, sp, onClose }: { district: Parameters<typeof overviewOf>[0]; real: RealShop[]; sp: Set<string>; onClose(): void }) {
  const all = useMemo(() => overviewAll(real, sp), [real, sp]);
  const cur = all.find((x) => x.district === district)!;
  const newAll = all.flatMap((x) => x.newThisWeek.map((n) => ({ ...n, district: x.district })));
  const hl = useMapHighlight((s) => s.lots);
  const sum = (k: 'real' | 'demo' | 'examples' | 'sponsors' | 'vacant') => all.reduce((a, x) => a + x[k], 0);
  const Row = ({ label, v, color }: { label: string; v: number; color?: string }) => (
    <div className="flex items-center justify-between rounded-lg bg-cream-50 px-2 py-1"><span className="text-stone-600">{label}</span><b style={color ? { color } : undefined}>{v}</b></div>
  );
  return (
    <div className="pointer-events-auto fixed inset-0 z-[58] grid place-items-center bg-cocoa-800/20 p-3" onClick={onClose}>
      <div className="wobble-in max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl bg-cream-50 p-4 text-xs shadow-soft" data-testid="overview-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div className="text-base font-black text-cocoa-800">🗺️ 地图纵览</div><button aria-label="关闭" onClick={onClose}>✕</button></div>
        <div className="mt-0.5 text-[11px]" style={{ color: REAL_BLUE }}>{REAL_NOTE}</div>
        <div className="mt-2 font-black text-cocoa-800">{DISTRICTS[district].name}（{cur.lots} 个铺位）</div>
        <div className="mt-1 grid grid-cols-2 gap-1" data-testid="overview-district">
          <Row label="真实用户 OPC" v={cur.real} color={REAL_BLUE} /><Row label="演示店铺" v={cur.demo} />
          <Row label="【例】示范店" v={cur.examples} /><Row label="黄金位赞助" v={cur.sponsors} />
          <Row label="空铺可租" v={cur.vacant} />
        </div>
        <div className="mt-3 font-black text-cocoa-800">全部 5 座城市</div>
        <div className="mt-1 grid grid-cols-2 gap-1"><Row label="真实用户 OPC" v={sum('real')} color={REAL_BLUE} /><Row label="演示店铺" v={sum('demo')} /><Row label="【例】示范店" v={sum('examples')} /><Row label="空铺可租" v={sum('vacant')} /></div>
        <div className="mt-3 flex items-center gap-2 font-black text-cocoa-800">📈 本周新增 <span className="rounded-full px-1.5 text-[10px] text-white" style={{ background: REAL_BLUE }}>+{newAll.length}</span>
          {newAll.length > 0 && <button className="chip ml-auto bg-cream-100" data-testid="overview-highlight" onClick={() => { useMapHighlight.getState().set(hl.length ? [] : newAll.map((n) => n.lotId)); onClose(); }}>{hl.length ? '取消标出' : '📍 在小地图上标出'}</button>}
        </div>
        <div className="mt-1 space-y-1" data-testid="overview-new-list">
          {newAll.length === 0 && <div className="rounded-lg bg-cream-100 p-2 text-stone-500">本周还没有新开的真实店铺。开放内测后，新开的店会在这里按时间排列（蓝字）。</div>}
          {newAll.map((n) => (
            <div key={n.id} className="flex items-center gap-2 rounded-lg bg-cream-100 px-2 py-1.5">
              <b className="truncate" style={{ color: REAL_BLUE }}>{n.name}</b>
              <span className="text-[10px] text-stone-500">{DISTRICTS[n.district].name} · {new Date(n.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}{n.mine ? ' · 我的店' : ''}</span>
              <button className="chip ml-auto bg-almond-300" onClick={() => { onClose(); useTown.getState().setTab('city'); useLive.getState().fly({ title: n.name, lotId: n.lotId }); }}>✈️ 去看看</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const W = 200, H = 168;

export function MiniMap() {
  const district = useTown((s) => s.district);
  const tab = useTown((s) => s.tab);
  const walkTo = useTown((s) => s.walkTo);
  const [open, setOpenRaw] = useState(() => getPref('minimap', false));
  const setOpen = (v: boolean) => { setOpenRaw(v); setPref('minimap', v); };
  const [zoom, setZoom] = useState(1);
  const me = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const cd = useMemo(() => compiledOf(district), [district]);
  const active = useWork((s) => s.active);
  const lots = useMemo(() => lotsOf(district), [district]);
  const goldenSet = useMemo(() => new Set(lotPlan(district).golden), [district]);
  const exampleSet = useMemo(() => new Set(lotPlan(district).examples), [district]);
  const tl = jobTargetLot(active);
  const realShops = useRealShops();
  const realLots = useMemo(() => new Set(realShops.map((r) => r.lotId)), [realShops]);
  const hlLots = useMapHighlight((s) => s.lots);
  const target = tl ? placeOfLot(tl) : undefined;
  const b = cd.def.bounds;
  const scale = Math.min(W / (b.maxX - b.minX), H / (b.maxZ - b.minZ));
  const ox = (W - (b.maxX - b.minX) * scale) / 2, oz = (H - (b.maxZ - b.minZ) * scale) / 2;
  const sx = (x: number) => ox + (x - b.minX) * scale, sz = (z: number) => oz + (z - b.minZ) * scale;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (me.current) me.current.setAttribute('transform', `translate(${sx(playerRuntime.x)},${sz(playerRuntime.z)}) rotate(${(-playerRuntime.heading * 180) / Math.PI + 180}) scale(${1 / zoom})`);
      // 放大时以自己为中心
      if (svg.current) {
        const w = W / zoom, h = H / zoom;
        const cx = zoom === 1 ? W / 2 : Math.max(w / 2, Math.min(W - w / 2, sx(playerRuntime.x)));
        const cy = zoom === 1 ? H / 2 : Math.max(h / 2, Math.min(H - h / 2, sz(playerRuntime.z)));
        svg.current.setAttribute('viewBox', `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  });

  if (tab !== 'city') return null;
  if (!open) {
    return (
      <div className="pointer-events-auto absolute right-3 top-[7.4rem] z-20 flex gap-1 md:bottom-24 md:left-3 md:right-auto md:top-auto">
        <button data-testid="minimap-open" onClick={() => setOpen(true)} className="glass rounded-full px-3 py-1 text-xs font-bold text-cocoa-600">🗺️ 小地图</button>
        <OverviewChip district={district} />
        <button data-testid="find-me" title="找到我（F）" onClick={() => { playerRuntime.locateAt = performance.now(); }} className="glass rounded-full px-2 py-1 text-xs font-bold text-cocoa-600">📍</button>
      </div>
    );
  }
  return (
    <div className="pointer-events-auto glass absolute right-3 top-[7.4rem] z-20 overflow-hidden rounded-2xl p-1.5 md:bottom-24 md:left-3 md:right-auto md:top-auto" data-testid="minimap">
      <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-bold text-stone-600">
        <span>{cd.def.name} · 上北下南 · <span className="text-[#5E8C6A]">●OPC</span> <span className="text-[#D4A017]">●黄金位</span> <span style={{ color: ROLE_COLORS.example }}>●例</span> <span style={{ color: REAL_BLUE }}>●真实</span></span>
        <span className="flex items-center gap-2">
          <span className="flex overflow-hidden rounded-full bg-cream-100">
            <button data-testid="minimap-zoom-in" aria-label="放大小地图" disabled={zoom >= 4} onClick={() => setZoom((z) => Math.min(4, z * 2))} className="px-1.5 font-black disabled:opacity-30">＋</button>
            <button data-testid="minimap-zoom-out" aria-label="缩小小地图" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z / 2))} className="px-1.5 font-black disabled:opacity-30">－</button>
          </span>
          <OverviewChip district={district} />
          <button data-testid="find-me" onClick={() => { playerRuntime.locateAt = performance.now(); }} className="rounded-full bg-[#FF8A3D] px-2 py-0.5 text-[10px] font-black text-white">📍 找到我 (F)</button>
          <button onClick={() => setOpen(false)} aria-label="收起小地图">✕</button>
        </span>
      </div>
      <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} data-zoom={zoom} className="block cursor-crosshair rounded-xl bg-[#DCE8C8]"
        onWheel={(e) => setZoom((z) => (e.deltaY < 0 ? Math.min(4, z * 2) : Math.max(1, z / 2)))}
        onClick={(e) => {
          const el = e.currentTarget as SVGSVGElement;
          const m = el.getScreenCTM();
          const pt = el.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
          const q = m ? pt.matrixTransform(m.inverse()) : pt;
          walkTo({ x: b.minX + (q.x - ox) / scale, z: b.minZ + (q.y - oz) / scale });
        }}>
        {/* 公园 / 绿地 */}
        {cd.def.areas.filter((a) => (a.kind === 'park' || a.kind === 'lawn') && a.box).map((a) => (
          <rect key={a.id} x={sx(a.box!.cx - a.box!.w / 2)} y={sz(a.box!.cz - a.box!.d / 2)} width={a.box!.w * scale} height={a.box!.d * scale} rx={2}
            fill={a.kind === 'park' ? '#9CC47E' : '#B5D49A'} stroke="#6E9A52" strokeWidth={0.6} />
        ))}
        {cd.def.buildings.map((bd) => bd.box ? (
          <rect key={bd.id} x={sx(bd.box.cx) - (bd.box.w * scale) / 2} y={sz(bd.box.cz) - (bd.box.d * scale) / 2} width={bd.box.w * scale} height={bd.box.d * scale}
            transform={`rotate(${(-bd.box.rot * 180) / Math.PI} ${sx(bd.box.cx)} ${sz(bd.box.cz)})`} fill="#E9D9C2" />
        ) : <polygon key={bd.id} points={bd.polygon!.map((p) => `${sx(p.x)},${sz(p.z)}`).join(' ')} fill="#C98068" />)}
        {cd.def.roads.map((r) => (
          <line key={r.id} x1={sx(r.a.x)} y1={sz(r.a.z)} x2={sx(r.b.x)} y2={sz(r.b.z)} stroke="#FBF6EC" strokeWidth={Math.max(3, (r.carriage + r.sidewalk * 2) * scale)} strokeLinecap="butt" />
        ))}
        {cd.def.roads.filter((r) => !r.pedestrian).map((r) => (
          <line key={`c${r.id}`} x1={sx(r.a.x)} y1={sz(r.a.z)} x2={sx(r.b.x)} y2={sz(r.b.z)} stroke="#9C9893" strokeWidth={Math.max(1.6, r.carriage * scale)} />
        ))}
        {cd.def.roads.filter((r) => r.pedestrian).map((r) => (
          <line key={`p${r.id}`} x1={sx(r.a.x)} y1={sz(r.a.z)} x2={sx(r.b.x)} y2={sz(r.b.z)} stroke="#E8B9A0" strokeWidth={Math.max(2, r.sidewalk * scale)} strokeDasharray="3 2" />
        ))}
        {cd.def.roads.map((r) => {
          const mx = sx((r.a.x + r.b.x) / 2), mz = sz((r.a.z + r.b.z) / 2);
          let ang = (Math.atan2(sz(r.b.z) - sz(r.a.z), sx(r.b.x) - sx(r.a.x)) * 180) / Math.PI;
          if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
          return (
            <text key={`t${r.id}`} x={mx} y={mz} transform={`rotate(${ang} ${mx} ${mz})`} textAnchor="middle" dominantBaseline="central"
              fontSize={9 / Math.sqrt(zoom)} fontWeight="800" fill="#1F4E8C" stroke="#FFFFFF" strokeWidth={2.6 / Math.sqrt(zoom)} paintOrder="stroke">
              {r.name.replace('（示意）', '')}
            </text>
          );
        })}
        {/* 铺位：金色 = 黄金赞助位（40%），绿色 = OPC 招租位（60%） */}
        {lots.map((l) => (
          <circle key={l.door.lotId} cx={sx(l.door.p.x)} cy={sz(l.door.p.z)} r={(exampleSet.has(l.door.lotId!) ? 2 : 1.5) / Math.sqrt(zoom)} fill={exampleSet.has(l.door.lotId!) ? ROLE_COLORS.example : goldenSet.has(l.door.lotId!) ? '#D4A017' : '#5E8C6A'} opacity={0.9} />
        ))}
        {lots.filter((l) => realLots.has(l.door.lotId!)).map((l) => (
          <circle key={`r${l.door.lotId}`} cx={sx(l.door.p.x)} cy={sz(l.door.p.z)} r={2.8 / Math.sqrt(zoom)} fill={REAL_BLUE} stroke="#fff" strokeWidth={0.8 / Math.sqrt(zoom)} data-real="1" />
        ))}
        {lots.filter((l) => hlLots.includes(l.door.lotId!)).map((l) => (
          <circle key={`h${l.door.lotId}`} cx={sx(l.door.p.x)} cy={sz(l.door.p.z)} r={6 / Math.sqrt(zoom)} fill="none" stroke={REAL_BLUE} strokeWidth={1.6 / Math.sqrt(zoom)} className="animate-ping" style={{ transformOrigin: `${sx(l.door.p.x)}px ${sz(l.door.p.z)}px` }} data-testid="map-highlight" />
        ))}
        {cd.tunnels.map((t, i) => (
          <circle key={`tn${i}`} cx={sx(t.box.cx)} cy={sz(t.box.cz)} r={2.2} fill="#3E4048" />
        ))}
        {cd.def.areas.filter((a) => a.kind === 'park' && a.box && a.label).map((a) => (
          <text key={`pl${a.id}`} x={sx(a.box!.cx)} y={sz(a.box!.cz)} textAnchor="middle" dominantBaseline="central" fontSize={8 / Math.sqrt(zoom)} fontWeight="800"
            fill="#2F5A22" stroke="#FFFFFF" strokeWidth={2.2 / Math.sqrt(zoom)} paintOrder="stroke">🌳{a.label!.replace(/（.*?）/g, '')}</text>
        ))}
        {target && target.district === district && (
          <g transform={`translate(${sx(target.trigger.x)},${sz(target.trigger.z)})`}>
            <circle r="5" fill="#FF8A3D" stroke="#FFFFFF" strokeWidth="1.5" /><text y="3" textAnchor="middle" fontSize="7">🎯</text>
          </g>
        )}
        <g ref={me}>
          <circle r="5.5" fill="#E8C77A" stroke="#4A3426" strokeWidth="1.5" />
          <path d="M0,-9 L4,-3 L-4,-3 Z" fill="#4A3426" />
        </g>
        {zoom === 1 && <text x={W - 10} y={12} fontSize="10" fontWeight="900" fill="#4A3426" textAnchor="middle">北</text>}
        {zoom === 1 && <path d={`M${W - 10},15 l3,6 l-3,-2 l-3,2 z`} fill="#4A3426" />}
      </svg>
      <div className="flex flex-wrap items-center gap-x-2 px-1 pt-1 text-[9px] font-bold text-stone-500" data-testid="roof-legend">
        身份色：{(['example', 'company', 'investor', 'brand', 'personal'] as const).map((k) => (
          <span key={k} className="flex items-center gap-0.5"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: ROLE_COLORS[k] }} />{ROLE_LABEL[k]}</span>
        ))}
      </div>
    </div>
  );
}
