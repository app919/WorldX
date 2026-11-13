/**
 * 微信扫码登录（微信开放平台「网站应用」OAuth2，接口本身免费；开放平台开发者认证 ¥300/年）：
 *   1. 前端拿到 qrconnect 地址并展示二维码（官方扫码页）；
 *   2. 用户用微信扫码并确认授权，微信回调 /api/auth/wechat/callback?code&state；
 *   3. 服务端用 code 换 access_token + openid / unionid（不向前端返回这些标识）。
 * WECHAT_MODE=mock 时用本地模拟扫码页（仅开发 / 测试）。
 */
import { config } from '../config.js';

export function qrConnectUrl(state: string): string {
  const redirect = encodeURIComponent(`${config.publicUrl}/api/auth/wechat/callback`);
  if (config.wechat.mode === 'mock') return `${config.publicUrl}/api/auth/wechat/mock?state=${encodeURIComponent(state)}`;
  return `https://open.weixin.qq.com/connect/qrconnect?appid=${config.wechat.appId}&redirect_uri=${redirect}&response_type=code&scope=snsapi_login&state=${encodeURIComponent(state)}#wechat_redirect`;
}

export interface WechatIdentity { id: string; openid: string; nickname?: string }

export async function exchangeCode(code: string): Promise<WechatIdentity> {
  if (config.wechat.mode === 'mock') {
    if (!code.startsWith('mock_')) throw new Error('无效的模拟授权码');
    return { id: `mock-unionid-${code.slice(5)}`, openid: `mock-openid-${code.slice(5)}`, nickname: '微信用户' };
  }
  const { appId, appSecret } = config.wechat;
  const r = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${encodeURIComponent(code)}&grant_type=authorization_code`);
  const t = (await r.json()) as { access_token?: string; openid?: string; unionid?: string; errcode?: number; errmsg?: string };
  if (!t.access_token || !t.openid) throw new Error(`微信授权失败：${t.errcode} ${t.errmsg}`);
  let nickname: string | undefined;
  try {
    const u = (await (await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${t.access_token}&openid=${t.openid}`)).json()) as { nickname?: string };
    nickname = u.nickname;
  } catch { /* 昵称不是必需的 */ }
  return { id: t.unionid ?? t.openid, openid: t.openid, nickname };
}
