/**
 * 我的账户与数据：资料、商业画像、各模块的进度（游戏内状态）全部保存在服务端数据库。
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser, type UserRow } from '../app.js';
import { selfView } from './auth.js';
import { redactContacts } from '../lib/crypto.js';

/** 允许同步的前端状态模块（对应前端 zustand 的各个 store） */
export const STATE_KEYS = ['town', 'opp', 'center', 'work', 'lots'] as const;

export async function meRoutes(app: FastifyInstance) {
  const db = app.db;
  app.get('/api/me', async (req) => {
    if (!req.user) return { user: null };
    const shop = db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(req.user.id) as { id: string } | undefined;
    return { user: { ...selfView(req.user), shopId: shop?.id ?? null } };
  });

  app.put('/api/me/profile', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const b = z.object({ nickname: z.string().trim().min(1).max(16), lifeTag: z.string().max(20).optional(), look: z.record(z.string(), z.string().max(20)).optional() }).parse(req.body);
    db.prepare('UPDATE users SET nickname = ?, life_tag = ?, look_json = ? WHERE id = ?').run(redactContacts(b.nickname), b.lifeTag ?? null, b.look ? JSON.stringify(b.look) : null, me.id);
    return { user: selfView(db.prepare('SELECT * FROM users WHERE id = ?').get(me.id) as unknown as UserRow) };
  });

  app.get('/api/me/business', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const r = db.prepare('SELECT json FROM business_profiles WHERE user_id = ?').get(me.id) as { json: string } | undefined;
    return { profile: r ? JSON.parse(r.json) : null };
  });
  app.put('/api/me/business', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const json = JSON.stringify(req.body ?? {});
    if (json.length > 64 * 1024) return reply.code(413).send({ error: '内容太长' });
    db.prepare('INSERT INTO business_profiles (user_id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at').run(me.id, json, Date.now());
    return { ok: true };
  });

  app.get('/api/me/state', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const rows = db.prepare('SELECT key, json, updated_at FROM user_state WHERE user_id = ?').all(me.id) as { key: string; json: string; updated_at: number }[];
    return { state: Object.fromEntries(rows.map((r) => [r.key, { data: JSON.parse(r.json), updatedAt: r.updated_at }])) };
  });
  app.put('/api/me/state/:key', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { key } = z.object({ key: z.enum(STATE_KEYS) }).parse(req.params);
    const json = JSON.stringify(req.body ?? {});
    if (json.length > 512 * 1024) return reply.code(413).send({ error: '数据太大' });
    db.prepare('INSERT INTO user_state (user_id, key, json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at').run(me.id, key, json, Date.now());
    return { ok: true };
  });
}
