/**
 * 店铺：
 * - 每人只能开一家店（owner_id 唯一，且店主实名唯一）；需要已验证手机号；
 * - 只能开在 OPC 招租位（60%），黄金位留给赞助商；一个铺位只能一家店；
 * - 有营业执照需填企业名称 + 统一社会信用代码（校验位），店铺显示「企」角标；
 * - 公开接口只返回白名单字段：绝不包含手机号、微信、实名、信用代码；所有文字自动去掉联系方式。
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { newId } from '../db.js';
import { encrypt, hmac, redactContacts } from '../lib/crypto.js';
import { requireUser } from '../app.js';
import { isGolden, takenByDemo, validUSCC } from '../../../src/domain/lots';
import { lotById } from '../../../src/world';

const Product = z.object({ name: z.string().trim().min(1).max(30), description: z.string().max(200).default(''), priceFrom: z.number().nonnegative().max(1e8).optional(), unit: z.string().max(10).optional(), priceConfirmed: z.boolean().default(false) });
const ShopInput = z.object({
  lotId: z.string(),
  name: z.string().trim().min(2).max(16),
  tagline: z.string().max(40).default(''),
  category: z.string().max(20),
  facade: z.enum(['cafe', 'studio', 'shikumen', 'kiosk']),
  ownerName: z.string().trim().min(2).max(20),
  license: z.object({ company: z.string().trim().min(4).max(60), code: z.string().trim() }).nullable().optional(),
  products: z.array(Product).min(1).max(10),
  needs: z.array(z.string().max(20)).max(10).default([]),
  faqs: z.array(z.object({ q: z.string().max(60), a: z.string().max(300) })).max(10).default([]),
  companyDocId: z.string().optional(),
  productDocId: z.string().optional(),
});

export interface ShopRow {
  id: string; owner_id: string; lot_id: string; name: string; tagline: string; category: string; facade: string; licensed: number; license_company: string | null;
  products_json: string; needs_json: string; faqs_json: string; company_intro_json: string | null; product_intro_json: string | null; created_at: number; updated_at: number;
}

/** 公开的店铺信息（白名单） */
export function publicShop(s: ShopRow, ownerNickname: string | null) {
  return {
    id: s.id, lotId: s.lot_id, name: s.name, tagline: s.tagline, category: s.category, facade: s.facade,
    licensed: !!s.licensed, licenseCompany: s.license_company, ownerUserId: s.owner_id, ownerNickname: ownerNickname ?? '店主',
    products: JSON.parse(s.products_json), needs: JSON.parse(s.needs_json), faqs: JSON.parse(s.faqs_json),
    companyIntro: s.company_intro_json ? JSON.parse(s.company_intro_json) : null, productIntro: s.product_intro_json ? JSON.parse(s.product_intro_json) : null,
    createdAt: s.created_at,
  };
}

const clean = <T>(v: T): T => JSON.parse(redactContacts(JSON.stringify(v)));

