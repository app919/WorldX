/**
 * 公司主页式店铺的资料：公司介绍视频、演讲稿（PPT / PDF，统一转成 PDF 在线翻看）、产品资料（PDF）。
 * - 只有店主能上传 / 删除自己店的资料；上传即上线（违规由管理员下架，并给店主发整改提醒）；
 * - 对外播放 / 翻看走 /api/media/:id（支持视频拖动进度的 Range 请求），被下架的资料不再对外提供。
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { newId } from '../db.js';
import { requireUser } from '../app.js';
import { redactContacts } from '../lib/crypto.js';

const run = promisify(execFile);
export const MEDIA_KINDS = { video: ['.mp4', '.webm', '.mov'], deck: ['.pdf', '.ppt', '.pptx'], product: ['.pdf'] } as const;
const MIME: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.pdf': 'application/pdf' };
export const MEDIA_LIMIT = { video: 5, deck: 3, product: 6 };

export interface MediaRow { id: string; shop_id: string; user_id: string; kind: 'video' | 'deck' | 'product'; title: string | null; filename: string; mime: string; size: number; path: string; view_path: string | null; status: string; removed_reason: string | null; created_at: number }
export const publicMedia = (m: MediaRow) => ({ id: m.id, kind: m.kind, title: m.title ?? m.filename, size: m.size, status: m.status, createdAt: m.created_at, url: `/api/media/${m.id}` });

/** PPT / PPTX 转成 PDF（LibreOffice），方便在浏览器里直接翻看 */
async function toPdf(src: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'slb-deck-'));
  try {
    await run('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, src], { timeout: 120_000 });
    const out = (await readdir(dir)).find((f) => f.endsWith('.pdf'));
    if (!out) throw new Error('转换失败');
    const dst = src.replace(/\.[^.]+$/, '.view.pdf');
    await rename(join(dir, out), dst);
    return dst;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

export async function mediaRoutes(app: FastifyInstance) {
  const db = app.db;
  const myShop = (uid: string) => db.prepare("SELECT id, status FROM shops WHERE owner_id = ?").get(uid) as { id: string; status: string } | undefined;

  app.post('/api/shops/mine/media', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const shop = myShop(me.id);
    if (!shop) return reply.code(404).send({ error: '你还没有开店' });
    if (shop.status !== 'active') return reply.code(403).send({ error: '小店正在整改中，整改完成后再上传' });
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: '请选择文件' });
    const kind = z.enum(['video', 'deck', 'product']).parse((file.fields.kind as { value?: string } | undefined)?.value ?? 'deck');
    const title = redactContacts(String((file.fields.title as { value?: string } | undefined)?.value ?? '').slice(0, 60)) || null;
    const ext = extname(file.filename).toLowerCase();
    if (!(MEDIA_KINDS[kind] as readonly string[]).includes(ext)) return reply.code(400).send({ error: `${kind === 'video' ? '视频' : kind === 'deck' ? '演讲稿' : '产品资料'}只支持 ${MEDIA_KINDS[kind].join(' / ')}` });
    const n = (db.prepare("SELECT COUNT(*) n FROM shop_media WHERE shop_id = ? AND kind = ? AND status != 'removed'").get(shop.id, kind) as { n: number }).n;
    if (n >= MEDIA_LIMIT[kind]) return reply.code(400).send({ error: `最多上传 ${MEDIA_LIMIT[kind]} 个，可以先删掉旧的` });
    const buf = await file.toBuffer();
    const cap = (kind === 'video' ? config.maxVideoMb : config.maxUploadMb) * 1024 * 1024;
    if (file.file.truncated || buf.length > cap) return reply.code(413).send({ error: `文件不能超过 ${cap / 1024 / 1024} MB` });
    const id = newId('med');
    const dir = join(config.uploadDir, me.id, 'media');
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${id}${ext}`);
    await writeFile(path, buf);
    const needsPdf = kind === 'deck' && ext !== '.pdf';
    db.prepare('INSERT INTO shop_media (id, shop_id, user_id, kind, title, filename, mime, size, path, view_path, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, shop.id, me.id, kind, title, file.filename.slice(0, 120), MIME[ext] ?? 'application/octet-stream', buf.length, path, needsPdf ? null : path, needsPdf ? 'converting' : 'live', Date.now());
    if (needsPdf) {
      setImmediate(async () => {
        try { const pdf = await toPdf(path); db.prepare("UPDATE shop_media SET view_path = ?, mime = 'application/pdf', status = 'live' WHERE id = ? AND status = 'converting'").run(pdf, id); }
        catch { db.prepare("UPDATE shop_media SET status = 'failed' WHERE id = ?").run(id); }
      });
    }
    return { media: publicMedia(db.prepare('SELECT * FROM shop_media WHERE id = ?').get(id) as unknown as MediaRow) };
  });

  app.get('/api/shops/mine/media', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const shop = myShop(me.id);
    if (!shop) return { media: [] };
    const rows = db.prepare('SELECT * FROM shop_media WHERE shop_id = ? ORDER BY created_at DESC').all(shop.id) as unknown as MediaRow[];
    return { media: rows.map((m) => ({ ...publicMedia(m), removedReason: m.removed_reason })) };
  });

  app.delete('/api/shops/mine/media/:id', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const r = db.prepare("UPDATE shop_media SET status = 'removed', removed_reason = '店主删除' WHERE id = ? AND user_id = ?").run(id, me.id);
    if (!r.changes) return reply.code(404).send({ error: '资料不存在' });
    return { ok: true };
  });

  /** 对外播放 / 翻看（视频支持 Range，拖动进度条不需要整段下载） */
  app.get('/api/media/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const m = db.prepare('SELECT * FROM shop_media WHERE id = ?').get(id) as MediaRow | undefined;
    const owner = req.user && m && (req.user.id === m.user_id || req.user.role === 'admin');
    if (!m || (m.status !== 'live' && !owner) || !m.view_path) return reply.code(404).send({ error: '资料不存在或已下架' });
    const shop = db.prepare('SELECT status FROM shops WHERE id = ?').get(m.shop_id) as { status: string } | undefined;
    if (shop?.status !== 'active' && !owner) return reply.code(404).send({ error: '小店暂停营业中' });
    const size = (await stat(m.view_path)).size;
    reply.header('Content-Type', m.view_path.endsWith('.pdf') ? 'application/pdf' : m.mime);
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Cache-Control', 'private, max-age=3600');
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) return reply.code(416).header('Content-Range', `bytes */${size}`).send();
      reply.code(206).header('Content-Range', `bytes ${start}-${end}/${size}`).header('Content-Length', end - start + 1);
      return reply.send(createReadStream(m.view_path, { start, end }));
    }
    reply.header('Content-Length', size);
    return reply.send(createReadStream(m.view_path));
  });

  // —— 给店主的通知（管理员整改提醒等） ——
  app.get('/api/me/notices', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const rows = db.prepare('SELECT id, kind, title, body, created_at createdAt, read_at readAt FROM notices WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(me.id);
    return { notices: rows };
  });
  app.post('/api/me/notices/read', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    db.prepare('UPDATE notices SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(Date.now(), me.id);
    return { ok: true };
  });
}
