/**
 * 道路横断面渲染：机动车道（沥青）→ 路缘石 → 人行道（铺装抬高）→ 建筑退界 / 绿化。
 * 标线：双黄中心线 / 白色车道虚线 / 车道边线 / 斑马线 / 停车位与 “P”。
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { CompiledDistrict } from '../world/build';
import { add, inOBB, leftOf, mul, type OBB } from '../world/geom';
import { roadDir, roadLen } from '../world/helpers';
import { mats } from './materials';
import { worldBox, worldPlane } from './geo';
import { paintTex, roadNameTex } from './textures';
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
      {cd.carriages.map((c, i) => (
        <group key={c.road.id}>
          {/* 每条路的路面高度错开 2mm，路口重叠处不会出现 Z-fighting 闪烁 */}
          <Slab o={c.box} y={-0.02 + i * 0.002} h={0.06} mat={M.asphalt} unit={8} />
          <Markings road={c.road} cd={cd} y={0.045 + i * 0.002} />
          <RoadNames road={c.road} cd={cd} y={0.052 + i * 0.002} />
        </group>
      ))}
      {/* 人行道（抬高）+ 路缘石 */}
      {cd.sidewalks.map((s, i) => {
        const mat = s.road.paving === 'brick_red' ? M.brickPave : s.road.paving === 'tile_cream' ? M.tileCream : M.tileGrey;
        return (
          <group key={i} onClick={onClick}>
            <Slab o={s.box} y={i * 0.0015} h={SIDEWALK_H} mat={mat} unit={2.4} />
            <Curb o={s.box} side={s.side} roadDirRot={s.box.rot} lift={i * 0.0015} />
            <Tactile cd={cd} side={s} y={SIDEWALK_H + i * 0.0015 + 0.004} />
          </group>
        );
      })}
      {/* 斑马线 */}
      {cd.crosswalks.map((c, i) => <Crosswalk key={i} o={c.box} y={0.06 + cd.carriages.length * 0.002} />)}
      {/* 门前通道 */}
      {cd.paths.map((p, i) => <group key={i} onClick={onClick}><Slab o={p} y={-0.004 - (i % 5) * 0.001} h={SIDEWALK_H - 0.01} mat={M.tileCream} unit={2.4} /></group>)}
      {/* 区域 */}
      {cd.def.areas.map((a) => a.box && <Area key={a.id} kind={a.kind} o={a.box} onClick={onClick} />)}
    </group>
  );
}

/** 路缘石：沿人行道靠车道一侧的一条浅色石条 */
function Curb({ o, side, lift = 0 }: { o: OBB; side: 'L' | 'R'; roadDirRot: number; lift?: number }) {
  const M = mats();
  // 人行道 OBB 的局部 x 轴垂直于道路；靠车道的一边在 x = ±w/2
  const sgn = side === 'L' ? -1 : 1;
  const c = Math.cos(o.rot), s = Math.sin(o.rot);
  const lx = sgn * (o.w / 2 - 0.12);
  const p = { x: o.cx + lx * c, z: o.cz - lx * s };
  const g = useMemo(() => worldBox(0.26, SIDEWALK_H + 0.05, o.d, 2), [o.d]);
  return <mesh geometry={g} material={M.curb} position={[p.x, (SIDEWALK_H + 0.05) / 2 + lift, p.z]} rotation-y={o.rot} receiveShadow castShadow />;
}

