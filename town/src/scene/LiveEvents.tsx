/**
 * 「跟」：街上正在进行的活动 —— 摊位 + 围观的人群 + 活动牌（🔴 进行中 · 多少人在看 · 多少人报名），点击围观。
 */
import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { Chibi } from './Chibi';
import { navOf } from '../world';
import { LIVE_EVENTS, viewersAt } from '../domain/buzz';
import { IDENTITIES } from '../domain/identity';
import { useFollow } from '../store/useFollow';
import type { DistrictKey } from '../domain/commerce';
import type { AvatarLook } from '../domain/types';
import { useEffect, useState } from 'react';

export function LiveEvents({ district }: { district: DistrictKey }) {
  const list = LIVE_EVENTS.filter((e) => e.district === district);
  return <group>{list.map((e) => <LiveSpot key={e.id} id={e.id} district={district} />)}</group>;
}

const look = (i: number): AvatarLook => {
  const id = IDENTITIES[i % IDENTITIES.length];
  return { body: id.body, pants: id.pants, accent: id.accent, outfit: id.outfit, accessory: id.accessory, hair: ['#3B3B3B', '#5A3E2B', '#2E2420', '#7A5539'][i % 4], skin: ['#F2D4BE', '#F6DCC8', '#EFCFB4'][i % 3], gender: i % 2 ? 'f' : 'm' };
};

function LiveSpot({ id, district }: { id: string; district: DistrictKey }) {
  const e = LIVE_EVENTS.find((x) => x.id === id)!;
  const nav = navOf(district);
  const at = useMemo(() => nav.nearestWalkable({ x: nav.cd.def.spawn.x + e.offset.x, z: nav.cd.def.spawn.z + e.offset.z }, 12) ?? nav.cd.def.spawn, [nav, e]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(t); }, []);
  const joined = useFollow((s) => s.joined.includes(id));
  const watching = useFollow((s) => s.watching === id);
  const crowd = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const p = nav.nearestWalkable({ x: at.x + Math.cos(a) * 2.6, z: at.z + Math.sin(a) * 2.6 }, 2) ?? at;
    return { p, rot: Math.atan2(at.x - p.x, at.z - p.z), look: look(i + id.length) };
  }), [nav, at, id]);
  const happy = useMemo(() => ({ current: 0 }), []);
  return (
    <group>
      {crowd.map((c, i) => (
        <group key={i} position={[c.p.x, 0.16, c.p.z]} rotation-y={c.rot}>
          <Chibi look={c.look} happyRef={i % 3 === 0 ? { current: performance.now() / 1000 + 9999 } : happy} scale={0.78} />
        </group>
      ))}
      <group position={[at.x, 3.4, at.z]}>
        <Html center zIndexRange={[14, 0]}>
          <button data-testid={`live-board-${id}`} onClick={() => useFollow.getState().watch(id)}
            className={`whitespace-nowrap rounded-2xl px-3 py-1.5 text-left shadow-soft ring-2 ${watching ? 'bg-almond-300 ring-almond-500' : 'bg-cream-50/95 ring-[#D9A62E]'}`}>
            <div className="flex items-center gap-1 text-[11px] font-black text-cocoa-800"><span className="rounded bg-[#E0453A] px-1 text-[9px] text-white">● 进行中</span>{e.kind} · {e.title}</div>
            <div className="text-[10px] text-stone-600">👀 {viewersAt(e, now) + (watching ? 1 : 0)} 人在看 · 🙋 {e.signed + (joined ? 1 : 0)}/{e.capacity} 已报名 · <b className="text-cocoa-700">点我围观</b></div>
          </button>
        </Html>
      </group>
    </group>
  );
}
