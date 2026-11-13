/**
 * 地图边缘的下穿隧道口：道路不会在地图边上“断掉”，车辆驶进隧道、再从别的隧道口驶出。
 * 洞口朝向街区内侧，顶部是覆土绿化，向地图外延伸成一片缓坡。
 */
import { useMemo } from 'react';
import { TUNNEL, type CompiledDistrict } from '../world/build';
import { signTex } from './textures';

export function Tunnels({ cd }: { cd: CompiledDistrict }) {
  return <group>{cd.tunnels.map((t, i) => <Portal key={i} t={t} />)}</group>;
}

function Portal({ t }: { t: CompiledDistrict['tunnels'][number] }) {
  const W = t.width, D = TUNNEL + 0.6, H = 4.6;
  const label = useMemo(() => signTex(`${t.road.name.replace('（示意）', '')} · 隧道`, '#2F5D8A', '#FFFFFF', 512, 96), [t.road.name]);
  // 本地坐标：+z 指向地图外，洞口在 z = -D/2
  return (
    <group position={[t.box.cx, 0, t.box.cz]} rotation-y={Math.atan2(t.out.x, t.out.z)}>
      {/* 侧墙 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.45), H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.9, H, D]} /><meshStandardMaterial color="#B9B2A6" roughness={0.9} />
        </mesh>
      ))}
      {/* 顶板 + 洞口过梁 */}
      <mesh position={[0, H + 0.35, 0]} castShadow receiveShadow><boxGeometry args={[W, 0.7, D]} /><meshStandardMaterial color="#C9C2B6" roughness={0.9} /></mesh>
      <mesh position={[0, H - 0.25, -D / 2 + 0.3]}><boxGeometry args={[W, 0.9, 0.6]} /><meshStandardMaterial color="#D8D1C4" roughness={0.85} /></mesh>
      {/* 洞内：深色吊顶与内壁（车辆进入后看不见） */}
      <mesh position={[0, H - 0.72, 0.4]} rotation-x={Math.PI / 2}><planeGeometry args={[W - 1.8, D - 0.6]} /><meshBasicMaterial color="#121418" /></mesh>
      <mesh position={[0, H / 2, D / 2 - 0.05]}><planeGeometry args={[W, H]} /><meshBasicMaterial color="#0B0C0F" /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={`in${s}`} position={[s * (W / 2 - 0.92), H / 2, 0.4]} rotation-y={-s * Math.PI / 2}><planeGeometry args={[D - 0.6, H]} /><meshBasicMaterial color="#1A1C21" /></mesh>
      ))}
      {/* 隧道灯带 */}
      {[-1, 1].map((s) => (
        <mesh key={`l${s}`} position={[s * (W / 2 - 1), H - 1.1, 0.4]}><boxGeometry args={[0.08, 0.08, D - 1.2]} /><meshStandardMaterial color="#FFE7B0" emissive="#FFD58A" emissiveIntensity={1.6} /></mesh>
      ))}
      {/* 洞口名牌 */}
      <mesh position={[0, H - 0.25, -D / 2 - 0.02]} rotation-y={Math.PI}><planeGeometry args={[Math.min(W - 2, 9), 0.7]} /><meshBasicMaterial map={label} toneMapped={false} /></mesh>
      {/* 覆土绿化与向外延伸的缓坡 */}
      <mesh position={[0, H + 0.9, 0]} receiveShadow><boxGeometry args={[W + 0.4, 0.4, D]} /><meshStandardMaterial color="#8FB46E" roughness={1} /></mesh>
      <mesh position={[0, H / 2 + 0.6, D / 2 + 9]} receiveShadow><boxGeometry args={[W + 0.4, H + 1.2, 18]} /><meshStandardMaterial color="#86AC66" roughness={1} /></mesh>
      {[-W / 2 + 1.2, -W / 4, 0.3, W / 4, W / 2 - 1.2].map((x, i) => (
        <mesh key={`b${i}`} position={[x, H + 1.5, (i % 2 ? 0.8 : -0.6)]} castShadow><sphereGeometry args={[0.75 + (i % 3) * 0.15, 10, 8]} /><meshStandardMaterial color={i % 2 ? '#6E9A52' : '#7FAA5E'} roughness={1} /></mesh>
      ))}
    </group>
  );
}
