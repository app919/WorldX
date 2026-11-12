import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { Chibi } from './Chibi';
import { RESIDENTS, type Resident } from '../data/seed';
import { residentAnchor, useOpportunities, useTown } from '../store/useTown';

/** 街上的居民：在常驻地点附近慢慢闲逛；有商业可能性时头顶冒出小星星 */
export function Residents() {
  const rels = useOpportunities();
  const flagged = new Set(rels.map((r) => r.toUserId));
  return (
    <group>
      {RESIDENTS.map((r) => <Wanderer key={r.id} r={r} spark={flagged.has(r.id)} />)}
    </group>
  );
}

function Wanderer({ r, spark }: { r: Resident; spark: boolean }) {
  const anchor = residentAnchor(r);
  const g = useRef<Group>(null);
  const moving = useRef(0);
  const happy = useRef(0);
  const st = useRef({ x: anchor.x, z: anchor.z, tx: anchor.x, tz: anchor.z, wait: Math.random() * 3 });
  const select = useTown((s) => s.select);
  const isFriend = useTown((s) => s.friends.includes(r.id));

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    if (s.wait > 0) {
      s.wait -= dt; moving.current = 0;
      if (s.wait <= 0) {
        const a = Math.random() * Math.PI * 2, d = 0.6 + Math.random() * 1.6;
        s.tx = anchor.x + Math.cos(a) * d; s.tz = anchor.z + Math.sin(a) * d;
      }
    } else {
      const dx = s.tx - s.x, dz = s.tz - s.z, len = Math.hypot(dx, dz);
      if (len < 0.1) { s.wait = 2 + Math.random() * 4; }
      else {
        s.x += (dx / len) * 1.4 * dt; s.z += (dz / len) * 1.4 * dt; moving.current = 1;
        if (g.current) g.current.rotation.y = Math.atan2(dx, dz);
      }
    }
    if (g.current) g.current.position.set(s.x, 0, s.z);
    void state;
  });

  return (
    <group
      ref={g}
      position={[anchor.x, 0, anchor.z]}
      onClick={(e) => { e.stopPropagation(); select('resident', r.id); happy.current = performance.now() / 1000 + 1; }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <Chibi look={r.look} movingRef={moving} happyRef={happy} scale={0.92} />
      {/* 点击热区 */}
      <mesh position-y={0.9} visible={false}>
        <cylinderGeometry args={[0.6, 0.6, 1.9, 8]} />
      </mesh>
      <Html position={[0, 2.15, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-1 whitespace-nowrap rounded-full bg-cream-50/90 px-2 py-0.5 text-[10px] font-semibold text-cocoa-600 shadow-soft">
          {isFriend && <span>💗</span>}
          {r.nickname}
          {spark && <span className="animate-bounce text-almond-500">✨</span>}
          {!r.online && <span className="text-stone-400">· 离线</span>}
        </div>
      </Html>
    </group>
  );
}
