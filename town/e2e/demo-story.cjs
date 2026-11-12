/**
 * 端到端演示故事（Playwright）：
 *   创建小人 → 进入武康路 → 走路 → 告诉 AI 我会什么 → 商业可能性地图 →
 *   逛咖啡店（主理人离线，AI 分身接待，L3 问题被转交）→ 打招呼 → 对方接受 →
 *   交换联系方式 → 预约线上见面 → 店铺之间出现发光连接线 → 五分钟开店
 *
 * 用法：npm run build && npm run preview（另一个终端）然后 npm run e2e
 *   BASE_URL 默认 http://localhost:4173，截图输出到 e2e/screenshots/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: Number(process.env.DPR || 1) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
  const t0 = Date.now();

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 1. 选一个小人（3 秒完成）
  await page.getByTestId('onboard-step-avatar').waitFor();
  await shot('01-onboarding');
  await page.getByText('自由职业者').click();
  await page.getByPlaceholder('给小人起个昵称').fill('阿岚');
  await page.getByText('下一步').click();
  await page.getByText('武康大楼').click();
  await page.getByTestId('status-line').waitFor();
  await page.waitForTimeout(2500);
  check('首次进入成功', await page.getByTestId('status-line').isVisible(), `${Date.now() - t0}ms`);
  await shot('02-wukang-road');

  // 2. 走路（键盘）
  await page.mouse.click(700, 120); // 聚焦画布区域（点击地面也会设定目标）
  await page.keyboard.down('d'); await page.waitForTimeout(1200); await page.keyboard.up('d');
  await page.keyboard.down('s'); await page.waitForTimeout(600); await page.keyboard.up('s');
  await page.waitForTimeout(500);
  await shot('03-walking');

  // 3. 告诉 AI 我会什么
  await page.getByTestId('nav-map').click();
  await page.getByTestId('use-example').click();
  await page.getByTestId('confirm-profile').waitFor();
  await shot('04-profile-extraction');
  await page.getByTestId('confirm-profile').click();
  await page.getByTestId('opportunity-svg').waitFor();
  await page.getByTestId('node-u_xiaoman').click();
  const table = await page.getByTestId('relation-table').innerText();
  check('推荐关系可解释（匹配程度/理由/来源/未确认）', /匹配程度/.test(table) && /推荐理由/.test(table) && /未确认/.test(table) && /系统估算/.test(table));
  await shot('05-opportunity-map');

  // 4. 走进咖啡馆：主理人离线，AI 分身接待
  await page.getByText('🏪 逛 TA 的小店').first().click();
  await page.getByTestId('agent-chat').waitFor();
  check('访客知道在和 AI 分身交流', (await page.getByTestId('agent-transparency').innerText()).includes('AI 分身'));
  await page.getByTestId('chat-input').fill('你们的咖啡豆多少钱？');
  await page.keyboard.press('Enter');
  await page.getByTestId('chat-input').fill('可以打个折吗？');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const log = await page.getByTestId('chat-log').innerText();
  check('Agent 只引用确认过的价格', log.includes('88'));
  check('L3 问题转交主理人', log.includes('L3 需本人确认') && log.includes('已转交主理人'));
  await shot('06-agent-chat');

  // 5. 打招呼 → 奶油信封
  await page.getByTestId('chat-hello').click();
  await page.getByTestId('invite-card').waitFor();
  await shot('07-invitation-card');
  await page.getByTestId('send-hello').click();
  await page.getByTestId('agent-chat').getByLabel('关闭').click();
  await page.getByTestId('map-panel').getByLabel('关闭').click();
  await page.waitForTimeout(900);
  await shot('08-envelope-flying');

  // 6. 对方（演示角色，离线 → 上线）接受
  await page.waitForTimeout(3600);
  await page.getByTestId('nav-messages').click();
  await page.getByTestId('intro-u_xiaoman').waitFor();
  await page.getByTestId('consent-contact').click();
  check('双方同意后才显示联系方式', await page.getByTestId('contact-visible').isVisible());
  await page.getByTestId('book-meeting').click();
  await page.waitForTimeout(300);
  await shot('09-meeting-booked');

  // 7. 连接线
  await page.getByTestId('messages-panel').getByLabel('关闭').click();
  await page.waitForTimeout(1500);
  await shot('10-connection-line');

  // 8. 五分钟开店
  await page.getByTestId('my-shop-btn').click();
  await page.getByTestId('opc-wizard').waitFor();
  await page.getByTestId('shop-name').fill('阿岚 AI 影像');
  for (let i = 0; i < 3; i++) await page.getByTestId('wizard-next').click();
  await shot('11-opc-wizard-agent');
  await page.getByTestId('wizard-finish').click();
  await page.waitForTimeout(1800);
  await shot('12-shop-opened');

  // 9. 夜晚
  await page.getByTestId('daynight').click();
  await page.waitForTimeout(1200);
  await shot('13-night');

  // 10. 帧率粗测（软件渲染下仅供参考）
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const s = performance.now();
    const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); };
    requestAnimationFrame(f);
  }));
  check('帧率（无 GPU 的软件渲染，仅供参考）', true, `${fps} fps`);

  const fatal = errors.filter((e) => !/GPU stall|WebGL|swiftshader|GL_/.test(e));
  check('无页面错误', fatal.length === 0, fatal.slice(0, 3).join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 项通过，截图在 ${OUT}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
