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
import { Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { Chibi, GhostChibi } from './Chibi';
import { useServer } from '../store/useServer';
import { cam, camRef, cycleView, zoomBy, CAM_DEFAULT } from './input';
import { useStroll } from '../store/useStroll';
import { dress } from '../domain/identity';
import { compiledOf, navOf, streetOfDoor } from '../world';
import { Zone } from '../world/nav';
import { RESIDENTS } from '../data/seed';
import { playerRuntime, residentAnchor, useTown } from '../store/useTown';
import { input } from './input';
import { crosswalkBusy, hitsCar, pedLight, trafficRuntime } from '../world/traffic';
import { useWork } from '../store/useWork';
import { dist, inOBB, inPolygon } from '../world/geom';

const WALK = 4.4;
const RUN = 7.6;

export function Player() {
  const avatar = useTown((s) => s.avatar)!;
  const licensed = useTown((s) => !!s.myOpc?.license);
  const dressed = dress(avatar.look, avatar.lifeTag, { company: licensed });
  const district = useTown((s) => s.district);
  const walkPath = useTown((s) => s.walkPath);
  const group = useRef<Group>(null);
  const moving = useRef(0);
  const happy = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const tick = useRef(0);
  const lastSave = useRef(0);
  const nearby = useRef<Set<string>>(new Set());
  const pathIdx = useRef(0);
  const lastDoor = useRef<string | null>(null);
  const roadHint = useRef(0);
  const restHint = useRef(0);
  const signalHint = useRef(0);
  const slideMemo = useRef({ side: 0 });
  /** 按着方向却一动不动的时间：超过 0.8 秒就自动脱困 */
  const stuckFor = useRef(0);
  const ghost = useRef<Group | null>(null);
  const ring = useRef<Mesh>(null);
  const plane = useRef<Group>(null);
  const beacon = useRef<Group>(null);
  const { camera, gl } = useThree();
  const camTarget = useRef(new Vector3(avatar.position.x, 0, avatar.position.z));
  const snapCam = useRef(true);

  useEffect(() => { pathIdx.current = 0; }, [walkPath]);
  useEffect(() => {
    playerRuntime.x = avatar.position.x; playerRuntime.z = avatar.position.z;
    camTarget.current.set(avatar.position.x, 0, avatar.position.z);
    snapCam.current = true; // 进入 / 切换街区：镜头直接到位，不从远处飘过来
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === ' ') happy.current = -1;
      if (e.key.toLowerCase() === 'f') playerRuntime.locateAt = performance.now();
      if (e.key.toLowerCase() === 'v') { cycleView(playerRuntime.heading); if (cam.mode !== 'top') cam.yaw = playerRuntime.heading; }
    };
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    const wheel = (e: WheelEvent) => zoomBy(1 + Math.sign(e.deltaY) * 0.08);
    // 双指捏合缩放（手机 / 触控板）
    const touches = new Map<number, { x: number; y: number }>();
    let pinch0 = 0;
    const span = () => { const [a, b] = [...touches.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
    let look: { id: number; x: number; y: number } | null = null;
    const pdown = (e: PointerEvent) => {
      if (cam.mode !== 'top' && touches.size === 0) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { pinch0 = span(); look = null; }
    };
    const pmove = (e: PointerEvent) => {
      if (look && look.id === e.pointerId && cam.mode !== 'top') {
        const dxp = e.clientX - look.x, dyp = e.clientY - look.y;
        look.x = e.clientX; look.y = e.clientY;
        cam.yaw -= dxp * 0.006;
        cam.pitch = Math.max(-0.9, Math.min(0.55, cam.pitch - dyp * 0.004));
      }
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && pinch0 > 0) { const d = span(); if (d > 0) { zoomBy(pinch0 / d); pinch0 = d; } }
    };
    const pup = (e: PointerEvent) => { if (look?.id === e.pointerId) look = null; touches.delete(e.pointerId); pinch0 = touches.size === 2 ? span() : 0; };
    const keyZoom = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') zoomBy(0.88);
      if (e.key === '-' || e.key === '_') zoomBy(1.14);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keydown', keyZoom);
    window.addEventListener('keyup', up);
    const el = gl.domElement;
    el.addEventListener('wheel', wheel, { passive: true });
    el.addEventListener('pointerdown', pdown); el.addEventListener('pointermove', pmove);
    el.addEventListener('pointerup', pup); el.addEventListener('pointercancel', pup);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keydown', keyZoom); window.removeEventListener('keyup', up);
      el.removeEventListener('wheel', wheel); el.removeEventListener('pointerdown', pdown); el.removeEventListener('pointermove', pmove);
      el.removeEventListener('pointerup', pup); el.removeEventListener('pointercancel', pup);
    };
  }, [gl]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = useTown.getState();
    const nav = navOf(s.district);
    if (playerRuntime.teleported) { playerRuntime.teleported = false; camTarget.current.set(playerRuntime.x, 0, playerRuntime.z); snapCam.current = true; }
    // 打个飞的：小飞机载着角色飞（镜头跟着飞）
    const fr = playerRuntime.fly;
    if (fr) {
      const k = Math.min(1, (performance.now() - fr.t0) / fr.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      playerRuntime.x = fr.from.x + (fr.to.x - fr.from.x) * e;
      playerRuntime.z = fr.from.z + (fr.to.z - fr.from.z) * e;
      playerRuntime.flyY = fr.mode === 'arc' ? Math.sin(Math.PI * k) * 7 : fr.mode === 'up' ? e * 16 : (1 - e) * 16;
      if (Math.hypot(fr.to.x - fr.from.x, fr.to.z - fr.from.z) > 0.1) playerRuntime.heading = Math.atan2(fr.to.x - fr.from.x, fr.to.z - fr.from.z);
      if (k >= 1) { playerRuntime.fly = null; playerRuntime.flyY = 0; fr.done?.(); }
      camTarget.current.lerp(new Vector3(playerRuntime.x, 0, playerRuntime.z), 0.35);
    }
    if (happy.current === -1) happy.current = performance.now() / 1000 + 1.2;
    const k = keys.current;
    let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + input.joyX;
    let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0) + input.joyY;
    // Q / E 转身（跟随与第一人称）
    if (cam.mode !== 'top') cam.yaw += ((k['q'] ? 1 : 0) - (k['e'] ? 1 : 0)) * dt * 2.2;
    if (cam.mode !== 'top' && Math.hypot(dx, dz) > 0.1) {
      // 相对视角：前 = 视线方向，右 = 视线右手边
      const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
      const rx = -fz, rz = fx;
      const fwd = -dz, right = dx;
      dx = fx * fwd + rx * right; dz = fz * fwd + rz * right;
    }
    const manual = !fr && Math.hypot(dx, dz) > 0.1;
    if (fr) { dx = 0; dz = 0; }
    const run = !!k['shift'] || input.run;

    if (manual && s.walkPath) s.clearPath();
    if (!manual && !fr && s.walkPath) {
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
      let res = nav.move(from, to, slideMemo.current);
      // 不能穿过车辆：车在斑马线上时会被挡住
      let carBlock = false;
      if (hitsCar(trafficRuntime.tr, res.p)) {
        res = { p: from, hit: true }; carBlock = true;
        if (now > signalHint.current) { signalHint.current = now + 3; s.toast('🚗 车挡在前面，稍等它开走', 'info'); }
      }
      // 过马路看信号灯：红灯不能走上斑马线；没有信号灯的斑马线，有车驶来要先等一等
      let waitSignal = false;
      const cwIdx = nav.cd.crosswalks.findIndex((c) => inOBB(c.box, res.p, 0.05));
      if (cwIdx >= 0 && !inOBB(nav.cd.crosswalks[cwIdx].box, from, 0.05)) {
        const sig = pedLight(trafficRuntime.tr, cwIdx);
        const busy = sig === 'none' && crosswalkBusy(trafficRuntime.tr, nav.cd.crosswalks[cwIdx].box, 9);
        if (sig === 'stop' || busy) {
          res = { p: from, hit: true }; waitSignal = true;
          if (now > signalHint.current) { signalHint.current = now + 3; s.toast(sig === 'stop' ? '🚦 红灯，请等行人绿灯再过马路' : '🚗 有车驶来，稍等再过', 'info'); }
        }
      }
      if (res.hit && manual && now > playerRuntime.bumpUntil) {
        const z = nav.zoneAt(to);
        if (z === Zone.Obstacle) { playerRuntime.bumpUntil = now + 0.7; s.fxPush({ kind: 'bonk', from: to }); }
        if (z === Zone.Road && now > roadHint.current) { roadHint.current = now + 4; s.toast('这里是机动车道，请从斑马线过马路', 'info'); }
      }
      // 脱困：一直按着方向却没有移动（被树、路灯、栏杆夹住）→ 往按的方向找最近的可走点，挪过去
      const movedBy = Math.hypot(res.p.x - from.x, res.p.z - from.z);
      // 等红灯、等车开走不算卡住（不能借脱困穿过斑马线或车）
      stuckFor.current = movedBy < speed * dt * 0.08 && res.hit && !carBlock && !waitSignal ? stuckFor.current + dt : 0;
      if (stuckFor.current > 0.8) {
        stuckFor.current = 0;
        const out = nav.unstick(from, dx / len, dz / len);
        if (out && !hitsCar(trafficRuntime.tr, out) && !nav.cd.crosswalks.some((c) => inOBB(c.box, out, 0.05))) { res = { p: out, hit: false }; slideMemo.current = { side: 0 }; }
      }
      playerRuntime.x = res.p.x; playerRuntime.z = res.p.z;
      playerRuntime.heading = Math.atan2(dx, dz);
      // 被车挡住、或者红灯等着：原地站着（不再“原地踏步”）
      moving.current = carBlock || (res.hit && Math.hypot(res.p.x - from.x, res.p.z - from.z) < 1e-4) ? 0 : run ? 2 : 1;
      if (!s.tutorial.walked) s.markWalked();
    } else { moving.current = 0; stuckFor.current = 0; }
    playerRuntime.moving = moving.current > 0;

    if (group.current) {
      group.current.position.set(playerRuntime.x, 0.16 + playerRuntime.flyY, playerRuntime.z);
      if (plane.current) { plane.current.visible = !!playerRuntime.fly; const sp = plane.current.getObjectByName('prop'); if (sp) sp.rotation.z += dt * 40; }
      let diff = playerRuntime.heading - group.current.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      group.current.rotation.y += diff * Math.min(1, dt * 10);
      const sq = now < playerRuntime.bumpUntil ? 1 - Math.sin((playerRuntime.bumpUntil - now) * 9) * 0.1 : 1;
      group.current.scale.set(1 / sq, sq, 1 / sq);
    }

    // 「找到我」：镜头立即回到角色身上，脚下光圈放大闪烁，头顶出现大箭头
    const sinceLocate = (performance.now() - playerRuntime.locateAt) / 1000;
    if (sinceLocate < 0.1) { camTarget.current.set(playerRuntime.x, 0, playerRuntime.z); cam.dist = CAM_DEFAULT; }
    const pulse = sinceLocate < 3 ? 1 + Math.abs(Math.sin(sinceLocate * 6)) * 1.6 : 1 + Math.sin(now * 3) * 0.08;
    if (ring.current) ring.current.visible = cam.mode === 'top' || sinceLocate < 3;
    if (ring.current) { ring.current.scale.setScalar(pulse); (ring.current.material as MeshBasicMaterial).opacity = sinceLocate < 3 ? 1 : 0.85; }
    if (beacon.current) { beacon.current.visible = sinceLocate < 3.5; beacon.current.position.y = 3.6 + Math.abs(Math.sin(now * 5)) * 0.6; }
    // 镜头
    camRef.current = camera;
    camTarget.current.lerp(new Vector3(playerRuntime.x, 0, playerRuntime.z), Math.min(1, dt * (cam.mode === 'top' ? 3 : 10)));
    const fpMode = cam.mode === 'fp' && !playerRuntime.fly;
    if (group.current) group.current.visible = !fpMode;
    if (cam.mode === 'top' || playerRuntime.fly) {
      // 俯视约 55°，柔和跟随
      const off = new Vector3(0, 44, 18).multiplyScalar(cam.dist);
      if (snapCam.current) { camTarget.current.set(playerRuntime.x, 0, playerRuntime.z); camera.position.copy(camTarget.current).add(off); snapCam.current = false; }
      camera.position.lerp(camTarget.current.clone().add(off), Math.min(1, dt * 3));
      camera.lookAt(camTarget.current.x, 0.8 + playerRuntime.flyY * 0.6, camTarget.current.z);
    } else {
      // 随便逛逛：镜头慢慢转到角色前进的方向（电影感），到站时转向要看的地方
      if (useStroll.getState().active) {
        let dy = playerRuntime.heading - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        cam.yaw += dy * Math.min(1, dt * 1.6);
      }
      const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      // 走路时镜头轻微起伏（第一人称更明显），站定时平稳
      const bob = moving.current ? Math.sin(now * (moving.current === 2 ? 13 : 9)) * (fpMode ? 0.045 : 0.02) : 0;
      if (fpMode) {
        const eye = new Vector3(camTarget.current.x + fx * 0.12, 1.32 + bob, camTarget.current.z + fz * 0.12);
        camera.position.lerp(eye, Math.min(1, dt * 18));
        camera.lookAt(eye.x + fx * cp * 10, eye.y + sp * 10, eye.z + fz * cp * 10);
        // 第一人称：没有在走的时候，身体朝向视线
        if (!moving.current) playerRuntime.heading = cam.yaw;
      } else {
        // 跟随：在角色身后偏上；如果和角色之间隔着楼，镜头自动拉近，不会穿进墙里
        const want = 6.8 * Math.max(0.55, Math.min(1.6, cam.dist));
        const cd = compiledOf(s.district);
        let back = want;
        for (let d = 0.8; d <= want; d += 0.4) {
          const p = { x: camTarget.current.x - fx * d, z: camTarget.current.z - fz * d };
          if (cd.def.buildings.some((b) => (b.polygon ? inPolygon(b.polygon, p) : inOBB(b.box!, p, 0.3)))
            || cd.props.some((t) => t.kind === 'tree' && dist(t.p, p) < 0.7 * (t.scale ?? 1))) { back = Math.max(0.8, d - 0.4); break; }
        }
        let h = 2.9 - sp * back * 0.8;
        // 镜头位置落在树冠里（树冠大约 2.4 米以上、半径约 2.2）：降到树冠下面，从树下拍过去
        const cpos = { x: camTarget.current.x - fx * back * cp - fz * 0.9, z: camTarget.current.z - fz * back * cp + fx * 0.9 };
        // 镜头到角色的视线穿过树冠（不只是镜头本身在树冠里）也降下来
        const crownHit = (k: number) => { const q = { x: camTarget.current.x + (cpos.x - camTarget.current.x) * k, z: camTarget.current.z + (cpos.z - camTarget.current.z) * k }; return cd.props.some((t) => t.kind === 'tree' && dist(t.p, q) < 2.9 * (t.scale ?? 1)); };
        if ([0.35, 0.55, 0.75, 1].some(crownHit)) h = Math.min(h, 2.4);
        // 过肩：镜头稍微偏到角色右后方，画面中间留给前方的街道
        const rx = -fz * 0.9, rz = fx * 0.9;
        const pos = new Vector3(camTarget.current.x - fx * back * cp + rx, Math.max(0.6, h) + bob, camTarget.current.z - fz * back * cp + rz);
        camera.position.lerp(pos, Math.min(1, dt * 8));
        camera.lookAt(camTarget.current.x + fx * 7 + rx * 0.5, 1.4 + sp * 6, camTarget.current.z + fz * 7 + rz * 0.5);
      }
    }

    if (now - tick.current > 0.3) {
      tick.current = now;
      s.setStreet(streetOfDoor(s.district, playerRuntime));
      // 进门：站到门口触发点
      const cd = compiledOf(s.district);
      const door = cd.doors.find((d) => dist(d.trigger, playerRuntime) < 0.75);
      // 站在门口时，不管信息牌是走过来触发的还是「打个飞的」/ 搜索打开的，都算这扇门已经处理过：
      // 关掉信息牌后不会立刻又弹出来，离开门口再回来才会再弹
      if (door && (s.card || s.chatOpc || useServer.getState().shopView)) lastDoor.current = door.id;
      // 打工：取货 / 送达 / 到店帮工（路过别的店弹出的名片不影响送货）
      if (door && door.id !== lastDoor.current && door.lotId && useWork.getState().active && useWork.getState().arrive(door.lotId)) {
        lastDoor.current = door.id;
        if (s.card) s.openCard(undefined);
        if (s.chatOpc) s.openChat(undefined);
      } else if (door && door.id !== lastDoor.current && !s.chatOpc && !s.card) {
        lastDoor.current = door.id;
        if (door.lotId) s.enterLot(door.lotId);
        else if (door.label) {
          const b = cd.def.buildings.find((x) => x.id === door.buildingId);
          if (b?.archiveId) { s.openCard({ kind: 'landmark', id: b.archiveId }); s.visit(b.archiveId); }
          else s.openCard({ kind: 'door', label: door.label });
        }
      }
      if (!door) lastDoor.current = null;
      // 在公园里歇一歇：站着不动时慢慢恢复体力
      const inPark = cd.parks.find((pk) => inOBB(pk.box, playerRuntime));
      if (inPark && !playerRuntime.moving) {
        const w = useWork.getState();
        if (w.purse.stamina < 100) {
          w.restTick(0.3);
          if (now > restHint.current) { restHint.current = now + 30; s.toast(`在${inPark.label.replace(/（.*?）/g, '')}歇一会儿，体力慢慢恢复 ⚡`, 'info'); }
        }
      }
      // 被建筑或树冠挡住了吗？沿视线（每向镜头方向 1 个单位升高约 1.8）检查建筑占地与高度、行道树树冠
      if (ghost.current) {
        let hidden = false;
        for (let d = 1; d <= 16 && !hidden; d += 0.8) {
          const p = { x: playerRuntime.x, z: playerRuntime.z + d * 0.48 };
          const h = 1.2 + d * 0.48 * 1.82;
          hidden = cd.def.buildings.some((b) => (b.polygon ? inPolygon(b.polygon, p) : inOBB(b.box!, p)) && (b.kind === 'wukang_mansion' ? 26 : b.floors * 3 + 2.5) > h);
        }
        if (!hidden) {
          // 树冠大约在 2.4–6.5 高、半径约 2：视线在这一高度段经过树冠就算被挡住
          hidden = cd.props.some((t) => {
            if (t.kind !== 'tree') return false;
            const dz = t.p.z - playerRuntime.z, dx = Math.abs(t.p.x - playerRuntime.x);
            const sc = t.scale ?? 1;
            return dx < 2.6 * sc && dz > -1.2 && dz < 6.2 * sc;
          });
        }
        ghost.current.visible = hidden && cam.mode === 'top';
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
        <Chibi look={dressed} movingRef={moving} happyRef={happy} />
        <group ref={plane} visible={false}><LittlePlane /></group>
        <GhostChibi look={dressed} movingRef={moving} happyRef={happy} groupRef={ghost} />
        {/* 脚下定位光圈：永远画在最上层，被树和楼挡住也能看到自己在哪 */}
        <mesh ref={ring} position-y={0.05} rotation-x={-Math.PI / 2} renderOrder={1000}>
          <ringGeometry args={[0.62, 0.86, 40]} />
          <meshBasicMaterial color="#FF6A00" transparent opacity={0.85} depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
        </mesh>
        <group ref={beacon} visible={false}>
          <mesh rotation-x={Math.PI} renderOrder={1001}>
            <coneGeometry args={[0.55, 1.1, 4]} />
            <meshBasicMaterial color="#FF8A3D" depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
          </mesh>
        </group>
        <Html position={[0, 2.3, 0]} center zIndexRange={[18, 0]} style={{ pointerEvents: 'none' }}>
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

/** 小飞机（软萌粉白配色）：角色坐在机身上，螺旋桨转动 */
function LittlePlane() {
  return (
    <group position={[0, 0.15, 0]}>
      <mesh rotation-x={Math.PI / 2} position-z={0.1}><capsuleGeometry args={[0.38, 1.3, 8, 16]} /><meshStandardMaterial color="#FFF6EA" roughness={0.6} /></mesh>
      <mesh position={[0, 0.02, 0.15]}><boxGeometry args={[2.6, 0.08, 0.6]} /><meshStandardMaterial color="#F07FAF" roughness={0.6} /></mesh>
      <mesh position={[0, 0.05, -0.75]}><boxGeometry args={[1.0, 0.06, 0.32]} /><meshStandardMaterial color="#F07FAF" roughness={0.6} /></mesh>
      <mesh position={[0, 0.35, -0.8]}><boxGeometry args={[0.06, 0.5, 0.3]} /><meshStandardMaterial color="#3D7BD8" roughness={0.6} /></mesh>
      <group name="prop" position={[0, 0, 1.0]}>
        <mesh><boxGeometry args={[0.9, 0.08, 0.04]} /><meshStandardMaterial color="#4A3426" /></mesh>
        <mesh rotation-z={Math.PI / 2}><boxGeometry args={[0.9, 0.08, 0.04]} /><meshStandardMaterial color="#4A3426" /></mesh>
      </group>
      <mesh position={[0, 0, 0.98]} rotation-x={Math.PI / 2}><coneGeometry args={[0.16, 0.25, 12]} /><meshStandardMaterial color="#D9A62E" /></mesh>
    </group>
  );
}
