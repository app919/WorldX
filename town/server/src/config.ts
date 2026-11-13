/**
 * 服务端配置：全部来自环境变量（见 server/.env.example）。
 * 生产环境必须设置 SESSION_SECRET 与 DATA_KEY，否则拒绝启动。
 */
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const env = process.env;
export const isProd = env.NODE_ENV === 'production';

function secret(name: string, bytes = 32): string {
  const v = env[name];
  if (v) return v;
  if (isProd) throw new Error(`生产环境必须设置环境变量 ${name}`);
  // 开发环境：使用固定的开发密钥（不要用于生产）
  return `dev-${name}-${'x'.repeat(bytes)}`.slice(0, bytes * 2);
}

export const config = {
  port: Number(env.PORT ?? 8787),
  host: env.HOST ?? '0.0.0.0',
  publicUrl: env.PUBLIC_URL ?? 'http://localhost:8787',
  dbPath: env.DB_PATH ?? resolve(import.meta.dirname, '../data/sanlinbang.db'),
  uploadDir: env.UPLOAD_DIR ?? resolve(import.meta.dirname, '../data/uploads'),
  webDist: env.WEB_DIST ?? resolve(import.meta.dirname, '../../dist'),
  /** 会话签名 / 哈希用密钥 */
  sessionSecret: secret('SESSION_SECRET'),
  /** 手机号、微信 openid 等敏感字段的 AES-256-GCM 加密密钥（64 位十六进制） */
  dataKey: env.DATA_KEY ?? (isProd ? (() => { throw new Error('生产环境必须设置 DATA_KEY（64 位十六进制）'); })() : '0'.repeat(64)),
  sessionDays: Number(env.SESSION_DAYS ?? 30),
  /** 短信：console（开发，验证码打印在日志里）| aliyun | tencent */
  sms: {
    provider: (env.SMS_PROVIDER ?? 'console') as 'console' | 'aliyun' | 'tencent',
    aliyun: { accessKeyId: env.ALIYUN_ACCESS_KEY_ID ?? '', accessKeySecret: env.ALIYUN_ACCESS_KEY_SECRET ?? '', signName: env.ALIYUN_SMS_SIGN ?? '', templateCode: env.ALIYUN_SMS_TEMPLATE ?? '' },
    tencent: { secretId: env.TENCENT_SECRET_ID ?? '', secretKey: env.TENCENT_SECRET_KEY ?? '', sdkAppId: env.TENCENT_SMS_APP_ID ?? '', signName: env.TENCENT_SMS_SIGN ?? '', templateId: env.TENCENT_SMS_TEMPLATE ?? '', region: env.TENCENT_SMS_REGION ?? 'ap-guangzhou' },
    codeTtlSec: 300, resendSec: Number(env.SMS_RESEND_SEC ?? 60), dailyLimit: Number(env.SMS_DAILY_LIMIT ?? 10),
  },
  /** 微信开放平台「网站应用」扫码登录；WECHAT_MODE=mock 时使用本地模拟扫码页（仅开发） */
  wechat: { mode: (env.WECHAT_MODE ?? (env.WECHAT_APP_ID ? 'live' : 'mock')) as 'live' | 'mock', appId: env.WECHAT_APP_ID ?? '', appSecret: env.WECHAT_APP_SECRET ?? '' },
  /** 文档解析：默认使用免费的规则提取；可选配置 ANTHROPIC_API_KEY 用 Claude 提炼（付费，可不配） */
  anthropicKey: env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
  /** 初始管理员手机号（逗号分隔）：这些手机号登录后自动获得管理员权限 */
  adminPhones: (env.ADMIN_PHONES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  maxUploadMb: Number(env.MAX_UPLOAD_MB ?? 25),
  devToken: randomBytes(8).toString('hex'),
};

if (isProd && config.sms.provider === 'console') throw new Error('生产环境不能使用 SMS_PROVIDER=console，请配置 aliyun 或 tencent');
if (isProd && config.wechat.mode === 'mock') throw new Error('生产环境不能使用 WECHAT_MODE=mock，请配置 WECHAT_APP_ID / WECHAT_APP_SECRET');
