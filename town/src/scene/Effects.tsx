import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import { CatmullRomCurve3, Group, QuadraticBezierCurve3, Vector3, MeshStandardMaterial, Color } from 'three';
import { useTown, residentAnchor, myAnchor, playerRuntime, type Fx } from '../store/useTown';
import { residentById } from '../data/seed';

/** 软萌反馈：小爱心、奶油信封、握手、金币星星、咖啡香气、啵！ */
export function Effects() {
  const fx = useTown((s) => s.fx);
  return <group>{fx.map((f) => <One key={f.id} f={f} />)}</group>;
}

function One({ f }: { f: Fx }) {
  switch (f.kind) {
    case 'envelope': return <Envelope f={f} />;
    case 'coins': return <Coins f={f} />;
    default: return <Floater f={f} />;
  }
}

const FLOAT: Record<string, { text: string; cls: string }> = {
  heart: { text: '💗', cls: 'text-2xl' },
  handshake: { text: '🤝', cls: 'text-3xl' },
  aroma: { text: '☕ 咖啡香～', cls: 'text-sm font-bold text-cocoa-600 bg-cream-50/90 rounded-full px-2 py-0.5' },
  bonk: { text: '啵！', cls: 'text-sm font-black text-brick-500' },
  door: { text: '🔔 叮咚', cls: 'text-xs font-bold text-cocoa-600 bg-cream-50/90 rounded-full px-2 py-0.5' },
};

function Floater({ f }: { f: Fx }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    const t = (performance.now() - f.at) / 1000;
    if (!g.current) return;
    const base = f.kind === 'handshake' ? { x: playerRuntime.x, z: playerRuntime.z } : f.from;
    g.current.position.set(base.x + (f.kind === 'aroma' ? Math.sin(t * 3) * 0.4 : 0), 2.4 + t * 0.9, base.z);
  });
  const c = FLOAT[f.kind];
  return (
    <group ref={g}>
      <Html center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`fx-pop whitespace-nowrap ${c.cls}`}>{c.text}</div>
      </Html>
    </group>
  );
}

/** 奶油信封：沿弧线飞向对方 */
function Envelope({ f }: { f: Fx }) {
  const g = useRef<Group>(null);
  const curve = useMemo(() => {
    const a = new Vector3(f.from.x, 1.6, f.from.z);
    const to = f.to ?? { x: f.from.x + 6, z: f.from.z - 6 };
    const b = new Vector3(to.x, 1.6, to.z);
    const mid = a.clone().lerp(b, 0.5); mid.y += Math.max(4, a.distanceTo(b) * 0.35);
    return new QuadraticBezierCurve3(a, mid, b);
  }, [f]);
  useFrame(() => {
    const t = Math.min(1, (performance.now() - f.at) / 1800);
    if (!g.current) return;
    const p = curve.getPoint(t);
    g.current.position.copy(p);
    g.current.rotation.set(Math.sin(t * 12) * 0.3, t * 8, Math.cos(t * 10) * 0.2);
    const sc = t > 0.92 ? (1 - t) / 0.08 : 1;
    g.current.scale.setScalar(Math.max(0.01, sc));
  });
  return (
    <group ref={g}>
      <RoundedBox args={[0.9, 0.6, 0.12]} radius={0.06}>
        <meshStandardMaterial color="#FFF6E4" roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0.06, 0.07]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.42, 0.42, 0.02]} />
        <meshStandardMaterial color="#F4EBDA" />
      </mesh>
      <mesh position={[0, -0.02, 0.09]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#E6A3A7" />
      </mesh>
    </group>
  );
}

const coinMat = new MeshStandardMaterial({ color: '#E8C77A', roughness: 0.35, metalness: 0.3, emissive: new Color('#D9AE55'), emissiveIntensity: 0.3 });
const starMat = new MeshStandardMaterial({ color: '#FFF1B8', emissive: new Color('#FFE38A'), emissiveIntensity: 0.8 });

