/**
 * 后端接口测试：用内存数据库 + fastify.inject 走完整链路。
 */
import { beforeAll, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.ADMIN_PHONES = '13900000000';
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'slb-up-'));
process.env.WEB_DIST = '/nonexistent';
process.env.SMS_PROVIDER = 'console';
process.env.SMS_RESEND_SEC = '0';
process.env.SMS_DAILY_LIMIT = '1000';
process.env.WECHAT_MODE = 'mock';
delete process.env.ANTHROPIC_API_KEY;

const { buildApp } = await import('../src/app');
const { openDb } = await import('../src/db');
const { usccCheckChar, isGolden, lotPlan } = await import('../../src/domain/lots');
const { allLots } = await import('../../src/world');

type App = ReturnType<typeof buildApp>;
let app: App;
const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const sc = res.headers['set-cookie'];
  const arr = Array.isArray(sc) ? sc : sc ? [String(sc)] : [];
  return arr.map((c) => c.split(';')[0]).join('; ');
};
async function login(phone: string, ip = '10.0.0.1') {
  const s = await app.inject({ method: 'POST', url: '/api/auth/sms/send', payload: { phone }, remoteAddress: ip });
  expect(s.statusCode).toBe(200);
  const code = s.json().devCode as string;
  const v = await app.inject({ method: 'POST', url: '/api/auth/sms/verify', payload: { phone, code, agree: true } });
  expect(v.statusCode).toBe(200);
  return { cookie: cookieOf(v), user: v.json().user };
}
const req = (cookie: string) => ({ headers: { cookie } });
const freeOpcLot = (skip = 0) => allLots().filter((l) => l.district === 'wukang' && l.door.lotId!.startsWith('wukang_lot') && !isGolden(l.door.lotId!))[skip].door.lotId!;
const shopBody = (over: Record<string, unknown> = {}) => ({
  lotId: freeOpcLot(), name: '阿岚影像', tagline: '欢迎咨询，手机 13912345678，微信 alan_studio88', category: '内容与传媒', facade: 'studio', ownerName: '张阿岚',
  products: [{ name: '产品短视频', description: '15 秒成片', priceFrom: 800, unit: '条', priceConfirmed: true }], needs: ['客户'], faqs: [], ...over,
});

beforeAll(async () => {
  app = buildApp({ db: openDb(':memory:'), logger: false });
  await app.ready();
});

