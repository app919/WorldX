/**
 * OPC 的 AI 商业分身 —— “主理人不在线，店铺也能营业”。
 *
 * 权限分级：
 *   L1 接待：公司介绍、产品介绍、常见问题、案例 —— 可自由执行
 *   L2 商务：收集需求、推荐服务、预约会议 —— 受规则约束，主理人可关闭
 *   L3 决策：最终报价、折扣、合同、承诺交付、退款 —— 必须本人确认，Agent 永远不做
 *
 * 硬性原则：
 * - 只引用主理人确认过的资料（priceConfirmed 的价格、已录入的 FAQ / 案例），绝不编造。
 * - 访客必须知道自己在和 AI 分身对话（transparencyNotice）。
 * - 主理人接管后 Agent 立刻停止回答。
 *
 * 第一版是可测试的规则引擎；接入大模型时，应把大模型限制在“措辞润色”，
 * 事实仍由本模块从结构化数据中检索并作为 citations 输出。
 */
import type { AgentConfig, AgentReply, OpcProfile } from './types';

export const transparencyNotice = (opcName: string) =>
  `你好～我是「${opcName}」主理人的 AI 分身 🤖。我可以介绍产品、回答常见问题、帮你预约主理人；报价确认、折扣、合同等需要主理人本人决定。`;

const L3_PATTERNS = /折扣|打折|打个折|打.折|便宜点|便宜一点|优惠|砍价|合同|签约|签合同|保证|承诺|包过|一定能|交付时间|几天交付|退款|退钱|最终报价|最低价|定金|发票|赔偿/;
const PRICE_PATTERNS = /多少钱|价格|报价|费用|收费|怎么收|价位/;
const INTRO_PATTERNS = /你们是|介绍一下|做什么|是谁|什么店|主营/;
const PRODUCT_PATTERNS = /能做|可以做|能不能|有没有|服务|产品|业务/;
const CASE_PATTERNS = /案例|作品|做过|客户有/;
const MEETING_PATTERNS = /预约|见面|聊聊|沟通|开会|约个|电话/;
const NEED_PATTERNS = /预算|我想做|我们想|我需要|需求是|用途/;
const HUMAN_PATTERNS = /真人|本人|机器人|你是ai|你是 ai|人工/;

