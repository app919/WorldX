/**
 * 红绿灯：每个路口每个进口方向一根灯杆（立在停止线旁的路缘），灯头朝向驶来的车辆；
 * 路口斑马线两端有行人信号灯（绿色小人 = 可以通行，红色 = 等待）。
 * 灯色由交通仿真的信号配时驱动，车辆与行人都按灯通行。
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import type { CompiledDistrict } from '../world/build';
import { leftOf, type V2 } from '../world/geom';
import { roadDir } from '../world/helpers';
import { lightFor, pedLight, type Traffic } from '../world/traffic';

const pole = new MeshStandardMaterial({ color: '#3E4A5A', roughness: 0.6, metalness: 0.4 });
const housing = new MeshStandardMaterial({ color: '#22272E', roughness: 0.5 });

export function Signals({ cd, tr }: { cd: CompiledDistrict; tr: Traffic }) {
  const heads = useMemo(() => {
    const out: { key: string; j: string; road: string; p: V2; rot: number; arm: V2 }[] = [];
    const seen = new Set<string>();
    for (const l of tr.lanes) {
      const road = cd.def.roads.find((r) => r.id === l.roadId)!;
      for (const j of l.junctions) {
        const sg = tr.signals.get(j.id);
        if (!sg || sg.roads.length < 2 || j.tIn < 3) continue;
        const key = `${j.id}|${l.roadId}|${Math.sign(l.dir.x * 3 + l.dir.z)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const t = j.tIn - 1.8;
        const p = { x: l.from.x + l.dir.x * t, z: l.from.z + l.dir.z * t };
        const n = leftOf(roadDir(road));
        const off = (p.x - road.a.x) * n.x + (p.z - road.a.z) * n.z; // 车道相对道路中线的偏移
        const right = { x: -l.dir.z, z: l.dir.x };
        const side = Math.sign(right.x * n.x + right.z * n.z) || 1;
        const center = { x: p.x - n.x * off, z: p.z - n.z * off };
        const q = { x: center.x + n.x * side * (road.carriage / 2 + 0.45), z: center.z + n.z * side * (road.carriage / 2 + 0.45) };
        out.push({ key, j: j.id, road: l.roadId, p: q, rot: Math.atan2(-l.dir.x, -l.dir.z), arm: { x: -n.x * side, z: -n.z * side } });
      }
    }
    return out;
  }, [cd, tr]);
  const peds = useMemo(() => {
    const out: { key: string; i: number; p: V2; rot: number }[] = [];
    cd.crosswalks.forEach((cw, i) => {
      if (!tr.cwSignal[i]) return;
      const n = leftOf(roadDir(cw.road));
      for (const sg of [1, -1]) {
        const p = { x: cw.center.x + n.x * sg * (cw.road.carriage / 2 + 0.7) + roadDir(cw.road).x * (cw.box.w / 2 + 0.4), z: cw.center.z + n.z * sg * (cw.road.carriage / 2 + 0.7) + roadDir(cw.road).z * (cw.box.w / 2 + 0.4) };
        out.push({ key: `${i}${sg}`, i, p, rot: Math.atan2(-n.x * sg, -n.z * sg) });
      }
    });
    return out;
  }, [cd, tr]);
  return (
    <group>
      {heads.map((h) => <CarLight key={h.key} tr={tr} j={h.j} road={h.road} p={h.p} rot={h.rot} arm={h.arm} />)}
      {peds.map((h) => <PedLight key={h.key} tr={tr} i={h.i} p={h.p} rot={h.rot} />)}
    </group>
  );
}

function CarLight({ tr, j, road, p, rot, arm }: { tr: Traffic; j: string; road: string; p: V2; rot: number; arm: V2 }) {
  const mats = useMemo(() => ['#FF3B30', '#FFC21A', '#34C759'].map((c) => new MeshStandardMaterial({ color: '#2A2A2A', emissive: c, emissiveIntensity: 0.05 })), []);
  const last = useRef('');
  useFrame(() => {
    const l = lightFor(tr, j, road);
    if (l === last.current) return;
    last.current = l;
    mats[0].emissiveIntensity = l === 'red' ? 2.4 : 0.05;
    mats[1].emissiveIntensity = l === 'yellow' ? 2.4 : 0.05;
    mats[2].emissiveIntensity = l === 'green' ? 2.4 : 0.05;
    mats.forEach((m, k) => m.color.set(m.emissiveIntensity > 1 ? ['#FF6B5E', '#FFD45A', '#6BE38A'][k] : '#2A2A2A'));
  });
  // L 形信号灯杆：立杆在路缘，横臂伸到车道上方，灯头朝向驶来的车辆；立杆中部再挂一个小灯头
  const L = 2.4;
  const hx = p.x + arm.x * L, hz = p.z + arm.z * L;
  return (
    <group>
      <mesh material={pole} position={[p.x, 2.3, p.z]} castShadow><cylinderGeometry args={[0.08, 0.11, 4.6, 8]} /></mesh>
      <mesh material={pole} position={[(p.x + hx) / 2, 4.5, (p.z + hz) / 2]} rotation-y={Math.atan2(arm.x, arm.z)} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.05, 0.05, L, 6]} /></mesh>
      {[{ x: hx, z: hz, y: 4.1, s: 1 }, { x: p.x, z: p.z, y: 2.4, s: 0.7 }].map((h, i) => (
        <group key={i} position={[h.x, h.y, h.z]} rotation-y={rot} scale={h.s}>
          <mesh material={housing} castShadow><boxGeometry args={[0.46, 1.3, 0.36]} /></mesh>
          {mats.map((m, k) => <mesh key={k} material={m} position={[0, 0.4 - k * 0.4, 0.19]}><sphereGeometry args={[0.15, 14, 10]} /></mesh>)}
        </group>
      ))}
    </group>
  );
}

function PedLight({ tr, i, p, rot }: { tr: Traffic; i: number; p: V2; rot: number }) {
  const red = useMemo(() => new MeshStandardMaterial({ color: '#2A2A2A', emissive: '#FF3B30', emissiveIntensity: 0.05 }), []);
  const green = useMemo(() => new MeshStandardMaterial({ color: '#2A2A2A', emissive: '#34C759', emissiveIntensity: 0.05 }), []);
  const last = useRef('');
  useFrame(() => {
    const s = pedLight(tr, i);
    if (s === last.current) return;
    last.current = s;
    red.emissiveIntensity = s === 'stop' ? 2.2 : 0.05; red.color.set(s === 'stop' ? '#FF6B5E' : '#2A2A2A');
    green.emissiveIntensity = s === 'walk' ? 2.2 : 0.05; green.color.set(s === 'walk' ? '#6BE38A' : '#2A2A2A');
  });
  return (
    <group position={[p.x, 0, p.z]} rotation-y={rot}>
      <mesh material={pole} position-y={1.1} castShadow><cylinderGeometry args={[0.05, 0.06, 2.2, 8]} /></mesh>
      <mesh material={housing} position={[0, 2.2, 0]}><boxGeometry args={[0.32, 0.62, 0.2]} /></mesh>
      {/* 上：红色站立小人；下：绿色行走小人 */}
      <mesh material={red} position={[0, 2.36, 0.11]}><planeGeometry args={[0.2, 0.22]} /></mesh>
      <mesh material={green} position={[0, 2.06, 0.11]}><planeGeometry args={[0.2, 0.22]} /></mesh>
    </group>
  );
}
