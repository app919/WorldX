/**
 * V2 端到端演示故事（Playwright）：
 *   武康大楼出发 → 沿人行道走 → 「我的生意」告诉 AI 我能提供什么 → 客户优先列表（五个问题）→
 *   点“走到店门口”，沿人行道 / 斑马线寻路，从门口进店 → AI 分身接待（价格 / L3）→
 *   打招呼 → 对方接受 → 双方同意交换联系方式 → 预约见面 → 社区推荐活动 → 三条街道 → 开店 → 夜景
 *
 * 用法：npm run build && npm run preview（另一个终端）然后 npm run e2e
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: Number(process.env.DPR || 1) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
  const t0 = Date.now();

  await page.goto(`${BASE}/?e2e`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await page.getByTestId('onboard-step-avatar').waitFor();
  await shot('01-onboarding');
  await page.getByText('OPC 主理人').click();
  await page.getByPlaceholder('给小人起个昵称').fill('阿岚');
  await page.getByText('下一步').click();
  await page.getByText('淮海中路 × 武康路').click();
  await page.getByTestId('status-line').waitFor();
  await page.waitForTimeout(4000);
  check('首次进入成功', true, `${Date.now() - t0}ms`);
  await shot('02-wukang-street');

  // 告诉 AI 我能提供什么 → 客户优先
  await page.getByTestId('nav-biz').click();
  await page.getByTestId('use-example').click();
  await page.getByTestId('confirm-profile').click();
  await page.getByTestId('biz-list').waitFor();
  const counts = await page.getByTestId('biz-counts').innerText();
  const firstCard = await page.getByTestId('biz-list').locator('> div').first().innerText();
  check('默认展示潜在客户', /潜在客户/.test(counts));
  check('客户卡片回答五个问题', ['客户在哪里', '可能需要', '你可以提供', '为什么推荐'].every((k) => firstCard.includes(k)), firstCard.split('\n')[1]);
  check('需求证据有区分（已发布 / 系统推测）', /对方已发布|系统推测/.test(firstCard));
  await shot('03-my-business-customers');
  await page.getByText('商业关系视图').click();
  await page.getByTestId('flow-svg').waitFor();
  await shot('04-business-flow');
  await page.getByText('优先联系').click();

  // 沿人行道走到梧桐豆子门口，从门口进店。
  // 无 GPU 的 CI 里渲染很慢，先把角色放到同一侧人行道、离门口约 8 个单位处，再用真实的寻路 + 门口触发完成进店。
  check('测试钩子：角色放到门口附近的人行道上', await page.evaluate(() => window.__town.nearLot('wk_w2', 7)));
  await page.waitForTimeout(500);
  await page.getByTestId('rel-e_wutong').getByText(/走到店门口/).click();
  let entered = false;
  try { await page.getByTestId('agent-chat').waitFor({ timeout: 150000 }); entered = true; } catch { /* */ }
  check('沿人行道寻路并从门口进店', entered);
  await shot('05-entered-shop');

  if (entered) {
    await page.getByTestId('chat-input').fill('咖啡豆多少钱？');
    await page.keyboard.press('Enter');
    await page.getByTestId('chat-input').fill('可以打个折吗？');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const log = await page.getByTestId('chat-log').innerText();
    check('AI 分身只引用确认过的价格', log.includes('88'));
    check('L3 问题转交主理人', log.includes('L3 需本人确认') && log.includes('已转交主理人'));
    await shot('06-agent-chat');
    await page.getByTestId('chat-hello').click();
  } else {
    await page.getByTestId('nav-biz').click();
    await page.getByTestId('hello-e_wutong').click();
  }
  await page.getByTestId('invite-card').waitFor();
  await shot('07-invitation');
  await page.getByTestId('send-hello').click();
  if (entered) await page.getByTestId('agent-chat').getByLabel('关闭').click();
  await page.waitForTimeout(5000);
  await page.getByTestId('nav-messages').click();
  await page.getByTestId('intro-u_xiaoman').waitFor();
  await page.getByTestId('consent-contact').click();
  check('双方同意后才显示联系方式', await page.getByTestId('contact-visible').isVisible());
  await page.getByTestId('book-meeting').click();
  await shot('08-meeting-booked');

  // 社区与商业地图打通
  await page.getByTestId('nav-community').click();
  const reco = await page.getByTestId('event-reco').innerText().catch(() => '');
  check('社区根据商业地图推荐活动', /潜在客户/.test(reco), reco.slice(0, 40));
  await page.getByTestId('event-ev_brand_day').click();
  await shot('09-community');
  await page.getByTestId('nav-community').click();
  await page.waitForTimeout(800);
  await shot('10-connection-line');

  // 三条街道
  for (const d of ['yangjing', 'sichuan_n', 'wukang']) {
    await page.getByTestId(`district-${d}`).click();
    await page.waitForTimeout(3500);
    await shot(`11-district-${d}`);
  }

  // 开店
  await page.getByTestId('my-shop-btn').click();
  await page.getByTestId('opc-wizard').waitFor();
  await page.getByTestId('shop-name').fill('阿岚 AI 影像');
  for (let i = 0; i < 3; i++) await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-finish').click();
  await page.waitForTimeout(3000);
  await shot('12-shop-opened');

  await page.getByTestId('daynight').click();
  await page.waitForTimeout(1500);
  await shot('13-night');

  const fatal = errors.filter((e) => !/GPU stall|WebGL|swiftshader|GL_|THREE\.WebGLRenderer/.test(e));
  check('无页面错误', fatal.length === 0, fatal.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 项通过，截图在 ${OUT}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
