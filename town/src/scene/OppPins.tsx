/**
 * 需求单在街区里：发布方店门口立一个状态标记（招标中 / 推广 / 用工），点击打开需求大厅；
 * 成交后，我和合作方的店之间出现一条金色连接线（见 Effects 的 DealLines）。
 */
import { Html } from '@react-three/drei';
import { entityById } from '../data/seed';
import { lotById } from '../world';
import { useOpp } from '../store/useOpp';
import { useTown } from '../store/useTown';
import { STATUS_LABEL } from '../domain/opportunity';

const ICON = { tender: '📣', promo: '📢', gig: '🧰' } as const;

export function OppPins({ district }: { district: string }) {
  const setTab = useTown((s) => s.setTab);
  const setOppTab = useOpp((s) => s.setOppTab);
  useOpp((s) => s.deals);
  useOpp((s) => s.myOpps);
  const st = useOpp.getState();
  const byLot = new Map<string, { n: number; label: string; status: string }>();
  for (const o of st.allOpps()) {
    const e = o.entityId ? entityById(o.entityId) : undefined;
    const lot = e?.place.lotId;
    if (!lot || e?.place.district !== district) continue;
    const cur = byLot.get(lot);
    const status = st.statusOf(o);
    if (cur) cur.n++;
    else byLot.set(lot, { n: 1, label: `${ICON[o.kind]} ${o.budget ? `¥${Math.round(o.budget.min / 1000)}–${Math.round(o.budget.max / 1000)}k` : o.pay ?? o.commission ?? ''}`, status: STATUS_LABEL[status] });
  }
  return (
    <group>
      {[...byLot.entries()].map(([lotId, v]) => {
        const lot = lotById(lotId);
        if (!lot) return null;
        return (
          <group key={lotId} position={[lot.door.p.x + lot.door.out.x * 2.2, 3.4, lot.door.p.z + lot.door.out.z * 2.2]}>
            <Html center zIndexRange={[22, 18]}>
              <button data-testid={`opp-pin-${lotId}`} onClick={() => { setOppTab('hall'); setTab('opps'); }}
                className="whitespace-nowrap rounded-full bg-[#2F5D8A] px-2 py-0.5 text-[10px] font-black text-white shadow-soft ring-2 ring-white/70">
                {v.label}{v.n > 1 ? ` +${v.n - 1}` : ''} · {v.status}
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