function fmtPrice(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)} 万` : `${n}`;
}

/** 在产品名 / 描述里找与访客问题最相关的产品 */
function findProduct(opc: OpcProfile, q: string) {
  let best: { p: OpcProfile['products'][number]; hit: number } | null = null;
  for (const p of opc.products) {
    const words = `${p.name}${p.description}`.replace(/[，。、\s]/g, '');
    let hit = 0;
    for (let i = 0; i < q.length - 1; i++) if (words.includes(q.slice(i, i + 2))) hit++;
    if (hit > 0 && (!best || hit > best.hit)) best = { p, hit };
  }
  return best?.p;
}

function findFaq(opc: OpcProfile, q: string) {
  let best: { a: string; q: string; hit: number } | null = null;
  for (const f of opc.faqs) {
    let hit = 0;
    for (let i = 0; i < f.q.length - 1; i++) if (q.includes(f.q.slice(i, i + 2))) hit++;
    if (hit >= 2 && (!best || hit > best.hit)) best = { ...f, hit };
  }
  return best;
}

export function agentRespond(opc: OpcProfile, cfg: AgentConfig, question: string): AgentReply {
  const q = question.trim().toLowerCase();

  if (cfg.ownerTakeover) {
    return { text: '主理人已经亲自接管对话啦，请稍等 TA 的回复～', level: 'L1', citations: [], handoff: true };
  }

  if (HUMAN_PATTERNS.test(q)) {
    return {
      text: `我是 AI 分身，不是主理人本人哦。${cfg.ownerOnline ? '主理人现在在线，我可以帮你请 TA 过来。' : '主理人暂时不在线，我可以帮你留言或预约 TA 的时间。'}`,
      level: 'L1', citations: ['agent.transparency'], handoff: false,
    };
  }

  // L3：永远转交本人
  if (L3_PATTERNS.test(q)) {
    return {
      text: '这个需要主理人本人确认，我不能替 TA 做决定（例如最终报价、折扣、合同或交付承诺）。我已经把你的问题转交给主理人，也可以直接预约一个 15 分钟沟通～',
      level: 'L3', citations: ['agent.policy.L3'], handoff: true,
    };
  }

  const l2 = cfg.enabledLevels.L2;

  if (PRICE_PATTERNS.test(q)) {
    const p = findProduct(opc, q) ?? opc.products.find((x) => x.priceConfirmed && x.priceFrom !== undefined);
    if (p && p.priceConfirmed && p.priceFrom !== undefined) {
      return {
        text: `「${p.name}」的基础服务从 ${fmtPrice(p.priceFrom)} 元${p.unit ? `/${p.unit}` : ''}起，具体取决于需求和制作要求。最终报价需要主理人确认，要不要帮你预约一个 15 分钟沟通？`,
        level: 'L2', citations: [`product:${p.id}.priceFrom`], handoff: false,
        action: l2 ? { kind: 'suggest_meeting' } : undefined,
      };
    }
    return {
      text: '主理人还没有公开确认这项服务的价格，我不能替 TA 报价哦。你可以说说预算和用途，我整理好转交给主理人。',
      level: 'L2', citations: ['agent.policy.no_unconfirmed_price'], handoff: !l2,
      action: l2 ? { kind: 'collect_need' } : undefined,
    };
  }

  if (MEETING_PATTERNS.test(q)) {
    if (!l2) return { text: '预约功能主理人暂时没有开放给 AI 分身，我先帮你留言给 TA～', level: 'L2', citations: ['agent.config.L2=off'], handoff: true };
    return {
      text: '好呀！可以预约主理人 15 / 30 / 60 分钟的线上见面，介绍你的需求。我会把时间发给主理人确认。',
      level: 'L2', citations: ['agent.config.L2=on'], handoff: false, action: { kind: 'suggest_meeting' },
    };
  }

  if (NEED_PATTERNS.test(q)) {
    if (!l2) return { text: '收到～我先把你的需求原样留言给主理人。', level: 'L2', citations: ['agent.config.L2=off'], handoff: true };
    return {
      text: '收到，我帮你整理成一份初步需求，主理人上线后会看到。可以再告诉我：用途、期望时间和大概预算吗？',
      level: 'L2', citations: ['agent.l2.collect_need'], handoff: false,
      action: { kind: 'collect_need', payload: { raw: question } },
    };
  }

  if (CASE_PATTERNS.test(q)) {
    if (!opc.cases.length) return { text: '主理人还没有上传公开案例，我不想乱举例子～可以预约主理人了解。', level: 'L1', citations: [], handoff: false };
    return { text: `公开过的案例有：${opc.cases.join('；')}。`, level: 'L1', citations: opc.cases.map((_, i) => `case:${i}`), handoff: false };
  }

  const faq = findFaq(opc, q);
  if (faq) return { text: faq.a, level: 'L1', citations: [`faq:${faq.q}`], handoff: false };

  const product = findProduct(opc, q);
  if (product && PRODUCT_PATTERNS.test(q)) {
    return {
      text: `可以呀！我们提供「${product.name}」：${product.description}。你可以告诉我预算和用途，我帮你整理一个初步合作建议。`,
      level: 'L1', citations: [`product:${product.id}`], handoff: false,
    };
  }

  if (INTRO_PATTERNS.test(q) || PRODUCT_PATTERNS.test(q)) {
    return {
      text: `${opc.name}：${opc.tagline}。主要提供 ${opc.products.map((p) => `「${p.name}」`).join('、')}。`,
      level: 'L1', citations: ['opc.tagline', ...opc.products.map((p) => `product:${p.id}`)], handoff: false,
    };
  }

  return {
    text: '这个问题我不太确定，不想乱说～我可以把它留言给主理人，或者帮你预约一次沟通。',
    level: 'L1', citations: [], handoff: true,
  };
}

/** 从主理人确认的资料自动生成店铺介绍与 FAQ 草稿（开店第三步）——仍需主理人确认后上线 */
export function draftAgentKnowledge(opc: Pick<OpcProfile, 'name' | 'tagline' | 'products' | 'openNeeds'>) {
  const faqs = [
    { q: '你们主要做什么', a: `${opc.name}主要提供：${opc.products.map((p) => p.name).join('、')}。` },
    { q: '可以远程合作吗', a: '可以，线上线下都可以沟通，具体以主理人确认为准。' },
  ];
  if (opc.openNeeds.length) faqs.push({ q: '你们在找合作伙伴吗', a: `是的，目前在寻找：${opc.openNeeds.join('、')}。` });
  return {
    intro: `欢迎来到「${opc.name}」！${opc.tagline}`,
    faqs,
  };
}
