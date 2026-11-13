/**
 * 正式模式（连接后端）全链路走查：
 *   注册登录（手机号 + 验证码）→ 新手引导 → 开店（上传 PPT 公司简介并解析）→ 另一个用户走进这家店 → 私信（含联系方式隐藏）
 *   → 留微信号按钮 → 对方回复 → 刷新后进度还在 → 管理员看板（用户、活跃、PV/UV、模块、点击、留微信、消息审查、审计）
 * 用法：先启动后端（ADMIN_PHONES=13900000000），再 BASE_URL=http://localhost:8787 node e2e/backend-flow.cjs
 */
const { chromium } = require('playwright');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8787';
const OUT = process.env.OUT_DIR || path.join(__dirname, 'backend-flow');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const must = (c, m) => { if (!c) throw new Error(m); };

async function step(name, page, fn) {
  const t = Date.now();
  try { const d = await fn(); results.push({ name, ok: true }); console.log(`✅ ${name}${d ? ` — ${d}` : ''} (${((Date.now() - t) / 1000).toFixed(1)}s)`); }
  catch (e) { results.push({ name, ok: false, err: String(e).split('\n')[0] }); console.log(`❌ ${name} — ${String(e).split('\n')[0]}`); await page.screenshot({ path: path.join(OUT, `FAIL-${results.length}.png`) }).catch(() => {}); }
}

async function makePptx(file) {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  const slide = (lines) => `<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>${lines.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join('')}</p:spTree></p:cSld></p:sld>`;
  z.file('ppt/slides/slide1.xml', slide(['小满影像工作室', '专注咖啡与甜品品牌的产品影像，为 30 多个本地品牌拍摄过新品。', '电话：13712349999']));
  z.file('ppt/slides/slide2.xml', slide(['核心优势', '• 自带 20 平米摄影棚', '• 48 小时交付', '微信：xiaoman_studio']));
  fs.writeFileSync(file, await z.generateAsync({ type: 'nodebuffer' }));
}

async function login(page, phone) {
  await page.goto(`${BASE}/?e2e&lowgfx`);
  await page.getByTestId('login').waitFor({ timeout: 30000 });
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-send').click();
  await page.getByTestId('login-devcode').waitFor();
  const code = (await page.getByTestId('login-devcode').innerText()).match(/\d{6}/)[0];
  await page.getByTestId('login-code').fill(code);
  return code;
}
async function onboard(page, name) {
  await page.getByText('学生', { exact: true }).click();
  const nick = page.getByPlaceholder(/昵称/);
  if (await nick.count()) await nick.fill(name);
  await page.getByText('下一步').click();
  await page.getByText('徐汇区', { exact: false }).first().click();
  await page.getByTestId('status-line').waitFor({ timeout: 60000 });
}

