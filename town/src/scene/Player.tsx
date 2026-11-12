import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, Vector3 } from 'three';
import { Chibi } from './Chibi';
import { BOUNDS, COLLIDERS, streetAt } from './layout';
import { GAME_LANDMARKS, SHOP_LOTS, cityWalkRoute } from '../data/buildings';
import { RESIDENTS } from '../data/seed';
import { lotOf, playerRuntime, residentAnchor, useTown } from '../store/useTown';
import { input } from './input';

const WALK = 4.2;
const RUN = 7.5;
const RADIUS = 0.38;

export function Player() {
  const avatar = useTown((s) => s.avatar)!;
  const group = useRef<Group>(null);
  const moving = useRef(0);
  const happy = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const routeIdx = useRef(0);
  const camDist = useRef(1);
  const lastStreetCheck = useRef(0);
  const lastSave = useRef(0);
  const nearby = useRef<Set<string>>(new Set());
  const { camera, gl } = useThree();
  const camTarget = useRef(new Vector3());

  useEffect(() => {
    playerRuntime.x = avatar.position.x;
    playerRuntime.z = avatar.position.z;
    camTarget.current.set(avatar.position.x, 0, avatar.position.z);
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === ' ') happy.current = -1; // 下一帧开始蹦蹦跳
    };
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    const wheel = (e: WheelEvent) => { camDist.current = Math.max(0.55, Math.min(1.8, camDist.current * (1 + Math.sign(e.deltaY) * 0.08))); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    gl.domElement.addEventListener('wheel', wheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      gl.domElement.removeEventListener('wheel', wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = useTown.getState();
    const k = keys.current;
    let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + input.joyX;
    let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0) + input.joyY;
    const manual = Math.hypot(dx, dz) > 0.1;
    let run = !!k['shift'] || input.run;

    if (manual) {
      if (s.walkTarget || s.autoWalk) s.setAutoWalk(false);
    } else if (s.walkTarget) {
      dx = s.walkTarget.x - playerRuntime.x; dz = s.walkTarget.z - playerRuntime.z;
      if (Math.hypot(dx, dz) < 0.3) { s.setWalkTarget(undefined); dx = dz = 0; }
    } else if (s.autoWalk) {
      const route = cityWalkRoute();
      const t = route[routeIdx.current % route.length];
      dx = t.x - playerRuntime.x; dz = t.z - playerRuntime.z;
      if (Math.hypot(dx, dz) < 0.8) routeIdx.current++;
      run = false;
    }

    const len = Math.hypot(dx, dz);
    const now = state.clock.elapsedTime;
    if (happy.current === -1) happy.current = performance.now() / 1000 + 1.2;
    if (len > 0.05) {
      const speed = (run ? RUN : WALK) * Math.min(1, len);
      let nx = playerRuntime.x + (dx / len) * speed * dt;
      let nz = playerRuntime.z + (dz / len) * speed * dt;
      // 简化碰撞：圆形推开；撞到路灯/树会软软地弹回来
      for (const c of COLLIDERS) {
        const ddx = nx - c.x, ddz = nz - c.z;
        const d = Math.hypot(ddx, ddz);
        const min = c.r + RADIUS;
        if (d < min && d > 1e-4) {
          if (c.soft && now > playerRuntime.bumpUntil) {
            playerRuntime.bumpUntil = now + 0.6;
            nx = c.x + (ddx / d) * (min + 0.45);
            nz = c.z + (ddz / d) * (min + 0.45);
            s.fxPush({ kind: 'bonk', from: { x: nx, z: nz } });
            if (s.walkTarget) s.setWalkTarget(undefined);
          } else {
            nx = c.x + (ddx / d) * min;
            nz = c.z + (ddz / d) * min;
          }
        }
      }
      playerRuntime.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, nx));
      playerRuntime.z = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, nz));
      playerRuntime.heading = Math.atan2(dx, dz);
      moving.current = run ? 2 : 1;
      if (!s.tutorial.walked) s.markWalked();
    } else {
      moving.current = 0;
    }
    playerRuntime.moving = moving.current > 0;

    if (group.current) {
      group.current.position.set(playerRuntime.x, 0, playerRuntime.z);
      const cur = group.current.rotation.y;
      let diff = playerRuntime.heading - cur;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      group.current.rotation.y = cur + diff * Math.min(1, dt * 10);
      const squash = now < playerRuntime.bumpUntil ? 1 - Math.sin((playerRuntime.bumpUntil - now) * 10) * 0.12 : 1;
      group.current.scale.set(1 / squash, squash, 1 / squash);
    }

    // 镜头：微缩模型视角，柔和跟随
    camTarget.current.lerp(new Vector3(playerRuntime.x, 0, playerRuntime.z), Math.min(1, dt * 3));
    const off = new Vector3(0, 28, 21).multiplyScalar(camDist.current);
    camera.position.lerp(camTarget.current.clone().add(off), Math.min(1, dt * 3));
    camera.lookAt(camTarget.current.x, 0.8, camTarget.current.z);

    // 周期性检查：街道名、打卡、偶遇、咖啡香气
    if (now - lastStreetCheck.current > 0.4) {
      lastStreetCheck.current = now;
      s.setStreet(streetAt(playerRuntime));
      for (const b of GAME_LANDMARKS) {
        if (Math.hypot(b.pos.x - playerRuntime.x, b.pos.z - playerRuntime.z) < Math.max(b.footprint.w, b.footprint.d) / 2 + 3) s.visit(b.id);
      }
      for (const r of RESIDENTS) {
        const a = residentAnchor(r);
        const key = `r:${r.id}`;
        const near = Math.hypot(a.x - playerRuntime.x, a.z - playerRuntime.z) < 3.2;
        if (near && !nearby.current.has(key)) { nearby.current.add(key); s.makeFriend(r.id); happy.current = performance.now() / 1000 + 0.9; }
        if (!near) nearby.current.delete(key);
      }
      for (const r of RESIDENTS) {
        if (r.opc?.facade !== 'cafe') continue;
        const lot = SHOP_LOTS.find((l) => l.id === lotOf(r.opc!));
        if (!lot) continue;
        const key = `cafe:${lot.id}`;
        const near = Math.hypot(lot.pos.x - playerRuntime.x, lot.pos.z - playerRuntime.z) < 4;
        if (near && !nearby.current.has(key)) { nearby.current.add(key); s.fxPush({ kind: 'aroma', from: lot.pos }); }
        if (!near) nearby.current.delete(key);
      }
    }
    if (now - lastSave.current > 5) {
      lastSave.current = now;
      useTown.setState((st) => (st.avatar ? { avatar: { ...st.avatar, position: { x: playerRuntime.x, z: playerRuntime.z } } } : {}));
    }
  });

  const walkTarget = useTown((s) => s.walkTarget);
  return (
    <>
      <group ref={group} position={[avatar.position.x, 0, avatar.position.z]}>
        <Chibi look={avatar.look} movingRef={moving} happyRef={happy} />
        <Html position={[0, 2.25, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full bg-almond-300 px-2 py-0.5 text-[11px] font-bold text-cocoa-800 shadow-soft">我 · {avatar.nickname}</div>
        </Html>
      </group>
      {walkTarget && (
        <mesh position={[walkTarget.x, 0.12, walkTarget.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.3, 0.45, 24]} />
          <meshBasicMaterial color="#E8C77A" transparent opacity={0.85} />
        </mesh>
      )}
    </>
  );
}
