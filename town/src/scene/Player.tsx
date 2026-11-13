/**
 * 玩家角色控制器：
 * - 键盘 / 摇杆移动时，每一步都经过导航网格校验：不能穿墙、穿树、穿花坛，不能离开人行道走上机动车道，
 *   只能从斑马线过街；被挡住时沿墙滑动，撞到路灯 / 树会软软地弹一下（但不会穿模）。
 * - 点击地面：A* 寻路，沿人行道和斑马线走过去。
 * - 走到店门口的触发点才算“进店”。
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, Vector3 } from 'three';
import { Chibi, GhostChibi } from './Chibi';
import { compiledOf, navOf, streetOfDoor } from '../world';
import { Zone } from '../world/nav';
import { RESIDENTS } from '../data/seed';
import { playerRuntime, residentAnchor, useTown } from '../store/useTown';
import { input } from './input';
import { hitsCar, trafficRuntime } from '../world/traffic';
import { dist, inOBB, inPolygon } from '../world/geom';

const WALK = 4.4;
const RUN = 7.6;

export function Player() {
  const avatar = useTown((s) => s.avatar)!;
  const district = useTown((s) => s.district);
  const walkPath = useTown((s) => s.walkPath);
  const group = useRef<Group>(null);
  const moving = useRef(0);
  const happy = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const camDist = useRef(1);
  const tick = useRef(0);
  const lastSave = useRef(0);
  const nearby = useRef<Set<string>>(new Set());
  const pathIdx = useRef(0);
  const lastDoor = useRef<string | null>(null);
  const roadHint = useRef(0);
  const ghost = useRef<Group | null>(null);
  const { camera, gl } = useThree();
  const camTarget = useRef(new Vector3(avatar.position.x, 0, avatar.position.z));

  useEffect(() => { pathIdx.current = 0; }, [walkPath]);
  useEffect(() => {
    playerRuntime.x = avatar.position.x; playerRuntime.z = avatar.position.z;
    camTarget.current.set(avatar.position.x, 0, avatar.position.z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === ' ') happy.current = -1;
    };
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    const wheel = (e: WheelEvent) => { camDist.current = Math.max(0.5, Math.min(1.7, camDist.current * (1 + Math.sign(e.deltaY) * 0.08))); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    gl.domElement.addEventListener('wheel', wheel, { passive: true });
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); gl.domElement.removeEventListener('wheel', wheel); };
  }, [gl]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = useTown.getState();
    const nav = navOf(s.district);
    if (playerRuntime.teleported) { playerRuntime.teleported = false; camTarget.current.set(playerRuntime.x, 0, playerRuntime.z); }
    if (happy.current === -1) happy.current = performance.now() / 1000 + 1.2;
    const k = keys.current;
    let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + input.joyX;
    let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0) + input.joyY;
    const manual = Math.hypot(dx, dz) > 0.1;
    const run = !!k['shift'] || input.run;

    if (manual && s.walkPath) s.clearPath();
    if (!manual && s.walkPath) {
      const tgt = s.walkPath[Math.min(pathIdx.current, s.walkPath.length - 1)];
      dx = tgt.x - playerRuntime.x; dz = tgt.z - playerRuntime.z;
      if (Math.hypot(dx, dz) < 0.25) {
        pathIdx.current++;
        if (pathIdx.current >= s.walkPath.length) { s.clearPath(); dx = dz = 0; }
      }
    }
    const len = Math.hypot(dx, dz);
    const now = state.clock.elapsedTime;
    if (len > 0.05) {
      const speed = (run ? RUN : WALK) * Math.min(1, len);
      const from = { x: playerRuntime.x, z: playerRuntime.z };
      const to = { x: from.x + (dx / len) * speed * dt, z: from.z + (dz / len) * speed * dt };
      let res = nav.move(from, to);
      // 不能穿过车辆：车在斑马线上时会被挡住
      if (hitsCar(trafficRuntime.tr, res.p)) res = { p: from, hit: true };
      if (res.hit && manual && now > playerRuntime.bumpUntil) {
        const z = nav.zoneAt(to);
        if (z === Zone.Obstacle) { playerRuntime.bumpUntil = now + 0.7; s.fxPush({ kind: 'bonk', from: to }); }
        if (z === Zone.Road && now > roadHint.current) { roadHint.current = now + 4; s.toast('这里是机动车道，请从斑马线过马路', 'info'); }
      }
      playerRuntime.x = res.p.x; playerRuntime.z = res.p.z;
      playerRuntime.heading = Math.atan2(dx, dz);
      moving.current = run ? 2 : 1;
      if (!s.tutorial.walked) s.markWalked();
    } else moving.current = 0;
    playerRuntime.moving = moving.current > 0;

    if (group.current) {
      group.current.position.set(playerRuntime.x, 0.16, playerRuntime.z);
      let diff = playerRuntime.heading - group.current.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      group.current.rotation.y += diff * Math.min(1, dt * 10);
      const sq = now < playerRuntime.bumpUntil ? 1 - Math.sin((playerRuntime.bumpUntil - now) * 9) * 0.1 : 1;
      group.current.scale.set(1 / sq, sq, 1 / sq);
    }

    // 镜头：俯视约 55°，柔和跟随
    camTarget.current.lerp(new Vector3(playerRuntime.x, 0, playerRuntime.z), Math.min(1, dt * 3));
    const off = new Vector3(0, 40, 22).multiplyScalar(camDist.current);
    camera.position.lerp(camTarget.current.clone().add(off), Math.min(1, dt * 3));
    camera.lookAt(camTarget.current.x, 0.8, camTarget.current.z);

    if (now - tick.current > 0.3) {
      tick.current = now;
      s.setStreet(streetOfDoor(s.district, playerRuntime));
      // 进门：站到门口触发点
      const cd = compiledOf(s.district);
      const door = cd.doors.find((d) => dist(d.trigger, playerRuntime) < 0.75);
      if (door && door.id !== lastDoor.current && !s.chatOpc && !s.card) {
        lastDoor.current = door.id;
        if (door.lotId) s.enterLot(door.lotId);
        else if (door.label) {
          const b = cd.def.buildings.find((x) => x.id === door.buildingId);
          if (b?.archiveId) { s.openCard({ kind: 'landmark', id: b.archiveId }); s.visit(b.archiveId); }
          else s.openCard({ kind: 'door', label: door.label });
        }
      }
      if (!door) lastDoor.current = null;
      // 被建筑挡住了吗？沿视线（每向镜头方向 1 个单位升高约 1.8）检查建筑占地与高度
      if (ghost.current) {
        let hidden = false;
        for (let d = 1; d <= 16 && !hidden; d += 0.8) {
          const p = { x: playerRuntime.x, z: playerRuntime.z + d * 0.48 };
          const h = 1.2 + d * 0.48 * 1.82;
          hidden = cd.def.buildings.some((b) => (b.polygon ? inPolygon(b.polygon, p) : inOBB(b.box!, p)) && (b.kind === 'wukang_mansion' ? 11 : b.floors * 1.35 + 2) > h);
        }
        ghost.current.visible = hidden;
      }
      // 靠近地标打卡
      for (const b of cd.def.buildings.filter((x) => x.archiveId)) {
        const c = b.polygon ? b.polygon[4] : { x: b.box!.cx, z: b.box!.cz };
        if (dist(c, playerRuntime) < 14) s.visit(b.archiveId!);
      }
      // 偶遇
      for (const r of RESIDENTS) {
        if (r.district !== s.district) continue;
        const a = residentAnchor(r).p;
        const key = r.id, near = dist(a, playerRuntime) < 3;
        if (near && !nearby.current.has(key)) { nearby.current.add(key); s.makeFriend(r.id); happy.current = performance.now() / 1000 + 0.9; }
        if (!near) nearby.current.delete(key);
      }
    }
    if (now - lastSave.current > 4) {
      lastSave.current = now;
      useTown.setState((st) => (st.avatar ? { avatar: { ...st.avatar, position: { x: playerRuntime.x, z: playerRuntime.z } } } : {}));
    }
  });

  return (
    <>
      <group ref={group} position={[avatar.position.x, 0.16, avatar.position.z]}>
        <Chibi look={avatar.look} movingRef={moving} happyRef={happy} />
        <GhostChibi look={avatar.look} movingRef={moving} happyRef={happy} groupRef={ghost} />
        <Html position={[0, 2.3, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full bg-almond-300 px-2 py-0.5 text-[11px] font-bold text-cocoa-800 shadow-soft">我 · {avatar.nickname}</div>
        </Html>
      </group>
      {walkPath && walkPath.length > 0 && <PathDots path={walkPath} />}
    </>
  );
}

function PathDots({ path }: { path: { x: number; z: number }[] }) {
  const pts: { x: number; z: number }[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const L = dist(a, b);
    for (let s = 0; s < L; s += 1.1) pts.push({ x: a.x + ((b.x - a.x) * s) / L, z: a.z + ((b.z - a.z) * s) / L });
  }
  const end = path[path.length - 1];
  return (
    <group>
      {pts.map((p, i) => (
        <mesh key={i} position={[p.x, 0.2, p.z]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.12, 10]} /><meshBasicMaterial color="#E8C77A" /></mesh>
      ))}
      <mesh position={[end.x, 0.21, end.z]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.3, 0.45, 24]} /><meshBasicMaterial color="#E8C77A" /></mesh>
    </group>
  );
}