describe('注册 / 登录', () => {
  it('手机号 + 验证码：必须同意协议；验证码错误计次；登录后 /api/me 只有脱敏手机号', async () => {
    const s = await app.inject({ method: 'POST', url: '/api/auth/sms/send', payload: { phone: '13811112222' } });
    const code = s.json().devCode;
    expect((await app.inject({ method: 'POST', url: '/api/auth/sms/verify', payload: { phone: '13811112222', code, agree: false } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/auth/sms/verify', payload: { phone: '13811112222', code: '000000', agree: true } })).json().error).toContain('不正确');
    const v = await app.inject({ method: 'POST', url: '/api/auth/sms/verify', payload: { phone: '13811112222', code, agree: true } });
    expect(v.json().isNew).toBe(true);
    const me = (await app.inject({ method: 'GET', url: '/api/me', ...req(cookieOf(v)) })).json().user;
    expect(me.phoneMasked).toBe('138****2222');
    expect(JSON.stringify(me)).not.toContain('13811112222');
    // 同一验证码不能复用
    expect((await app.inject({ method: 'POST', url: '/api/auth/sms/verify', payload: { phone: '13811112222', code, agree: true } })).statusCode).toBe(400);
  });
  it('发送频率限制；格式错误被拒', async () => {
    const { config } = await import('../src/config');
    const saved = config.sms.resendSec;
    config.sms.resendSec = 60;
    await app.inject({ method: 'POST', url: '/api/auth/sms/send', payload: { phone: '13811113333' } });
    expect((await app.inject({ method: 'POST', url: '/api/auth/sms/send', payload: { phone: '13811113333' } })).statusCode).toBe(429);
    config.sms.resendSec = saved;
    expect((await app.inject({ method: 'POST', url: '/api/auth/sms/send', payload: { phone: '12345' } })).statusCode).toBe(400);
  });
  it('微信扫码（模拟）：开始 → 扫码确认 → 轮询拿到登录态；同一微信再次登录是同一个账号', async () => {
    const st = (await app.inject({ method: 'POST', url: '/api/auth/wechat/start', payload: { agree: true } })).json();
    expect(st.url).toContain('/api/auth/wechat/mock');
    expect((await app.inject({ method: 'GET', url: `/api/auth/wechat/poll?state=${st.state}` })).json().done).toBe(false);
    const page = (await app.inject({ method: 'GET', url: `/api/auth/wechat/mock?state=${st.state}` })).body;
    const href = page.match(/href="([^"]+)"/)![1].replace(/&amp;/g, '&');
    expect((await app.inject({ method: 'GET', url: href })).body).toContain('授权成功');
    const p = await app.inject({ method: 'GET', url: `/api/auth/wechat/poll?state=${st.state}` });
    expect(p.json().done).toBe(true);
    const me = (await app.inject({ method: 'GET', url: '/api/me', ...req(cookieOf(p)) })).json().user;
    expect(me.wechatBound).toBe(true);
    expect(me.phoneMasked).toBeNull();
    expect(JSON.stringify(me)).not.toMatch(/openid|unionid/);
  });
  it('跨站请求被拒绝', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/sms/send', payload: { phone: '13811114444' }, headers: { origin: 'https://evil.example.com' } });
    expect(r.statusCode).toBe(403);
  });
});

describe('店铺：每人一家、黄金位、执照、隐私', () => {
  it('开店成功；公开信息不含手机号 / 微信 / 实名 / 信用代码', async () => {
    const { cookie, user } = await login('13822220001');
    const code = '91310000MA1FL0000' + usccCheckChar('91310000MA1FL0000');
    const r = await app.inject({ method: 'POST', url: '/api/shops', ...req(cookie), payload: shopBody({ license: { company: '上海阿岚影像工作室', code } }) });
    expect(r.statusCode).toBe(200);
    const pub = (await app.inject({ method: 'GET', url: '/api/shops' })).json().shops[0];
    const s = JSON.stringify(pub);
    expect(pub.licensed).toBe(true);
    expect(pub.ownerUserId).toBe(user.id);
    for (const leak of ['13912345678', 'alan_studio88', '张阿岚', code, '13822220001', '138****0001']) expect(s).not.toContain(leak);
    expect(pub.tagline).toContain('已隐藏');
  });
  it('同一个人不能开第二家店；同一铺位 / 同一实名不能重复；黄金位不能开；执照代码要校验；未绑定手机号不能开店', async () => {
    const { cookie } = await login('13822220001');
    expect((await app.inject({ method: 'POST', url: '/api/shops', ...req(cookie), payload: shopBody({ lotId: freeOpcLot(1) }) })).json().error).toContain('只能开一家');
    const b = await login('13822220002');
    expect((await app.inject({ method: 'POST', url: '/api/shops', ...req(b.cookie), payload: shopBody({ ownerName: '李四' }) })).json().error).toContain('已经有人开店');
    expect((await app.inject({ method: 'POST', url: '/api/shops', ...req(b.cookie), payload: shopBody({ lotId: freeOpcLot(2) }) })).json().error).toContain('姓名已经登记');
    expect((await app.inject({ method: 'POST', url: '/api/shops', ...req(b.cookie), payload: shopBody({ lotId: lotPlan('wukang').golden[3], ownerName: '王五' }) })).json().error).toContain('黄金位');
    expect((await app.inject({ method: 'POST', url: '/api/shops', ...req(b.cookie), payload: shopBody({ lotId: freeOpcLot(2), ownerName: '王五', license: { company: '某某有限公司', code: '91310000MA1FL0000A' } }) })).json().error).toMatch(/信用代码|^$/);
    const st = (await app.inject({ method: 'POST', url: '/api/auth/wechat/start', payload: { agree: true } })).json();
    const page = (await app.inject({ method: 'GET', url: `/api/auth/wechat/mock?state=${st.state}` })).body;
    await app.inject({ method: 'GET', url: page.match(/href="([^"]+)"/)![1].replace(/&amp;/g, '&') });
    const wx = cookieOf(await app.inject({ method: 'GET', url: `/api/auth/wechat/poll?state=${st.state}` }));
    expect((await app.inject({ method: 'POST', url: '/api/shops', ...req(wx), payload: shopBody({ lotId: freeOpcLot(3), ownerName: '赵六' }) })).json().error).toContain('绑定手机号');
  });
});

describe('开店资料：PPT / Word / PDF / 旧版 Word 解析与提炼', () => {
  const pptx = async () => {
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
    const slide = (lines: string[]) => `<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>${lines.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join('')}</p:spTree></p:cSld></p:sld>`;
    z.file('ppt/slides/slide1.xml', slide(['阿岚影像工作室', '专注咖啡与甜品品牌的产品影像。我们为 30 多个本地品牌拍摄过新品。', '联系电话：13912345678']));
    z.file('ppt/slides/slide2.xml', slide(['核心优势', '• 自带 20 平米摄影棚', '• 48 小时交付', '微信：alan_studio88']));
    z.file('ppt/slides/slide3.xml', slide(['产品短视频：15–30 秒新品宣传片', '白底产品图：电商主图与详情页', '服务客户：咖啡品牌、烘焙店、文创店']));
    return z.generateAsync({ type: 'nodebuffer' });
  };
  const docx = async () => {
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    z.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
    z.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p('梧桐豆子咖啡')}${p('独立咖啡品牌，小批量烘焙，坚持使用当季生豆。')}${p('产品：梧桐拼配豆、挂耳咖啡、联名饮品')}${p('邮箱 hello@wutong.cn')}</w:body></w:document>`);
    return z.generateAsync({ type: 'nodebuffer' });
  };
  async function upload(cookie: string, name: string, buf: Buffer, kind = 'company') {
    const boundary = '----slb' + Math.random().toString(16).slice(2);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      buf, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const r = await app.inject({ method: 'POST', url: '/api/uploads/shop-doc', headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: body });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().id;
    for (let i = 0; i < 300; i++) {
      const d = (await app.inject({ method: 'GET', url: `/api/uploads/shop-doc/${id}`, headers: { cookie } })).json().doc;
      if (d.status !== 'parsing') return d;
      await new Promise((res) => setTimeout(res, 100));
    }
    throw new Error('解析超时');
  }
  it('PPTX：按页抽取文字，提炼出标题 / 简介 / 亮点 / 产品，去掉手机号与微信号', async () => {
    const { cookie } = await login('13833330001');
    const d = await upload(cookie, '公司介绍.pptx', await pptx(), 'product');
    expect(d.status).toBe('done');
    expect(d.method).toBe('rules');
    const s = JSON.stringify(d.summary) + d.preview;
    expect(s).not.toContain('13912345678');
    expect(s).not.toContain('alan_studio88');
    expect(d.summary.title).toBe('阿岚影像工作室');
    expect(d.summary.highlights.join()).toContain('48 小时交付');
    expect(d.summary.products.map((p: { name: string }) => p.name)).toContain('产品短视频');
  });
  it('DOCX 与 PDF：可以解析；邮箱被隐藏', async () => {
    const { cookie } = await login('13833330002');
    const d = await upload(cookie, '品牌介绍.docx', await docx());
    expect(d.status).toBe('done');
    expect(d.summary.title).toBe('梧桐豆子咖啡');
    expect(JSON.stringify(d)).not.toContain('hello@wutong.cn');
    const dir = mkdtempSync(join(tmpdir(), 'slb-pdf-'));
    writeFileSync(join(dir, 'in.txt'), '光影小棚\n产品摄影工作室，自带二十平米摄影棚。\n服务：白底图、场景图\n');
    execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, join(dir, 'in.txt')], { timeout: 60_000 });
    const pdf = await upload(cookie, '介绍.pdf', readFileSync(join(dir, 'in.pdf')));
    expect(pdf.status).toBe('done');
    expect(pdf.summary.title).toContain('光影小棚');
  }, 90_000);
  it('旧版 .doc：用 LibreOffice 转换后解析；不支持的格式被拒；空文件报错', async () => {
    const { cookie } = await login('13833330003');
    const dir = mkdtempSync(join(tmpdir(), 'slb-doc-'));
    writeFileSync(join(dir, 'in.txt'), '街角书店\n独立书店，二楼可以办 30 人读书会。\n');
    execFileSync('soffice', ['--headless', '--convert-to', 'doc', '--outdir', dir, join(dir, 'in.txt')], { timeout: 60_000 });
    const d = await upload(cookie, '书店.doc', readFileSync(join(dir, 'in.doc')));
    expect(d.status, d.error).toBe('done');
    expect(d.summary.title).toContain('街角书店');
    const boundary = 'xx';
    const bad = await app.inject({ method: 'POST', url: '/api/uploads/shop-doc', headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.exe"\r\n\r\nMZ\r\n--${boundary}--\r\n` });
    expect(bad.statusCode).toBe(400);
    const empty = await upload(cookie, '空.txt', Buffer.from('  '));
    expect(empty.status).toBe('failed');
  }, 120_000);
  it('开店时引用解析好的资料，公开店铺展示提炼后的公司简介', async () => {
    const { cookie } = await login('13833330004');
    const d = await upload(cookie, '公司介绍.pptx', await pptx());
    const r = await app.inject({ method: 'POST', url: '/api/shops', ...req(cookie), payload: shopBody({ lotId: freeOpcLot(5), ownerName: '陈七', tagline: '你好', companyDocId: d.id }) });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().shop.companyIntro.title).toBe('阿岚影像工作室');
  });
});

