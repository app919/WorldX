/**
 * 数据库：SQLite（Node 内置 node:sqlite，免费、无需安装数据库服务，WAL 模式）。
 * 所有表结构在这里集中定义并按版本迁移；需要扩容时可平滑迁移到 PostgreSQL（表结构为标准 SQL）。
 */
import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

const MIGRATIONS: string[] = [
  /* 1：用户、会话、验证码、授权 */ `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'user',            -- user | admin
    status TEXT NOT NULL DEFAULT 'active',        -- active | banned
    phone_hash TEXT UNIQUE,                        -- HMAC，唯一性与查找
    phone_enc TEXT,                                -- AES-GCM 加密原文（仅服务端可解密）
    phone_mask TEXT,                               -- 139****5678
    wechat_hash TEXT UNIQUE,                       -- 微信 unionid（无则 openid）的 HMAC
    wechat_enc TEXT,                               -- 加密的 openid / unionid
    nickname TEXT,
    life_tag TEXT,
    look_json TEXT,
    agreed_terms_at INTEGER,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    ua TEXT, ip_hash TEXT
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);
  CREATE TABLE sms_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_hash TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL,                         -- login | bind
    attempts INTEGER NOT NULL DEFAULT 0,
    used INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    ip_hash TEXT
  );
  CREATE INDEX idx_sms_phone ON sms_codes(phone_hash, created_at);
  CREATE TABLE oauth_states (
    state TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,                         -- login | bind
    user_id TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    result_user_id TEXT                            -- 扫码完成后写入，前端轮询拿到登录结果
  );`,
  /* 2：用户数据、店铺、文档 */ `
  CREATE TABLE user_state (
    user_id TEXT NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  CREATE TABLE business_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE shops (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),   -- 每人只能开一家店
    lot_id TEXT NOT NULL UNIQUE,                          -- 一个铺位只能有一家店
    name TEXT NOT NULL,
    tagline TEXT,
    category TEXT,
    facade TEXT,
    owner_name_hash TEXT NOT NULL UNIQUE,                 -- 店主实名唯一（只存哈希与加密原文）
    owner_name_enc TEXT NOT NULL,
    licensed INTEGER NOT NULL DEFAULT 0,
    license_company TEXT,
    license_code_enc TEXT,
    products_json TEXT NOT NULL DEFAULT '[]',
    needs_json TEXT NOT NULL DEFAULT '[]',
    faqs_json TEXT NOT NULL DEFAULT '[]',
    company_intro_json TEXT,                              -- 从上传文档提炼的公司简介（已去敏）
    product_intro_json TEXT,                              -- 从上传文档提炼的产品简介（已去敏）
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE shop_docs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,                                   -- company | product
    filename TEXT NOT NULL,
    mime TEXT, size INTEGER, path TEXT NOT NULL,
    status TEXT NOT NULL,                                 -- parsing | done | failed
    method TEXT,                                          -- rules | claude
    text TEXT,                                            -- 抽取的正文（已去敏）
    summary_json TEXT,                                    -- 提炼出的可展示内容
    error TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_docs_user ON shop_docs(user_id);`,
  /* 3：消息 */ `
  CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL REFERENCES users(id),
    b_id TEXT NOT NULL REFERENCES users(id),
    origin TEXT,                                          -- 从哪里发起：shop:<id> 等
    created_at INTEGER NOT NULL,
    last_msg_at INTEGER,
    UNIQUE (a_id, b_id)
  );
  CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conv_id TEXT NOT NULL REFERENCES conversations(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    has_contact INTEGER NOT NULL DEFAULT 0,               -- 是否包含手机号 / 微信等联系方式（审计标记）
    created_at INTEGER NOT NULL,
    read_at INTEGER
  );
  CREATE INDEX idx_msg_conv ON messages(conv_id, created_at);`,
  /* 4：埋点与管理审计 */ `
  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    day TEXT NOT NULL,                                    -- YYYY-MM-DD（Asia/Shanghai）
    anon_id TEXT NOT NULL,                                -- 设备匿名 id（Cookie）
    user_id TEXT,
    type TEXT NOT NULL,                                   -- pv | click | action
    module TEXT,
    target TEXT,
    path TEXT,
    meta_json TEXT,
    ip_hash TEXT
  );
  CREATE INDEX idx_events_day ON events(day, type);
  CREATE INDEX idx_events_mod ON events(type, module, day);
  CREATE INDEX idx_events_target ON events(type, target, day);
  CREATE INDEX idx_events_user ON events(user_id, day);
  CREATE TABLE admin_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    ts INTEGER NOT NULL
  );`,
];

// 通过 createRequire 加载内置的 node:sqlite（测试运行器对较新的内置模块识别不全）
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
export type DB = DatabaseSyncT;

export function openDb(path = config.dbPath): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, at INTEGER NOT NULL)');
  const done = new Set((db.prepare('SELECT version FROM _migrations').all() as { version: number }[]).map((r) => r.version));
  MIGRATIONS.forEach((sql, i) => {
    const v = i + 1;
    if (done.has(v)) return;
    db.exec('BEGIN');
    try { db.exec(sql); db.prepare('INSERT INTO _migrations (version, at) VALUES (?, ?)').run(v, Date.now()); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  });
  return db;
}

/** 上海时区的日期（埋点按天统计） */
export function dayOf(ts = Date.now()): string {
  return new Date(ts + 8 * 3600_000).toISOString().slice(0, 10);
}

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
