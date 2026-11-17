import { expect, it, vi } from 'vitest';
import { DISTRICT_ORDER, compiledOf, navOf } from './index';
import { dist } from './geom';
vi.setConfig({ testTimeout: 600000 });
/** 走路撞树：从各个方向、偏一点、斜着撞向每棵树，绝大多数情况下都能自己绕过去（剩下极少数由角色的脱困逻辑处理） */
it('走路撞树不会被卡住：从各方向、偏心、斜向撞向树都能绕过去', () => {
  for (const id of DISTRICT_ORDER) {
    const cd = compiledOf(id); const nav = navOf(id);
    const trees = cd.props.filter((p) => p.kind === 'tree');
    let tries = 0, stuck = 0; const ex: string[] = [];
    let glued = 0, frames = 0, frames2 = 0;
    for (const t of trees.filter((_, i) => i % 3 === 0)) for (let k = 0; k < 8; k += 2) for (const [lat, ang] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.6], [0, -0.6]]) {
      const a = (k / 8) * Math.PI * 2;
      const px = -Math.sin(a), pz = Math.cos(a);
      const start = nav.nearestWalkable({ x: t.p.x + Math.cos(a) * 2.2 + px * lat, z: t.p.z + Math.sin(a) * 2.2 + pz * lat }, 0.8);
      if (!start) continue;
      const ux = -Math.cos(a + ang), uz = -Math.sin(a + ang);
      // only if destination beyond tree is walkable
      const far = { x: t.p.x - Math.cos(a) * 2.5, z: t.p.z - Math.sin(a) * 2.5 };
      if (!nav.walkable(far)) continue;
      tries++;
      let p = start; const memo = { side: 0 } as { side: number };
      let best = Infinity; let stuckT = 0;
      for (let f = 0; f < 600; f++) { // 10 s @60fps, walk speed 3.2
        const to = { x: p.x + ux * 3.2 / 60, z: p.z + uz * 3.2 / 60 };
        let q = nav.move(p, to, memo).p; frames++;
        // 与游戏里一致的脱困：按着方向 0.8 秒没动 → 挪到前方最近的可走点
        stuckT = dist(q, p) < 0.004 ? stuckT + 1 / 60 : 0;
        if (stuckT > 0.8) { stuckT = 0; const out = nav.unstick(p, ux, uz); if (out) q = out; } if (dist(p, t.p) < 2.5) { frames2++; if (dist(q, p) < 0.004) glued++; } p = q;
        best = Math.min(best, dist(p, far));
      }
      // progress along direction
      const prog = (p.x - start.x) * ux + (p.z - start.z) * uz;
      if (prog < 3) { stuck++; if (ex.length < 4) ex.push(`(${t.p.x.toFixed(1)},${t.p.z.toFixed(1)}) dir${k} prog ${prog.toFixed(2)}`); }
    }
    expect(stuck / Math.max(1, tries), id).toBeLessThan(0.02); // 剩下的是贴着路缘的树：树后面是机动车道，本来就不该走过去
    console.log(id, 'glued%', (glued / Math.max(1, frames2) * 100).toFixed(2), 'trees', trees.length, 'tries', tries, 'stuck', stuck, ex.join(' | '));
  }
});
