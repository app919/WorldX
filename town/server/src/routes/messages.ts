/**
 * 用户之间的私信：
 * - 只有会话双方能读写；所有消息原文保存在数据库，管理员可审查（用户注册时已同意）；
 * - 发给对方展示时，手机号 / 微信号 / 邮箱会被自动隐藏（平台内沟通，保护双方）；原文只给管理员审计；
 * - 「留微信号」按钮：功能暂未开放，点击会记录到数据看板。
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dayOf, newId } from '../db.js';
import { hasContact, redactContacts } from '../lib/crypto.js';
import { ipHash, requireUser } from '../app.js';

interface Conv { id: string; a_id: string; b_id: string; origin: string | null; created_at: number; last_msg_at: number | null }

export async function messageRoutes(app: FastifyInstance) {
  const db = app.db;
  const peerOf = (c: Conv, me: string) => (c.a_id === me ? c.b_id : c.a_id);
  const peerView = (id: string) => {
    const u = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(id) as { id: string; nickname: string | null } | undefined;
    const s = db.prepare('SELECT id, name FROM shops WHERE owner_id = ?').get(id) as { id: string; name: string } | undefined;
    return { id, nickname: u?.nickname ?? '邻居', shopId: s?.id ?? null, shopName: s?.name ?? null };
  };
  const mine = (convId: string, me: string) => db.prepare('SELECT * FROM conversations WHERE id = ? AND (a_id = ? OR b_id = ?)').get(convId, me, me) as Conv | undefined;

  app.post('/api/conversations', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { peerId, origin } = z.object({ peerId: z.string(), origin: z.string().max(60).optional() }).parse(req.body);
    if (peerId === me.id) return reply.code(400).send({ error: '不能给自己发消息' });
    if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active'").get(peerId)) return reply.code(404).send({ error: '对方不存在' });
    const [a, b] = [me.id, peerId].sort();
    let c = db.prepare('SELECT * FROM conversations WHERE a_id = ? AND b_id = ?').get(a, b) as Conv | undefined;
    if (!c) {
      const id = newId('cv');
      db.prepare('INSERT INTO conversations (id, a_id, b_id, origin, created_at) VALUES (?, ?, ?, ?, ?)').run(id, a, b, origin ?? null, Date.now());
      c = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as unknown as Conv;
    }
    return { conversation: { id: c.id, peer: peerView(peerOf(c, me.id)) } };
  });

  app.get('/api/conversations', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const list = db.prepare('SELECT * FROM conversations WHERE a_id = ? OR b_id = ? ORDER BY COALESCE(last_msg_at, created_at) DESC LIMIT 200').all(me.id, me.id) as unknown as Conv[];
    return {
      conversations: list.map((c) => {
        const last = db.prepare('SELECT body, sender_id, created_at FROM messages WHERE conv_id = ? ORDER BY created_at DESC LIMIT 1').get(c.id) as { body: string; sender_id: string; created_at: number } | undefined;
        const unread = (db.prepare('SELECT COUNT(*) n FROM messages WHERE conv_id = ? AND sender_id != ? AND read_at IS NULL').get(c.id, me.id) as { n: number }).n;
        return { id: c.id, peer: peerView(peerOf(c, me.id)), last: last ? { body: redactContacts(last.body).slice(0, 60), mine: last.sender_id === me.id, at: last.created_at } : null, unread };
      }),
    };
  });

  app.get('/api/conversations/:id/messages', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { after } = z.object({ after: z.coerce.number().optional() }).parse(req.query);
    if (!mine(id, me.id)) return reply.code(404).send({ error: '会话不存在' });
    const rows = db.prepare('SELECT id, sender_id, body, created_at, read_at FROM messages WHERE conv_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 500').all(id, after ?? 0) as { id: string; sender_id: string; body: string; created_at: number; read_at: number | null }[];
    return { messages: rows.map((m) => ({ id: m.id, mine: m.sender_id === me.id, body: m.sender_id === me.id ? m.body : redactContacts(m.body), at: m.created_at, read: !!m.read_at })) };
  });

  app.post('/api/conversations/:id/messages', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
    if (!mine(id, me.id)) return reply.code(404).send({ error: '会话不存在' });
    const recent = (db.prepare('SELECT COUNT(*) n FROM messages WHERE sender_id = ? AND created_at > ?').get(me.id, Date.now() - 60_000) as { n: number }).n;
    if (recent >= 30) return reply.code(429).send({ error: '发送太频繁了，休息一下' });
    const mid = newId('m'), now = Date.now();
    db.prepare('INSERT INTO messages (id, conv_id, sender_id, body, has_contact, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(mid, id, me.id, body, hasContact(body) ? 1 : 0, now);
    db.prepare('UPDATE conversations SET last_msg_at = ? WHERE id = ?').run(now, id);
    return { message: { id: mid, mine: true, body, at: now, read: false }, contactHidden: hasContact(body) };
  });

  app.post('/api/conversations/:id/read', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!mine(id, me.id)) return reply.code(404).send({ error: '会话不存在' });
    db.prepare('UPDATE messages SET read_at = ? WHERE conv_id = ? AND sender_id != ? AND read_at IS NULL').run(Date.now(), id, me.id);
    return { ok: true };
  });

  /** 「留微信号」按钮：功能暂未开放，只记录点击 */
  app.post('/api/conversations/:id/wechat-click', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    if (!mine(id, me.id)) return reply.code(404).send({ error: '会话不存在' });
    const now = Date.now();
    db.prepare('INSERT INTO events (ts, day, anon_id, user_id, type, module, target, path, meta_json, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(now, dayOf(now), req.anonId, me.id, 'action', 'messages', 'wechat_button', null, JSON.stringify({ conv: id }), ipHash(req));
    return { ok: true, message: '「留微信号」功能即将上线，先在站内聊聊吧' };
  });
}