export async function shopRoutes(app: FastifyInstance) {
  const db = app.db;
  const withOwner = (s: ShopRow) => publicShop(s, (db.prepare('SELECT nickname FROM users WHERE id = ?').get(s.owner_id) as { nickname: string | null } | undefined)?.nickname ?? null);

  app.get('/api/shops', async () => ({ shops: (db.prepare("SELECT * FROM shops WHERE status = 'active' ORDER BY created_at DESC LIMIT 500").all() as unknown as ShopRow[]).map(withOwner) }));
  app.get('/api/shops/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const s = db.prepare("SELECT * FROM shops WHERE id = ? AND status = 'active'").get(id) as ShopRow | undefined;
    if (!s) return reply.code(404).send({ error: '店铺不存在' });
    return { shop: withOwner(s) };
  });
  app.get('/api/shops/mine', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const s = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(me.id) as ShopRow | undefined;
    return { shop: s ? withOwner(s) : null };
  });

  /** 校验并写入解析好的文档简介 */
  function introFromDoc(userId: string, docId: string | undefined, kind: 'company' | 'product'): string | null {
    if (!docId) return null;
    const d = db.prepare("SELECT summary_json FROM shop_docs WHERE id = ? AND user_id = ? AND kind = ? AND status = 'done'").get(docId, userId, kind) as { summary_json: string } | undefined;
    if (!d) throw Object.assign(new Error(kind === 'company' ? '公司简介文档还没解析完成' : '产品简介文档还没解析完成'), { statusCode: 400 });
    return d.summary_json;
  }

  app.post('/api/shops', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    if (!me.phone_hash) return reply.code(400).send({ error: '开店需要先绑定手机号（每人只能开一家店）' });
    const b = ShopInput.parse(req.body);
    const err: string[] = [];
    const lot = lotById(b.lotId);
    if (!lot) err.push('铺位不存在');
    else if (isGolden(b.lotId)) err.push('这是黄金位（留给赞助商），请选择 OPC 招租位');
    else if (takenByDemo().has(b.lotId)) err.push('这个铺位已有店铺');
    if (db.prepare('SELECT 1 FROM shops WHERE owner_id = ?').get(me.id)) err.push('你已经开过一家店了（每人只能开一家店）');
    if (db.prepare('SELECT 1 FROM shops WHERE lot_id = ?').get(b.lotId)) err.push('这个铺位已经有人开店了');
    const nameHash = hmac(b.ownerName, 'owner-name');
    if (db.prepare('SELECT 1 FROM shops WHERE owner_name_hash = ?').get(nameHash)) err.push('这个店主姓名已经登记过店铺（每人只能开一家店）');
    if (b.license && !validUSCC(b.license.code)) err.push('统一社会信用代码不正确（18 位，含校验位）');
    if (err.length) return reply.code(400).send({ error: err.join('；'), errors: err });
    const id = newId('shop'), now = Date.now();
    const companyIntro = introFromDoc(me.id, b.companyDocId, 'company');
    const productIntro = introFromDoc(me.id, b.productDocId, 'product');
    try {
      db.prepare(`INSERT INTO shops (id, owner_id, lot_id, name, tagline, category, facade, owner_name_hash, owner_name_enc, licensed, license_company, license_code_enc,
        products_json, needs_json, faqs_json, company_intro_json, product_intro_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, me.id, b.lotId, redactContacts(b.name), redactContacts(b.tagline), b.category, b.facade, nameHash, encrypt(b.ownerName), b.license ? 1 : 0,
          b.license ? redactContacts(b.license.company) : null, b.license ? encrypt(b.license.code.toUpperCase()) : null,
          JSON.stringify(clean(b.products)), JSON.stringify(clean(b.needs)), JSON.stringify(clean(b.faqs)), companyIntro, productIntro, now, now);
    } catch (e) {
      // 并发情况下由数据库唯一约束兜底
      if (String(e).includes('UNIQUE')) return reply.code(409).send({ error: '铺位或店主信息已被占用，请刷新后重试' });
      throw e;
    }
    return { shop: withOwner(db.prepare('SELECT * FROM shops WHERE id = ?').get(id) as unknown as ShopRow) };
  });

  app.put('/api/shops/mine', async (req, reply) => {
    const me = requireUser(req, reply); if (!me) return;
    const s = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(me.id) as ShopRow | undefined;
    if (!s) return reply.code(404).send({ error: '你还没有开店' });
    const b = ShopInput.pick({ name: true, tagline: true, category: true, facade: true, products: true, needs: true, faqs: true, companyDocId: true, productDocId: true }).partial().parse(req.body);
    const sets: string[] = [], vals: (string | number | null)[] = [];
    const put = (col: string, v: string | number | null) => { sets.push(`${col} = ?`); vals.push(v); };
    if (b.name) put('name', redactContacts(b.name));
    if (b.tagline !== undefined) put('tagline', redactContacts(b.tagline));
    if (b.category) put('category', b.category);
    if (b.facade) put('facade', b.facade);
    if (b.products) put('products_json', JSON.stringify(clean(b.products)));
    if (b.needs) put('needs_json', JSON.stringify(clean(b.needs)));
    if (b.faqs) put('faqs_json', JSON.stringify(clean(b.faqs)));
    if (b.companyDocId) put('company_intro_json', introFromDoc(me.id, b.companyDocId, 'company'));
    if (b.productDocId) put('product_intro_json', introFromDoc(me.id, b.productDocId, 'product'));
    put('updated_at', Date.now());
    db.prepare(`UPDATE shops SET ${sets.join(', ')} WHERE id = ?`).run(...vals, s.id);
    return { shop: withOwner(db.prepare('SELECT * FROM shops WHERE id = ?').get(s.id) as unknown as ShopRow) };
  });

  /** 其他用户的公开名片（昵称、生活标签、小店），不含任何联系方式 */
  app.get('/api/users/:id/public', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const u = db.prepare("SELECT id, nickname, life_tag, look_json FROM users WHERE id = ? AND status = 'active'").get(id) as { id: string; nickname: string | null; life_tag: string | null; look_json: string | null } | undefined;
    if (!u) return reply.code(404).send({ error: '用户不存在' });
    const s = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(id) as ShopRow | undefined;
    return { user: { id: u.id, nickname: u.nickname ?? '邻居', lifeTag: u.life_tag, look: u.look_json ? JSON.parse(u.look_json) : null, shop: s ? withOwner(s) : null } };
  });
}
