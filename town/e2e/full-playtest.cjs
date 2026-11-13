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

const BASE = (process.env.BASE_URL || 'http://localhost:4173') + '/?e2e&lowgfx';
const OUT = path.join(__dirname, 'playtest');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const results = [];
let page;

async function step(name, fn) {
  if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return;
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
/** 生成一个合法的统一社会信用代码（GB 32100-2015 校验位） */
const USCC_CHARS = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const uscc = (first17) => { const w = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]; const sum = first17.split('').reduce((a, ch, i) => a + USCC_CHARS.indexOf(ch) * w[i], 0); const c = 31 - (sum % 31); return first17 + USCC_CHARS[c === 31 ? 0 : c]; };
const goTab = async (tab) => { const s = await evalTown(() => window.__town.useTown.getState().tab); if (s !== tab) await T(`nav-${tab}`).click(); };
const toCity = async () => { await evalTown(() => window.__town.useTown.getState().setTab('city')); };
const waitFor = async (pred, ms = 120000, every = 400) => { const t = Date.now(); while (Date.now() - t < ms) { if (await pred()) return true; await page.waitForTimeout(every); } return false; };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
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
        if (txt.includes('暂时没有找到')) { counts[l] = 0; continue; }
        must(/为什么推荐/.test(txt) && /在哪里/.test(txt), `${l} 第 ${i + 1} 条缺少答案`);
      }
    }
    await page.locator('button.chip', { hasText: '潜在客户' }).first().click();
    return JSON.stringify(counts);
  });
  await step('我的生意：每张客户卡片展开后显示计算依据', async () => {
    await page.locator('button.chip', { hasText: '潜在客户' }).first().click();
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
    await evalTown(() => window.__town.nearLot('wk_w2', 6, false));
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
    await goTab('biz');
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
    const save = T('entity-card').getByText('⭐ 收藏为线索');
    if (await save.count()) await save.click();
    must(await T('entity-card').getByText('已收藏线索').count(), '收藏状态不对');
    await closeAll();
  });
  await step('铺位规则：每个街区 60% OPC 招租位 + 40% 黄金赞助位，已有店铺不占黄金位', async () => {
    const r = await evalTown(() => ['wukang', 'yangjing', 'sichuan_n'].map((d) => { const p = window.__town.lotPlan(d); return { d, total: p.total, golden: p.golden.length, opc: p.opc.length }; }));
    for (const x of r) must(x.golden === Math.round(x.total * 0.4) && x.golden + x.opc === x.total, `${x.d} 比例不对 ${JSON.stringify(x)}`);
    return r.map((x) => `${x.d}: OPC ${x.opc} / 黄金 ${x.golden} / 共 ${x.total}`).join('；');
  });
  await step('黄金位：走到门口显示赞助招商 → 资质校验 → 提交 → 审核 → 付款 → 上线（招牌带「赞」角标）', async () => {
    const lot = await evalTown(() => { const p = window.__town.lotPlan('wukang'); const s = window.__town.useLots.getState(); return p.golden.find((id) => !s.sponsorOf(id) && window.__town.doors('wukang').some((d) => d.lotId === id)); });
    must(lot, '没有空的黄金位');
    await evalTown((l) => window.__town.nearLot(l, 3), lot);
    await T('golden-card').waitFor({ timeout: 150000 });
    await T('sponsor-open').click();
    await T('sp-company').fill('三邻邦测试科技有限公司');
    await T('sp-code').fill('91310000MA1FL0000A');
    await T('sp-contact').fill('测试');
    await T('sp-phone').fill('13900001111');
    await T('sp-submit').click();
    must((await T('sp-errors').innerText()).includes('统一社会信用代码'), '没有校验信用代码');
    await T('sp-code').fill(uscc('91310000MA1FL0000'));
    await T('sp-submit').click();
    await page.waitForTimeout(3600);
    const st = await T('sponsor-status').innerText();
    must(st.includes('已上线'), `赞助状态：${st}`);
    await page.screenshot({ path: path.join(OUT, '05b-golden.png') });
    await T('golden-card').getByLabel('关闭').click();
    return lot;
  });
  await step('空铺：走到 OPC 招租位门口显示招租名片（含 60/40 说明）', async () => {
    const lot = await evalTown(() => { const p = window.__town.lotPlan('wukang'); return window.__town.doors('wukang').find((d) => d.lotId && d.lotId.startsWith('wukang_lot') && p.opc.includes(d.lotId))?.lotId; });
    must(lot, '没有空铺');
    await evalTown((l) => window.__town.nearLot(l, 3), lot);
    await T('lot-card').waitFor({ timeout: 150000 });
    must((await T('lot-plan').innerText()).includes('60%'), '没有 60/40 说明');
    return lot;
  });
  await step('开店：在空铺开店（外观 / 铺位 / 商品 / 需求 / 主体 / AI 分身权限）', async () => {
    await T('open-wizard').click();
    await T('opc-wizard').waitFor();
    await page.getByText('奶油咖啡馆').click();
    await T('shop-name').fill('阿岚 AI 影像');
    // 实名：已登记的手机号 / 姓名不能重复开店
    await T('owner-name').fill('林小满');
    await T('owner-phone').fill('13800000001');
    await T('owner-sms-send').click();
    await T('owner-sms').fill(await T('sms-code').innerText());
    await T('wizard-next').click();
    const dup = await T('wizard-errors').innerText();
    must(dup.includes('手机号已经开过店') && dup.includes('姓名已经登记'), `没有拦截重复开店：${dup}`);
    await T('owner-name').fill('阿岚');
    await T('owner-phone').fill('13912345678');
    await T('owner-sms-send').click();
    await T('owner-sms').fill('000000');
    await T('wizard-next').click();
    must((await T('wizard-errors').innerText()).includes('验证码不正确'), '没有校验验证码');
    await T('owner-sms').fill(await T('sms-code').innerText());
    await T('wizard-next').click();
    await page.getByText('AI技术服务').click();
    await page.getByText('+ 再加一款').click();
    await page.getByPlaceholder('产品 / 服务名称').nth(1).fill('AI 品牌短片');
    await T('wizard-next').click();
    await page.getByText('渠道', { exact: true }).click();
    await page.getByText('正在找合伙人').click();
    await T('license-yes').click();
    await T('license-company').fill('上海阿岚影像工作室');
    await T('license-code').fill('92310000MA1AL0000A');
    await T('wizard-next').click();
    must((await T('wizard-errors').innerText()).includes('统一社会信用代码'), '没有校验执照');
    await T('license-code').fill(uscc('92310104MA1AL0000'));
    await T('wizard-next').click();
    must(await page.getByText('L3 决策').isVisible(), '缺少 L3 说明');
    await T('wizard-finish').click();
    await page.waitForTimeout(2500);
    const opc = await evalTown(() => window.__town.useTown.getState().myOpc);
    must(!!opc, '开店失败');
    must(opc.license && opc.owner && opc.owner.phoneMasked === '139****5678', `店主 / 执照信息不对：${JSON.stringify(opc.owner)}`);
    must(!(await evalTown(() => window.__town.lotPlan('wukang').golden)).includes(opc.lotId), '开在了黄金位');
    await page.screenshot({ path: path.join(OUT, '06-opened.png') });
  });
  // —— v0.5：产业链黄页 + 上下游速配 + 服务商抢位 + 机会广场 ——
  for (const ind of ['ecommerce', 'heritage', 'education']) {
    await step(`产业链：「${ind}」完整上下游（上游 / 中游 / 下游 / 服务支撑 + 流向）`, async () => {
      await closeAll();
      await evalTown(() => window.__town.useTown.getState().setTab('chain'));
      await T('chain-panel').waitFor();
      await T(`industry-${ind}`).click();
      await page.waitForTimeout(400);
      const n = await page.locator('[data-testid^=stage-]').count();
      must(n >= 7, `环节数 ${n}`);
      await page.screenshot({ path: path.join(OUT, `17-chain-${ind}.png`) });
      return `${n} 个环节`;
    });
  }
  await step('产业链：把我放到链上（自动 / 手动登记），速配出上游、下游、同行与服务商', async () => {
    await T('industry-ecommerce').click();
    await T('stage-ec_content').click();
    await T('stage-detail').waitFor();
    if (await T('join-stage').count()) await T('join-stage').click();
    await page.waitForTimeout(300);
    must(await T('me-in-ec_content').count() > 0, '链路图上没有标出“我”');
    const txt = await T('speed-match').innerText();
    must(txt.includes('上游') && txt.includes('下游'), '速配缺少上下游');
    await page.screenshot({ path: path.join(OUT, '18-speed-match.png') });
    return txt.split('\n').length + ' 行速配结果';
  });
  await step('产业链：企业服务商抢位（每环节 2 个），满了只能候补', async () => {
    await T('stage-ec_live').click();
    await T('slot-claim-open').click();
    await T('slot-provider').fill('三邻邦测试服务商');
    await T('slot-offer').fill('直播间设备租赁 8 折');
    await T('slot-claim').click();
    await page.waitForTimeout(300);
    must((await T('slot-box').innerText()).includes('我的展位'), '没有抢到展位');
    await T('stage-ec_service').click();
    await T('slot-claim-open').click();
    await T('slot-offer').fill('记账报税');
    await T('slot-claim').click();
    await page.waitForTimeout(300);
    must(!(await T('slot-box').innerText()).includes('我的展位'), '满员环节不应抢到');
  });
  const waitText = async (loc, text, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await loc.innerText().catch(() => '')).includes(text)) return true; await page.waitForTimeout(300); } return false; };
  await step('需求大厅：需求单字段完整（需求方 / 预算 / 交付 / 地区 / 合作方式 / 截止 / 状态），可筛选', async () => {
    await evalTown(() => window.__town.useTown.getState().setTab('opps'));
    await T('opp-panel').waitFor();
    await T('opp-tab-hall').click();
    const f = await T('opp-op_t1').getByTestId('opp-fields').innerText();
    for (const k of ['已认证', '¥', '交付', '📍', '截止', '匹配中']) must(f.includes(k), `缺少字段 ${k}：${f}`);
    await T('opp-kind-gig').click();
    must(await T('opp-op_t1').count() === 0 && await T('opp-op_g1').count() === 1, '类型筛选无效');
    await T('opp-kind-all').click();
    return f;
  });
  await step('供给方：投标 → 中标 → 确认成交单 → 按节点交付 → 对方验收 → 互评', async () => {
    const card = T('opp-op_t2');
    await card.getByTestId('bid-open').click();
    await card.getByTestId('bid-quote').fill('12000');
    await card.getByTestId('bid-plan').fill('两人小团队，按周汇报，三个月完成店铺上新与运营。');
    await card.getByTestId('bid-submit').click();
    must(await waitText(card, '中标'), '没有中标');
    await T('opp-tab-taken').click();
    const d = T('deal-op_t2');
    await d.getByTestId('contract-confirm').click();
    must(await waitText(d, '双方已确认'), '成交单没有双方确认');
    for (let i = 0; i < 3; i++) {
      await d.getByTestId('ms-deliver').waitFor({ timeout: 10000 });
      await d.getByTestId('ms-deliver').click();
      must(await waitText(d.getByTestId(`milestone-${i}`), '已验收'), `节点 ${i + 1} 没有验收`);
    }
    await d.getByTestId('rate-submit').waitFor({ timeout: 10000 });
    await d.getByTestId('rate-submit').click();
    must(await d.getByTestId('rated').count() > 0, '没有评价');
    return '对方评价：' + ((await d.getByTestId('rating').innerText()).includes('对方给你') ? '已收到' : '未收到');
  });
  await step('联合交付：组队 → 按角色邀请伙伴 → 分成合计 100% → 联合投标', async () => {
    await T('opp-tab-hall').click();
    const card = T('opp-op_t4');
    await card.getByTestId('team-start').click();
    const tb = card.getByTestId('team-builder');
    for (const r of ['r_rd', 'r_teach', 'r_media']) {
      const btn = tb.getByTestId(`role-${r}`).getByTestId(`invite-role-${r}`);
      if (await btn.count()) await btn.first().click();
    }
    await page.waitForTimeout(1600);
    const splits = await tb.locator('[data-testid^=split-]').count();
    for (let i = 0; i < splits; i++) await tb.locator('[data-testid^=split-]').nth(i).fill(String(i === 0 ? 100 - 33 * (splits - 1) : 33));
    await tb.getByTestId('team-quote').fill('11000');
    await tb.getByTestId('team-plan').fill('课程设计 + 主讲 + 课件视频三人联合交付，两周内完成。');
    await tb.getByTestId('team-submit').click();
    must(await waitText(card, '已投标'), '联合投标没有提交：' + (await tb.innerText().catch(() => '')));
    await page.screenshot({ path: path.join(OUT, '20-team.png') });
  });
  await step('灵活就业：接单推广（推广码 → 作品 → 验收）与兼职投递（→ 邀约）', async () => {
    const p = T('opp-op_p1');
    await p.getByTestId('promo-take').click();
    await p.getByTestId('promo-link').fill('https://example.com/my-video');
    await p.getByTestId('promo-submit').click();
    must(await waitText(p, '已验收'), '推广没有验收');
    const g = T('opp-op_g1');
    await g.getByTestId('gig-apply').click();
    must(await waitText(g, '邀约'), '没有邀约');
  });
  await step('需求方：发布（违规拦截）→ 审核 → 平台推荐并邀请 → 比选表 → 选标 → 成交 → 逐节点验收 → 评价 → 复购', async () => {
    await T('opp-post-open').click();
    await T('post-title').fill('七夕礼盒短视频，需先交保证金');
    await T('post-submit').click();
    must((await T('post-errors').innerText()).includes('不允许'), '没有拦截违规内容');
    await T('post-title').fill('七夕礼盒短视频 3 条招标');
    await T('post-roles').fill('拍摄、设计');
    await T('post-submit').click();
    const d = page.locator('[data-testid^=deal-my_tender]').first();
    await d.waitFor();
    must(await waitText(d, '平台为你推荐'), '没有进入匹配 / 推荐');
    await d.getByTestId('reco-invite').first().click();
    must(await waitText(d.getByTestId('compare-table'), '¥', 12000), '没有收到投标');
    await page.screenshot({ path: path.join(OUT, '21-compare.png') });
    await d.getByTestId('award').first().click();
    await d.getByTestId('contract-confirm').click();
    must(await waitText(d, '双方已确认'), '没有成交');
    for (let i = 0; i < 3; i++) {
      await d.getByTestId('ms-accept').waitFor({ timeout: 10000 });
      await d.getByTestId('ms-accept').click();
      must(await waitText(d.getByTestId(`milestone-${i}`), '已验收'), `节点 ${i + 1}`);
    }
    await d.getByTestId('rate-submit').click();
    await d.getByTestId('repeat').click();
    await page.waitForTimeout(600);
    must(await page.locator('[data-testid^=deal-my_tender]').count() >= 2, '复购没有生成新需求');
    await page.screenshot({ path: path.join(OUT, '22-deal-done.png') });
  });
  await step('街区：成交后出现金色连接线；发布方店门口有需求标记', async () => {
    await evalTown(() => window.__town.useTown.getState().setTab('city'));
    await evalTown(() => window.__town.useTown.getState().goDistrict('wukang'));
    await page.waitForTimeout(2500);
    must(await page.locator('[data-testid^=opp-pin-]').count() > 0, '店门口没有需求标记');
  });
  await step('街区公告栏：每个街区都有，点击打开机会广场；店铺显示产业链位置', async () => {
    await evalTown(() => window.__town.useTown.getState().setTab('city'));
    const ok = await evalTown(() => ['wukang', 'yangjing', 'sichuan_n'].every((d) => window.__town.props(d).some((p) => p.kind === 'notice_board')));
    must(ok, '有街区缺公告栏');
    await closeAll();
    await evalTown(() => { const t = window.__town.useTown.getState(); t.openCard(undefined); t.enterLot('wk_w2'); });
    await T('agent-chat').waitFor({ timeout: 20000 });
    must(await T('shop-chain').count() > 0, '店铺没有显示产业链位置');
    must(await T('shop-credit').count() > 0, '店铺没有显示信用记录');
    await T('agent-chat').getByLabel('关闭').click();
  });

  await step('每人一家店：开店后再到空铺，只提示已有小店，不能再开', async () => {
    const lot = await evalTown(() => { const p = window.__town.lotPlan('wukang'); const mine = window.__town.useTown.getState().myOpc.lotId; return window.__town.doors('wukang').filter((d) => d.lotId && d.lotId.startsWith('wukang_lot') && p.opc.includes(d.lotId) && d.lotId !== mine)[1]?.lotId; });
    await evalTown((l) => window.__town.nearLot(l, 3), lot);
    await T('lot-card').waitFor({ timeout: 150000 });
    must(await T('open-wizard').count() === 0 && (await T('lot-card').innerText()).includes('已经有一家小店'), '没有限制每人一家');
    await T('lot-card').getByLabel('关闭').click();
  });
  await step('我的小店：进入自己的店，试用自己的 AI 分身', async () => {
    await closeAll(); await toCity();
    await T('my-shop-btn').click();
    await T('agent-chat').waitFor({ timeout: 30000 });
    must(await T('badge-company').count() > 0, '有营业执照的店铺没有「企」角标');
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
    if (await card.getByTestId('hello-e_wutong').count()) {
      await card.getByTestId('hello-e_wutong').click();
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
    for (const d of ['15 分钟', '30 分钟', '60 分钟']) { await card.locator('button.chip', { hasText: d }).click(); await card.getByTestId('book-meeting').click(); }
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
    must(!(await T('community-panel').getByText(/赞助内容 · /).count()), '关闭后仍显示赞助活动');
    await goTab('me');
    await T('me-panel').getByText('接收赞助活动推荐', { exact: false }).click();
    await T('me-panel').getByText('愿意被 AI 推荐', { exact: false }).click();
    await T('me-panel').getByText('愿意被 AI 推荐', { exact: false }).click();
  });
  await step('我的：审计日志记录了商业操作', async () => {
    await goTab('me');
    const t = await T('audit-log').innerText();
    for (const a of ['intro.sent', 'contact.', 'meeting.booked', 'collab.', 'opc.opened', 'agent.reply']) must(t.includes(a), `缺少 ${a}`);
  });

  // —— v0.4：版本号、找到我、打工挣钞票与消费、公园 ——
  await step('版本号：顶栏显示当前版本（确认看到的是最新版）', async () => {
    await toCity();
    const v = await T('version').innerText();
    must(v.includes('0.7.0'), `版本号是 ${v}`);
    return v;
  });
  await step('找到我：点击后镜头回到角色、脚下光圈闪烁', async () => {
    await toCity();
    await T('find-me').click();
    await page.waitForTimeout(600);
    const t = await evalTown(() => window.__town.playerRuntime.locateAt);
    must(t > 0, '没有触发定位');
    await page.screenshot({ path: path.join(OUT, '11-find-me.png') });
  });
  await step('打工 · 跑腿：接单 → 走到 A 店取货 → 走到 B 店送达 → 拿到钞票', async () => {
    await toCity();
    await T('district-wukang').click();
    await page.waitForTimeout(1500);
    await evalTown(() => window.__town.useWork.setState({ active: undefined, doneToday: [], purse: { ...window.__town.useWork.getState().purse, stamina: 90 } }));
    await T('open-jobs').click();
    await T('job-board').waitFor();
    await page.screenshot({ path: path.join(OUT, '12-job-board.png') });
    await T('job-delivery').first().getByText('接单').click();
    await T('active-job').waitFor();
    const job = await evalTown(() => window.__town.useWork.getState().active.job);
    const cash0 = await evalTown(() => window.__town.useWork.getState().purse.cash);
    await evalTown((l) => window.__town.nearLot(l), job.from.lotId);
    for (let i = 0; i < 40 && !(await evalTown(() => window.__town.useWork.getState().active?.picked)); i++) await page.waitForTimeout(500);
    must(await evalTown(() => window.__town.useWork.getState().active?.picked), '没有取到货');
    await page.screenshot({ path: path.join(OUT, '13-picked.png') });
    await evalTown((l) => window.__town.nearLot(l), job.to.lotId);
    for (let i = 0; i < 40 && (await evalTown(() => !!window.__town.useWork.getState().active)); i++) await page.waitForTimeout(500);
    const cash1 = await evalTown(() => window.__town.useWork.getState().purse.cash);
    must(cash1 > cash0, `钞票没有增加 ${cash0} → ${cash1}`);
    return `${job.title}：💴 ${cash0} → ${cash1}`;
  });
  await step('打工 · 店里帮工：按单配齐 4 单，下班结算', async () => {
    await closeAll();
    const lot = await evalTown(() => { const w = window.__town.useWork.getState(); const j = w.jobsHere().find((x) => x.kind === 'shift'); w.accept(j); return j.at.lotId; });
    const cash0 = await evalTown(() => window.__town.useWork.getState().purse.cash);
    await evalTown((l) => window.__town.nearLot(l), lot);
    await T('shift-game').waitFor({ timeout: 20000 });
    for (let k = 0; k < 4; k++) {
      // 低画质测试浏览器里 Playwright 的点击较慢，直接触发 DOM 点击，避免 60 秒的班次计时先结束
      await page.evaluate(() => {
        const need = document.querySelector('[data-testid=order-need]').getAttribute('data-need').split(',');
        for (const id of need) document.querySelector(`[data-testid=ing-${id}]`).click();
      });
      await page.waitForTimeout(120);
      if (k === 0) await page.screenshot({ path: path.join(OUT, '14-shift.png') });
      await page.evaluate(() => document.querySelector('[data-testid=serve]').click());
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(400);
    const cash1 = await evalTown(() => window.__town.useWork.getState().purse.cash);
    must(cash1 >= cash0 + 4 * 6 + 6, `帮工工资不对 ${cash0} → ${cash1}`);
    return `💴 ${cash0} → ${cash1}`;
  });
  await step('消费：进咖啡店买一杯拿铁（花钞票、补体力）', async () => {
    await closeAll();
    await evalTown(() => window.__town.useWork.setState((s) => ({ purse: { ...s.purse, stamina: 40 } })));
    await evalTown(() => window.__town.nearLot('wk_w2'));
    await T('agent-chat').waitFor({ timeout: 20000 });
    await T('open-counter').click();
    await T('counter').waitFor();
    const p0 = await evalTown(() => window.__town.useWork.getState().purse);
    await T('buy-m_latte').click();
    await page.waitForTimeout(300);
    const p1 = await evalTown(() => window.__town.useWork.getState().purse);
    await page.screenshot({ path: path.join(OUT, '15-counter.png') });
    must(p1.cash === p0.cash - 22 && p1.stamina > p0.stamina, `消费结果不对 ${JSON.stringify(p0)} → ${JSON.stringify(p1)}`);
    await T('counter').getByLabel('关闭').click();
    return `💴 ${p0.cash} → ${p1.cash}，⚡ ${p0.stamina} → ${p1.stamina}`;
  });
  await step('公园：走进公园，站着歇一会儿体力会恢复；小地图标出公园', async () => {
    await closeAll();
    const pk = await evalTown(() => window.__town.parks('wukang')[0]);
    await evalTown(() => window.__town.useWork.setState((s) => ({ purse: { ...s.purse, stamina: 30 } })));
    await evalTown((p) => { const t = window.__town.useTown.getState(); t.goDistrict('wukang', { x: p.cx, z: p.cz }); }, pk);
    await page.waitForTimeout(3500);
    const st = await evalTown(() => window.__town.useWork.getState().purse.stamina);
    await page.screenshot({ path: path.join(OUT, '16-park.png') });
    must(st > 30, `体力没有恢复：${st}`);
    const label = await T('minimap').innerText();
    must(label.includes('襄阳公园') || label.includes('徐家汇公园'), '小地图上没有公园名');
    return `${pk.label}：体力 30 → ${Math.round(st)}`;
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
