/** 打工目的地标记：取货点 / 送达点 / 帮工的店，在门口上方显示一个跳动的大标签 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { placeOfLot, useWork } from '../store/useWork';

export function jobTargetLot(a = useWork.getState().active) {
  if (!a) return undefined;
  return a.job.kind === 'delivery' ? (a.picked ? a.job.to.lotId : a.job.from.lotId) : a.job.at.lotId;
}

export function JobTarget({ district }: { district: string }) {
  const active = useWork((s) => s.active);
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.position.y = 4.2 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.5; });
  const lot = jobTargetLot(active);
  const pl = lot ? placeOfLot(lot) : undefined;
  if (!active || !pl || pl.district !== district) return null;
  const label = active.job.kind === 'delivery' ? (active.picked ? '🎯 送到这里' : '📦 在这取货') : '🧑‍🍳 在这帮工';
  return (
    <group position={[pl.trigger.x, 0, pl.trigger.z]}>
      <group ref={g}>
        <Html center zIndexRange={[45, 40]} style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center">
            <span className="whitespace-nowrap rounded-2xl bg-[#FF8A3D] px-3 py-1 text-xs font-black text-white shadow-soft">{label} · {pl.name}</span>
            <span className="h-4 w-1 bg-[#FF8A3D]" />
          </div>
        </Html>
      </group>
      <mesh position-y={0.25} rotation-x={-Math.PI / 2}><ringGeometry args={[0.7, 1.0, 32]} /><meshBasicMaterial color="#FF8A3D" transparent opacity={0.9} /></mesh>
    </group>
  );
}
