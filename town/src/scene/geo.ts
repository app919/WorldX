import { BoxGeometry, PlaneGeometry, Shape, ExtrudeGeometry, type BufferGeometry } from 'three';
import type { V2 } from '../world/geom';

/** UV 按真实尺寸缩放的盒子：贴图密度在不同大小的墙面上保持一致（unit = 一张贴图覆盖的长度） */
export function worldBox(w: number, h: number, d: number, unit = 4): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv');
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, (uv.getX(i) * dims[f][0]) / unit, (uv.getY(i) * dims[f][1]) / unit);
  }
  uv.needsUpdate = true;
  return g;
}

/** 平铺地面：UV 按尺寸缩放，并旋转到水平 */
export function worldPlane(w: number, d: number, unit = 4): PlaneGeometry {
  const g = new PlaneGeometry(w, d);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / unit, (uv.getY(i) * d) / unit);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** 多边形挤出（用于武康大楼等不规则占地），UV 按世界坐标 */
export function extrudePolygon(poly: V2[], height: number, bevel = 0, unit = 4): BufferGeometry {
  const s = new Shape(poly.map((p) => ({ x: p.x, y: -p.z }) as unknown as import('three').Vector2));
  s.autoClose = true;
  const g = new ExtrudeGeometry(s, { depth: height, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position'), uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / unit, pos.getY(i) / unit);
  uv.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
