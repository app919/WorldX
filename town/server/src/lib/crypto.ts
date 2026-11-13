/**
 * 敏感信息保护：
 * - 手机号 / 微信 unionid：HMAC-SHA256 哈希用于唯一性与查找（不可逆），AES-256-GCM 加密保存原文（仅服务端需要时解密）；
 * - 对外只给脱敏形式（如 139****5678）；任何公开接口都不返回原文、哈希或密文。
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const key = Buffer.from(config.dataKey, 'hex');

export const hmac = (v: string, purpose = 'id') => createHmac('sha256', config.sessionSecret).update(`${purpose}:${v}`).digest('hex');

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

export const token = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const maskPhone = (p: string) => p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
export const validPhone = (p: string) => /^1[3-9]\d{9}$/.test(p);
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** 公开内容去敏：手机号、座机、微信号、邮箱一律替换（店铺介绍、解析出的文档内容等） */
export function redactContacts(text: string): string {
  return text
    .replace(/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/g, '［手机号已隐藏］')
    .replace(/(?<!\d)0\d{2,3}[-\s]?\d{7,8}(?!\d)/g, '［电话已隐藏］')
    .replace(/(微信|vx|v信|wechat|weixin|wx)\s*[号:：]?\s*[a-zA-Z][-_a-zA-Z0-9]{5,19}/gi, '［微信号已隐藏］')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '［邮箱已隐藏］');
}

/** 是否包含联系方式（用于消息审计标记） */
export const hasContact = (text: string) => redactContacts(text) !== text;
