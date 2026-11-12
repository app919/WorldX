/**
 * 车辆：只在机动车道上按车道方向行驶（右侧通行），不会开上人行道；
 * 前方斑马线上有人时会礼让停车。
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { CompiledDistrict } from '../world/build';
import { dist, inOBB } from '../world/geom';
import { Car } from './Props';
import { playerRuntime } from '../store/useTown';

const COLORS = ['#F2D99B', '#9DB6CA', '#F7F3EA', '#C98068', '#A9C2A0', '#E6A3A7', '#6F8BA4'];

export function Traffic({ cd }: { cd: CompiledDistrict }) {
  const cars = useMemo(() => cd.lanes.flatMap((lane, li) => {
    const L = dist(lane.from, lane.to);
    const n = Math.max(1, Math.floor(L / 45));
    return Array.from({ length: n }, (_, k) => ({ lane, t0: (k / n) * L + li * 7, color: COLORS[(li * 3 + k) % COLORS.length], speed: 5 + ((li + k) % 3) }));
  }), [cd]);
  return <group>{cars.map((c, i) => <MovingCar key={i} {...c} cd={cd} />)}</group>;
}

function MovingCar({ lane, t0, color, speed, cd }: { lane: CompiledDistrict['lanes'][number]; t0: number; color: string; speed: number; cd: CompiledDistrict }) {
  const g = useRef<Group>(null);
  const s = useRef({ t: t0, v: speed });
  const L = dist(lane.from, lane.to);
  const rot = Math.atan2(lane.dir.x, lane.dir.z);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const st = s.current;
    const pos = (t: number) => ({ x: lane.from.x + lane.dir.x * t, z: lane.from.z + lane.dir.z * t });
    // 礼让行人：前方 2–7 单位内的斑马线上有玩家
    const ahead = [3, 5, 7].map((d) => pos(st.t + d));
    const yieldNow = cd.crosswalks.some((cw) => inOBB(cw.box, playerRuntime, 0.6) && ahead.some((p) => inOBB(cw.box, p, 0.2)));
    const target = yieldNow ? 0 : speed;
    st.v += (target - st.v) * Math.min(1, dt * (yieldNow ? 4 : 1.2));
    st.t += st.v * dt;
    if (st.t > L + 6) st.t = -6;
    const p = pos(st.t);
    g.current?.position.set(p.x, 0, p.z);
  });
  return <group ref={g} rotation-y={rot}><Car color={color} /></group>;
}
