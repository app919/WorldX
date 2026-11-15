/**
 * 雨雪粒子：跟着角色周围下（只在雨天 / 雪天出现）；阴天只改光照（见 CityScene 的 DayNight）。
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, type LineSegments, type Points } from 'three';
import { useTown, playerRuntime } from '../store/useTown';
import { useWeather } from '../store/useWeather';
import { cityOfDistrict } from '../domain/cities';
import { LOW_GFX } from './quality';

const R = 40, TOP = 26;

export function WeatherFx() {
  const district = useTown((s) => s.district);
  const kind = useWeather((s) => s.cities[cityOfDistrict(district).id] ?? 'sunny');
  if (kind === 'rain') return <Rain />;
  if (kind === 'snow') return <Snow />;
  return null;
}

function seedPositions(n: number) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 2 * R; a[i * 3 + 1] = Math.random() * TOP; a[i * 3 + 2] = (Math.random() - 0.5) * 2 * R; }
  return a;
}

function Rain() {
  const n = LOW_GFX ? 500 : 1400;
  const base = useMemo(() => seedPositions(n), [n]);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 6), 3));
    return g;
  }, [n]);
  const ref = useRef<LineSegments>(null);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const pos = geo.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < n; i++) {
      let y = base[i * 3 + 1] - dt * 28;
      if (y < 0) y += TOP;
      base[i * 3 + 1] = y;
      const x = base[i * 3] + playerRuntime.x, z = base[i * 3 + 2] + playerRuntime.z;
      pos.setXYZ(i * 2, x, y, z);
      pos.setXYZ(i * 2 + 1, x + 0.08, y + 0.9, z + 0.05);
    }
    pos.needsUpdate = true;
  });
  return (
    <lineSegments ref={ref} geometry={geo} frustumCulled={false}>
      <lineBasicMaterial color="#C9D6E2" transparent opacity={0.55} />
    </lineSegments>
  );
}

function Snow() {
  const n = LOW_GFX ? 500 : 1200;
  const base = useMemo(() => seedPositions(n), [n]);
  const geo = useMemo(() => { const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3)); return g; }, [n]);
  const ref = useRef<Points>(null);
  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), t = state.clock.elapsedTime;
    const pos = geo.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < n; i++) {
      let y = base[i * 3 + 1] - dt * 2.2;
      if (y < 0) y += TOP;
      base[i * 3 + 1] = y;
      pos.setXYZ(i, base[i * 3] + playerRuntime.x + Math.sin(t * 0.8 + i) * 0.6, y, base[i * 3 + 2] + playerRuntime.z + Math.cos(t * 0.6 + i) * 0.6);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#FFFFFF" size={0.32} transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}
