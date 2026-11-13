/**
 * 三邻邦后端（Fastify）。同一个服务同时提供 /api 与构建好的前端页面（同源，Cookie 会话）。
 */
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fstatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { config, isProd } from './config.js';
import { openDb, type DB } from './db.js';
import { hmac, token } from './lib/crypto.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { shopRoutes } from './routes/shops.js';
import { docRoutes } from './routes/docs.js';
import { messageRoutes } from './routes/messages.js';
import { trackRoutes } from './routes/track.js';
import { adminRoutes } from './routes/admin.js';

export interface UserRow { id: string; role: string; status: string; nickname: string | null; phone_mask: string | null; phone_hash: string | null; wechat_hash: string | null; life_tag: string | null; look_json: string | null; created_at: number; last_seen_at: number | null; agreed_terms_at: number | null }

declare module 'fastify' {
  interface FastifyInstance { db: DB }
  interface FastifyRequest { user?: UserRow; anonId: string }
}

export const SESSION_COOKIE = 'slb_session';
export const ANON_COOKIE = 'slb_aid';

export function buildApp(opts: { db?: DB; logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? !process.env.VITEST, trustProxy: true, bodyLimit: 1024 * 1024 });
  const db = opts.db ?? openDb();
  app.decorate('db', db);
  app.register(cookie, { secret: config.sessionSecret });
  app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 } });

  app.addHook('onRequest', async (req, reply) => {
    // 匿名设备 id：用于 UV 统计（不含个人信息）
    let aid = req.cookies[ANON_COOKIE];
    if (!aid || !/^[\w-]{10,40}$/.test(aid)) {
      aid = token(12);
      reply.setCookie(ANON_COOKIE, aid, { path: '/', httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 400 * 86400 });
    }
    req.anonId = aid;
    // 登录态
    const t = req.cookies[SESSION_COOKIE];
    if (t) {
      const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(hmac(t, 'session'), Date.now()) as unknown as UserRow | undefined;
      if (row && row.status === 'active') {
        req.user = row;
        if (!row.last_seen_at || Date.now() - row.last_seen_at > 60_000) db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(Date.now(), row.id);
      }
    }
    // 写请求校验来源（防 CSRF）：有 Origin 头时必须与本站一致
    if (req.url.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== config.publicUrl && origin !== `${req.protocol}://${req.headers.host}`) {
        return reply.code(403).send({ error: '来源不被允许' });
      }
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    // 参数校验失败（zod）→ 400
    if ((err as { name?: string }).name === 'ZodError') {
      const issues = (err as unknown as { issues: { path: (string | number)[]; message: string }[] }).issues;
      return reply.code(400).send({ error: '请求参数不正确', fields: issues.map((i) => i.path.join('.')) });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    reply.code(status).send({ error: status >= 500 ? '服务器开小差了，请稍后再试' : err.message });
  });

  app.get('/api/health', async () => ({ ok: true }));
  app.register(authRoutes);
  app.register(meRoutes);
  app.register(shopRoutes);
  app.register(docRoutes);
  app.register(messageRoutes);
  app.register(trackRoutes);
  app.register(adminRoutes);

  // 前端页面（构建产物）
  if (existsSync(config.webDist)) {
    app.register(fstatic, { root: config.webDist, prefix: '/', index: ['index.html'] });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: '接口不存在' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}

export function requireUser(req: FastifyRequest, reply: FastifyReply): UserRow | undefined {
  if (!req.user) { reply.code(401).send({ error: '请先登录' }); return undefined; }
  return req.user;
}
export function requireAdmin(req: FastifyRequest, reply: FastifyReply): UserRow | undefined {
  if (!req.user) { reply.code(401).send({ error: '请先登录' }); return undefined; }
  if (req.user.role !== 'admin') { reply.code(403).send({ error: '需要管理员权限' }); return undefined; }
  return req.user;
}
export const ipHash = (req: FastifyRequest) => hmac(req.ip ?? '', 'ip').slice(0, 16);