const RUN = String(Date.now()).slice(-6);
const phoneA = `1370${RUN}1`.slice(0, 11), phoneB = `1371${RUN}2`.slice(0, 11);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctxA = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const ctxB = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const ctxC = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const A = await ctxA.newPage(), B = await ctxB.newPage(), C = await ctxC.newPage();
  const errors = [];
  for (const p of [A, B, C]) p.on('pageerror', (e) => errors.push(String(e)));
  const pptx = path.join(OUT, 'company.pptx');
  await makePptx(pptx);
  let lotA = '';

  await step('注册登录：必须同意协议；手机号 + 验证码登录成功', A, async () => {
    await login(A, phoneA);
    await A.getByTestId('login-submit').click();
    must((await A.getByTestId('login-msg').innerText()).includes('同意'), '没有要求同意协议');
    await A.getByTestId('login-agree').check();
    await A.getByTestId('login-submit').click();
    await A.getByText('学生', { exact: true }).waitFor({ timeout: 30000 });
    await A.screenshot({ path: path.join(OUT, '01-after-login.png') });
  });
  await step('新手引导后进入街区（资料保存到服务端）', A, async () => {
    await onboard(A, '小满');
    await A.waitForTimeout(2500);
    const me = await A.evaluate(() => fetch('/api/me').then((r) => r.json()));
    must(me.user && me.user.phoneMasked === `${phoneA.slice(0, 3)}****${phoneA.slice(7)}`, `账户信息不对 ${JSON.stringify(me)}`);
    must(!JSON.stringify(me).includes(phoneA), '返回了手机号原文');
  });
  await step('开店：实名、上传 PPT 公司简介 → 自动提炼（手机号 / 微信被隐藏）→ 开张', A, async () => {
    lotA = await A.evaluate(async () => { const taken = new Set((await (await fetch('/api/shops')).json()).shops.map((x) => x.lotId)); const p = window.__town.lotPlan('wukang'); return window.__town.doors('wukang').find((d) => d.lotId && d.lotId.startsWith('wukang_lot') && p.opc.includes(d.lotId) && !taken.has(d.lotId)).lotId; });
    await A.evaluate((l) => window.__town.useTown.getState().setWizard(true, l), lotA);
    await A.getByTestId('opc-wizard').waitFor();
    await A.getByTestId('owner-name').fill('张小满');
    await A.getByTestId('shop-name').fill('小满影像');
    await A.getByTestId('wizard-next').click();
    // 直接传文件内容（中文文件名），避开测试工具对中文路径的兼容问题
    await A.getByTestId('doc-input-company').setInputFiles({ name: '公司介绍.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: fs.readFileSync(pptx) });
    await A.getByTestId('doc-summary-company').waitFor({ timeout: 60000 });
    const sum = await A.getByTestId('doc-summary-company').innerText();
    must(sum.includes('小满影像工作室') && !sum.includes('13712349999') && !sum.includes('xiaoman_studio'), `提炼结果不对：${sum}`);
    await A.screenshot({ path: path.join(OUT, '02-doc-parsed.png') });
    await A.getByTestId('wizard-next').click();
    await A.getByTestId('wizard-next').click();
    await A.getByTestId('wizard-finish').click();
    await A.waitForFunction(() => !!window.__town.useTown.getState().myOpc, null, { timeout: 20000 });
    return sum.split('\n')[0];
  });
  await step('隐私：公开店铺接口不含手机号、实名、微信号', B, async () => {
    await B.goto(`${BASE}/api/shops`);
    const txt = await B.innerText('body');
    must(txt.includes('小满影像'), '店铺没有公开');
    for (const leak of [phoneA, `${phoneA.slice(0, 3)}****${phoneA.slice(7)}`, '张小满', '13712349999', 'xiaoman_studio']) must(!txt.includes(leak), `泄露了 ${leak}`);
  });
  await step('另一个用户登录，走进这家店：看到「企」以外的信息与提炼的公司简介，发私信', B, async () => {
    await login(B, phoneB);
    await B.getByTestId('login-agree').check();
    await B.getByTestId('login-submit').click();
    await onboard(B, '阿强');
    await B.waitForFunction((l) => window.__town && window.__town.useTown, lotA);
    await B.waitForTimeout(1500);
    await B.evaluate((l) => window.__town.useTown.getState().enterLot(l), lotA);
    await B.getByTestId('remote-shop').waitFor({ timeout: 15000 });
    must((await B.getByTestId('remote-company').innerText()).includes('48 小时交付'), '没有展示公司简介');
    await B.screenshot({ path: path.join(OUT, '03-remote-shop.png') });
    await B.getByTestId('remote-dm').click();
    await B.getByTestId('dm-panel').waitFor();
    await B.getByTestId('dm-input').fill('你好小满，我想拍一组新品图，我电话 13712345678');
    await B.getByTestId('dm-send').click();
    await B.getByTestId('dm-note').waitFor();
    await B.getByTestId('dm-wechat').click();
    await B.waitForTimeout(800);
  });
  await step('店主收到私信（对方的手机号被隐藏），回复后对方能看到', A, async () => {
    await A.evaluate(() => { const t = window.__town.useTown.getState(); t.openChat(undefined); t.openCard(undefined); t.setTab('messages'); });
    await A.getByTestId('msg-tab-dm').click();
    await A.getByTestId('dm-item').first().waitFor({ timeout: 15000 });
    await A.getByTestId('dm-item').first().click();
    await A.getByTestId('dm-messages').getByText('你好小满', { exact: false }).waitFor({ timeout: 10000 });
    const t = await A.getByTestId('dm-messages').innerText();
    must(!t.includes('13712345678') && t.includes('已隐藏'), `联系方式没有隐藏：${t}`);
    await A.getByTestId('dm-input').fill('可以的，周三下午来棚里聊');
    await A.getByTestId('dm-send').click();
    await B.getByTestId('dm-messages').getByText('周三下午', { exact: false }).waitFor({ timeout: 10000 });
    await A.screenshot({ path: path.join(OUT, '04-dm.png') });
  });
  await step('刷新页面：仍然登录，小店与进度都还在（保存在服务端）', A, async () => {
    await A.waitForTimeout(2500);
    await A.reload();
    await A.getByTestId('status-line').waitFor({ timeout: 60000 });
    must(await A.evaluate(() => window.__town.useTown.getState().myOpc?.name === '小满影像'), '小店丢失');
  });
  await step('管理员登录后台：注册用户、活跃用户、PV/UV、留微信号点击', C, async () => {
    await C.goto(`${BASE}/admin.html`);
    await C.getByTestId('admin-phone').fill('13900000000');
    await C.getByTestId('admin-send').click();
    await C.waitForTimeout(500);
    await C.getByTestId('admin-login').click();
    await C.getByTestId('admin-overview').waitFor({ timeout: 15000 });
    const users = Number((await C.getByTestId('kpi-users').innerText()).match(/\n(\d+)/)[1]);
    const dau = Number((await C.getByTestId('kpi-dau').innerText()).match(/\n(\d+)/)[1]);
    const wx = Number((await C.getByTestId('kpi-wechat').innerText()).match(/\n(\d+)/)[1]);
    must(users >= 3 && dau >= 2 && wx >= 1, `看板数字不对 users=${users} dau=${dau} wechat=${wx}`);
    await C.screenshot({ path: path.join(OUT, '05-admin-overview.png') });
    return `注册 ${users} · DAU ${dau} · 留微信 ${wx}`;
  });
  await step('管理员：各模块 PV/UV、按钮点击 PV/UV', C, async () => {
    await C.getByTestId('admin-tab-modules').click();
    await C.getByTestId('admin-modules').waitFor();
    const m = await C.getByTestId('admin-modules').innerText();
    must(m.includes('我的上海') && m.includes('消息'), `模块不全：${m.slice(0, 200)}`);
    await C.screenshot({ path: path.join(OUT, '06-admin-modules.png') });
    await C.getByTestId('admin-tab-clicks').click();
    await C.getByTestId('admin-clicks').getByText('dm-send').first().waitFor({ timeout: 10000 });
  });
  await step('管理员：消息审查能看到聊天原文（含联系方式标记），查看写入审计日志', C, async () => {
    await C.getByTestId('admin-tab-messages').click();
    await C.getByTestId('admin-conv').first().click();
    await C.getByTestId('admin-conv-detail').getByText('13712345678', { exact: false }).waitFor({ timeout: 10000 });
    await C.screenshot({ path: path.join(OUT, '07-admin-messages.png') });
    await C.getByTestId('admin-tab-audit').click();
    await C.getByTestId('admin-table-audit').getByText('view_conversation').first().waitFor();
  });
  await step('普通用户访问管理接口被拒绝', B, async () => {
    const s = await B.evaluate(() => fetch('/api/admin/overview').then((r) => r.status));
    must(s === 403, `状态码 ${s}`);
  });
  await step('页面无脚本错误', A, async () => { must(!errors.length, errors.join('\n')); });

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} 项通过`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(ok === results.length ? 0 : 1);
})();
