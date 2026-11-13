/**
 * 小地图：标出当前街区所有道路的路名、斑马线、自己的位置与朝向（上方为北）。
 * 点击小地图上的位置，角色会沿人行道寻路走过去。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { compiledOf } from '../world';
import { playerRuntime, useTown } from '../store/useTown';
import { placeOfLot, useWork } from '../store/useWork';
import { jobTargetLot } from '../scene/JobTarget';

const W = 200, H = 168;

export function MiniMap() {
  const district = useTown((s) => s.district);
  const tab = useTown((s) => s.tab);
  const walkTo = useTown((s) => s.walkTo);
  const [open, setOpen] = useState(true);
  const me = useRef<SVGGElement>(null);
  const cd = useMemo(() => compiledOf(district), [district]);
  const active = useWork((s) => s.active);
  const tl = jobTargetLot(active);
  const target = tl ? placeOfLot(tl) : undefined;
  const b = cd.def.bounds;
  const scale = Math.min(W / (b.maxX - b.minX), H / (b.maxZ - b.minZ));
  const ox = (W - (b.maxX - b.minX) * scale) / 2, oz = (H - (b.maxZ - b.minZ) * scale) / 2;
  const sx = (x: number) => ox + (x - b.minX) * scale, sz = (z: number) => oz + (z - b.minZ) * scale;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (me.current) me.current.setAttribute('transform', `translate(${sx(playerRuntime.x)},${sz(playerRuntime.z)}) rotate(${(-playerRuntime.heading * 180) / Math.PI + 180})`);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  });

  if (tab !== 'city') return null;
  if (!open) {
    return <button data-testid="minimap-open" onClick={() => setOpen(true)} className="pointer-events-auto glass absolute right-3 top-[7.4rem] z-20 rounded-full px-3 py-1 text-xs font-bold text-cocoa-600 md:bottom-24 md:left-3 md:right-auto md:top-auto">🗺️ 小地图</button>;
  }
  return (
    <div className="pointer-events-auto glass absolute right-3 top-[7.4rem] z-20 overflow-hidden rounded-2xl p-1.5 md:bottom-24 md:left-3 md:right-auto md:top-auto" data-testid="minimap">
      <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-bold text-stone-600">
        <span>{cd.def.name} · 上北下南</span>
        <span className="flex items-center gap-2">
          <button data-testid="find-me" onClick={() => { playerRuntime.locateAt = performance.now(); }} className="rounded-full bg-[#FF8A3D] px-2 py-0.5 text-[10px] font-black text-white">📍 找到我 (F)</button>
          <button onClick={() => setOpen(false)} aria-label="收起小地图">✕</button>
        </span>
      </div>
      <svg width={W} height={H} className="block cursor-crosshair rounded-xl bg-[#DCE8C8]"
        onClick={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          walkTo({ x: b.minX + (e.clientX - r.left - ox) / scale, z: b.minZ + (e.clientY - r.top - oz) / scale });
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
        {cd.def.roads.map((r) => (
          <line key={`c${r.id}`} x1={sx(r.a.x)} y1={sz(r.a.z)} x2={sx(r.b.x)} y2={sz(r.b.z)} stroke="#9C9893" strokeWidth={Math.max(1.6, r.carriage * scale)} />
        ))}
        {cd.def.roads.map((r) => {
          const mx = sx((r.a.x + r.b.x) / 2), mz = sz((r.a.z + r.b.z) / 2);
          let ang = (Math.atan2(sz(r.b.z) - sz(r.a.z), sx(r.b.x) - sx(r.a.x)) * 180) / Math.PI;
          if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
          return (
            <text key={`t${r.id}`} x={mx} y={mz} transform={`rotate(${ang} ${mx} ${mz})`} textAnchor="middle" dominantBaseline="central"
              fontSize="9" fontWeight="800" fill="#1F4E8C" stroke="#FFFFFF" strokeWidth="2.6" paintOrder="stroke">
              {r.name.replace('（示意）', '')}
            </text>
          );
        })}
        {cd.tunnels.map((t, i) => (
          <circle key={`tn${i}`} cx={sx(t.box.cx)} cy={sz(t.box.cz)} r={2.2} fill="#3E4048" />
        ))}
        {cd.def.areas.filter((a) => a.kind === 'park' && a.box && a.label).map((a) => (
          <text key={`pl${a.id}`} x={sx(a.box!.cx)} y={sz(a.box!.cz)} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="800"
            fill="#2F5A22" stroke="#FFFFFF" strokeWidth="2.2" paintOrder="stroke">🌳{a.label!.replace(/（.*?）/g, '')}</text>
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
        <text x={W - 10} y={12} fontSize="10" fontWeight="900" fill="#4A3426" textAnchor="middle">北</text>
        <path d={`M${W - 10},15 l3,6 l-3,-2 l-3,2 z`} fill="#4A3426" />
      </svg>
    </div>
  );
}
