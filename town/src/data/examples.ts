/**
 * 【例】示范 OPC：每个街区约 10% 的铺位预设一家“示范店”，让第一次来的人看到一家完整的 OPC 店长什么样。
 *
 * - 全部为虚构示例（店名、主理人、客户、数据都不对应任何真实个人或商户），招牌与名片显示「例」角标；
 * - 覆盖当下最热门的一人公司方向：AI Agent、具身智能、直播、短视频剪辑、独立开发、数字人、出海等；
 * - 不进入产业链黄页、不参与「我的生意」匹配，避免与真实入驻主体混淆；可以在「今天来找什么」里被搜到；
 * - 主理人 NPC 统一穿蓝色背带裤。
 */
import type { DistrictKey } from '../domain/commerce';

export interface ExampleProduct { name: string; desc: string; price: string }
export interface ExampleOpc {
  id: string;
  district: DistrictKey;
  /** 方向（展示用） */
  direction: string;
  name: string;
  tagline: string;
  owner: { nickname: string; gender: 'f' | 'm'; title: string };
  /** 公司简介 */
  about: string;
  /** 一人公司现状：成立时间、团队形态、营收阶段（虚构） */
  status: string;
  highlights: string[];
  products: ExampleProduct[];
  cases: string[];
  /** 服务流程 */
  process: string[];
  tools: string[];
  faqs: { q: string; a: string }[];
  /** 正在找的资源 / 合作 */
  lookingFor: string[];
  /** 搜索关键词（「今天来找什么」） */
  keywords: string[];
  facade: 'cafe' | 'studio' | 'shikumen' | 'kiosk';
}

const E = (x: ExampleOpc) => x;

