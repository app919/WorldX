/**
 * 埋点：页面 / 模块浏览（pv）、按钮与链接点击（click）、关键动作（action）。
 * UV 以设备匿名 id（Cookie）去重；登录用户同时记录 user_id 用于活跃用户统计。不记录 IP 原文。
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dayOf } from '../db.js';
import { ipHash } from '../app.js';

const Ev = z.object({
  type: z.enum(['pv', 'click', 'action']),
  module: z.string().max(40).optional(),
  target: z.string().max(80).optional(),
  path: z.string().max(200).optional(),
  ts: z.number().optional(),
  meta: z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean()])).optional(),
});

export async function trackRoutes(app: FastifyInstance) {
  const db = app.db;
  app.post('/api/track', async (req) => {
    const { events } = z.object({ events: z.array(Ev).max(50) }).parse(req.body);
    const now = Date.now();
    const ins = db.prepare('INSERT INTO events (ts, day, anon_id, user_id, type, module, target, path, meta_json, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const ih = ipHash(req);
    db.exec('BEGIN');
    try {
      for (const e of events) {
        // 客户端时间只接受 10 分钟内的偏差
        const ts = e.ts && Math.abs(e.ts - now) < 600_000 ? e.ts : now;
        ins.run(ts, dayOf(ts), req.anonId, req.user?.id ?? null, e.type, e.module ?? null, e.target ?? null, e.path ?? null, e.meta ? JSON.stringify(e.meta) : null, ih);
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return { ok: true, n: events.length };
  });
}
