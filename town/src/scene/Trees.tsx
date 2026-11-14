/**
 * 上海街道植物资产库：法国梧桐、桂花、香樟、银杏、灌木。
 * 每种树 3 个形态变体（不同年龄、冠幅、分枝），实例化渲染并随机缩放 / 旋转，
 * 避免“整条街复制粘贴同一个模型”。
 *
 * 梧桐：斑驳的浅色树皮、粗壮树干、三到四根明显的分枝、层叠宽冠 —— 叶片团萌化，但不是一个球。
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../world/geom';
import { LOW_GFX } from './quality';
import type { PropDef, TreeSpecies } from '../world/types';

type Part = BufferGeometry;

function colorize(g: BufferGeometry, pick: (y: number, i: number) => Color): BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng.getAttribute('uv')) ng.deleteAttribute('uv');
  const pos = ng.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = pick(pos.getY(i), i);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new BufferAttribute(col, 3));
  return ng;
}

/** 一段树枝：从 a 到 b 的锥形圆柱 */
function limb(a: Vector3, b: Vector3, r0: number, r1: number, bark: (i: number) => Color): Part {
  const len = a.distanceTo(b);
  const g = new CylinderGeometry(r1, r0, len, 7, 2);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyMatrix4(new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new Vector3(1, 1, 1)));
  return colorize(g, (_y, i) => bark(i));
}

/**
 * 一团叶子：带噪声起伏的二十面体。
 * 立体感来自三件事：① 朝上的面亮、朝下的面暗（按法线着色）；② 靠近树冠中心的部分更暗（像有阴影）；③ 颜色带细微抖动。
 */
function clump(c: Vector3, r: number, squash: number, base: string, light: string, R: () => number, accent?: string, center?: Vector3): Part {
  const ico = new IcosahedronGeometry(r, LOW_GFX ? 1 : 2);
  ico.deleteAttribute('uv'); ico.deleteAttribute('normal');
  const g = mergeVertices(ico); // 合并顶点后再加噪声，保证叶团是连续、圆润的
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (R() - 0.5) * 0.26;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k);
  }
  g.translate(c.x, c.y, c.z);
  g.computeVertexNormals();
  const ng = g.toNonIndexed();
  const pos = ng.getAttribute('position'), nor = ng.getAttribute('normal');
  const cb = new Color(base), cl = new Color(light), dark = new Color(base).multiplyScalar(0.62), ca = accent ? new Color(accent) : null;
  const ctr = center ?? c;
  const col = new Float32Array(pos.count * 3);
  const tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    const up = nor.getY(i) * 0.5 + 0.5; // 0 = 朝下，1 = 朝上
    tmp.copy(dark).lerp(cb, Math.min(1, up * 1.6)).lerp(cl, Math.max(0, up - 0.55) * 1.6);
    // 靠近树冠中心 / 低处更暗
    const dx = pos.getX(i) - ctr.x, dz = pos.getZ(i) - ctr.z;
    const out = Math.min(1, Math.hypot(dx, dz) / (r * 1.6));
    tmp.multiplyScalar(0.82 + 0.18 * out);
    if (ca && R() < 0.035) tmp.lerp(ca, 0.85); // 桂花的点点小花
    tmp.offsetHSL((R() - 0.5) * 0.015, 0, (R() - 0.5) * 0.05);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  ng.setAttribute('color', new BufferAttribute(col, 3));
  return ng;
}

/** 蓬松的树冠：一大团 + 表面冒出的几团小叶簇（卡通“棉花糖”轮廓，不再是一个球） */
function crown(parts: Part[], c: Vector3, r: number, squash: number, base: string, light: string, R: () => number, accent?: string, center?: Vector3) {
  parts.push(clump(c, r, squash, base, light, R, accent, center));
  const n = LOW_GFX ? 2 : 5;
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2, el = 0.15 + R() * 0.9; // 主要分布在上半球与侧面
    const d = r * 0.82;
    const pc = new Vector3(c.x + Math.cos(a) * Math.cos(el) * d, c.y + Math.sin(el) * d * squash, c.z + Math.sin(a) * Math.cos(el) * d);
    parts.push(clump(pc, r * (0.38 + R() * 0.18), Math.min(1, squash + 0.15), base, light, R, accent, center ?? c));
  }
}

/** 树根：底部微微张开的根部 */
function rootFlare(parts: Part[], r: number, bark: (i: number) => Color) {
  const g = new CylinderGeometry(r, r * 1.7, 0.35, 8, 1);
  g.translate(0, 0.17, 0);
  parts.push(colorize(g, (_y, i) => bark(i)));
}

const BARK_PLANE = ['#C9C2AE', '#A9A48F', '#DCD6C3', '#8E8B78'];
const BARK = ['#7A5E49', '#8A6C55', '#6E5442'];

function barkFn(cols: string[], R: () => number) {
  const cs = cols.map((c) => new Color(c));
  return () => cs[Math.floor(R() * cs.length)];
}

