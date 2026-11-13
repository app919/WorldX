/**
 * 注册 / 登录：
 * - 手机号 + 短信验证码（同一手机号 60 秒内只能发一次、每天最多 10 次，同一 IP 每小时最多 30 次；验证码 5 分钟有效、最多试 5 次）；
 * - 微信扫码（开放平台 OAuth）：前端展示二维码，扫码后服务端完成登录，前端轮询拿到结果；
 * - 首次登录即注册，必须同意《用户协议》《隐私政策》（含：为安全与合规，平台会保存并可能审查站内消息）。
 * - 微信登录的用户开店前需要绑定手机号（每人一家店，以手机号为准）。
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { config, isProd } from '../config.js';
import { newId } from '../db.js';
import { encrypt, hmac, maskPhone, safeEqual, token, validPhone } from '../lib/crypto.js';
import { sendSmsCode } from '../lib/sms.js';
import { exchangeCode, qrConnectUrl } from '../lib/wechat.js';
import { ipHash, requireUser, SESSION_COOKIE, type UserRow } from '../app.js';

export function startSession(app: FastifyInstance, req: FastifyRequest, reply: FastifyReply, userId: string) {
  const t = token();
  const now = Date.now();
  app.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ua, ip_hash) VALUES (?, ?, ?, ?, ?, ?)')
    .run(hmac(t, 'session'), userId, now, now + config.sessionDays * 86400_000, String(req.headers['user-agent'] ?? '').slice(0, 200), ipHash(req));
  reply.setCookie(SESSION_COOKIE, t, { path: '/', httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: config.sessionDays * 86400 });
}

/** 返回给本人的账户信息（只有脱敏手机号，不含任何哈希、密文、openid） */
export function selfView(u: UserRow) {
  return { id: u.id, role: u.role, nickname: u.nickname, phoneMasked: u.phone_mask, wechatBound: !!u.wechat_hash, lifeTag: u.life_tag, look: u.look_json ? JSON.parse(u.look_json) : null, createdAt: u.created_at };
}

const isAdminPhone = (phone: string) => config.adminPhones.includes(phone);