export const EXAMPLE_OPCS: ExampleOpc[] = [
  // —— 武康大楼（6 家） ——
  E({
    id: 'ex_agent', district: 'wukang', direction: 'AI Agent', name: '小邦智能体工坊', tagline: '给小公司配一个 24 小时不下班的 AI 员工', facade: 'studio',
    owner: { nickname: '阿哲', gender: 'm', title: '前大厂算法工程师，一人 AI Agent 工作室' },
    about: '为 5–50 人的小企业定制 AI Agent：客服接待、销售线索整理、合同初审、周报汇总。基于主流大模型与企业自己的资料搭建，交付后提供 3 个月陪跑调优。',
    status: '成立 1 年 · 一人 + 2 位兼职顾问 · 已交付 14 个项目（示例数据）',
    highlights: ['两周内上线第一个可用 Agent', '数据不出企业：支持私有化部署', '按效果分阶段付款'],
    products: [
      { name: '客服 / 前台 Agent', desc: '接入微信、网站，自动回答常见问题并转人工', price: '¥8,000 起 / 套' },
      { name: '销售线索 Agent', desc: '自动整理询盘、打标签、生成跟进提醒', price: '¥12,000 起 / 套' },
      { name: 'Agent 陪跑月费', desc: '每月调优提示词、更新知识库、出效果报告', price: '¥2,000 / 月' },
    ],
    cases: ['某连锁茶饮品牌：门店客服 Agent，人工咨询量下降约一半（示例）', '某设计工作室：报价单自动生成 Agent（示例）'],
    process: ['30 分钟需求诊断', '整理资料与流程', '两周搭建试用版', '上线 + 陪跑调优'],
    tools: ['大模型 API', '向量知识库', '工作流编排', '企业微信'],
    faqs: [{ q: '我们没有技术人员能用吗？', a: '可以，交付的是可视化后台，培训 1 小时就能自己维护知识库。' }, { q: '数据安全怎么保证？', a: '可以只在你们自己的服务器或云账号里部署，合同里写明数据归属。' }],
    lookingFor: ['需要 AI 客服的连锁门店', '能一起做行业方案的 UI 设计师'],
    keywords: ['AI', 'Agent', '智能体', '客服', '自动化', '大模型', '开发', '技术'],
  }),
  E({
    id: 'ex_editor', district: 'wukang', direction: '短视频剪辑', name: '一帧剪辑室', tagline: '把 2 小时素材剪成 30 秒爆款', facade: 'studio',
    owner: { nickname: '小鹿', gender: 'f', title: '自由剪辑师，前 MCN 后期主管' },
    about: '专注品牌短视频与口播剪辑：节奏、字幕、包装、调色一站完成。熟悉抖音、小红书、视频号不同平台的节奏和尺寸，支持长期包月。',
    status: '成立 2 年 · 一人 + 外包配音 / 调色伙伴 · 月均交付 60+ 条（示例数据）',
    highlights: ['48 小时交初剪', '包月客户可指定固定风格模板', '可配合 AI 生成画面补镜头'],
    products: [
      { name: '口播短视频剪辑', desc: '60 秒内，含字幕、包装、BGM', price: '¥300 / 条' },
      { name: '品牌宣传片剪辑', desc: '1–3 分钟，含调色与音效设计', price: '¥2,500 起 / 支' },
      { name: '包月剪辑', desc: '每月 20 条口播 + 2 支长视频', price: '¥6,800 / 月' },
    ],
    cases: ['某咖啡品牌秋季新品系列 12 条短视频（示例）', '某知识博主口播包月 6 个月（示例）'],
    process: ['确认脚本与参考', '传素材', '48 小时初剪', '两轮修改', '交付工程文件'],
    tools: ['Premiere', 'DaVinci Resolve', '剪映专业版', 'AI 字幕'],
    faqs: [{ q: '可以只剪不拍吗？', a: '可以，大部分客户都是自己拍、交给我剪。需要拍摄可以推荐街区里的摄影伙伴。' }, { q: '修改几次？', a: '含两轮修改，超出按每轮 ¥100 计。' }],
    lookingFor: ['长期包月的品牌方', '能接急单的配音伙伴'],
    keywords: ['剪辑', '视频', '短视频', '后期', '口播', '宣传片', '抖音', '小红书'],
  }),
  E({
    id: 'ex_design', district: 'wukang', direction: 'AI 设计', name: '梧桐视觉 AI 设计', tagline: '一周出一套能落地的品牌视觉', facade: 'cafe',
    owner: { nickname: 'Momo', gender: 'f', title: '独立品牌设计师，AI 辅助设计' },
    about: '用“AI 生成 + 设计师精修”的方式，为新消费品牌、咖啡甜品店、个人 IP 做 logo、包装、海报和社交媒体视觉，速度快、版权清晰。',
    status: '成立 3 年 · 一人公司 · 服务品牌 40+（示例数据）',
    highlights: ['所有交付物可商用、附版权说明', '提供可编辑源文件', 'AI 草图当天出 6 个方向'],
    products: [
      { name: 'Logo + 基础 VI', desc: '标志、标准色、字体、名片', price: '¥6,000 起' },
      { name: '包装设计', desc: '单品包装正背面 + 展开图', price: '¥3,500 / 款' },
      { name: '社媒视觉月包', desc: '每月 16 张小红书 / 公众号图', price: '¥3,000 / 月' },
    ],
    cases: ['某烘焙品牌全套包装升级（示例）', '某独立书店 10 周年视觉（示例）'],
    process: ['品牌问卷', 'AI 方向草图', '选定方向精修', '交付源文件与规范'],
    tools: ['Midjourney', 'Figma', 'Illustrator', 'Photoshop'],
    faqs: [{ q: 'AI 画的有版权问题吗？', a: '最终交付物都经过设计师重绘与精修，并在合同中约定版权归你。' }],
    lookingFor: ['需要整套视觉的新品牌', '包装打样工厂'],
    keywords: ['设计', 'logo', '包装', '海报', 'VI', '品牌', 'AI 绘图', '视觉'],
  }),
  E({
    id: 'ex_xhs', district: 'wukang', direction: '小红书运营', name: '种草研究所', tagline: '帮小品牌在小红书被搜到', facade: 'kiosk',
    owner: { nickname: '橙子', gender: 'f', title: '内容运营，一人代运营工作室' },
    about: '小红书账号从 0 到 1：定位、选题、笔记撰写、达人投放与数据复盘。只接 8 个长期客户，保证每个账号都有人认真看。',
    status: '成立 1 年半 · 一人 + 2 位兼职写手 · 同时服务 8 个账号（示例数据）',
    highlights: ['每周数据复盘', '笔记合规审核（不刷量、不虚假种草）', '可对接 KOC 投放'],
    products: [
      { name: '账号诊断', desc: '定位、竞品、选题清单', price: '¥1,200 / 次' },
      { name: '代运营月包', desc: '每月 12 篇笔记 + 评论维护 + 周报', price: '¥5,000 / 月' },
      { name: 'KOC 投放执行', desc: '筛选、沟通、跟进发布', price: '服务费 15%' },
    ],
    cases: ['某手作饰品账号 3 个月涨粉 1.2 万（示例）'],
    process: ['诊断', '定选题', '写作与排期', '发布与复盘'],
    tools: ['小红书专业号后台', '数据表格', 'AI 选题助手'],
    faqs: [{ q: '保证涨粉吗？', a: '不承诺数字，只承诺方法和执行；会把每周数据完整给你看。' }],
    lookingFor: ['想做小红书的本地品牌', '会拍照的兼职伙伴'],
    keywords: ['小红书', '运营', '代运营', '种草', '营销', '内容', '投放', 'KOC'],
  }),
  E({
    id: 'ex_indie', district: 'wukang', direction: '独立开发', name: '一人软件铺', tagline: '把小生意的麻烦事做成一个小程序', facade: 'shikumen',
    owner: { nickname: '老周', gender: 'm', title: '独立开发者，全栈' },
    about: '为门店、工作室开发预约、会员、点单、排课等小程序和轻量 SaaS；自己也在运营两款订阅制小工具。',
    status: '成立 2 年 · 一人 · 两款自有产品月订阅收入稳定（示例数据）',
    highlights: ['固定报价，不按人天加价', '代码与账号归客户', '上线后 1 个月免费维护'],
    products: [
      { name: '预约 / 会员小程序', desc: '适合美业、健身、工作室', price: '¥9,800 起' },
      { name: '数据看板', desc: '把表格变成每天自动更新的看板', price: '¥4,000 起' },
      { name: '维护年费', desc: 'Bug 修复、小改动、服务器运维', price: '¥3,600 / 年' },
    ],
    cases: ['某瑜伽馆排课与会员小程序（示例）', '某社区菜场线上订菜维护（示例）'],
    process: ['需求清单', '原型确认', '开发 2–4 周', '测试上线'],
    tools: ['TypeScript', '微信小程序', '云数据库', '低代码'],
    faqs: [{ q: '后期改需求怎么算？', a: '小改动包含在维护年费里，大功能单独报价，先报价后开工。' }],
    lookingFor: ['需要小程序的门店', '会做 UI 的设计伙伴'],
    keywords: ['开发', '小程序', '软件', 'SaaS', '程序员', '技术', '网站', 'APP'],
  }),
  E({
    id: 'ex_podcast', district: 'wukang', direction: '播客 / 音频', name: '梧桐声音工作室', tagline: '帮品牌开一档有人听的播客', facade: 'cafe',
    owner: { nickname: '阿声', gender: 'm', title: '播客制作人，前电台编辑' },
    about: '品牌播客策划、录制、剪辑与分发；也做课程旁白、有声书和企业宣传片配音。工作室在武康路老洋房二楼，自带录音间。',
    status: '成立 2 年 · 一人 + 1 位兼职剪辑 · 制作节目 120+ 期（示例数据）',
    highlights: ['自带专业录音间', '可远程录制', '提供节目封面与文字稿'],
    products: [
      { name: '品牌播客月包', desc: '每月 4 期，含策划、录制、剪辑、分发', price: '¥8,000 / 月' },
      { name: '录音间时租', desc: '双人录音，含调音师', price: '¥300 / 小时' },
      { name: '配音 / 旁白', desc: '宣传片、课程', price: '¥500 起 / 条' },
    ],
    cases: ['某生活方式品牌播客 30 期（示例）'],
    process: ['定节目定位', '选题与嘉宾', '录制', '剪辑与分发'],
    tools: ['专业录音设备', 'Audition', 'AI 降噪', '多平台分发'],
    faqs: [{ q: '没有主持人怎么办？', a: '可以由我主持，也可以培训你们的同事上手。' }],
    lookingFor: ['想做播客的品牌', '有故事的嘉宾'],
    keywords: ['播客', '音频', '配音', '录音', '旁白', '有声书', '声音'],
  }),

  // —— 洋泾社区（7 家） ——
  E({
    id: 'ex_robot', district: 'yangjing', direction: '具身智能', name: '邻家机器人实验室', tagline: '让机器人走进社区小店和养老院', facade: 'studio',
    owner: { nickname: '大伟', gender: 'm', title: '机器人系统集成工程师' },
    about: '做具身智能的“最后一公里”：为门店、展厅、养老机构选型、集成和部署服务机器人与机械臂，开发引导讲解、送物、陪伴等场景应用。',
    status: '成立 8 个月 · 一人 + 合作硬件厂商 · 完成 5 个场景试点（示例数据）',
    highlights: ['不卖硬件差价，按方案与部署收费', '支持租赁试用', '提供场景安全评估'],
    products: [
      { name: '场景评估', desc: '现场勘察 + 机器人选型建议', price: '¥3,000 / 次' },
      { name: '讲解 / 迎宾机器人部署', desc: '展厅、门店迎宾讲解应用', price: '¥25,000 起' },
      { name: '机器人租赁运维', desc: '按月租赁，含远程运维', price: '¥4,500 起 / 月' },
    ],
    cases: ['某社区长者食堂送餐机器人试点（示例）', '某科技展厅讲解机器人（示例）'],
    process: ['场景评估', '选型与试用', '应用开发', '部署培训', '运维'],
    tools: ['ROS', '多模态大模型', '机械臂 SDK', '室内导航'],
    faqs: [{ q: '机器人坏了怎么办？', a: '租赁方案含远程运维与 48 小时上门；购买方案有一年质保。' }],
    lookingFor: ['愿意试点的养老 / 门店场景', '工业设计伙伴', '天使投资人'],
    keywords: ['机器人', '具身智能', '硬件', 'AI', '养老', '自动化', '机械臂', '投资'],
  }),
  E({
    id: 'ex_live', district: 'yangjing', direction: '直播带货', name: '泾彩直播间', tagline: '社区小店也能开一场像样的直播', facade: 'kiosk',
    owner: { nickname: '佳佳', gender: 'f', title: '带货主播 / 直播间代运营' },
    about: '提供直播间搭建、主播出镜、脚本与投流的一站式服务，擅长食品、家居、社区团购类目；也帮小店主培训自播。',
    status: '成立 1 年 · 一人主播 + 1 位场控 · 累计直播 300+ 场（示例数据）',
    highlights: ['按场次 + 佣金组合计费', '直播间可上门搭建', '自播培训包教包会'],
    products: [
      { name: '专场直播', desc: '3 小时，含脚本、主播、场控', price: '¥3,000 / 场 + 佣金' },
      { name: '直播间搭建', desc: '灯光、背景、设备清单与调试', price: '¥5,000 起' },
      { name: '自播培训', desc: '4 次课，手把手带开播', price: '¥2,800 / 期' },
    ],
    cases: ['某糕团老店中秋专场（示例）', '某社区菜场早市直播（示例）'],
    process: ['选品与定价', '脚本', '彩排', '直播', '复盘'],
    tools: ['抖音 / 视频号直播', '投流后台', '提词器'],
    faqs: [{ q: '保证销量吗？', a: '不保证，按场次收基础费、按成交收佣金，双方利益一致。' }],
    lookingFor: ['有好货的品牌方', '会剪直播切片的剪辑师'],
    keywords: ['直播', '带货', '主播', '电商', '抖音', '视频号', '团购'],
  }),
  E({
    id: 'ex_private', district: 'yangjing', direction: '私域运营', name: '邻里私域研究室', tagline: '把老客户变成会复购的朋友', facade: 'shikumen',
    owner: { nickname: '美玲', gender: 'f', title: '私域与社群运营顾问' },
    about: '帮门店和品牌搭建企业微信私域：社群 SOP、会员体系、复购活动和自动化话术，适合有一定老客户但不会经营的商家。',
    status: '成立 2 年 · 一人 · 服务门店 30+（示例数据）',
    highlights: ['30 天搭好私域框架', '交付完整 SOP 文档', '合规：不骚扰、不刷屏'],
    products: [
      { name: '私域搭建', desc: '企微、社群、欢迎语、标签体系', price: '¥6,000 / 套' },
      { name: '社群代运营', desc: '每日内容 + 每月 2 场活动', price: '¥4,000 / 月' },
      { name: '复购活动策划', desc: '节日、会员日方案', price: '¥2,000 / 场' },
    ],
    cases: ['某社区面包店会员复购提升（示例）'],
    process: ['盘点老客户', '搭框架', '写 SOP', '陪跑一个月'],
    tools: ['企业微信', 'SCRM', 'AI 话术助手'],
    faqs: [{ q: '我只有几百个客户值得做吗？', a: '值得，几百个熟客的复购往往比一万个陌生流量更值钱。' }],
    lookingFor: ['社区门店', '能做小程序商城的开发者'],
    keywords: ['私域', '社群', '运营', '企业微信', '会员', '复购', '营销'],
  }),
  E({
    id: 'ex_pet', district: 'yangjing', direction: '宠物服务', name: '毛孩子上门', tagline: '主人上班，我们上门', facade: 'kiosk',
    owner: { nickname: '小安', gender: 'f', title: '宠物上门喂养 / 训练师' },
    about: '洋泾周边 3 公里内的上门喂猫遛狗、洗护预约与行为训练；全程视频反馈，持证宠物护理师。',
    status: '成立 1 年 · 一人 + 2 位兼职护理师 · 服务家庭 200+（示例数据）',
    highlights: ['全程视频打卡', '持证护理', '购买第三方宠物责任险'],
    products: [
      { name: '上门喂猫', desc: '30 分钟：喂食、铲屎、陪玩', price: '¥60 / 次' },
      { name: '上门遛狗', desc: '45 分钟', price: '¥80 / 次' },
      { name: '行为训练', desc: '5 次课：定点如厕、随行', price: '¥1,500 / 期' },
    ],
    cases: ['春节假期连续 10 天上门喂养（示例）'],
    process: ['线上沟通习惯', '首次见面', '按次上门', '视频反馈'],
    tools: ['预约小程序', '视频打卡'],
    faqs: [{ q: '钥匙怎么交接？', a: '推荐密码锁临时密码；钥匙交接会签交接单。' }],
    lookingFor: ['社区宠物店合作', '兼职护理师'],
    keywords: ['宠物', '上门', '喂猫', '遛狗', '训练', '生活服务'],
  }),
  E({
    id: 'ex_fit', district: 'yangjing', direction: '健身私教', name: '泾南轻训营', tagline: '下班 40 分钟，在公园练出好状态', facade: 'studio',
    owner: { nickname: '阿峰', gender: 'm', title: '独立私教，国家职业资格认证' },
    about: '在泾南公园与社区活动室开小班训练营，也提供线上打卡私教；专注久坐上班族的体态调整与减脂。',
    status: '成立 1 年半 · 一人 · 学员 150+（示例数据）',
    highlights: ['6 人小班', '训练前体态评估', '线上线下结合'],
    products: [
      { name: '公园小班课', desc: '8 次，每次 40 分钟', price: '¥680 / 期' },
      { name: '一对一私教', desc: '含训练计划与饮食建议', price: '¥300 / 节' },
      { name: '线上打卡营', desc: '21 天，每日计划 + 点评', price: '¥199 / 期' },
    ],
    cases: ['某公司午间体态改善课（示例）'],
    process: ['体态评估', '定计划', '训练', '每周复盘'],
    tools: ['体测设备', '训练 App', '社群打卡'],
    faqs: [{ q: '零基础可以吗？', a: '可以，第一节课先做评估，再安排强度。' }],
    lookingFor: ['企业团体课', '合作场地'],
    keywords: ['健身', '私教', '运动', '减脂', '体态', '训练'],
  }),
  E({
    id: 'ex_avatar', district: 'yangjing', direction: '数字人', name: '分身数字人工作室', tagline: '你的数字分身，替你讲课、直播、接待', facade: 'studio',
    owner: { nickname: 'Kiki', gender: 'f', title: '数字人内容制作人' },
    about: '为老师、主播、企业高管定制数字人分身，批量生成口播视频、课程讲解和多语种版本；也提供数字人直播间搭建。',
    status: '成立 10 个月 · 一人 · 交付数字人 60+（示例数据）',
    highlights: ['形象与声音授权合同齐全', '一次拍摄，长期复用', '支持中英日多语种'],
    products: [
      { name: '数字人分身定制', desc: '形象 + 声音克隆，含 10 条视频', price: '¥6,800 起' },
      { name: '口播视频生成', desc: '提供文稿即可', price: '¥150 / 条' },
      { name: '数字人直播间', desc: '7×24 小时轮播讲解', price: '¥3,000 / 月' },
    ],
    cases: ['某财税讲师 100 条课程短视频（示例）'],
    process: ['授权签约', '20 分钟拍摄', '模型训练', '批量生成'],
    tools: ['数字人平台', '声音克隆', 'AI 翻译'],
    faqs: [{ q: '会被冒用吗？', a: '形象与声音只用于你授权的内容，合同约定用途与删除机制。' }],
    lookingFor: ['知识博主', '出海品牌'],
    keywords: ['数字人', 'AI', '口播', '虚拟主播', '直播', '视频', '分身'],
  }),
  E({
    id: 'ex_cross', district: 'yangjing', direction: '跨境电商', name: '小船出海', tagline: '一个人也能把好货卖到海外', facade: 'kiosk',
    owner: { nickname: 'Leo', gender: 'm', title: '跨境电商独立站操盘手' },
    about: '帮国内小品牌搭建独立站、做海外社媒和 TikTok 内容，打通物流与收款；自己运营一个家居小件品牌。',
    status: '成立 3 年 · 一人 + 海外兼职 · 自有品牌销往 20+ 国家（示例数据）',
    highlights: ['从 0 搭独立站 3 周上线', '提供物流与收款渠道对接', '中英双语内容'],
    products: [
      { name: '独立站搭建', desc: '店铺、支付、物流配置', price: '¥12,000 起' },
      { name: '海外社媒代运营', desc: 'TikTok / Instagram 每月 20 条', price: '¥6,000 / 月' },
      { name: '出海诊断', desc: '品类、定价、渠道建议', price: '¥1,500 / 次' },
    ],
    cases: ['某非遗手作品牌独立站上线（示例）'],
    process: ['诊断', '建站', '内容测试', '放量'],
    tools: ['独立站平台', 'TikTok', '海外仓', '跨境收款'],
    faqs: [{ q: '需要公司主体吗？', a: '建议有，个体户也可以起步，可以推荐财税伙伴帮你办理。' }],
    lookingFor: ['有特色的国货品牌', '英文配音', '海外仓资源'],
    keywords: ['出海', '跨境', '电商', 'TikTok', '独立站', '外贸', '海外'],
  }),

  // —— 甜爱路及四川北路（6 家） ——
  E({
    id: 'ex_photo', district: 'sichuan_n', direction: '商业摄影', name: '北路快门', tagline: '产品、人像、空间，一个人搞定', facade: 'studio',
    owner: { nickname: '阿光', gender: 'm', title: '商业摄影师' },
    about: '电商产品图、品牌人像、餐厅空间与活动跟拍；熟悉四川北路、甜爱路一带的取景点，也有 30㎡ 棚。',
    status: '成立 4 年 · 一人 + 修图外包 · 合作品牌 80+（示例数据）',
    highlights: ['当天出精选样片', '可开发票', '提供商用授权'],
    products: [
      { name: '电商产品图', desc: '白底 + 场景，每款 5 张', price: '¥180 / 款' },
      { name: '品牌人像', desc: '半天，精修 20 张', price: '¥2,800' },
      { name: '活动跟拍', desc: '4 小时，当天出 30 张', price: '¥2,000' },
    ],
    cases: ['某文创品牌七夕系列产品图（示例）'],
    process: ['确认拍摄清单', '拍摄', '选片', '精修交付'],
    tools: ['全画幅相机', '影棚灯光', 'Lightroom'],
    faqs: [{ q: '可以拍视频吗？', a: '可以拍素材，剪辑推荐街区的剪辑师伙伴。' }],
    lookingFor: ['长期合作的电商品牌', '造型师'],
    keywords: ['拍摄', '摄影', '拍照', '产品图', '人像', '跟拍', '摄影师'],
  }),
  E({
    id: 'ex_course', district: 'sichuan_n', direction: '知识付费', name: '多伦课堂', tagline: '把你的经验做成一门能卖的课', facade: 'shikumen',
    owner: { nickname: '林老师', gender: 'f', title: '课程设计师 / 讲师' },
    about: '帮行业专家把经验做成线上课：课程结构设计、讲义、录制、上架与私域转化；自己开设“一人公司入门”系列课。',
    status: '成立 3 年 · 一人 · 学员累计 5,000+（示例数据）',
    highlights: ['课程结构先行，避免录完没人买', '提供上架与定价建议', '可对接数字人批量录制'],
    products: [
      { name: '课程打磨', desc: '大纲、讲义、试讲辅导', price: '¥8,000 / 门' },
      { name: '代录制剪辑', desc: '10 节以内', price: '¥6,000 起' },
      { name: '一人公司入门课', desc: '8 节录播 + 2 次直播答疑', price: '¥399' },
    ],
    cases: ['某财税专家 12 节课程上线（示例）'],
    process: ['定位与人群', '大纲', '录制', '上架与转化'],
    tools: ['课程平台', '录屏', '社群'],
    faqs: [{ q: '我不擅长表达能做课吗？', a: '可以，先做图文或数字人课程，也能从小班直播开始。' }],
    lookingFor: ['有专业经验的专家', '剪辑与设计伙伴'],
    keywords: ['课程', '知识付费', '培训', '讲师', '教育', '直播课'],
  }),
  E({
    id: 'ex_l10n', district: 'sichuan_n', direction: 'AI 翻译 / 出海本地化', name: '虹口译站', tagline: 'AI 初译 + 人工精校，三天出多语种', facade: 'cafe',
    owner: { nickname: 'Yuki', gender: 'f', title: '日英双语译者，本地化项目经理' },
    about: '产品说明、官网、App 与视频字幕的多语种本地化：AI 初译提速，母语审校保证质量，擅长日语、英语市场。',
    status: '成立 2 年 · 一人 + 母语审校网络 · 完成项目 90+（示例数据）',
    highlights: ['AI + 人工双保险', '术语表长期维护', '支持视频字幕压制'],
    products: [
      { name: '文档本地化', desc: '中→英 / 日', price: '¥0.25 / 字起' },
      { name: '视频字幕', desc: '听写、翻译、压制', price: '¥30 / 分钟' },
      { name: '官网多语种', desc: '含术语表与 SEO 关键词', price: '¥5,000 起' },
    ],
    cases: ['某咖啡器具品牌日文官网（示例）'],
    process: ['术语确认', 'AI 初译', '人工精校', '交付与维护'],
    tools: ['机器翻译', '术语库', '字幕软件'],
    faqs: [{ q: '加急可以吗？', a: '可以，24 小时加急收 30% 加急费。' }],
    lookingFor: ['出海品牌', '跨境电商卖家'],
    keywords: ['翻译', '本地化', '出海', '英语', '日语', '字幕', 'AI'],
  }),
  E({
    id: 'ex_craft', district: 'sichuan_n', direction: '非遗文创', name: '海派手作社', tagline: '把海派老手艺做成年轻人喜欢的小物', facade: 'kiosk',
    owner: { nickname: '阿婉', gender: 'f', title: '手作设计师，海派绒线编结学习者' },
    about: '以海派绒线编结、剪纸等传统手艺为灵感，设计文创小物与手作体验课；接企业定制礼品与团建课。',
    status: '成立 2 年 · 一人 + 3 位合作手艺人 · 开课 100+ 场（示例数据）',
    highlights: ['手艺人合作分成透明', '企业定制最低 50 份起', '体验课可上门'],
    products: [
      { name: '手作体验课', desc: '2 小时，含材料', price: '¥168 / 人' },
      { name: '企业定制礼盒', desc: '主题设计 + 手工制作', price: '¥120 起 / 份' },
      { name: '文创小物', desc: '书签、挂饰、钥匙扣', price: '¥39 起' },
    ],
    cases: ['某公司 80 人手作团建（示例）'],
    process: ['确认主题与人数', '打样', '制作 / 开课', '交付'],
    tools: ['手作工具', '小红书', '小程序商城'],
    faqs: [{ q: '可以加 logo 吗？', a: '可以，定制款可以加企业 logo 与祝福语。' }],
    lookingFor: ['企业团建 / 礼品采购', '出海渠道'],
    keywords: ['非遗', '手作', '文创', '礼品', '团建', '手工', '定制'],
  }),
  E({
    id: 'ex_3d', district: 'sichuan_n', direction: '3D 打印 / 潮玩', name: '小模型制造局', tagline: '从一张草图到一个手办', facade: 'studio',
    owner: { nickname: '阿凯', gender: 'm', title: '3D 建模师 / 潮玩设计' },
    about: '3D 建模、打印与上色，做潮玩手办、产品原型和品牌周边；可配合 AI 生成 3D 草模，小批量 10 件起做。',
    status: '成立 1 年半 · 一人 + 2 台光固化打印机 · 交付原型 200+（示例数据）',
    highlights: ['小批量起做', '可出产品原型做众筹', '提供开模工厂对接'],
    products: [
      { name: '3D 建模', desc: '角色 / 产品外观', price: '¥1,500 起' },
      { name: '打印 + 上色', desc: '10cm 手办', price: '¥300 / 个' },
      { name: '品牌周边小批量', desc: '50 件起', price: '询价' },
    ],
    cases: ['某 AI 玩偶众筹原型（示例）'],
    process: ['草图', '建模确认', '打样', '批量'],
    tools: ['Blender', 'ZBrush', '光固化打印', 'AI 3D 生成'],
    faqs: [{ q: '能直接量产吗？', a: '几百件以内可以打印，上千件建议开模，我可以对接工厂。' }],
    lookingFor: ['IP 方', '硬件创业团队', '众筹策划'],
    keywords: ['3D', '打印', '手办', '潮玩', '建模', '原型', '周边', '硬件'],
  }),
  E({
    id: 'ex_tax', district: 'sichuan_n', direction: '财税服务', name: '一人财税工作室', tagline: '一人公司的记账报税，交给另一个一人公司', facade: 'shikumen',
    owner: { nickname: '王会计', gender: 'f', title: '中级会计师，一人财税工作室' },
    about: '专为一人公司、个体户、小微企业提供注册、记账报税、发票与社保咨询；用自动化工具降低成本，价格透明。',
    status: '成立 5 年 · 一人 + 财税软件 · 长期客户 120+（示例数据）',
    highlights: ['价格透明、无隐藏费用', '每月报税提醒', '注册到报税全流程'],
    products: [
      { name: '小规模记账报税', desc: '每月记账 + 申报', price: '¥200 / 月' },
      { name: '公司注册', desc: '个体户 / 有限公司', price: '¥800 起' },
      { name: '财税咨询', desc: '一对一 1 小时', price: '¥300' },
    ],
    cases: ['帮 30 位自由职业者注册个体户（示例）'],
    process: ['了解业务', '选主体类型', '注册', '按月记账报税'],
    tools: ['财税 SaaS', '电子税务局', 'AI 票据识别'],
    faqs: [{ q: '一人公司要不要注册？', a: '看收入规模和客户是否需要发票，第一次咨询我会给你算清楚。' }],
    lookingFor: ['刚起步的一人公司', '法务伙伴'],
    keywords: ['财税', '记账', '报税', '注册公司', '发票', '会计', '法务'],
  }),
];

export const examplesOf = (d: DistrictKey) => EXAMPLE_OPCS.filter((e) => e.district === d);
export const exampleById = (id: string) => EXAMPLE_OPCS.find((e) => e.id === id);
