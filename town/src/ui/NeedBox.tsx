/**
 * 右下角「今天来找什么？」需求框：像搜索框一样，满足“买、逛、跟”的需求——
 * 输入或点快捷词（找剪辑、找拍摄、找投资人……），列出街上能帮你的人和店，一键“带我去”。
 */
import { useMemo, useState } from 'react';
import { QUICK_NEEDS, searchTown, type SearchHit } from '../domain/search';
import { lotOfExample } from '../domain/lots';
import { lotById, navOf } from '../world';
import { residentAnchor, useTown } from '../store/useTown';
import { useServer } from '../store/useServer';
import { useCenter } from '../store/useCenter';
import { residentOfEntity } from '../data/seed';
import { track } from '../net/api';
import { useLive } from '../store/useLive';
import { emitGame } from '../store/gameEvents';
import { ROLE_COLORS } from '../domain/palette';
import type { DistrictKey } from '../domain/commerce';

const BADGE_BG: Record<string, string> = { 例: ROLE_COLORS.example, 企: ROLE_COLORS.company, 投: ROLE_COLORS.investor, 投资人: ROLE_COLORS.investor, 品: ROLE_COLORS.brand, 认证: ROLE_COLORS.company };

/** 走到某个位置：同一街区就规划步行路线；不同街区先把你送到目标附近 */
export function goNear(district: DistrictKey, p: { x: number; z: number }) {
  const t = useTown.getState();
  if (t.district !== district) { t.goDistrict(district, p); return true; }
  const q = navOf(district).nearestWalkable(p, 5);
  return q ? t.walkTo(q) : false;
}

export function NeedBox() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const remote = useServer((s) => s.shops);
  const hits = useMemo(() => searchTown(q, {
    lotOfExample,
    districtOfLot: (l) => lotById(l)?.district,
    remote: remote.map((r) => ({ id: r.id, lotId: r.lotId, name: r.name, tagline: r.tagline, category: r.category, licensed: r.licensed, ownerUserId: r.ownerUserId })),
  }), [q, remote]);

  const ask = (text: string) => { setQ(text); setOpen(true); emitGame('search'); track('action', 'need_box', 'search', { q: text.slice(0, 40) }); };

  /** 一键「打个飞的」：直接落在店门口，打开店铺 AI 分身（示范店打开示范介绍） */
  const act = (h: SearchHit) => {
    track('action', 'need_box', `go_${h.kind}`, { q: q.slice(0, 40), id: h.id, rank: String(hits.indexOf(h) + 1) });
    const t = useTown.getState();
    setOpen(false);
    if (h.kind === 'provider' || h.kind === 'contact') {
      useCenter.getState().setSection(h.kind === 'provider' ? 'services' : 'funding');
      t.setTab('center');
      if (h.kind === 'contact') emitGame('view_investor'); else emitGame('center_service');
      return;
    }
    if (h.kind === 'remote' && h.lotId) {
      useLive.getState().fly({ title: h.title, lotId: h.lotId });
      return;
    }
    if (h.lotId) { useLive.getState().fly({ title: h.title, lotId: h.lotId }); return; }
    // 没有铺位的个人：飞到 TA 常出没的地方，并打开名片
    const r = residentOfEntity(h.id.replace(/^ent_/, ''));
    if (r) { const a = residentAnchor(r); useLive.getState().fly({ title: h.title, at: { district: a.district, x: a.p.x, z: a.p.z }, then: () => t.openCard({ kind: 'resident', id: r.id }) }); }
  };

  return (
    <div className="pointer-events-auto w-[min(20rem,calc(100vw-2rem))]" data-testid="need-box">
      {open && (
        <div className="wobble-in mb-2 max-h-[46vh] overflow-y-auto rounded-3xl bg-cream-50/95 p-3 shadow-soft ring-1 ring-cream-200" data-testid="need-panel">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-cocoa-800">今天来找什么？</div>
            <button aria-label="收起" className="text-xs text-stone-500" onClick={() => setOpen(false)}>收起</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_NEEDS.map((n) => (
              <button key={n} data-testid={`need-chip-${n.replace(/\s/g, '')}`} onClick={() => ask(n)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${q === n ? 'bg-almond-400 text-cocoa-800' : 'bg-cream-100 text-stone-600'}`}>{n}</button>
            ))}
          </div>
          {q && (
            <div className="mt-2 space-y-1.5" data-testid="need-results">
              {hits.length === 0 && <div className="text-xs text-stone-500">街上暂时没找到“{q}”。可以去「机会」发一条需求，让对口的人来找你。</div>}
              {hits.map((h) => (
                <button key={h.id} data-testid="need-hit" onClick={() => act(h)} className="flex w-full items-start gap-2 rounded-2xl bg-cream-100 px-3 py-2 text-left hover:bg-almond-300/60">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-xs font-black text-cocoa-800">
                      {h.badge && <span className="rounded px-1 text-[9px] font-black text-white" style={{ background: BADGE_BG[h.badge] ?? ROLE_COLORS.personal }}>{h.badge}</span>}
                      <span className="truncate">{h.title}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] text-stone-600">{h.sub}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-stone-500" data-testid="hit-rep">
                      <b className="text-cocoa-700">评价分 {h.rep.score}</b>
                      <span>{h.rep.reviews ? `⭐${h.rep.rating.toFixed(1)}（${h.rep.reviews}）` : '新店'}</span>
                      <span>信用 {h.rep.credit}</span>
                      <span>活跃 {h.rep.activity}</span>
                      {h.kind !== 'example' && h.ownerId !== undefined && <span>{h.rep.online ? '🟢在线' : '⚪离线'}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-almond-400 px-2 py-0.5 text-[10px] font-bold text-cocoa-800">{h.kind === 'provider' || h.kind === 'contact' ? '去看看' : '✈️ 打个飞的'}</span>
                </button>
              ))}
              {hits.length > 0 && <div className="text-[10px] text-stone-400">按评价分排序（评分 + 信用等级 + 活跃度）。{hits.some((h) => h.kind === 'example') && '「例」是系统示范店（虚构示例），可以参观学习，不能交易，排在最后。'}</div>}
            </div>
          )}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q.trim()); }} className="flex items-center gap-2 rounded-full bg-cream-50/95 px-3 py-2 shadow-soft ring-2 ring-almond-400">
        <span>🔍</span>
        <input data-testid="need-input" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          placeholder="今天来找什么？剪辑、拍摄、投资人…" className="min-w-0 flex-1 bg-transparent text-sm text-cocoa-800 outline-none placeholder:text-stone-400" maxLength={30} />
        {q && <button type="button" aria-label="清空" className="text-xs text-stone-400" onClick={() => setQ('')}>✕</button>}
      </form>
    </div>
  );
}
