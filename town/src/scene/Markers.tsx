/**
 * 商业地图的地理视图：在 3D 街区里标出“我的潜在客户 / 供应商 / 合作方”在哪里。
 * - 有铺位的主体：标在店门口；
 * - 个人：不显示精确位置（不在地图上标点）；
 * - 未入驻主体：标注“未入驻”，与平台会员区分。
 */
import { Html } from '@react-three/drei';
import { BIZ_LABEL, ENTITY_KIND_LABEL, type BizRelation, type DistrictKey } from '../domain/commerce';
import { entityById } from '../data/seed';
import { allLots } from '../world';
import { useBusinessMap, useTown } from '../store/useTown';

const TONE: Record<string, string> = {
  customer: 'bg-almond-400 text-cocoa-800 ring-almond-500',
  supplier: 'bg-haze-300 text-cocoa-800 ring-haze-400',
  partner: 'bg-sage-300 text-sage-700 ring-sage-400',
  channel: 'bg-sakura-300 text-cocoa-800 ring-sakura-400',
  resource: 'bg-cream-200 text-cocoa-600 ring-cream-300',
};

export function Markers({ district }: { district: DistrictKey }) {
  const map = useBusinessMap();
  const show = useTown((s) => s.showMarkers);
  const type = useTown((s) => s.bizType);
  const focus = useTown((s) => s.bizFocus);
  const setBiz = useTown((s) => s.setBiz);
  const setTab = useTown((s) => s.setTab);
  if (!map || !show) return null;
  const rels: BizRelation[] = map.byType[type];
  return (
    <group>
      {rels.map((r) => {
        const e = entityById(r.counterpartyId);
        if (!e?.place.lotId || e.kind === 'individual') return null;
        const lot = allLots().find((l) => l.door.lotId === e.place.lotId);
        if (!lot || lot.district !== district) return null;
        const active = focus === r.id;
        return (
          <group key={r.id} position={[lot.door.p.x + lot.door.out.x * 1.2, 4.6, lot.door.p.z + lot.door.out.z * 1.2]}>
            <Html center zIndexRange={active ? [40, 30] : [25, 20]}>
              <button
                data-testid={`marker-${r.counterpartyId}`}
                onClick={() => { setBiz(type, r.id); setTab('biz'); }}
                className={`flex flex-col items-center ${active ? 'scale-110' : ''} transition`}
              >
                <span className={`whitespace-nowrap rounded-2xl px-2.5 py-1 text-[11px] font-bold shadow-soft ring-2 ${TONE[r.type]}`}>
                  {BIZ_LABEL[r.type]} · {e.name.replace('（虚构）', '').replace('（示意）', '')} {r.score !== null && <span className="opacity-80">{r.score}%</span>}
                </span>
                <span className="mt-0.5 rounded-full bg-cream-50/90 px-1.5 text-[9px] text-stone-600">
                  {r.evidence === 'published' ? '对方已发布需求' : '需求为系统推测'}{e.kind === 'prospect' ? ` · ${ENTITY_KIND_LABEL.prospect.split(' · ')[0]}` : ''}
                </span>
                <span className="h-3 w-0.5 bg-cocoa-400" />
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
