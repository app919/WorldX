/**
 * 管理员接口（role = admin）：
 * - 数据看板：注册用户、DAU / WAU / MAU、PV / UV、每个功能模块与每个按钮 / 链接的 PV / UV、「留微信号」按钮点击；
 * - 消息审查：查看所有会话与消息原文（含联系方式标记），每次查看都写入管理审计日志；
 * - 用户 / 店铺 / 上传资料列表（手机号只显示脱敏形式）。
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dayOf } from '../db.js';
import { requireAdmin } from '../app.js';

const DAY = 86400_000;

export async function adminRoutes(app: FastifyInstance) {
  const db = app.db;
  const audit = (adminId: string, action: string, target?: string) => db.prepare('INSERT INTO admin_audit (admin_id, action, target, ts) VALUES (?, ?, ?, ?)').run(adminId, action, target ?? null, Date.now());
  const one = <T>(sql: string, ...p: (string | number)[]) => db.prepare(sql).get(...p) as T;
  const all = <T>(sql: string, ...p: (string | number)[]) => db.prepare(sql).all(...p) as T[];

  app.get('/api/admin/overview', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) }).parse(req.query);
    const now = Date.now(), today = dayOf(now);
    const since = dayOf(now - (days - 1) * DAY);
    const active = (from: number) => one<{ n: number }>('SELECT COUNT(DISTINCT user_id) n FROM events WHERE user_id IS NOT NULL AND ts >= ?', from).n;
    const series = all<{ day: string; pv: number; uv: number; dau: number }>(
      "SELECT day, SUM(type = 'pv') pv, COUNT(DISTINCT anon_id) uv, COUNT(DISTINCT user_id) dau FROM events WHERE day >= ? GROUP BY day ORDER BY day", since);
    const signups = all<{ day: string; n: number }>("SELECT strftime('%Y-%m-%d', created_at / 1000 + 8 * 3600, 'unixepoch') day, COUNT(*) n FROM users WHERE created_at >= ? GROUP BY day", now - days * DAY);
    const map = new Map(series.map((s) => [s.day, s]));
    const sMap = new Map(signups.map((s) => [s.day, s.n]));
    const daysList = Array.from({ length: days }, (_, i) => dayOf(now - (days - 1 - i) * DAY));
    return {
      totals: {
        users: one<{ n: number }>('SELECT COUNT(*) n FROM users').n,
        usersToday: sMap.get(today) ?? 0,
        phoneUsers: one<{ n: number }>('SELECT COUNT(*) n FROM users WHERE phone_hash IS NOT NULL').n,
        wechatUsers: one<{ n: number }>('SELECT COUNT(*) n FROM users WHERE wechat_hash IS NOT NULL').n,
        shops: one<{ n: number }>("SELECT COUNT(*) n FROM shops WHERE status = 'active'").n,
        messages: one<{ n: number }>('SELECT COUNT(*) n FROM messages').n,
        conversations: one<{ n: number }>('SELECT COUNT(*) n FROM conversations').n,
        dau: active(now - DAY), wau: active(now - 7 * DAY), mau: active(now - 30 * DAY),
        pvToday: map.get(today)?.pv ?? 0, uvToday: map.get(today)?.uv ?? 0,
        wechatClicks: one<{ n: number }>("SELECT COUNT(*) n FROM events WHERE type = 'action' AND target = 'wechat_button'").n,
      },
      series: daysList.map((d) => ({ day: d, pv: map.get(d)?.pv ?? 0, uv: map.get(d)?.uv ?? 0, dau: map.get(d)?.dau ?? 0, signups: sMap.get(d) ?? 0 })),
    };
  });

  app.get('/api/admin/modules', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }).parse(req.query);
    const since = dayOf(Date.now() - (days - 1) * DAY);
    return { modules: all<{ module: string; pv: number; uv: number; clicks: number; clickUv: number }>(
      `SELECT COALESCE(module, '(未标注)') module, SUM(type = 'pv') pv, COUNT(DISTINCT CASE WHEN type = 'pv' THEN anon_id END) uv,
              SUM(type = 'click') clicks, COUNT(DISTINCT CASE WHEN type = 'click' THEN anon_id END) clickUv
       FROM events WHERE day >= ? GROUP BY module ORDER BY pv DESC, clicks DESC`, since) };
  });

  app.get('/api/admin/clicks', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { days, module } = z.object({ days: z.coerce.number().int().min(1).max(90).default(7), module: z.string().optional() }).parse(req.query);
    const since = dayOf(Date.now() - (days - 1) * DAY);
    const rows = module
      ? all<{ module: string; target: string; pv: number; uv: number }>("SELECT module, target, COUNT(*) pv, COUNT(DISTINCT anon_id) uv FROM events WHERE type IN ('click', 'action') AND day >= ? AND module = ? GROUP BY module, target ORDER BY pv DESC LIMIT 200", since, module)
      : all<{ module: string; target: string; pv: number; uv: number }>("SELECT module, target, COUNT(*) pv, COUNT(DISTINCT anon_id) uv FROM events WHERE type IN ('click', 'action') AND day >= ? GROUP BY module, target ORDER BY pv DESC LIMIT 200", since);
    return { clicks: rows };
  });

  app.get('/api/admin/wechat-button', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    return {
      total: one<{ n: number; u: number }>("SELECT COUNT(*) n, COUNT(DISTINCT user_id) u FROM events WHERE type = 'action' AND target = 'wechat_button'"),
      byDay: all<{ day: string; n: number; u: number }>("SELECT day, COUNT(*) n, COUNT(DISTINCT user_id) u FROM events WHERE type = 'action' AND target = 'wechat_button' GROUP BY day ORDER BY day DESC LIMIT 60"),
    };
  });

  app.get('/api/admin/users', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { q, page } = z.object({ q: z.string().optional(), page: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    const like = `%${q ?? ''}%`;
    return { users: all<Record<string, unknown>>(
      `SELECT u.id, u.role, u.status, u.nickname, u.phone_mask phoneMasked, (u.wechat_hash IS NOT NULL) wechatBound, u.created_at createdAt, u.last_seen_at lastSeenAt,
              s.name shopName, (SELECT COUNT(*) FROM messages m WHERE m.sender_id = u.id) messages
       FROM users u LEFT JOIN shops s ON s.owner_id = u.id
       WHERE (? = '%%' OR u.nickname LIKE ? OR u.phone_mask LIKE ? OR s.name LIKE ? OR u.id = ?)
       ORDER BY u.created_at DESC LIMIT 50 OFFSET ?`, like, like, like, like, q ?? '', page * 50) };
  });

  app.get('/api/admin/shops', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    return { shops: all<Record<string, unknown>>(`SELECT s.id, s.name, s.lot_id lotId, s.category, s.licensed, s.license_company licenseCompany, s.created_at createdAt, u.nickname owner, u.phone_mask ownerPhone,
      (s.company_intro_json IS NOT NULL) hasCompanyIntro, (s.product_intro_json IS NOT NULL) hasProductIntro FROM shops s JOIN users u ON u.id = s.owner_id ORDER BY s.created_at DESC LIMIT 500`) };
  });

  app.get('/api/admin/docs', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    return { docs: all<Record<string, unknown>>('SELECT d.id, d.kind, d.filename, d.size, d.status, d.method, d.error, d.created_at createdAt, u.nickname owner FROM shop_docs d JOIN users u ON u.id = d.user_id ORDER BY d.created_at DESC LIMIT 200') };
  });

  /** 消息审查：会话列表（可按昵称 / 店名 / 消息内容搜索、只看含联系方式的） */
  app.get('/api/admin/conversations', async (req, reply) => {
    const admin = requireAdmin(req, reply); if (!admin) return;
    const { q, flagged } = z.object({ q: z.string().optional(), flagged: z.coerce.boolean().optional() }).parse(req.query);
    audit(admin.id, 'list_conversations', q);
    const like = `%${q ?? ''}%`;
    return { conversations: all<Record<string, unknown>>(
      `SELECT c.id, c.origin, c.created_at createdAt, c.last_msg_at lastMsgAt,
              ua.id aId, ua.nickname aName, ub.id bId, ub.nickname bName,
              (SELECT COUNT(*) FROM messages m WHERE m.conv_id = c.id) messages,
              (SELECT COUNT(*) FROM messages m WHERE m.conv_id = c.id AND m.has_contact = 1) flagged,
              (SELECT COUNT(*) FROM events e WHERE e.type = 'action' AND e.target = 'wechat_button' AND e.meta_json LIKE '%' || c.id || '%') wechatClicks,
              (SELECT body FROM messages m WHERE m.conv_id = c.id ORDER BY created_at DESC LIMIT 1) lastBody
       FROM conversations c JOIN users ua ON ua.id = c.a_id JOIN users ub ON ub.id = c.b_id
       WHERE (? = '%%' OR ua.nickname LIKE ? OR ub.nickname LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conv_id = c.id AND m.body LIKE ?))
         AND (? = 0 OR EXISTS (SELECT 1 FROM messages m WHERE m.conv_id = c.id AND m.has_contact = 1))
       ORDER BY COALESCE(c.last_msg_at, c.created_at) DESC LIMIT 200`, like, like, like, like, flagged ? 1 : 0) };
  });

  app.get('/api/admin/conversations/:id', async (req, reply) => {
    const admin = requireAdmin(req, reply); if (!admin) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    audit(admin.id, 'view_conversation', id);
    return { messages: all<Record<string, unknown>>(`SELECT m.id, m.sender_id senderId, u.nickname sender, m.body, m.has_contact hasContact, m.created_at createdAt, m.read_at readAt
      FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.conv_id = ? ORDER BY m.created_at ASC`, id) };
  });

  app.get('/api/admin/audit', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    return { audit: all<Record<string, unknown>>('SELECT a.id, a.action, a.target, a.ts, u.nickname admin FROM admin_audit a JOIN users u ON u.id = a.admin_id ORDER BY a.ts DESC LIMIT 200') };
  });
}
