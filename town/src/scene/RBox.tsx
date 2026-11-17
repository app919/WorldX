/**
 * 圆角方块（替代 drei 的 RoundedBox）：几何体按尺寸缓存共用，且不做“折痕法线”重算 ——
 * 街上几百个圆角物件（车身、摊位、花箱）首屏生成时间大幅减少。
 */
import { forwardRef, type ReactNode } from 'react';
import type { Material, Mesh } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ThreeElements } from '@react-three/fiber';

const cache = new Map<string, RoundedBoxGeometry>();
function geo(w: number, h: number, d: number, r: number, seg: number) {
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}|${seg}`;
  let g = cache.get(k);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, Math.max(1, seg), Math.min(r, w / 2, h / 2, d / 2)); cache.set(k, g); }
  return g;
}

type Props = Omit<ThreeElements['mesh'], 'args'> & { args?: [number?, number?, number?]; radius?: number; smoothness?: number; material?: Material; children?: ReactNode };

export const RoundedBox = forwardRef<Mesh, Props>(function RoundedBox({ args = [1, 1, 1], radius = 0.05, smoothness = 4, children, ...rest }, ref) {
  const [w = 1, h = 1, d = 1] = args;
  return <mesh ref={ref} geometry={geo(w, h, d, radius, Math.min(smoothness, 3))} {...rest}>{children}</mesh>;
});
