/**
 * 开店资料上传：公司简介 / 产品简介（PPT / PDF / Word / TXT），异步解析，前端轮询结果并在开店时引用。
 * 原始文件只保存在服务器上，不对外提供下载；对外只展示提炼后的、已去掉联系方式的内容。
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { config } from '../config.js';
import { newId } from '../db.js';
import { requireUser } from '../app.js';
import { ACCEPT, parseDoc, type DocKind } from '../lib/docparse.js';

export async function docRoutes(app: FastifyInstance) {
  const db = app.db;

  app.post('/api/uploads/shop-doc', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const n = (db.prepare('SELECT COUNT(*) n FROM shop_docs WHERE user_id = ? AND created_at > ?').get(me.id, Date.now() - 86400_000) as { n: number }).n;
    if (n >= 30) return reply.code(429).send({ error: '今天上传次数太多了' });
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: '请选择文件' });
    const kind = z.enum(['company', 'product']).parse((file.fields.kind as { value?: string } | undefined)?.value ?? 'company') as DocKind;
    const ext = extname(file.filename).toLowerCase();
    if (!ACCEPT.includes(ext)) return reply.code(400).send({ error: `只支持 ${ACCEPT.join(' / ')}` });
    const buf = await file.toBuffer();
    if (file.file.truncated) return reply.code(413).send({ error: `文件不能超过 ${config.maxUploadMb} MB` });
    const id = newId('doc');
    const dir = join(config.uploadDir, me.id);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${id}${ext}`);
    await writeFile(path, buf);
    db.prepare('INSERT INTO shop_docs (id, user_id, kind, filename, mime, size, path, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, me.id, kind, file.filename.slice(0, 120), file.mimetype, buf.length, path, 'parsing', Date.now());
    // 异步解析，不阻塞上传请求
    setImmediate(async () => {
      try {
        const r = await parseDoc(buf, file.filename, kind);
        db.prepare("UPDATE shop_docs SET status = 'done', method = ?, text = ?, summary_json = ? WHERE id = ?").run(r.method, r.text, JSON.stringify(r.summary), id);
      } catch (e) {
        db.prepare("UPDATE shop_docs SET status = 'failed', error = ? WHERE id = ?").run(e instanceof Error ? e.message : String(e), id);
      }
    });
    return { id, status: 'parsing' };
  });

  app.get('/api/uploads/shop-doc/:id', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const d = db.prepare('SELECT id, kind, filename, status, method, summary_json, error, substr(text, 1, 600) preview FROM shop_docs WHERE id = ? AND user_id = ?').get(id, me.id) as
      { id: string; kind: string; filename: string; status: string; method: string | null; summary_json: string | null; error: string | null; preview: string | null } | undefined;
    if (!d) return reply.code(404).send({ error: '文件不存在' });
    return { doc: { id: d.id, kind: d.kind, filename: d.filename, status: d.status, method: d.method, summary: d.summary_json ? JSON.parse(d.summary_json) : null, error: d.error, preview: d.preview } };
  });
}
