/**
 * 街上的人：
 * - 主理人 / 自由职业者（可点击，查看公开介绍、打招呼）：在自己的店门口或所在街区附近活动；
 * - 路人（氛围角色，不可交互）：沿人行道和斑马线，用同一套导航规则散步，绝不会穿墙或横穿马路。
 */
import { useEffect, useMemo, useRef } from 'react';
import { crosswalkBusy, hitsCar, trafficRuntime } from '../world/traffic';
import { inOBB } from '../world/geom';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { Chibi } from './Chibi';
import { navOf } from '../world';
import { rng, type V2 } from '../world/geom';
import { RESIDENTS, type Resident } from '../data/seed';
import { residentAnchor, useBusinessMap, useTown } from '../store/useTown';
import type { DistrictKey } from '../domain/commerce';
import type { AvatarLook } from '../domain/types';

export function People({ district }: { district: DistrictKey }) {
  const map = useBusinessMap();
  const customers = new Set(map?.byType.customer.map((r) => r.counterpartyId) ?? []);
  const list = RESIDENTS.filter((r) => r.district === district || residentAnchor(r).district === district);
  return (
    <group>
      {list.map((r) => <Owner key={r.id} r={r} isCustomer={customers.has(r.entityId)} />)}
      {Array.from({ length: 7 }).map((_, i) => <Walker key={`${district}${i}`} district={district} seed={i + 1} />)}
    </group>
  );
}

function Owner({ r, isCustomer }: { r: Resident; isCustomer: boolean }) {
  const anchor = residentAnchor(r);
  const nav = navOf(anchor.district);
  const g = useRef<Group>(null);
  const moving = useRef(0);
  const happy = useRef(0);
  const st = useRef({ p: { ...anchor.p }, path: [] as V2[], i: 0, wait: Math.random() * 3 });
  const openCard = useTown((s) => s.openCard);
  const isFriend = useTown((s) => s.friends.includes(r.id));

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    if (s.wait > 0) {
      s.wait -= dt; moving.current = 0;
      if (s.wait <= 0) {
        const a = Math.random() * Math.PI * 2;
        const t = nav.nearestWalkable({ x: anchor.p.x + Math.cos(a) * 2.5, z: anchor.p.z + Math.sin(a) * 2.5 }, 3);
        s.path = (t && nav.findPath(s.p, t)) ?? []; s.i = 0;
        if (!s.path.length) s.wait = 2;
      }
    } else if (s.path.length) {
      const tgt = s.path[Math.min(s.i, s.path.length - 1)];
      const dx = tgt.x - s.p.x, dz = tgt.z - s.p.z, L = Math.hypot(dx, dz);
      if (L < 0.2) { s.i++; if (s.i >= s.path.length) { s.path = []; s.wait = 3 + Math.random() * 4; } }
      else { s.p.x += (dx / L) * 1.3 * dt; s.p.z += (dz / L) * 1.3 * dt; moving.current = 1; if (g.current) g.current.rotation.y = Math.atan2(dx, dz); }
    } else s.wait = 2;
    g.current?.position.set(s.p.x, 0.16, s.p.z);
  });

  return (
    <group
      ref={g}
      position={[anchor.p.x, 0.16, anchor.p.z]}
      onClick={(e) => { e.stopPropagation(); openCard({ kind: 'resident', id: r.id }); happy.current = performance.now() / 1000 + 1; }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <Chibi look={r.look} movingRef={moving} happyRef={happy} scale={0.92} />
      <mesh position-y={0.9} visible={false}><cylinderGeometry args={[0.6, 0.6, 1.9, 8]} /></mesh>
      <Html position={[0, 2.15, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-1 whitespace-nowrap rounded-full bg-cream-50/90 px-2 py-0.5 text-[10px] font-semibold text-cocoa-600 shadow-soft">
          {isFriend && <span>💗</span>}{r.nickname}
          {isCustomer && <span className="rounded-full bg-almond-300 px-1 text-[9px] text-cocoa-800">可能的客户</span>}
          {!r.online && <span className="text-stone-400">· 离线</span>}
        </div>
      </Html>
    </group>
  );
}

const WALKER_LOOKS: AvatarLook[] = [
  { body: '#D9C7B0', skin: '#F2D4BE', hair: '#3B3B3B', accessory: 'none' },
  { body: '#A9BFD0', skin: '#F6DCC8', hair: '#5A3E2B', accessory: 'cap' },
  { body: '#E6B9A6', skin: '#EFCFB4', hair: '#2E2420', accessory: 'none' },
  { body: '#BFD3B5', skin: '#F6DCC8', hair: '#7A5539', accessory: 'glasses' },
  { body: '#EAD9A6', skin: '#F2D4BE', hair: '#D8D3CC', accessory: 'scarf' },
];

function Walker({ district, seed }: { district: DistrictKey; seed: number }) {
  const key = `walker-${seed}`;
  useEffect(() => () => { trafficRuntime.peds.delete(key); }, [key]);
  const nav = navOf(district);
  const R = useMemo(() => rng(seed * 991 + district.length), [seed, district]);
  const look = WALKER_LOOKS[seed % WALKER_LOOKS.length];
  const randomSpot = () => {
    const b = nav.cd.def.bounds;
    for (let k = 0; k < 40; k++) {
      const p = { x: b.minX + R() * (b.maxX - b.minX), z: b.minZ + R() * (b.maxZ - b.minZ) };
      if (nav.walkable(p)) return p;
    }
    return nav.cd.def.spawn;
  };
  const st = useRef<{ p: V2; path: V2[]; i: number; wait: number }>({ p: randomSpot(), path: [], i: 0, wait: R() * 2 });
  const g = useRef<Group>(null);
  const moving = useRef(0);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    if (!s.path.length) {
      s.wait -= dt; moving.current = 0;
      if (s.wait <= 0) { s.path = nav.findPath(s.p, randomSpot()) ?? []; s.i = 0; s.wait = 1 + R() * 3; }
    } else {
      const tgt = s.path[Math.min(s.i, s.path.length - 1)];
      const dx = tgt.x - s.p.x, dz = tgt.z - s.p.z, L = Math.hypot(dx, dz);
      if (L < 0.2) { s.i++; if (s.i >= s.path.length) s.path = []; }
      else {
        const next = { x: s.p.x + (dx / L) * 1.6 * dt, z: s.p.z + (dz / L) * 1.6 * dt };
        // 过马路前看一眼：斑马线上有车就等一等；也不会穿过车辆
        const cw = nav.cd.crosswalks.find((c) => inOBB(c.box, next, 0.2));
        const wait = (cw && !inOBB(cw.box, s.p, 0) && crosswalkBusy(trafficRuntime.tr, cw.box)) || hitsCar(trafficRuntime.tr, next);
        if (wait) moving.current = 0;
        else { s.p = next; moving.current = 1; if (g.current) g.current.rotation.y = Math.atan2(dx, dz); }
      }
    }
    trafficRuntime.peds.set(key, s.p);
    g.current?.position.set(s.p.x, 0.16, s.p.z);
  });
  return <group ref={g}><Chibi look={look} movingRef={moving} scale={0.85} /></group>;
}
