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

  // —— 店铺治理：下架商品 / 资料、关店整改、恢复营业；每次处理都给店主发一条委婉友善的整改提醒，并写审计日志 ——
  const notify = (userId: string, title: string, body: string) =>
    db.prepare('INSERT INTO notices (id, user_id, kind, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(`ntc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, userId, 'moderation', title, body, Date.now());
  const Reason = z.object({ reason: z.string().trim().min(2).max(200) });
  const shopOwner = (id: string) => one<{ owner_id: string; name: string; products_json: string; status: string } | undefined>('SELECT owner_id, name, products_json, status FROM shops WHERE id = ?', id);
  const kindName: Record<string, string> = { video: '公司介绍视频', deck: '演讲稿', product: '产品资料' };

  app.get('/api/admin/governance', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const shops = all<{ id: string; name: string; lotId: string; status: string; closedReason: string | null; owner: string | null; products_json: string; createdAt: number }>(
      `SELECT s.id, s.name, s.lot_id lotId, s.status, s.closed_reason closedReason, s.products_json, s.created_at createdAt, u.nickname owner FROM shops s JOIN users u ON u.id = s.owner_id ORDER BY s.created_at DESC LIMIT 500`);
    const media = all<{ id: string; shopId: string; kind: string; title: string | null; filename: string; size: number; status: string; removedReason: string | null; createdAt: number }>(
      `SELECT id, shop_id shopId, kind, title, filename, size, status, removed_reason removedReason, created_at createdAt FROM shop_media ORDER BY created_at DESC LIMIT 1000`);
    return {
      shops: shops.map(({ products_json, ...x }) => ({ ...x, products: (JSON.parse(products_json) as { name: string; description?: string; removed?: { reason: string } }[]).map((p, i) => ({ idx: i, name: p.name, description: p.description ?? '', removed: p.removed?.reason ?? null })),
        media: media.filter((m) => m.shopId === x.id).map((m) => ({ ...m, url: `/api/media/${m.id}` })) })),
    };
  });

  app.post('/api/admin/shops/:id/products/:idx/takedown', async (req, reply) => {
    const me = requireAdmin(req, reply); if (!me) return;
    const { id, idx } = z.object({ id: z.string(), idx: z.coerce.number().int().min(0) }).parse(req.params);
    const { reason } = Reason.parse(req.body);
    const s = shopOwner(id);
    if (!s) return reply.code(404).send({ error: '店铺不存在' });
    const products = JSON.parse(s.products_json) as { name: string; removed?: { reason: string; at: number } }[];
    if (!products[idx]) return reply.code(404).send({ error: '商品不存在' });
    products[idx].removed = { reason, at: Date.now() };
    db.prepare('UPDATE shops SET products_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(products), Date.now(), id);
    audit(me.id, 'product.takedown', `${id}#${idx}:${reason}`);
    notify(s.owner_id, '「' + products[idx].name + '」暂时下架了', `你好！感谢你在三邻邦经营「${s.name}」。我们在巡检中发现商品「${products[idx].name}」${reason}，为了保护你和其他邻居，先帮你暂时下架。修改好后可以重新上架；如果你觉得我们判断有误，也欢迎直接回复说明，我们会尽快复核。祝生意兴隆！`);
    return { ok: true };
  });

  app.post('/api/admin/shops/:id/products/:idx/restore', async (req, reply) => {
    const me = requireAdmin(req, reply); if (!me) return;
    const { id, idx } = z.object({ id: z.string(), idx: z.coerce.number().int().min(0) }).parse(req.params);
    const s = shopOwner(id);
    if (!s) return reply.code(404).send({ error: '店铺不存在' });
    const products = JSON.parse(s.products_json) as { name: string; removed?: unknown }[];
    if (!products[idx]) return reply.code(404).send({ error: '商品不存在' });
    delete products[idx].removed;
    db.prepare('UPDATE shops SET products_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(products), Date.now(), id);
    audit(me.id, 'product.restore', `${id}#${idx}`);
    notify(s.owner_id, '「' + products[idx].name + '」已恢复上架', `你好！商品「${products[idx].name}」已经恢复上架，感谢配合。`);
    return { ok: true };
  });

  app.post('/api/admin/media/:id/takedown', async (req, reply) => {
    const me = requireAdmin(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { reason } = Reason.parse(req.body);
    const m = one<{ user_id: string; kind: string; title: string | null; filename: string; shop_id: string } | undefined>('SELECT user_id, kind, title, filename, shop_id FROM shop_media WHERE id = ?', id);
    if (!m) return reply.code(404).send({ error: '资料不存在' });
    db.prepare("UPDATE shop_media SET status = 'removed', removed_reason = ? WHERE id = ?").run(reason, id);
    audit(me.id, 'media.takedown', `${id}:${reason}`);
    const name = m.title ?? m.filename;
    notify(m.user_id, `${kindName[m.kind] ?? '资料'}「${name}」暂时下架了`, `你好！感谢你认真经营小店。你上传的${kindName[m.kind] ?? '资料'}「${name}」${reason}，我们先帮你暂时下架。调整后重新上传就可以了；如有疑问，欢迎回复说明，我们会尽快复核。`);
    return { ok: true };
  });

  app.post('/api/admin/shops/:id/close', async (req, reply) => {
    const me = requireAdmin(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { reason } = Reason.parse(req.body);
    const s = shopOwner(id);
    if (!s) return reply.code(404).send({ error: '店铺不存在' });
    db.prepare("UPDATE shops SET status = 'closed', closed_reason = ?, closed_at = ?, updated_at = ? WHERE id = ?").run(reason, Date.now(), Date.now(), id);
    audit(me.id, 'shop.close', `${id}:${reason}`);
    notify(s.owner_id, `「${s.name}」暂停营业整改`, `你好！我们在巡检中发现小店「${s.name}」${reason}。为了让街区保持安心的氛围，小店先暂停营业整改（铺位为你保留）。整改完成后回复我们，审核通过就会恢复营业。如果是误会，也请直接告诉我们，谢谢理解！`);
    return { ok: true };
  });

  app.post('/api/admin/shops/:id/reopen', async (req, reply) => {
    const me = requireAdmin(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const s = shopOwner(id);
    if (!s) return reply.code(404).send({ error: '店铺不存在' });
    db.prepare("UPDATE shops SET status = 'active', closed_reason = NULL, closed_at = NULL, updated_at = ? WHERE id = ?").run(Date.now(), id);
    audit(me.id, 'shop.reopen', id);
    notify(s.owner_id, `「${s.name}」恢复营业啦`, `你好！小店「${s.name}」已经恢复营业，感谢你的配合，祝生意兴隆！`);
    return { ok: true };
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
