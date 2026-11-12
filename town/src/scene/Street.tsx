/**
 * 道路横断面渲染：机动车道（沥青）→ 路缘石 → 人行道（铺装抬高）→ 建筑退界 / 绿化。
 * 标线：双黄中心线 / 白色车道虚线 / 车道边线 / 斑马线 / 停车位与 “P”。
 */
import { useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import type { CompiledDistrict } from '../world/build';
import { add, leftOf, mul, type OBB } from '../world/geom';
import { roadDir, roadLen } from '../world/helpers';
import { mats } from './materials';
import { worldBox, worldPlane } from './geo';
import { paintTex } from './textures';
import { useTown } from '../store/useTown';

const SIDEWALK_H = 0.16;

function Slab({ o, y, h, mat, unit = 4 }: { o: OBB; y: number; h: number; mat: MeshStandardMaterial; unit?: number }) {
  const g = useMemo(() => worldBox(o.w, h, o.d, unit), [o.w, o.d, h, unit]);
  return <mesh geometry={g} material={mat} position={[o.cx, y + h / 2, o.cz]} rotation-y={o.rot} receiveShadow />;
}

export function Street({ cd }: { cd: CompiledDistrict }) {
  const M = mats();
  const walkTo = useTown((s) => s.walkTo);
  const b = cd.def.bounds;
  const W = b.maxX - b.minX + 24, D = b.maxZ - b.minZ + 24;
  const ground = useMemo(() => worldPlane(W, D, 10), [W, D]);
  const base = useMemo(() => worldBox(W + 1.2, 3, D + 1.2, 10), [W, D]);

  const onClick = (e: { button?: number; point: { x: number; z: number }; stopPropagation(): void; delta?: number }) => {
    if (e.button !== 0 || (e.delta ?? 0) > 6) return;
    e.stopPropagation();
    walkTo({ x: e.point.x, z: e.point.z });
  };

  return (
    <group>
      {/* 微缩底座 */}
      <mesh geometry={base} material={M.stoneDark} position={[(b.minX + b.maxX) / 2, -1.52, (b.minZ + b.maxZ) / 2]} receiveShadow />
      <mesh geometry={ground} material={M.grass} position={[(b.minX + b.maxX) / 2, -0.01, (b.minZ + b.maxZ) / 2]} receiveShadow onClick={onClick} />

      {/* 机动车道 */}
      {cd.carriages.map((c) => (
        <group key={c.road.id}>
          <Slab o={c.box} y={-0.02} h={0.06} mat={M.asphalt} unit={8} />
          <Markings road={c.road} />
        </group>
      ))}
      {/* 人行道（抬高）+ 路缘石 */}
      {cd.sidewalks.map((s, i) => {
        const mat = s.road.paving === 'brick_red' ? M.brickPave : s.road.paving === 'tile_cream' ? M.tileCream : M.tileGrey;
        return (
          <group key={i} onClick={onClick}>
            <Slab o={s.box} y={0} h={SIDEWALK_H} mat={mat} unit={2.4} />
            <Curb o={s.box} side={s.side} roadDirRot={s.box.rot} />
          </group>
        );
      })}
      {/* 斑马线 */}
      {cd.crosswalks.map((c, i) => <Crosswalk key={i} o={c.box} />)}
      {/* 门前通道 */}
      {cd.paths.map((p, i) => <group key={i} onClick={onClick}><Slab o={p} y={0} h={SIDEWALK_H - 0.01} mat={M.tileCream} unit={2.4} /></group>)}
      {/* 区域 */}
      {cd.def.areas.map((a) => a.box && <Area key={a.id} kind={a.kind} o={a.box} onClick={onClick} />)}
    </group>
  );
}

/** 路缘石：沿人行道靠车道一侧的一条浅色石条 */
function Curb({ o, side }: { o: OBB; side: 'L' | 'R'; roadDirRot: number }) {
  const M = mats();
  // 人行道 OBB 的局部 x 轴垂直于道路；靠车道的一边在 x = ±w/2
  const sgn = side === 'L' ? -1 : 1;
  const c = Math.cos(o.rot), s = Math.sin(o.rot);
  const lx = sgn * (o.w / 2 - 0.12);
  const p = { x: o.cx + lx * c, z: o.cz - lx * s };
  const g = useMemo(() => worldBox(0.26, SIDEWALK_H + 0.05, o.d, 2), [o.d]);
  return <mesh geometry={g} material={M.curb} position={[p.x, (SIDEWALK_H + 0.05) / 2, p.z]} rotation-y={o.rot} receiveShadow castShadow />;
}

function Crosswalk({ o }: { o: OBB }) {
  const M = mats();
  const stripes = Math.floor(o.d / 0.9);
  return (
    <group position={[o.cx, 0.05, o.cz]} rotation-y={o.rot}>
      {Array.from({ length: stripes }).map((_, i) => (
        <mesh key={i} material={M.paint} position={[0, 0, -o.d / 2 + 0.45 + i * 0.9]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[o.w * 0.9, 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

function Markings({ road }: { road: CompiledDistrict['carriages'][number]['road'] }) {
  const M = mats();
  const u = roadDir(road), L = roadLen(road), n = leftOf(u);
  const rot = Math.atan2(u.x, u.z);
  const items: { p: { x: number; z: number }; w: number; l: number; yellow?: boolean }[] = [];
  const line = (off: number, dash: boolean, yellow = false, w = 0.14) => {
    if (!dash) { const c = add(add(road.a, mul(u, L / 2)), mul(n, off)); items.push({ p: c, w, l: L - 1, yellow }); return; }
    for (let s = 1.5; s < L - 1.5; s += 4) items.push({ p: add(add(road.a, mul(u, s + 1)), mul(n, off)), w, l: 2, yellow });
  };
  if (road.centerLine === 'double_yellow') { line(0.14, false, true); line(-0.14, false, true); }
  if (road.centerLine === 'dashed') line(0, true);
  // 车道分隔虚线（4 车道）
  if (road.lanes >= 4) { line(road.carriage / 4, true); line(-road.carriage / 4, true); }
  // 车道边线
  line(road.carriage / 2 - 0.35, false, false, 0.12);
  line(-road.carriage / 2 + 0.35, false, false, 0.12);
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} position={[it.p.x, 0.045, it.p.z]} rotation-y={rot} material={it.yellow ? M.paintYellow : M.paint}>
          <boxGeometry args={[it.w, 0.01, it.l]} />
        </mesh>
      ))}
    </group>
  );
}

const pMat = new MeshStandardMaterial({ map: paintTex('P'), transparent: true, roughness: 0.6 });

function Area({ kind, o, onClick }: { kind: string; o: OBB; onClick: (e: never) => void }) {
  const M = mats();
  if (kind === 'plaza') return <group onClick={onClick as never}><Slab o={o} y={0} h={SIDEWALK_H} mat={M.tileCream} unit={2} /></group>;
  if (kind === 'lawn') {
    return (
      <group>
        <Slab o={o} y={0} h={0.12} mat={M.grass} unit={6} />
        {/* 绿化带边界：矮绿篱 */}
        {edges(o).map((e, i) => <Slab key={i} o={e} y={0.1} h={0.42} mat={M.hedge} unit={1} />)}
      </group>
    );
  }
  if (kind === 'parking') {
    const n = Math.floor(o.w / 5.2);
    return (
      <group position={[o.cx, 0.05, o.cz]} rotation-y={o.rot}>
        {Array.from({ length: n + 1 }).map((_, i) => (
          <mesh key={i} material={M.paint} position={[-o.w / 2 + i * 5.2, 0, 0]}><boxGeometry args={[0.12, 0.01, o.d]} /></mesh>
        ))}
        <mesh material={M.paint} position={[0, 0, -o.d / 2]}><boxGeometry args={[n * 5.2, 0.01, 0.12]} /></mesh>
        <mesh material={pMat} position={[-o.w / 2 - 1.2, 0.01, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.6, 1.6]} /></mesh>
      </group>
    );
  }
  if (kind === 'wall') {
    return <Slab o={o} y={0} h={1.6} mat={M.stuccoCream} unit={3} />;
  }
  return null;
}

/** OBB 四条边上的细条（绿篱） */
function edges(o: OBB): OBB[] {
  const c = Math.cos(o.rot), s = Math.sin(o.rot);
  const at = (lx: number, lz: number) => ({ x: o.cx + lx * c + lz * s, z: o.cz - lx * s + lz * c });
  const t = 0.45;
  const a = at(0, o.d / 2 - t / 2), b = at(0, -o.d / 2 + t / 2), l = at(-o.w / 2 + t / 2, 0), r = at(o.w / 2 - t / 2, 0);
  return [
    { cx: a.x, cz: a.z, w: o.w, d: t, rot: o.rot }, { cx: b.x, cz: b.z, w: o.w, d: t, rot: o.rot },
    { cx: l.x, cz: l.z, w: t, d: o.d, rot: o.rot }, { cx: r.x, cz: r.z, w: t, d: o.d, rot: o.rot },
  ];
}
