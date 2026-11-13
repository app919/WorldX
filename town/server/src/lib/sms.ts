/**
 * 短信验证码发送：
 * - console：开发模式，验证码只打印在服务端日志（不花钱，不能用于生产）；
 * - aliyun：阿里云短信（dysmsapi SendSms，RPC 签名 HMAC-SHA1）；
 * - tencent：腾讯云短信（SendSms 2021-01-11，TC3-HMAC-SHA256 签名；新用户有免费试用条数）。
 * 国内短信都按条计费（约 ¥0.04–0.05/条），没有长期免费的正规渠道。
 */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { config } from '../config.js';

export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const p = config.sms.provider;
  if (p === 'console') { console.log(`[SMS 开发模式] ${phone} 的验证码：${code}`); return; }
  if (p === 'aliyun') return aliyun(phone, code);
  if (p === 'tencent') return tencent(phone, code);
  throw new Error(`未知的短信服务：${p}`);
}

const pe = (s: string) => encodeURIComponent(s).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~');

async function aliyun(phone: string, code: string) {
  const c = config.sms.aliyun;
  if (!c.accessKeyId || !c.accessKeySecret || !c.signName || !c.templateCode) throw new Error('阿里云短信未配置');
  const params: Record<string, string> = {
    AccessKeyId: c.accessKeyId, Action: 'SendSms', Format: 'JSON', PhoneNumbers: phone, RegionId: 'cn-hangzhou',
    SignName: c.signName, SignatureMethod: 'HMAC-SHA1', SignatureNonce: randomUUID(), SignatureVersion: '1.0',
    TemplateCode: c.templateCode, TemplateParam: JSON.stringify({ code }), Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), Version: '2017-05-25',
  };
  const q = Object.keys(params).sort().map((k) => `${pe(k)}=${pe(params[k])}`).join('&');
  const sig = createHmac('sha1', `${c.accessKeySecret}&`).update(`GET&%2F&${pe(q)}`).digest('base64');
  const res = await fetch(`https://dysmsapi.aliyuncs.com/?Signature=${pe(sig)}&${q}`);
  const body = (await res.json()) as { Code?: string; Message?: string };
  if (body.Code !== 'OK') throw new Error(`阿里云短信发送失败：${body.Code} ${body.Message ?? ''}`);
}

async function tencent(phone: string, code: string) {
  const c = config.sms.tencent;
  if (!c.secretId || !c.secretKey || !c.sdkAppId || !c.signName || !c.templateId) throw new Error('腾讯云短信未配置');
  const host = 'sms.tencentcloudapi.com', action = 'SendSms', version = '2021-01-11';
  const ts = Math.floor(Date.now() / 1000), date = new Date(ts * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify({ PhoneNumberSet: [`+86${phone}`], SmsSdkAppId: c.sdkAppId, SignName: c.signName, TemplateId: c.templateId, TemplateParamSet: [code] });
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  const hm = (k: Buffer | string, s: string) => createHmac('sha256', k).update(s).digest();
  const canonical = `POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n\ncontent-type;host;x-tc-action\n${sha(payload)}`;
  const scope = `${date}/sms/tc3_request`;
  const toSign = `TC3-HMAC-SHA256\n${ts}\n${scope}\n${sha(canonical)}`;
  const signing = hm(hm(hm(`TC3${c.secretKey}`, date), 'sms'), 'tc3_request');
  const signature = createHmac('sha256', signing).update(toSign).digest('hex');
  const res = await fetch(`https://${host}`, {
    method: 'POST', body: payload,
    headers: {
      Authorization: `TC3-HMAC-SHA256 Credential=${c.secretId}/${scope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`,
      'Content-Type': 'application/json; charset=utf-8', Host: host, 'X-TC-Action': action, 'X-TC-Timestamp': String(ts), 'X-TC-Version': version, 'X-TC-Region': c.region,
    },
  });
  const body = (await res.json()) as { Response?: { Error?: { Code: string; Message: string }; SendStatusSet?: { Code: string; Message: string }[] } };
  const err = body.Response?.Error ?? (body.Response?.SendStatusSet?.[0]?.Code !== 'Ok' ? body.Response?.SendStatusSet?.[0] : undefined);
  if (err) throw new Error(`腾讯云短信发送失败：${err.Code} ${err.Message}`);
}
