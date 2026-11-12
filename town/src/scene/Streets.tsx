import { useLayoutEffect, useMemo, useRef } from 'react';
import { Html, RoundedBox } from '@react-three/drei';
import { InstancedMesh, Object3D } from 'three';
import { GAME_ROADS } from '../data/buildings';
import { BOUNDS, HOUSES, LAMPS, TREES, type House } from './layout';
import { M } from './materials';
import { useTown } from '../store/useTown';

export function Ground() {
  const setWalkTarget = useTown((s) => s.setWalkTarget);
  const w = BOUNDS.maxX - BOUNDS.minX + 30;
  const d = BOUNDS.maxZ - BOUNDS.minZ + 30;
  const cx = (BOUNDS.maxX + BOUNDS.minX) / 2;
  const cz = (BOUNDS.maxZ + BOUNDS.minZ) / 2;
  return (
    <group>
      {/* 微缩底座：像一块奶油蛋糕 */}
      <RoundedBox args={[w, 2, d]} radius={0.9} smoothness={4} position={[cx, -1.02, cz]} material={M.creamDeep} receiveShadow />
      <mesh
        rotation-x={-Math.PI / 2}
        position={[cx, 0, cz]}
        receiveShadow
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          setWalkTarget({ x: e.point.x, z: e.point.z });
        }}
      >
        <planeGeometry args={[w - 1.4, d - 1.4]} />
        <primitive object={M.grass} attach="material" />
      </mesh>
      {GAME_ROADS.map((r) => (
        <group key={r.id}>
          {r.pts.slice(1).map((b, i) => {
            const a = r.pts[i];
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            const rot = Math.atan2(b.x - a.x, b.z - a.z);
            return (
              <group key={i} position={[(a.x + b.x) / 2, 0, (a.z + b.z) / 2]} rotation-y={rot}>
                {/* 人行道 */}
                <mesh position-y={0.04} receiveShadow material={M.sidewalk}>
                  <boxGeometry args={[r.width + 2.4, 0.08, len + 2.4]} />
                </mesh>
                <mesh position-y={0.09} receiveShadow material={M.road}>
                  <boxGeometry args={[r.width, 0.06, len + r.width]} />
                </mesh>
              </group>
            );
          })}
          {r.pts.map((p, i) => (
            <mesh key={`j${i}`} position={[p.x, 0.091, p.z]} rotation-x={-Math.PI / 2} material={M.road}>
              <circleGeometry args={[r.width / 2 + 0.05, 24]} />
            </mesh>
          ))}
          <StreetSign road={r} />
        </group>
      ))}
    </group>
  );
}

function StreetSign({ road }: { road: (typeof GAME_ROADS)[number] }) {
  const i = Math.floor((road.pts.length - 1) / 2);
  const a = road.pts[i], b = road.pts[i + 1];
  return (
    <Html position={[(a.x + b.x) / 2, 0.3, (a.z + b.z) / 2]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded-full bg-cream-50/85 px-2.5 py-0.5 text-[11px] font-semibold text-cocoa-600 shadow-soft">
        {road.name}
      </div>
    </Html>
  );
}

/** 梧桐树：实例化渲染，柔软的树冠 */
export function PlaneTrees() {
  const trunks = useRef<InstancedMesh>(null);
  const crownA = useRef<InstancedMesh>(null);
  const crownB = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D();
    TREES.forEach((t, i) => {
      const s = 0.85 + ((i * 37) % 10) / 30;
      o.position.set(t.x, 0.9 * s, t.z); o.scale.set(s, s, s); o.rotation.set(0, i, 0); o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      o.position.set(t.x, 2.3 * s, t.z); o.scale.set(1.25 * s, 0.95 * s, 1.25 * s); o.updateMatrix();
      crownA.current!.setMatrixAt(i, o.matrix);
      o.position.set(t.x + 0.35 * s, 2.85 * s, t.z - 0.2 * s); o.scale.set(0.85 * s, 0.75 * s, 0.85 * s); o.updateMatrix();
      crownB.current!.setMatrixAt(i, o.matrix);
    });
    [trunks, crownA, crownB].forEach((r) => (r.current!.instanceMatrix.needsUpdate = true));
  }, []);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, TREES.length]} castShadow material={M.trunk}>
        <cylinderGeometry args={[0.12, 0.17, 1.8, 8]} />
      </instancedMesh>
      <instancedMesh ref={crownA} args={[undefined, undefined, TREES.length]} castShadow material={M.plane}>
        <sphereGeometry args={[1, 14, 10]} />
      </instancedMesh>
      <instancedMesh ref={crownB} args={[undefined, undefined, TREES.length]} castShadow material={M.planeDeep}>
        <sphereGeometry args={[1, 12, 9]} />
      </instancedMesh>
    </group>
  );
}