describe('私信、留微信号按钮、埋点与管理后台', () => {
  it('双方可以互发消息；对方看到的联系方式被隐藏，管理员看到原文；第三人看不到', async () => {
    const a = await login('13844440001'), b = await login('13844440002'), c = await login('13844440003');
    const conv = (await app.inject({ method: 'POST', url: '/api/conversations', ...req(a.cookie), payload: { peerId: b.user.id, origin: 'shop:test' } })).json().conversation;
    const sent = await app.inject({ method: 'POST', url: `/api/conversations/${conv.id}/messages`, ...req(a.cookie), payload: { body: '你好，我的手机 13812345678，可以聊聊合作吗' } });
    expect(sent.json().contactHidden).toBe(true);
    await app.inject({ method: 'POST', url: `/api/conversations/${conv.id}/messages`, ...req(b.cookie), payload: { body: '可以的，周三下午方便' } });
    const forB = (await app.inject({ method: 'GET', url: `/api/conversations/${conv.id}/messages`, ...req(b.cookie) })).json().messages;
    expect(forB).toHaveLength(2);
    expect(forB[0].body).not.toContain('13812345678');
    expect((await app.inject({ method: 'GET', url: '/api/conversations', ...req(b.cookie) })).json().conversations[0].unread).toBe(1);
    expect((await app.inject({ method: 'GET', url: `/api/conversations/${conv.id}/messages`, ...req(c.cookie) })).statusCode).toBe(404);
    const w = await app.inject({ method: 'POST', url: `/api/conversations/${conv.id}/wechat-click`, ...req(a.cookie) });
    expect(w.json().message).toContain('即将上线');
    // 管理员
    const admin = await login('13900000000');
    expect((await app.inject({ method: 'GET', url: '/api/admin/conversations', ...req(a.cookie) })).statusCode).toBe(403);
    const list = (await app.inject({ method: 'GET', url: '/api/admin/conversations?flagged=1', ...req(admin.cookie) })).json().conversations;
    const row = list.find((x: { id: string }) => x.id === conv.id);
    expect(row.flagged).toBe(1);
    expect(row.wechatClicks).toBe(1);
    const msgs = (await app.inject({ method: 'GET', url: `/api/admin/conversations/${conv.id}`, ...req(admin.cookie) })).json().messages;
    expect(msgs[0].body).toContain('13812345678');
    const audit = (await app.inject({ method: 'GET', url: '/api/admin/audit', ...req(admin.cookie) })).json().audit;
    expect(audit.some((x: { action: string; target: string }) => x.action === 'view_conversation' && x.target === conv.id)).toBe(true);
  });
  it('埋点：PV / 点击按模块与按钮统计 PV 与 UV；看板有注册用户、活跃用户、留微信点击', async () => {
    const a = await login('13855550001');
    const ev = (type: string, module: string, target?: string) => ({ type, module, target, path: '/' });
    await app.inject({ method: 'POST', url: '/api/track', ...req(a.cookie), payload: { events: [ev('pv', 'city'), ev('pv', 'opps'), ev('click', 'opps', 'bid-open'), ev('click', 'opps', 'bid-open')] } });
    await app.inject({ method: 'POST', url: '/api/track', payload: { events: [ev('pv', 'opps'), ev('click', 'opps', 'bid-open')] } }); // 另一个匿名设备
    const admin = await login('13900000000');
    const ov = (await app.inject({ method: 'GET', url: '/api/admin/overview?days=7', ...req(admin.cookie) })).json();
    expect(ov.totals.users).toBeGreaterThan(5);
    expect(ov.totals.dau).toBeGreaterThanOrEqual(1);
    expect(ov.totals.wechatClicks).toBeGreaterThanOrEqual(1);
    expect(ov.series).toHaveLength(7);
    const mods = (await app.inject({ method: 'GET', url: '/api/admin/modules', ...req(admin.cookie) })).json().modules;
    const opps = mods.find((m: { module: string }) => m.module === 'opps');
    expect(opps.pv).toBe(2); expect(opps.uv).toBe(2); expect(opps.clicks).toBe(3); expect(opps.clickUv).toBe(2);
    const clicks = (await app.inject({ method: 'GET', url: '/api/admin/clicks?module=opps', ...req(admin.cookie) })).json().clicks;
    expect(clicks[0]).toMatchObject({ target: 'bid-open', pv: 3, uv: 2 });
    const users = (await app.inject({ method: 'GET', url: '/api/admin/users', ...req(admin.cookie) })).json().users;
    expect(JSON.stringify(users)).not.toMatch(/1385555000\d/);
  });
  it('进度数据保存在服务端（换设备也在）', async () => {
    const a = await login('13866660001');
    await app.inject({ method: 'PUT', url: '/api/me/state/opp', ...req(a.cookie), payload: { state: { myOpps: [{ id: 'x' }] } } });
    const again = await login('13866660001');
    const st = (await app.inject({ method: 'GET', url: '/api/me/state', ...req(again.cookie) })).json().state;
    expect(st.opp.data.state.myOpps[0].id).toBe('x');
    expect((await app.inject({ method: 'PUT', url: '/api/me/state/evil', ...req(a.cookie), payload: {} })).statusCode).toBe(400);
  });
});
