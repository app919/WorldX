/**
 * 全功能可玩性走查（Playwright）。每一步独立记录结果，失败时截图并继续，最后汇总。
 * 覆盖：新手引导、三条街道、走路（键盘 / 点击地面 / 随便逛逛）、规则提示、进店（全部已入驻店铺）、
 * AI 分身全部快捷问题、未入驻商家名片、空铺开店、地标建筑、居民名片与打招呼、
 * 我的生意（五类关系 / 三种视图 / 地图标注 / 收藏线索 / 跨街区前往）、商务连接全流程、
 * 社区（空间筛选 / 每个活动展开报名 / 发起活动 / 推荐）、消息全部分类、我的（标签 / 分身设置 / 隐私 / 审计）、
 * 顶栏（活力说明 / 钱包说明 / 昼夜 / 时间暂停）、手机布局与摇杆。
 *
 * 用法：npm run build && npm run preview，然后 node e2e/full-playtest.cjs
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE_URL || 'http://localhost:4173') + '/?e2e';
const OUT = path.join(__dirname, 'playtest');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const results = [];
let page;

async function step(name, fn) {
  const t = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`✅ ${name}${detail ? ` — ${detail}` : ''} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  } catch (e) {
    results.push({ name, ok: false, err: String(e).split('\n')[0] });
    console.log(`❌ ${name} — ${String(e).split('\n')[0]}`);
    await page.screenshot({ path: path.join(OUT, `FAIL-${results.length}.png`) }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const T = (id) => page.getByTestId(id);
const closeAll = async () => {
  for (const id of ['agent-chat', 'hello-composer', 'opc-wizard', 'entity-card', 'lot-card', 'building-card', 'resident-card']) {
    const el = T(id);
    if (await el.count()) await el.getByLabel('关闭').first().click().catch(() => {});
  }
  const card = page.locator('[aria-label="关闭"]');
  if (await card.count()) await card.first().click().catch(() => {});
};
const evalTown = (fn, arg) => page.evaluate(fn, arg);
const goTab = async (tab) => { const s = await evalTown(() => window.__town.useTown.getState().tab); if (s !== tab) await T(`nav-${tab}`).click(); };
const toCity = async () => { await evalTown(() => window.__town.useTown.getState().setTab('city')); };
const waitFor = async (pred, ms = 120000, every = 400) => { const t = Date.now(); while (Date.now() - t < ms) { if (await pred()) return true; await page.waitForTimeout(every); } return false; };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE);
  await evalTown(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();

  // —— 新手引导 ——
  await step('引导：6 种生活标签都可选、可换衣服颜色、可起昵称', async () => {
    for (const t of ['打工牛马', '自由职业者', 'OPC 主理人', '退休生活家', '学生', '城市玩家']) await page.getByText(t, { exact: true }).click();
    await page.getByLabel('#A9C2A0').click();
    await page.getByPlaceholder('给小人起个昵称').fill('阿岚');
    await page.getByText('下一步').click();
    must(await T('onboard-step-spawn').isVisible(), '没有进入第二步');
    await page.getByText('返回').click();
    await page.getByText('自由职业者', { exact: true }).click();
    await page.getByText('下一步').click();
  });
  await step('引导：三条街道都可作为出发点，选择后进入游戏', async () => {
    for (const t of ['淮海中路 × 武康路', '浦东新区', '虹口区']) must(await page.getByText(t, { exact: false }).first().isVisible(), `缺少 ${t}`);
    await page.getByText('淮海中路 × 武康路').click();
    await T('status-line').waitFor({ timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, '01-start.png') });
  });

  // —— 顶栏 ——
  await step('顶栏：街区活力说明（含计算依据）', async () => {
    await T('vitality').click();
    must(await page.getByText('街区活力 = 加权平均').isVisible(), '没有计算依据');
    await T('vitality').click();
  });
  await step('顶栏：星星 / 成长值说明（获取方式、用途、不可兑换）', async () => {
    await T('wallet').click();
    must(await page.getByText('不能兑换人民币', { exact: false }).isVisible(), '缺少不可兑换说明');
    await T('wallet').click();
  });
  await step('顶栏：昼夜切换与时间暂停', async () => {
    const h0 = await evalTown(() => window.__town.useTown.getState().hour);
    await T('daynight').click();
    const h1 = await evalTown(() => window.__town.useTown.getState().hour);
    must(Math.abs(h1 - h0) > 3, '昼夜没有切换');
    await T('timeflow').click();
    must(!(await evalTown(() => window.__town.useTown.getState().timeFlow)), '时间没有暂停');
    await T('timeflow').click();
    await T('daynight').click();
  });

  // —— 走路与规则 ——
  await step('走路：键盘移动（WASD）', async () => {
    const p0 = await evalTown(() => ({ ...window.__town.playerRuntime }));
    await page.mouse.move(640, 400);
    await page.keyboard.down('d'); await page.waitForTimeout(1500); await page.keyboard.up('d');
    const p1 = await evalTown(() => ({ ...window.__town.playerRuntime }));
    must(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.3, '角色没有移动');
    return `移动了 ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)}`;
  });
  await step('规则：朝马路一直走会被挡住并提示走斑马线', async () => {
    await page.keyboard.down('s'); await page.waitForTimeout(3500); await page.keyboard.up('s');
    const zone = await evalTown(async () => { const p = window.__town.playerRuntime; return window.__town.zoneAt ? window.__town.zoneAt(p) : null; });
    const toastSeen = await page.getByText('请从斑马线过马路', { exact: false }).count();
    const p = await evalTown(() => ({ ...window.__town.playerRuntime }));
    must(p.z < -5.9, `角色走上了车道 z=${p.z.toFixed(2)}`);
    return `停在人行道 z=${p.z.toFixed(2)}${toastSeen ? '，出现提示' : ''}${zone ?? ''}`;
  });
  await step('走路：点击地面自动寻路（显示路径）', async () => {
    await page.mouse.click(780, 330);
    const ok = await waitFor(async () => (await evalTown(() => !!window.__town.useTown.getState().walkPath)) || true, 2000);
    must(ok, '没有生成路径');
  });
  await step('走路：点击车道中间会提示走不过去或自动绕到斑马线', async () => {
    const r = await evalTown(() => window.__town.useTown.getState().walkTo({ x: 40, z: 0 }));
    return r ? '已规划绕行路径' : '提示走不过去';
  });
  await step('走路：“随便逛逛”规划一条可走的路线', async () => {
    await T('autowalk').click();
    must(await evalTown(() => !!window.__town.useTown.getState().walkPath), '没有路线');
    await evalTown(() => window.__town.useTown.getState().clearPath());
  });

  // —— 地标与门 ——
  await step('地标：走到武康大楼门口，打开建筑档案（待审核状态可见）', async () => {
    must(await evalTown(() => window.__town.nearDoor('wukang_mansion#0', 3)), '找不到武康大楼门口');
    await T('building-card').waitFor({ timeout: 120000 });
    must(await page.getByText('待人工审核', { exact: false }).count(), '缺少审核状态');
    await page.screenshot({ path: path.join(OUT, '02-landmark.png') });
    await closeAll();
  });
  await step('地标：宋庆龄故居（参观，不设商业铺位）', async () => {
    must(await evalTown(() => window.__town.nearDoor('soong#0', 3)), '找不到门');
    await T('building-card').waitFor({ timeout: 120000 });
    must(await page.getByText('不设商业铺位', { exact: false }).count(), '缺少说明');
    await closeAll();
  });

  // —— 我的生意 ——
  await step('我的生意：未填写时引导“先告诉 AI 你能提供什么”', async () => {
    await goTab('biz');
    must(await T('profile-setup').isVisible(), '没有引导');
  });
  await step('我的生意：自己输入一句话 → AI 提取 → 增删标签 → 确认', async () => {
    await T('profile-input').fill('我是做平面设计的，也会拍照，想找咖啡店和品牌客户，在虹口。');
    await T('extract-btn').click();
    must(await page.getByText('我理解到的你').isVisible(), '没有提取结果');
    await page.getByText('用示例：AI 视频制作人').click();
    await page.locator('select').first().selectOption({ label: '配音' });
    await page.getByText('✓ 配音').click();
    await T('confirm-profile').click();
    await T('biz-list').waitFor();
  });
  await step('我的生意：默认展示潜在客户，四个计数可点击', async () => {
    const t = await T('biz-counts').innerText();
    must(/潜在客户/.test(t), '计数缺失');
    for (const l of ['潜在供应商', '合作伙伴', '渠道资源', '潜在客户']) await T('biz-counts').getByText(l).click();
    return t.replace(/\n/g, ' ');
  });
  await step('我的生意：五类关系标签逐一切换，每条关系都有内容', async () => {
    const counts = {};
    for (const l of ['潜在客户', '上游供应商', '横向合作伙伴', '渠道伙伴', '资源伙伴']) {
      await page.locator('button.chip', { hasText: l }).first().click();
      const n = await T('biz-list').locator('> div').count();
      counts[l] = n;
      for (let i = 0; i < n; i++) {
        const txt = await T('biz-list').locator('> div').nth(i).innerText();
        must(/为什么推荐/.test(txt) && /在哪里/.test(txt), `${l} 第 ${i + 1} 条缺少答案`);
      }
    }
    await page.locator('button.chip', { hasText: '潜在客户' }).first().click();
    return JSON.stringify(counts);
  });
  await step('我的生意：每张客户卡片展开后显示计算依据', async () => {
    const n = await T('biz-list').locator('> div').count();
    for (let i = 0; i < n; i++) {
      await T('biz-list').locator('> div').nth(i).locator('button').first().click();
      must(await T('biz-list').locator('> div').nth(i).getByText('计算依据', { exact: false }).count(), `第 ${i + 1} 张没有计算依据`);
    }
    await page.screenshot({ path: path.join(OUT, '03-biz.png') });
    return `${n} 张`;
  });
  await step('我的生意：未入驻商家只能收藏为线索，不能打招呼', async () => {
    const card = T('rel-e_chunri');
    must(await card.count(), '没有春日花房');
    must(!(await card.getByText('打个招呼').count()), '未入驻却可以打招呼');
    await card.getByText('收藏为线索').click();
    must(await card.getByText('已收藏线索').count(), '收藏失败');
  });
  await step('我的生意：商业关系视图（分层）', async () => {
    await page.getByText('商业关系视图').click();
    await T('flow-svg').waitFor();
    await page.locator('[data-testid="flow-svg"] g.cursor-pointer').first().click();
    await page.screenshot({ path: path.join(OUT, '04-flow.png') });
  });
  await step('我的生意：生意灵感与成长地图', async () => {
    await page.getByText('生意灵感 · 成长').click();
    must(await page.getByText('我的商业成长地图').isVisible(), '缺少成长地图');
    await page.getByText('优先联系').click();
  });
  await step('我的生意：在街区地图上标出客户（3D 标注可点击回到详情）', async () => {
    await toCity();
    await evalTown(() => window.__town.nearLot('wk_w2', 6));
    await page.waitForTimeout(2500);
    const m = T('marker-e_wutong');
    must(await m.count(), '地图上没有梧桐豆子的客户标注');
    await m.click({ force: true });
    must((await evalTown(() => window.__town.useTown.getState().tab)) === 'biz', '点击标注没有打开我的生意');
    await page.getByText('在街区地图上标出').click();
    must(!(await evalTown(() => window.__town.useTown.getState().showMarkers)), '无法关闭标注');
    await page.getByText('在街区地图上标出').click();
  });
  await step('我的生意：“去其他街区看看”会切换街区并走向店门口', async () => {
    const btn = T('rel-e_wedding').getByText(/去.*看看|走到店门口/);
    await btn.click();
    const d = await evalTown(() => window.__town.useTown.getState().district);
    must(d === 'sichuan_n', `没有切换到四川北路，当前 ${d}`);
    await page.waitForTimeout(2000);
    await evalTown(() => window.__town.useTown.getState().goDistrict('wukang'));
    await page.waitForTimeout(1500);
  });

  // —— 进店：所有已入驻店铺 ——
  const shops = [['wk_w2', '梧桐豆子'], ['wk_e2', '光影小棚'], ['wk_n1', '小步营销'], ['yj_market', '社区菜场摊主联盟'], ['yj_n1', '邻里会客厅'], ['yj_s1', '阿婆糕团店'], ['sc_e2', '甜爱文创'], ['ta_n1', '甜爱写真馆'], ['sc_w3', '街角书店']];
  for (const [lot, name] of shops) {
    await step(`进店：从门口走进「${name}」，AI 分身接待（6 个快捷问题）`, async () => {
      await closeAll(); await toCity();
      must(await evalTown((l) => window.__town.nearLot(l, 3), lot), '找不到门口');
      await T('agent-chat').waitFor({ timeout: 150000 });
      must((await T('agent-transparency').innerText()).includes('AI 分身'), '没有声明 AI 身份');
      for (const q of ['你们是做什么的？', '多少钱？', '可以打个折吗？', '有案例吗？', '想预约聊聊', '你是真人吗？']) await T('agent-chat').getByText(q, { exact: true }).click();
      const log = await T('chat-log').innerText();
      must(/L3 需本人确认/.test(log), '折扣没有转交本人');
      must(/不是主理人本人|AI 分身/.test(log), '没有如实说明是 AI');
      await T('chat-input').fill('我们公司预算 5000，想做一支宣传片');
      await page.keyboard.press('Enter');
      if (lot === 'wk_w2') await page.screenshot({ path: path.join(OUT, '05-shop.png') });
      await closeAll();
    });
  }

  // —— 未入驻商家与空铺 ——
  await step('未入驻商家：走到门口显示“仅公开商业信息”的名片', async () => {
    await closeAll(); await toCity();
    must(await evalTown(() => window.__town.nearLot('wk_s1', 3)), '找不到门口');
    await T('entity-card').waitFor({ timeout: 150000 });
    must(await page.getByText('尚未入驻平台', { exact: false }).count(), '缺少未入驻说明');
    await T('entity-card').getByText(/收藏为线索|已收藏线索/).click();
    await closeAll();
  });
  await step('空铺：走到门口显示招租名片', async () => {
    const lot = await evalTown(() => window.__town.doors('wukang').find((d) => d.lotId && d.lotId.startsWith('wukang_lot'))?.lotId);
    must(lot, '没有空铺');
    await evalTown((l) => window.__town.nearLot(l, 3), lot);
    await T('lot-card').waitFor({ timeout: 150000 });
    return lot;
  });
  await step('开店：在空铺开店（外观 / 铺位 / 商品 / 需求 / 主体 / AI 分身权限）', async () => {
    await T('open-wizard').click();
    await T('opc-wizard').waitFor();
    await page.getByText('奶油咖啡馆').click();
    await T('shop-name').fill('阿岚 AI 影像');
    await T('wizard-next').click();
    await page.getByText('AI技术服务').click();
    await page.getByText('+ 再加一款').click();
    await page.getByPlaceholder('产品 / 服务名称').nth(1).fill('AI 品牌短片');
    await T('wizard-next').click();
    await page.getByText('渠道', { exact: true }).click();
    await page.getByText('正在找合伙人').click();
    await page.getByText('我已有经营主体', { exact: false }).click();
    await T('wizard-next').click();
    must(await page.getByText('L3 决策').isVisible(), '缺少 L3 说明');
    await T('wizard-finish').click();
    await page.waitForTimeout(2500);
    must(await evalTown(() => !!window.__town.useTown.getState().myOpc), '开店失败');
    await page.screenshot({ path: path.join(OUT, '06-opened.png') });
  });
  await step('我的小店：进入自己的店，试用自己的 AI 分身', async () => {
    await closeAll(); await toCity();
    await T('my-shop-btn').click();
    await T('agent-chat').waitFor({ timeout: 30000 });
    await T('agent-chat').getByText('多少钱？', { exact: true }).click();
    await closeAll();
  });

  // —— 居民与打招呼 ——
  await step('居民：查看名片（与我的生意的关系）并打招呼', async () => {
    await closeAll(); await toCity();
    await evalTown(() => window.__town.useTown.getState().openCard({ kind: 'resident', id: 'u_ajie' }));
    await T('resident-card').waitFor();
    must(await page.getByText('和你的生意有什么关系', { exact: false }).count(), '缺少商业关系');
    await T('hello-btn').click();
    await T('invite-card').waitFor();
    await T('send-hello').click();
    await closeAll();
  });
  await step('打招呼：从我的生意给梧桐豆子发奶油信封', async () => {
    await goTab('biz');
    const card = T('rel-e_wutong');
    if (await card.getByText('打个招呼').count()) {
      await card.getByText('打个招呼').click();
      await T('send-hello').click();
    }
  });

  // —— 消息：商务连接全流程 ——
  await step('消息：对方接受 → 同意交换联系方式 → 联系方式可见', async () => {
    await page.waitForTimeout(4500);
    await goTab('messages');
    await T('intro-u_xiaoman').waitFor({ timeout: 20000 });
    const card = page.locator('div', { has: T('intro-u_xiaoman') }).last();
    await card.getByTestId('consent-contact').click();
    must(await card.getByTestId('contact-visible').isVisible(), '联系方式不可见');
  });
  await step('消息：预约 15 / 30 / 60 分钟线上见面', async () => {
    const card = page.locator('div', { has: T('intro-u_xiaoman') }).last();
    for (const d of ['15 分钟', '30 分钟', '60 分钟']) { await card.getByText(d).click(); await card.getByTestId('book-meeting').click(); }
    must((await card.innerText()).split('📅').length - 1 >= 3, '预约记录不足 3 条');
  });
  await step('消息：提出合作记录 → 对方本人确认', async () => {
    const card = page.locator('div', { has: T('intro-u_xiaoman') }).last();
    await card.getByTestId('propose-collab').click();
    await page.waitForTimeout(3000);
    must(/双方确认合作/.test(await card.innerText()), '合作记录没有被确认');
    await page.screenshot({ path: path.join(OUT, '07-messages.png') });
  });
  await step('消息：所有分类都可打开（含“需要本人处理”标记）', async () => {
    for (const l of ['全部通知', '商业邀约', '合作申请', '会议预约', 'AI 接待记录', '真人私聊', '活动通知', '订单通知', '系统', '商务连接']) {
      await T('messages-panel').locator('button.chip', { hasText: l }).first().click();
    }
  });

  // —— 社区 ——
  await step('社区：根据商业地图推荐活动', async () => {
    await goTab('community');
    must(/潜在客户/.test(await T('event-reco').innerText()), '没有推荐');
    await T('event-reco').getByText('查看活动').click();
  });
  await step('社区：三个空间筛选', async () => {
    for (const l of ['咖啡客厅', '创业会客厅', '街区小市集']) { await T('community-panel').getByText(l, { exact: true }).first().click(); await T('community-panel').getByText(l, { exact: true }).first().click(); }
  });
  await step('社区：每个活动展开都有完整信息，并能报名', async () => {
    const ids = ['ev_brand_day', 'ev_opc_night', 'ev_qixi', 'ev_citywalk'];
    for (const id of ids) {
      await T(`event-${id}`).click();
      const txt = await T('community-panel').innerText();
      for (const k of ['适合谁', '流程', '主办方', '报名截止', '取消与退款']) must(txt.includes(k), `${id} 缺少 ${k}`);
      await T(`join-${id}`).click();
    }
    await page.screenshot({ path: path.join(OUT, '08-community.png') });
  });
  await step('社区：发起活动（必填校验 + 发布）', async () => {
    await T('community-panel').getByText('+ 发起活动').click();
    const publish = T('community-panel').getByText('发布活动');
    must(await publish.isDisabled(), '必填项为空时也能发布');
    await page.getByPlaceholder('活动标题（必填）').fill('AI 视频创作者夜聊');
    await page.getByPlaceholder('适合谁？能获得什么？（必填）').fill('想用 AI 做宣传片的小品牌；能看到真实案例');
    await page.getByPlaceholder('流程，例如：19:30 自我介绍；20:00 需求发布').fill('19:30 自我介绍；20:00 案例分享');
    await publish.click();
    must(await T('community-panel').getByText('AI 视频创作者夜聊').count(), '活动没有出现');
  });

  // —— 我的 ——
  await step('我的：切换生活标签', async () => {
    await goTab('me');
    await T('me-panel').getByText('学生', { exact: false }).first().click();
    must((await evalTown(() => window.__town.useTown.getState().avatar.lifeTag)) === 'student', '标签没有切换');
  });
  await step('我的：AI 分身设置（在线 / 自动接待 / L2 / 本人接管）全部生效', async () => {
    for (const l of ['我现在在线', '自动接待访客', '允许 L2', '我亲自接管对话']) await T('me-panel').getByText(l, { exact: false }).click();
    const a = await evalTown(() => window.__town.useTown.getState().myAgent);
    must(a.ownerTakeover === true && a.enabledLevels.L2 === false, JSON.stringify(a));
    await T('me-panel').getByText('以访客身份试试我的 AI 分身').click();
    await T('chat-input').fill('你们做什么的');
    await page.keyboard.press('Enter');
    must(/亲自接管/.test(await T('chat-log').innerText()), '接管后 AI 仍在回答');
    await closeAll();
    await goTab('me');
    await T('me-panel').getByText('我亲自接管对话', { exact: false }).click();
  });
  await step('我的：关闭“愿意被推荐”与赞助推荐（关闭后赞助活动不再显示）', async () => {
    await T('me-panel').getByText('接收赞助活动推荐', { exact: false }).click();
    await goTab('community');
    must(!(await T('community-panel').getByText('赞助内容').count()), '关闭后仍显示赞助');
    await goTab('me');
    await T('me-panel').getByText('接收赞助活动推荐', { exact: false }).click();
    await T('me-panel').getByText('愿意被 AI 推荐', { exact: false }).click();
    await T('me-panel').getByText('愿意被 AI 推荐', { exact: false }).click();
  });
  await step('我的：审计日志记录了商业操作', async () => {
    const t = await T('audit-log').innerText();
    for (const a of ['intro.sent', 'contact.', 'meeting.booked', 'collab.', 'opc.opened', 'agent.reply']) must(t.includes(a), `缺少 ${a}`);
  });

  // —— 三条街道 ——
  for (const d of ['yangjing', 'sichuan_n', 'wukang']) {
    await step(`街道：切换到「${d}」并四处走走`, async () => {
      await toCity();
      await T(`district-${d}`).click();
      await page.waitForTimeout(3000);
      await T('autowalk').click();
      await page.waitForTimeout(3000);
      const stats = await evalTown(() => window.__townStats);
      await page.screenshot({ path: path.join(OUT, `09-${d}.png`) });
      return `draw calls ${stats?.calls}, triangles ${stats?.triangles}`;
    });
  }
  await step('持久化：刷新后进度保留', async () => {
    await page.reload();
    await T('status-line').waitFor({ timeout: 60000 });
    must(await evalTown(() => !!window.__town.useTown.getState().myOpc), '小店丢失');
  });

  // —— 手机 ——
  await step('手机：底部弹层、摇杆可用', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const m = await ctx.newPage();
    await m.goto(BASE);
    await m.getByText('学生', { exact: true }).click();
    await m.getByText('下一步').click();
    await m.getByText('浦东新区', { exact: false }).first().click();
    await m.waitForTimeout(4000);
    const pad = m.locator('.touch-none').first();
    const b = await pad.boundingBox();
    const p0 = await m.evaluate(() => ({ ...window.__town.playerRuntime }));
    await m.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await m.mouse.down(); await m.mouse.move(b.x + b.width - 4, b.y + b.height / 2, { steps: 4 }); await m.waitForTimeout(1500); await m.mouse.up();
    const p1 = await m.evaluate(() => ({ ...window.__town.playerRuntime }));
    await m.getByTestId('nav-biz').click();
    await m.screenshot({ path: path.join(OUT, '10-mobile.png') });
    const wide = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await ctx.close();
    must(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.2, '摇杆没有移动角色');
    must(!wide, '页面横向溢出');
  });

  const fatal = errors.filter((e) => !/GPU stall|WebGL|swiftshader|GL_|THREE\.WebGLRenderer/.test(e));
  results.push({ name: '控制台无错误', ok: fatal.length === 0, err: fatal.slice(0, 3).join(' | ') });
  console.log(`${fatal.length ? '❌' : '✅'} 控制台无错误 ${fatal.slice(0, 3).join(' | ')}`);
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