export async function authRoutes(app: FastifyInstance) {
  const db = app.db;

  app.post('/api/auth/sms/send', async (req, reply) => {
    const { phone, purpose } = z.object({ phone: z.string(), purpose: z.enum(['login', 'bind']).default('login') }).parse(req.body);
    if (!validPhone(phone)) return reply.code(400).send({ error: '请输入 11 位中国大陆手机号' });
    const ph = hmac(phone, 'phone'), now = Date.now();
    const last = db.prepare('SELECT created_at FROM sms_codes WHERE phone_hash = ? ORDER BY created_at DESC LIMIT 1').get(ph) as { created_at: number } | undefined;
    if (last && now - last.created_at < config.sms.resendSec * 1000) return reply.code(429).send({ error: '验证码已发送，请稍后再试' });
    const today = (db.prepare('SELECT COUNT(*) n FROM sms_codes WHERE phone_hash = ? AND created_at > ?').get(ph, now - 86400_000) as { n: number }).n;
    if (today >= config.sms.dailyLimit) return reply.code(429).send({ error: '今天发送次数太多了，请明天再试' });
    const ipN = (db.prepare('SELECT COUNT(*) n FROM sms_codes WHERE ip_hash = ? AND created_at > ?').get(ipHash(req), now - 3600_000) as { n: number }).n;
    if (ipN >= 30) return reply.code(429).send({ error: '请求太频繁' });
    const code = String(randomInt(100000, 1000000));
    await sendSmsCode(phone, code);
    db.prepare('INSERT INTO sms_codes (phone_hash, code_hash, purpose, created_at, expires_at, ip_hash) VALUES (?, ?, ?, ?, ?, ?)')
      .run(ph, hmac(code, 'sms'), purpose, now, now + config.sms.codeTtlSec * 1000, ipHash(req));
    // 开发模式（console 短信）下把验证码返回给前端，方便本地调试与自动化测试；生产环境不会返回
    return { ok: true, ...(config.sms.provider === 'console' && !isProd ? { devCode: code } : {}) };
  });

  /** 校验验证码；成功返回 true（并作废该验证码） */
  function checkCode(phone: string, code: string, purpose: string): string | null {
    const ph = hmac(phone, 'phone');
    const row = db.prepare('SELECT * FROM sms_codes WHERE phone_hash = ? AND purpose = ? AND used = 0 ORDER BY created_at DESC LIMIT 1').get(ph, purpose) as { id: number; code_hash: string; attempts: number; expires_at: number } | undefined;
    if (!row || row.expires_at < Date.now()) return '验证码已过期，请重新获取';
    if (row.attempts >= 5) return '尝试次数太多，请重新获取验证码';
    if (!safeEqual(row.code_hash, hmac(code, 'sms'))) {
      db.prepare('UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
      return '验证码不正确';
    }
    db.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').run(row.id);
    return null;
  }

  app.post('/api/auth/sms/verify', async (req, reply) => {
    const { phone, code, agree } = z.object({ phone: z.string(), code: z.string(), agree: z.boolean() }).parse(req.body);
    if (!agree) return reply.code(400).send({ error: '请先阅读并同意《用户协议》和《隐私政策》' });
    if (!validPhone(phone)) return reply.code(400).send({ error: '手机号格式不正确' });
    const err = checkCode(phone, code, 'login');
    if (err) return reply.code(400).send({ error: err });
    const ph = hmac(phone, 'phone'), now = Date.now();
    let u = db.prepare('SELECT * FROM users WHERE phone_hash = ?').get(ph) as unknown as UserRow | undefined;
    let isNew = false;
    if (!u) {
      const id = newId('u');
      db.prepare('INSERT INTO users (id, role, phone_hash, phone_enc, phone_mask, agreed_terms_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, isAdminPhone(phone) ? 'admin' : 'user', ph, encrypt(phone), maskPhone(phone), now, now, now);
      u = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
      isNew = true;
    } else if (isAdminPhone(phone) && u.role !== 'admin') {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(u.id);
      u = { ...u, role: 'admin' };
    }
    if (u.status !== 'active') return reply.code(403).send({ error: '账号已被停用，请联系客服' });
    startSession(app, req, reply, u.id);
    return { user: selfView(u), isNew };
  });

  /** 已登录用户（例如微信登录）绑定手机号 */
  app.post('/api/auth/phone/bind', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { phone, code } = z.object({ phone: z.string(), code: z.string() }).parse(req.body);
    if (!validPhone(phone)) return reply.code(400).send({ error: '手机号格式不正确' });
    const err = checkCode(phone, code, 'bind');
    if (err) return reply.code(400).send({ error: err });
    const ph = hmac(phone, 'phone');
    const other = db.prepare('SELECT id FROM users WHERE phone_hash = ? AND id != ?').get(ph, me.id);
    if (other) return reply.code(409).send({ error: '这个手机号已经注册过账号了' });
    db.prepare('UPDATE users SET phone_hash = ?, phone_enc = ?, phone_mask = ?, role = CASE WHEN ? THEN \'admin\' ELSE role END WHERE id = ?')
      .run(ph, encrypt(phone), maskPhone(phone), isAdminPhone(phone) ? 1 : 0, me.id);
    return { user: selfView(db.prepare('SELECT * FROM users WHERE id = ?').get(me.id) as unknown as UserRow) };
  });

  // —— 微信扫码 ——
  app.post('/api/auth/wechat/start', async (req) => {
    const { agree } = z.object({ agree: z.boolean() }).parse(req.body ?? {});
    if (!agree) throw Object.assign(new Error('请先阅读并同意《用户协议》和《隐私政策》'), { statusCode: 400 });
    const state = token(18), now = Date.now();
    db.prepare('INSERT INTO oauth_states (state, purpose, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(state, req.user ? 'bind' : 'login', req.user?.id ?? null, now, now + 10 * 60_000);
    return { state, url: qrConnectUrl(state), mode: config.wechat.mode };
  });

  /** 前端轮询：扫码完成后在这里拿到登录态（会话 Cookie 写在这个响应里） */
  app.get('/api/auth/wechat/poll', async (req, reply) => {
    const { state } = z.object({ state: z.string() }).parse(req.query);
    const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state) as { purpose: string; expires_at: number; result_user_id: string | null } | undefined;
    if (!row || row.expires_at < Date.now()) return reply.code(410).send({ error: '二维码已过期，请刷新' });
    if (!row.result_user_id) return { done: false };
    db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(row.result_user_id) as unknown as UserRow;
    if (row.purpose === 'login') startSession(app, req, reply, u.id);
    return { done: true, user: selfView(u) };
  });

  app.get('/api/auth/wechat/callback', async (req, reply) => {
    const { code, state } = z.object({ code: z.string().optional(), state: z.string() }).parse(req.query);
    const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state) as { purpose: string; user_id: string | null; expires_at: number } | undefined;
    const page = (msg: string) => reply.type('text/html; charset=utf-8').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:40px">${msg}<script>setTimeout(()=>{try{window.close()}catch(e){}; if(window.top===window) location.href='/'},1200)</script></body>`);
    if (!row || row.expires_at < Date.now()) return page('二维码已过期，请回到页面刷新');
    if (!code) return page('你取消了授权');
    const id = await exchangeCode(code);
    const wh = hmac(id.id, 'wechat'), now = Date.now();
    let userId: string;
    if (row.purpose === 'bind' && row.user_id) {
      const other = db.prepare('SELECT id FROM users WHERE wechat_hash = ? AND id != ?').get(wh, row.user_id);
      if (other) return page('这个微信已绑定其他账号');
      db.prepare('UPDATE users SET wechat_hash = ?, wechat_enc = ? WHERE id = ?').run(wh, encrypt(JSON.stringify({ unionid: id.id, openid: id.openid })), row.user_id);
      userId = row.user_id;
    } else {
      const u = db.prepare('SELECT id FROM users WHERE wechat_hash = ?').get(wh) as { id: string } | undefined;
      if (u) userId = u.id;
      else {
        userId = newId('u');
        db.prepare('INSERT INTO users (id, wechat_hash, wechat_enc, nickname, agreed_terms_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(userId, wh, encrypt(JSON.stringify({ unionid: id.id, openid: id.openid })), (id.nickname ?? '').slice(0, 16) || null, now, now, now);
      }
    }
    db.prepare('UPDATE oauth_states SET result_user_id = ? WHERE state = ?').run(userId, state);
    return page('✅ 授权成功，请回到电脑页面');
  });

  /** 开发用的模拟扫码页（WECHAT_MODE=mock） */
  app.get('/api/auth/wechat/mock', async (req, reply) => {
    if (config.wechat.mode !== 'mock') return reply.code(404).send({ error: 'not found' });
    const { state } = z.object({ state: z.string() }).parse(req.query);
    const who = hmac(state, 'mock').slice(0, 8);
    return reply.type('text/html; charset=utf-8').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:24px;background:#f5f5f5">
      <div style="background:#fff;border-radius:12px;padding:20px;max-width:280px;margin:auto"><div style="font-size:42px">🟩</div><b>模拟微信扫码（开发模式）</b>
      <p style="color:#888;font-size:13px">正式环境这里是微信官方二维码</p>
      <a id="ok" href="/api/auth/wechat/callback?code=mock_${who}&state=${encodeURIComponent(state)}" style="display:block;background:#07c160;color:#fff;padding:10px;border-radius:8px;text-decoration:none">确认登录</a></div></body>`);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const t = req.cookies[SESSION_COOKIE];
    if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hmac(t, 'session'));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}