export function StreetLamps() {
  const poles = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D();
    LAMPS.forEach((l, i) => {
      o.position.set(l.x, 1.1, l.z); o.scale.set(1, 1, 1); o.updateMatrix(); poles.current!.setMatrixAt(i, o.matrix);
      o.position.set(l.x, 2.3, l.z); o.updateMatrix(); heads.current!.setMatrixAt(i, o.matrix);
    });
    poles.current!.instanceMatrix.needsUpdate = true;
    heads.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, LAMPS.length]} material={M.cocoa} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 2.2, 8]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, LAMPS.length]} material={M.lampHead}>
        <sphereGeometry args={[0.24, 14, 12]} />
      </instancedMesh>
    </group>
  );
}

/** 普通建筑：程序化生成的上海生活街屋（石库门、红砖洋房、小公寓、奶油小楼） */
export function Houses() {
  return (
    <group>
      {HOUSES.map((h, i) => (
        <group key={i} position={[h.x, 0, h.z]} rotation-y={h.rot}>
          <HouseModel h={h} />
        </group>
      ))}
    </group>
  );
}

function HouseModel({ h }: { h: House }) {
  const wall = useMemo(() => {
    switch (h.kind) {
      case 'shikumen': return M.stone;
      case 'red_villa': return M.brick;
      case 'apartment': return h.tint > 0.5 ? M.creamDeep : M.haze;
      default: return h.tint > 0.5 ? M.cream : M.sakura;
    }
  }, [h]);
  const rows = Math.max(1, Math.floor((h.h - 0.6) / 1.1));
  return (
    <group>
      <RoundedBox args={[h.w, h.h, h.d]} radius={0.32} smoothness={3} position-y={h.h / 2} material={wall} castShadow receiveShadow />
      {h.kind === 'shikumen' ? (
        <>
          {/* 石库门：深色门框 + 弧形门楣 */}
          <RoundedBox args={[1.1, 1.6, 0.2]} radius={0.06} position={[0, 0.8, h.d / 2]} material={M.cocoa} />
          <mesh position={[0, 1.7, h.d / 2 + 0.02]} rotation-x={Math.PI / 2} material={M.stoneDeep}>
            <cylinderGeometry args={[0.7, 0.7, 0.22, 16, 1, false, -Math.PI / 2, Math.PI]} />
          </mesh>
        </>
      ) : (
        <RoundedBox args={[0.8, 1.2, 0.16]} radius={0.06} position={[0, 0.6, h.d / 2]} material={M.wood} />
      )}
      {Array.from({ length: rows }).map((_, r) =>
        [-1, 1].map((s) => (
          <mesh key={`${r}${s}`} position={[s * h.w * 0.27, 1.6 + r * 1.1, h.d / 2 + 0.01]} material={M.window}>
            <boxGeometry args={[0.6, 0.55, 0.08]} />
          </mesh>
        )),
      )}
      {h.kind === 'red_villa' || h.kind === 'cream_house' ? (
        <mesh position-y={h.h + 0.55} rotation-y={Math.PI / 4} scale={[h.w / 2.6, 0.55, h.d / 2.6]} material={h.kind === 'red_villa' ? M.roofGrey : M.roofRed} castShadow>
          <coneGeometry args={[1.9, 2, 4]} />
        </mesh>
      ) : (
        <RoundedBox args={[h.w + 0.2, 0.3, h.d + 0.2]} radius={0.12} position-y={h.h + 0.05} material={M.roofFlat} />
      )}
    </group>
  );
}
