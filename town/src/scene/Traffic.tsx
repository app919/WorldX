/**
 * 车辆渲染：由 world/traffic.ts 的交通仿真驱动（跟车、路口让行、转弯、礼让斑马线行人）。
 * 渲染位置平滑跟随仿真位置（转弯并线时平滑过渡，不会瞬移），车轮按速度转动，减速时刹车灯亮。
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, MeshStandardMaterial } from 'three';
import type { CompiledDistrict } from '../world/build';
import { carPos, createTraffic, stepTraffic, trafficRuntime, type Car as SimCar } from '../world/traffic';
import { Car } from './Props';
import { playerRuntime } from '../store/useTown';
import { LOW_GFX } from './quality';

export function Traffic({ cd }: { cd: CompiledDistrict }) {
  const tr = useMemo(() => createTraffic(cd, LOW_GFX ? 0.6 : 1), [cd]);
  useEffect(() => {
    trafficRuntime.tr = tr;
    return () => { if (trafficRuntime.tr === tr) trafficRuntime.tr = null; };
  }, [tr]);
  useFrame((_, dt) => {
    trafficRuntime.peds.set('player', { x: playerRuntime.x, z: playerRuntime.z });
    stepTraffic(tr, Math.min(dt, 0.05), [...trafficRuntime.peds.values()]);
  });
  return <group>{tr.cars.map((c) => <MovingCar key={c.id} car={c} tr={tr} />)}</group>;
}

function MovingCar({ car, tr }: { car: SimCar; tr: ReturnType<typeof createTraffic> }) {
  const g = useRef<Group>(null);
  const wheels = useRef<Group[]>([]);
  const brake = useRef<MeshStandardMaterial | null>(null);
  const vis = useRef({ x: 0, z: 0, yaw: 0, init: false, spin: 0 });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (!g.current) return;
    g.current.visible = !car.hidden;
    if (car.hidden) { vis.current.init = false; return; }
    const lane = tr.lanes[car.lane];
    const p = carPos(tr, car);
    const yaw = Math.atan2(lane.dir.x, lane.dir.z);
    const v = vis.current;
    if (!v.init) { v.x = p.x; v.z = p.z; v.yaw = yaw; v.init = true; }
    // 平滑跟随：直行时几乎贴合，转弯并线时约 0.4 秒内平滑过渡
    const k = Math.min(1, dt * 7);
    v.x += (p.x - v.x) * k; v.z += (p.z - v.z) * k;
    let dy = yaw - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    v.yaw += dy * Math.min(1, dt * 5);
    g.current.position.set(v.x, 0, v.z);
    g.current.rotation.y = v.yaw;
    // 车轮滚动（半径约 0.34）
    v.spin += (car.v * dt) / 0.34;
    for (const w of wheels.current) if (w) w.rotation.x = v.spin;
    if (brake.current) brake.current.emissiveIntensity = car.braking ? 2.2 : 0.35;
  });
  return <group ref={g}><Car color={car.color} seed={car.seed} wheelsRef={wheels} brakeRef={brake} /></group>;
}
