import { Html, RoundedBox } from '@react-three/drei';
import { SHOP_LOTS } from '../data/buildings';
import { RESIDENTS } from '../data/seed';
import type { FacadeStyle, OpcProfile } from '../domain/types';
import { M } from './materials';
import { lotOf, useTown } from '../store/useTown';

/** OPC 小店：门头 + 招牌 + AI 分身在线接待的小机器人标识 */
export function Shops() {
  const myOpc = useTown((s) => s.myOpc);
  const myAgent = useTown((s) => s.myAgent);
  const select = useTown((s) => s.select);
  const openChat = useTown((s) => s.openChat);

  const occupied = new Map<string, { opc: OpcProfile; ownerOnline: boolean; agentOn: boolean; mine: boolean }>();
  for (const r of RESIDENTS) if (r.opc) occupied.set(lotOf(r.opc), { opc: r.opc, ownerOnline: r.online, agentOn: true, mine: false });
  if (myOpc) occupied.set(myOpc.lotId, { opc: myOpc, ownerOnline: !!myAgent?.ownerOnline, agentOn: !!myAgent?.autoReception, mine: true });

  return (
    <group>
      {SHOP_LOTS.map((lot) => {
        const o = occupied.get(lot.id);
        return (
          <group
            key={lot.id}
            position={[lot.pos.x, 0, lot.pos.z]}
            rotation-y={lot.rotation}
            onClick={(e) => {
              e.stopPropagation();
              if (o) openChat(o.opc.id);
              else select('lot', lot.id);
            }}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            {o ? <Facade style={o.opc.facade} /> : <EmptyLot />}
            <Html position={[0, o ? 3.6 : 2.4, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              {o ? (
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold shadow-soft ${o.mine ? 'bg-almond-300 text-cocoa-800 ring-2 ring-almond-500' : 'bg-cream-50/95 text-cocoa-800'}`}>
                    {o.mine && '⭐ '}{o.opc.name}
                  </div>
                  <div className="flex gap-1">
                    {o.ownerOnline ? (
                      <span className="rounded-full bg-sage-300 px-1.5 text-[10px] text-sage-700">主理人在线</span>
                    ) : o.agentOn ? (
                      <span className="rounded-full bg-haze-200 px-1.5 text-[10px] text-haze-600 animate-pulse">🤖 AI 分身接待中</span>
                    ) : null}
                    {o.opc.isDemo && <span className="rounded-full bg-cream-200 px-1.5 text-[10px] text-stone-600">演示</span>}
                  </div>
                </div>
              ) : (
                <div className="whitespace-nowrap rounded-full bg-cream-50/80 px-2 py-0.5 text-[10px] text-stone-600 shadow-soft">空铺 · 点我开店</div>
              )}
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function EmptyLot() {
  return (
    <group>
      <RoundedBox args={[3, 0.18, 2.6]} radius={0.08} position-y={0.1} material={M.sidewalk} receiveShadow />
      <mesh position={[0, 0.7, 0.9]} material={M.wood}><boxGeometry args={[0.06, 1.2, 0.06]} /></mesh>
      <RoundedBox args={[0.9, 0.55, 0.08]} radius={0.04} position={[0, 1.2, 0.92]} material={M.almond} />
    </group>
  );
}

function Facade({ style }: { style: FacadeStyle }) {
  const wall = style === 'cafe' ? M.cream : style === 'studio' ? M.haze : style === 'shikumen' ? M.stone : M.sakura;
  const awning = style === 'cafe' ? M.sage : style === 'studio' ? M.almond : style === 'shikumen' ? M.brick : M.haze;
  return (
    <group>
      <RoundedBox args={[3, 2.6, 2.6]} radius={0.35} smoothness={3} position-y={1.3} material={wall} castShadow receiveShadow />
      {/* 果冻感遮阳棚 */}
      <group position={[0, 2.0, 1.35]}>
        {[-1.05, -0.35, 0.35, 1.05].map((x, i) => (
          <mesh key={x} position={[x, 0, 0.25]} rotation-x={Math.PI / 2 - 0.5} material={i % 2 ? M.cream : awning}>
            <cylinderGeometry args={[0.36, 0.36, 0.8, 12, 1, false, 0, Math.PI]} />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.6, 1.0, 1.31]} material={M.window}><boxGeometry args={[1.1, 1.0, 0.08]} /></mesh>
      <RoundedBox args={[0.75, 1.4, 0.12]} radius={0.06} position={[0.8, 0.72, 1.31]} material={M.wood} />
      <RoundedBox args={[3.2, 0.3, 2.8]} radius={0.12} position-y={2.7} material={style === 'shikumen' ? M.stoneDeep : M.creamDeep} />
      {style === 'cafe' && (
        <group position={[1.6, 0, 1.8]}>
          <mesh position-y={0.35} material={M.wood}><cylinderGeometry args={[0.28, 0.28, 0.05, 14]} /></mesh>
          <mesh position-y={0.17} material={M.cocoa}><cylinderGeometry args={[0.04, 0.04, 0.35, 6]} /></mesh>
        </group>
      )}
      {/* 门口的小盆栽 */}
      <mesh position={[-1.5, 0.3, 1.5]} material={M.wood}><cylinderGeometry args={[0.2, 0.16, 0.3, 10]} /></mesh>
      <mesh position={[-1.5, 0.62, 1.5]} material={M.sageDeep}><sphereGeometry args={[0.28, 12, 10]} /></mesh>
    </group>
  );
}