/** 完成交易 / 开张：店铺上空的金币与小星星 */
function Coins({ f }: { f: Fx }) {
  const parts = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2, v: 2.5 + (i % 4) * 0.6, star: i % 3 === 0 })), []);
  const g = useRef<Group>(null);
  useFrame(() => {
    const t = (performance.now() - f.at) / 1000;
    g.current?.children.forEach((c, i) => {
      const p = parts[i];
      c.position.set(Math.cos(p.a) * t * 1.4, 3 + p.v * t - 2.5 * t * t, Math.sin(p.a) * t * 1.4);
      c.rotation.y = t * 8;
    });
  });
  return (
    <group ref={g} position={[f.from.x, 0, f.from.z]}>
      {parts.map((p, i) => (
        <mesh key={i} material={p.star ? starMat : coinMat} rotation-x={Math.PI / 2}>
          {p.star ? <octahedronGeometry args={[0.18]} /> : <cylinderGeometry args={[0.2, 0.2, 0.06, 16]} />}
        </mesh>
      ))}
    </group>
  );
}

/** 商业连接线：预约见面后，双方店铺之间出现柔软发光的线（同一街区内显示） */
export function ConnectionLines() {
  const intros = useTown((s) => s.intros);
  const myOpc = useTown((s) => s.myOpc);
  const avatar = useTown((s) => s.avatar);
  const district = useTown((s) => s.district);
  const links = intros.filter((i) => ['meeting_booked', 'collab_proposed', 'collab_confirmed', 'contact_exchanged', 'accepted'].includes(i.status));
  const me = myAnchor({ myOpc, avatar });
  return (
    <group>
      {links.map((l) => {
        const other = residentById(l.fromUserId === 'me' ? l.toUserId : l.fromUserId);
        if (!other || !me) return null;
        const o = residentAnchor(other);
        const strong = ['meeting_booked', 'collab_proposed', 'collab_confirmed'].includes(l.status);
        if (o.district !== district) return null;
        const from = me.district === district ? me.p : { x: o.p.x - 14, z: o.p.z - 14 };
        return <Glow key={l.id} from={from} to={o.p} strong={strong} confirmed={l.status === 'collab_confirmed'} />;
      })}
    </group>
  );
}

function Glow({ from, to, strong, confirmed }: { from: { x: number; z: number }; to: { x: number; z: number }; strong: boolean; confirmed: boolean }) {
  const curve = useMemo(() => {
    const a = new Vector3(from.x, 3.2, from.z);
    const b = new Vector3(to.x, 3.2, to.z);
    const mid = a.clone().lerp(b, 0.5); mid.y += Math.max(3, a.distanceTo(b) * 0.25);
    return new CatmullRomCurve3(new QuadraticBezierCurve3(a, mid, b).getPoints(40));
  }, [from.x, from.z, to.x, to.z]);
  const mat = useMemo(() => new MeshStandardMaterial({
    color: confirmed ? '#F2D99B' : strong ? '#F7DCDD' : '#DCE6EE',
    emissive: new Color(confirmed ? '#E8C77A' : strong ? '#E6A3A7' : '#9DB6CA'),
    emissiveIntensity: 1, transparent: true, opacity: strong ? 0.9 : 0.5, roughness: 0.3,
  }), [strong, confirmed]);
  const dot = useRef<Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    mat.emissiveIntensity = 0.8 + Math.sin(t * 2.5) * 0.4;
    if (dot.current) dot.current.position.copy(curve.getPoint((t * 0.25) % 1));
  });
  return (
    <group>
      <mesh material={mat}>
        <tubeGeometry args={[curve, 80, strong ? 0.12 : 0.06, 10, false]} />
      </mesh>
      {strong && (
        <group ref={dot}>
          <mesh><sphereGeometry args={[0.22, 16, 16]} /><meshBasicMaterial color="#FFF6E4" /></mesh>
        </group>
      )}
    </group>
  );
}