function Crosswalk({ o, y }: { o: OBB; y: number }) {
  const M = mats();
  const stripes = Math.floor(o.d / 0.9);
  return (
    <group position={[o.cx, y, o.cz]} rotation-y={o.rot}>
      {Array.from({ length: stripes }).map((_, i) => (
        <mesh key={i} material={M.paint} position={[0, 0, -o.d / 2 + 0.45 + i * 0.9]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[o.w * 0.9, 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

/** 标线：遇到其他道路的车道（路口）自动断开，不会画进路口中间 */
function Markings({ road, cd, y }: { road: CompiledDistrict['carriages'][number]['road']; cd: CompiledDistrict; y: number }) {
  const M = mats();
  const items = useMemo(() => {
    const u = roadDir(road), L = roadLen(road), n = leftOf(u);
    const others = cd.carriages.filter((c) => c.road !== road);
    const blocked = (p: { x: number; z: number }) => others.some((c) => inOBB(c.box, p, 0.8)) || cd.crosswalks.some((c) => inOBB(c.box, p, 0.2));
    const out: { p: { x: number; z: number }; w: number; l: number; yellow?: boolean }[] = [];
    const line = (off: number, dash: boolean, yellow = false, w = 0.14) => {
      const step = dash ? 4 : 2, len = dash ? 2 : 2.02;
      for (let s = 1.5; s < L - 1.5; s += step) {
        const c = add(add(road.a, mul(u, s + len / 2)), mul(n, off));
        if (!blocked(c)) out.push({ p: c, w, l: len, yellow });
      }
    };
    if (road.centerLine === 'double_yellow') { line(0.14, false, true); line(-0.14, false, true); }
    if (road.centerLine === 'dashed') line(0, true);
    if (road.lanes >= 4) { line(road.carriage / 4, true); line(-road.carriage / 4, true); }
    line(road.carriage / 2 - 0.35, false, false, 0.12);
    line(-road.carriage / 2 + 0.35, false, false, 0.12);
    return out;
  }, [road, cd]);
  const rot = Math.atan2(roadDir(road).x, roadDir(road).z);
  const white = items.filter((i) => !i.yellow), yellow = items.filter((i) => i.yellow);
  return (
    <group>
      <Batch list={white.map((it) => ({ x: it.p.x, y, z: it.p.z, ry: rot, sx: it.w, sy: 0.01, sz: it.l }))} mat={M.paint} />
      <Batch list={yellow.map((it) => ({ x: it.p.x, y, z: it.p.z, ry: rot, sx: it.w, sy: 0.01, sz: it.l }))} mat={M.paintYellow} />
    </group>
  );
}

/** 实例化的小方块（标线、盲道）：成千上万块也只占一次绘制 */
function Batch({ list, mat }: { list: { x: number; y: number; z: number; ry: number; sx: number; sy: number; sz: number }[]; mat: MeshStandardMaterial }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const o = new Object3D();
    list.forEach((it, i) => { o.position.set(it.x, it.y, it.z); o.rotation.set(0, it.ry, 0); o.scale.set(it.sx, it.sy, it.sz); o.updateMatrix(); ref.current!.setMatrixAt(i, o.matrix); });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [list]);
  if (!list.length) return null;
  return <instancedMesh ref={ref} args={[UNIT_BOX, mat, list.length]} receiveShadow />;
}
const UNIT_BOX = new BoxGeometry(1, 1, 1);

/** 路面路名：沿道路方向写在车道上（俯视角下一眼看出这是哪条路） */
function RoadNames({ road, cd, y }: { road: CompiledDistrict['carriages'][number]['road']; cd: CompiledDistrict; y: number }) {
  const spots = useMemo(() => {
    const u = roadDir(road), L = roadLen(road);
    const others = cd.carriages.filter((c) => c.road !== road);
    const out: { x: number; z: number }[] = [];
    for (let s = 14; s < L - 8; s += 26) {
      const p = add(road.a, mul(u, s));
      if (!others.some((c) => inOBB(c.box, p, 4)) && !cd.crosswalks.some((c) => inOBB(c.box, p, 3.5))) out.push(p);
    }
    return out;
  }, [road, cd]);
  const name = road.name.replace('（示意）', '');
  const tex = useMemo(() => roadNameTex(name), [name]);
  const u = roadDir(road);
  // 文字沿道路方向：平面的局部 x 轴对齐道路方向
  const rotY = Math.atan2(u.x, u.z) - Math.PI / 2;
  const w = Math.min(road.carriage * 0.95, 1.1 * name.length + 1);
  return (
    <group>
      {spots.map((p, i) => (
        <mesh key={i} position={[p.x, y, p.z]} rotation={[-Math.PI / 2, 0, rotY]} renderOrder={2}>
          <planeGeometry args={[w * 1.9, w * 0.42]} />
          <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** 盲道：人行道上的黄色导盲砖，路口处断开 */
function Tactile({ cd, side, y }: { cd: CompiledDistrict; side: CompiledDistrict['sidewalks'][number]; y: number }) {
  const segs = useMemo(() => {
    const r = side.road, u = roadDir(r), L = roadLen(r);
    const n = side.side === 'L' ? leftOf(u) : mul(leftOf(u), -1);
    const off = r.carriage / 2 + r.sidewalk * 0.6;
    const others = cd.carriages.filter((c) => c.road !== r);
    const out: { x: number; z: number }[] = [];
    for (let s = 1; s < L - 1; s += 2) {
      const p = add(add(r.a, mul(u, s)), mul(n, off));
      if (!others.some((c) => inOBB(c.box, p, 0.3)) && !cd.def.buildings.some((b) => b.box && inOBB(b.box, p, 0.2))) out.push(p);
    }
    return out;
  }, [cd, side]);
  const rot = Math.atan2(roadDir(side.road).x, roadDir(side.road).z);
  return <Batch list={segs.map((p) => ({ x: p.x, y, z: p.z, ry: rot, sx: 0.42, sy: 0.01, sz: 1.96 }))} mat={TACTILE} />;
}
const TACTILE = new MeshStandardMaterial({ color: '#E8C24A', roughness: 0.75 });

const pMat = new MeshStandardMaterial({ map: paintTex('P'), transparent: true, roughness: 0.6 });

function Area({ kind, o, onClick }: { kind: string; o: OBB; onClick: (e: never) => void }) {
  const M = mats();
  if (kind === 'plaza') return <group onClick={onClick as never}><Slab o={o} y={0} h={SIDEWALK_H} mat={M.tileCream} unit={2} /></group>;
  if (kind === 'park') {
    // 公园：草地 + 四周矮绿篱（每条边中间留出入口）
    const half = (e: OBB): OBB[] => {
      const long = e.w > e.d, L = long ? e.w : e.d, seg = (L - 3.6) / 2;
      const ax = long ? { x: Math.cos(e.rot), z: -Math.sin(e.rot) } : { x: Math.sin(e.rot), z: Math.cos(e.rot) };
      return [-1, 1].map((sg) => ({ ...e, cx: e.cx + ax.x * sg * (seg / 2 + 1.8), cz: e.cz + ax.z * sg * (seg / 2 + 1.8), w: long ? seg : e.w, d: long ? e.d : seg }));
    };
    return (
      <group>
        <Slab o={o} y={0} h={0.1} mat={M.grass} unit={6} />
        {edges(o).flatMap(half).map((e, i) => <Slab key={i} o={e} y={0.08} h={0.5} mat={M.hedge} unit={1} />)}
      </group>
    );
  }
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