export function treeGeometry(species: TreeSpecies, variant: number): BufferGeometry {
  const R = rng(species.length * 131 + variant * 17 + 7);
  const parts: Part[] = [];
  const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
  if (species === 'plane') {
    const h = 2.4 + variant * 0.25;
    const bark = barkFn(BARK_PLANE, R);
    const lean = (R() - 0.5) * 0.25;
    const top = v3(lean, h, 0);
    parts.push(limb(v3(0, 0, 0), top, 0.26, 0.18, bark));
    const nb = 3 + (variant % 2);
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2 + R() * 0.6;
      const L = 1.3 + R() * 0.5;
      const end = top.clone().add(v3(Math.cos(a) * L, 0.9 + R() * 0.5, Math.sin(a) * L));
      parts.push(limb(top, end, 0.15, 0.08, bark));
      // 每根分枝末端 2–3 团叶子，层叠成宽冠
      const n = 2 + Math.floor(R() * 2);
      for (let k = 0; k < n; k++) {
        crown(parts, end.clone().add(v3((R() - 0.5) * 1.0, (R() - 0.2) * 0.6, (R() - 0.5) * 1.0)), 0.85 + R() * 0.35, 0.7, '#4F8A3C', '#9BCB66', R, undefined, top.clone().add(v3(0, 1.4, 0)));
      }
    }
    crown(parts, top.clone().add(v3(0, 1.8, 0)), 1.0, 0.65, '#4F8A3C', '#A2CF6E', R);
    rootFlare(parts, 0.26, bark);
  } else if (species === 'camphor') {
    const bark = barkFn(BARK, R);
    const top = v3(0, 1.9, 0);
    parts.push(limb(v3(0, 0, 0), top, 0.3, 0.22, bark));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + R();
      const end = top.clone().add(v3(Math.cos(a) * 1.4, 0.8, Math.sin(a) * 1.4));
      parts.push(limb(top, end, 0.18, 0.1, bark));
      crown(parts, end.clone().add(v3(0, 0.5, 0)), 1.2 + R() * 0.3, 0.62, '#3F7A3A', '#8EBE62', R, undefined, v3(0, 3, 0));
    }
    crown(parts, v3(0, 3.4, 0), 1.35, 0.6, '#3F7A3A', '#96C46A', R);
    rootFlare(parts, 0.3, bark);
  } else if (species === 'osmanthus') {
    const bark = barkFn(BARK, R);
    parts.push(limb(v3(0, 0, 0), v3(0, 0.9, 0), 0.14, 0.11, bark));
    for (let i = 0; i < 7; i++) {
      const a = R() * Math.PI * 2, rr = R() * 0.6;
      parts.push(clump(v3(Math.cos(a) * rr, 1.5 + R() * 0.9, Math.sin(a) * rr), 0.55 + R() * 0.2, 0.9, '#3F6B3F', '#86B06E', R, '#F2C55C', v3(0, 1.9, 0)));
    }
  } else if (species === 'ginkgo') {
    const bark = barkFn(BARK, R);
    parts.push(limb(v3(0, 0, 0), v3(0, 3.2, 0), 0.18, 0.1, bark));
    for (let i = 0; i < 6; i++) {
      const y = 1.6 + i * 0.45, rr = 1.1 - i * 0.14;
      parts.push(clump(v3((R() - 0.5) * 0.3, y, (R() - 0.5) * 0.3), Math.max(0.35, rr), 0.6, '#9DB552', '#EADB7C', R, undefined, v3(0, y, 0)));
    }
  }
  const merged = mergeGeometries(parts.map((p) => { if (p.getAttribute('uv')) p.deleteAttribute('uv'); if (!p.getAttribute('normal')) p.computeVertexNormals(); return p; }));
  merged.computeBoundingSphere();
  return merged;
}

export function shrubGeometry(variant: number): BufferGeometry {
  const R = rng(variant * 53 + 3);
  const parts: Part[] = [];
  for (let i = 0; i < 4; i++) parts.push(clump(new Vector3((R() - 0.5) * 0.8, 0.35 + R() * 0.2, (R() - 0.5) * 0.8), 0.42 + R() * 0.15, 0.85, '#55804A', '#9CC47E', R, variant % 2 ? '#F0A9B4' : undefined, new Vector3(0, 0.3, 0)));
  return mergeGeometries(parts);
}

const leafMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });

/** 实例化渲染某个街区的所有树 */
export function Trees({ props }: { props: PropDef[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, PropDef[]>();
    props.filter((p) => p.kind === 'tree').forEach((p, i) => {
      const key = `${p.species ?? 'plane'}:${i % 3}`;
      m.set(key, [...(m.get(key) ?? []), p]);
    });
    return [...m.entries()].map(([key, list]) => {
      const [sp, v] = key.split(':');
      return { key, list, geo: treeGeometry(sp as TreeSpecies, Number(v)) };
    });
  }, [props]);
  return <>{groups.map((g) => <TreeBatch key={g.key} list={g.list} geo={g.geo} />)}</>;
}

function TreeBatch({ list, geo }: { list: PropDef[]; geo: BufferGeometry }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D();
    list.forEach((t, i) => {
      const s = t.scale ?? 1;
      o.position.set(t.p.x, 0, t.p.z);
      o.rotation.set(0, t.rot ?? 0, 0);
      o.scale.set(s, s * (0.95 + ((i * 37) % 10) / 100), s);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [list]);
  return <instancedMesh ref={ref} args={[geo, leafMat, list.length]} castShadow receiveShadow />;
}
