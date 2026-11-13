/**
 * 三个演示行业的完整上下游产业链（全部为虚构演示数据，isDemo）。
 *
 * - 每条链由若干「环节」组成：上游 → 中游 → 下游，另有一列「服务支撑」；
 * - 环节之间的连线写明流动的是什么（货 / 内容 / 订单 / 学员 / 服务 / 钱）；
 * - 每个环节里放着链上的成员：街区里的店铺与个人（entityId 指向街区主体，可以走过去进店），
 *   以及街区外的链上伙伴（city 标注所在城市）；
 * - 每个环节有 2 个「服务商展位」，企业服务商可以抢位提供资源支持（明确标注为推广，不影响匹配分）。
 */
import type { DistrictKey } from '../domain/commerce';

export type ChainLayer = 'upstream' | 'midstream' | 'downstream' | 'service';
export const LAYER_LABEL: Record<ChainLayer, string> = { upstream: '上游', midstream: '中游', downstream: '下游', service: '服务支撑' };

export interface ChainStage {
  id: string;
  name: string;
  layer: ChainLayer;
  desc: string;
  /** 这个环节里通常有哪些角色 */
  roles: string[];
  /** 用于匹配的能力标签（与 taxonomy 一致的 id） */
  caps: string[];
  /** 自然语言关键词（匹配用户自述 / 店铺介绍） */
  keywords: string[];
}

export interface ChainFlow { from: string; to: string; what: string }

export type MemberKind = 'opc' | 'merchant' | 'individual' | 'prospect' | 'service';
export const MEMBER_LABEL: Record<MemberKind, string> = {
  opc: '平台 OPC', merchant: '入驻商家', individual: '个人 · 自由职业', prospect: '未入驻 · 公开信息', service: '企业服务商',
};

export interface ChainMember {
  id: string;
  name: string;
  kind: MemberKind;
  stage: string;
  summary: string;
  /** 能提供 */
  offers: string[];
  /** 正在找 */
  needs: string[];
  /** 街区里的主体（可以在 3D 街区里找到、进店） */
  entityId?: string;
  district?: DistrictKey;
  city?: string;
  isDemo: true;
}

export interface Industry {
  id: 'ecommerce' | 'heritage' | 'education';
  name: string;
  emoji: string;
  summary: string;
  stages: ChainStage[];
  flows: ChainFlow[];
  members: ChainMember[];
}

const M = (m: Omit<ChainMember, 'isDemo'>): ChainMember => ({ ...m, isDemo: true });

export const INDUSTRY_CHAINS: Industry[] = [
  {
    id: 'ecommerce', name: '电商 · 直播带货及出海', emoji: '📦',
    summary: '从货源、内容、直播到跨境出海、仓储履约，一件商品如何卖到国内外消费者手里。',
    stages: [
      { id: 'ec_source', name: '货源与品牌', layer: 'upstream', desc: '源头工厂、产地合作社与自有品牌，负责“有好货”。', roles: ['源头工厂', '产地合作社', '自有品牌方'], caps: ['coffee', 'bakery', 'factory', 'hardware_eng', 'industrial_design'], keywords: ['工厂', '品牌', '产地', '货源', '供应链', '咖啡豆', '代工'] },
      { id: 'ec_content', name: '产品与内容生产', layer: 'upstream', desc: '商品图、短视频、详情页与种草文案，让货“看得见、讲得清”。', roles: ['产品摄影', '短视频', '平面设计', '文案'], caps: ['photo', 'video', 'ai_video', 'graphic', 'copywriting', 'voice'], keywords: ['摄影', '视频', '剪辑', '设计', '文案', '详情页'] },
      { id: 'ec_live', name: '直播与店铺运营', layer: 'midstream', desc: 'MCN 机构、主播达人、直播间搭建与店铺代运营，把内容变成订单。', roles: ['MCN 机构', '主播 / 达人', '场控助理', '店铺代运营', '选品'], caps: ['livestream', 'planning', 'community_ops'], keywords: ['直播', '带货', '主播', '达人', 'mcn', '运营', '选品'] },
      { id: 'ec_global', name: '跨境出海', layer: 'midstream', desc: '海外电商平台店铺、多语种内容、海外达人营销与认证合规。', roles: ['跨境店铺运营', '多语种翻译', '海外达人营销', '认证合规'], caps: ['crossborder', 'copywriting'], keywords: ['跨境', '出海', '海外', '外贸', '翻译', '亚马逊', 'tiktok'] },
      { id: 'ec_fulfil', name: '仓储履约与分销', layer: 'downstream', desc: '国内仓、海外仓、同城配送、团长分销与私域社群。', roles: ['仓储物流', '海外仓', '社区团长', '私域社群'], caps: ['logistics', 'community_ops', 'driving'], keywords: ['物流', '仓储', '配送', '团购', '团长', '私域', '社群'] },
      { id: 'ec_buyer', name: '消费者与采购方', layer: 'downstream', desc: '国内消费者、海外买家、企业团购与礼品采购。', roles: ['国内消费者', '海外买家', '企业团购'], caps: [], keywords: ['团购', '采购', '礼品'] },
      { id: 'ec_service', name: '服务支撑', layer: 'service', desc: '支付收款、财税法务、供应链金融、电商 SaaS 与培训。', roles: ['支付收款', '财税法务', '供应链金融', '电商 SaaS', 'AI 客服'], caps: ['software', 'ai_app', 'consulting', 'finance', 'legal'], keywords: ['财税', '法务', '金融', '支付', 'saas', '系统', '客服'] },
    ],
    flows: [
      { from: 'ec_source', to: 'ec_content', what: '样品' }, { from: 'ec_source', to: 'ec_live', what: '货品 / 佣金' },
      { from: 'ec_content', to: 'ec_live', what: '素材' }, { from: 'ec_content', to: 'ec_global', what: '多语种素材' },
      { from: 'ec_source', to: 'ec_global', what: '出口货品' }, { from: 'ec_live', to: 'ec_fulfil', what: '订单' },
      { from: 'ec_global', to: 'ec_fulfil', what: '海外订单' }, { from: 'ec_fulfil', to: 'ec_buyer', what: '包裹' },
    ],
    members: [
      M({ id: 'cm_wutong', name: '梧桐豆子', kind: 'opc', stage: 'ec_source', entityId: 'e_wutong', district: 'wukang', summary: '自有咖啡品牌，想把挂耳咖啡做成直播爆品，也在看东南亚市场。', offers: ['咖啡豆 / 挂耳供货', '联名定制'], needs: ['直播带货主播', '出海翻译与店铺运营'] }),
      M({ id: 'cm_factory', name: '嘉善文具厂（虚构）', kind: 'prospect', stage: 'ec_source', city: '浙江嘉善', summary: '文具 / 手帐本源头工厂，接受小批量定制（公开信息）。', offers: ['500 本起订的定制本册'], needs: ['自有品牌客户', '出海渠道'] }),
      M({ id: 'cm_guangying', name: '光影小棚', kind: 'opc', stage: 'ec_content', entityId: 'e_guangying', district: 'wukang', summary: '白底图、场景图，自带 20㎡ 小棚，可以按小时租给直播团队。', offers: ['产品摄影', '摄影棚时租'], needs: ['视频后期合作'] }),
      M({ id: 'cm_lulu', name: '鹿鹿 · 平面设计', kind: 'individual', stage: 'ec_content', entityId: 'e_lulu', district: 'wukang', summary: '详情页、包装、直播间贴片视觉。', offers: ['详情页设计', '包装设计'], needs: ['品牌视觉项目'] }),
      M({ id: 'cm_asheng', name: '阿声 · 配音', kind: 'individual', stage: 'ec_content', entityId: 'e_asheng', district: 'sichuan_n', summary: '中英双语旁白，可做出海视频配音。', offers: ['中英配音'], needs: ['宣传片 / 课程项目'] }),
      M({ id: 'cm_xiaobu', name: '小步营销', kind: 'merchant', stage: 'ec_live', entityId: 'e_xiaobu', district: 'wukang', summary: '本地生活整合营销，正在孵化 3 个直播间。', offers: ['直播间代运营', '达人对接'], needs: ['短视频剪辑', '有货的品牌'] }),
      M({ id: 'cm_mcn', name: '星河小象 MCN（虚构）', kind: 'prospect', stage: 'ec_live', city: '上海', summary: '签约 40 位腰部主播，擅长食品与家居类目（公开信息）。', offers: ['主播资源', '直播排期'], needs: ['高佣金好货'] }),
      M({ id: 'cm_global', name: '一帆出海工作室（虚构）', kind: 'opc', stage: 'ec_global', city: '上海', summary: '两个人的跨境小团队，做东南亚与北美的海外店铺代运营。', offers: ['海外店铺代运营', '多语种 listing'], needs: ['国内好货源', '英文配音'] }),
      M({ id: 'cm_meiyu', name: '美玉阿姨 · 邻里团', kind: 'individual', stage: 'ec_fulfil', entityId: 'e_meiyu', district: 'yangjing', summary: '社区团购团长，覆盖周边 6 个小区。', offers: ['社区团购分销'], needs: ['团购文案', '性价比好货'] }),
      M({ id: 'cm_cang', name: '临港小仓（虚构）', kind: 'service', stage: 'ec_fulfil', city: '上海临港', summary: '中小卖家一件代发与海外仓头程（服务商展位演示）。', offers: ['一件代发', '海外仓头程'], needs: ['中小卖家'] }),
      M({ id: 'cm_market', name: '社区菜场摊主联盟', kind: 'merchant', stage: 'ec_buyer', entityId: 'e_market', district: 'yangjing', summary: '想采购礼盒做节日团购。', offers: [], needs: ['节日礼盒货源'] }),
    ],
  },
  {
    id: 'heritage', name: '非遗手艺', emoji: '🧵',
    summary: '从原材料、传承人创作，到文创设计、内容传播、渠道与研学，让老手艺被更多人买单。',
    stages: [
      { id: 'hc_material', name: '原材料与工具', layer: 'upstream', desc: '蚕丝、竹篾、泥料、矿物颜料与传统工具。', roles: ['原料供应', '工具制作'], caps: ['materials'], keywords: ['原料', '材料', '丝', '竹', '泥', '颜料', '工具'] },
      { id: 'hc_craft', name: '传承与创作', layer: 'upstream', desc: '非遗传承人、手艺工作室与学徒，负责“手艺本身”。', roles: ['非遗传承人', '手艺工作室', '学徒'], caps: ['craft', 'bakery'], keywords: ['非遗', '手艺', '手工', '传承', '刺绣', '剪纸', '糕团', '竹编', '海派'] },
      { id: 'hc_design', name: '设计与产品化', layer: 'midstream', desc: '文创设计、包装、IP 授权与小批量生产，把作品变成商品。', roles: ['文创设计', '包装设计', 'IP 授权', '小批量生产'], caps: ['graphic', 'industrial_design'], keywords: ['文创', '设计', '包装', 'ip', '授权'] },
      { id: 'hc_media', name: '内容与传播', layer: 'midstream', desc: '纪录短片、摄影、讲解与文化研究，让故事被看见。', roles: ['纪录短片', '摄影', '讲解 / 研究'], caps: ['video', 'photo', 'copywriting', 'voice'], keywords: ['纪录', '视频', '摄影', '讲解', '故事'] },
      { id: 'hc_channel', name: '渠道与场景', layer: 'downstream', desc: '文创店、书店、市集、直播间、文旅景区与体验工坊。', roles: ['文创店 / 书店', '市集', '直播', '体验工坊', '文旅景区'], caps: ['bookstore', 'venue_provider', 'livestream'], keywords: ['市集', '文创店', '书店', '工坊', '景区', '直播'] },
      { id: 'hc_buyer', name: '消费者与机构客户', layer: 'downstream', desc: '游客、年轻消费者、企业礼品采购、学校研学。', roles: ['游客', '企业礼品', '学校研学'], caps: [], keywords: ['礼品', '研学', '游客'] },
      { id: 'hc_service', name: '服务支撑', layer: 'service', desc: '知识产权保护、非遗项目申报与政策咨询、场地、文旅机构。', roles: ['知识产权', '政策申报', '场地', '文旅机构'], caps: ['consulting', 'legal', 'venue_provider'], keywords: ['知识产权', '申报', '政策', '补贴'] },
    ],
    flows: [
      { from: 'hc_material', to: 'hc_craft', what: '原料' }, { from: 'hc_craft', to: 'hc_design', what: '作品 / 授权' },
      { from: 'hc_craft', to: 'hc_media', what: '故事' }, { from: 'hc_design', to: 'hc_channel', what: '文创商品' },
      { from: 'hc_media', to: 'hc_channel', what: '内容' }, { from: 'hc_craft', to: 'hc_channel', what: '体验课' },
      { from: 'hc_channel', to: 'hc_buyer', what: '商品 / 体验' },
    ],
    members: [
      M({ id: 'cm_silk', name: '湖州丝坊（虚构）', kind: 'prospect', stage: 'hc_material', city: '浙江湖州', summary: '桑蚕丝线与刺绣底布（公开信息）。', offers: ['刺绣丝线', '真丝底布'], needs: ['手艺工作室客户'] }),
      M({ id: 'cm_apo', name: '阿婆糕团店', kind: 'merchant', stage: 'hc_craft', entityId: 'e_apo', district: 'yangjing', summary: '海派糕团手艺三十年，想做糕团体验课与节令礼盒。', offers: ['糕团手作体验', '节令礼盒'], needs: ['礼盒包装设计', '短视频'] }),
      M({ id: 'cm_embroider', name: '顾绣小筑（虚构）', kind: 'opc', stage: 'hc_craft', city: '上海松江', summary: '顾绣手艺人的个人工作室，接定制与教学。', offers: ['刺绣定制', '刺绣体验课'], needs: ['文创产品化', '渠道'] }),
      M({ id: 'cm_tianai', name: '甜爱文创', kind: 'opc', stage: 'hc_design', entityId: 'e_tianai', district: 'sichuan_n', summary: '城市文创与信纸明信片，想联名非遗图案。', offers: ['文创设计与打样'], needs: ['非遗图案授权'] }),
      M({ id: 'cm_lulu2', name: '鹿鹿 · 平面设计', kind: 'individual', stage: 'hc_design', entityId: 'e_lulu', district: 'wukang', summary: '传统纹样再设计。', offers: ['纹样再设计', '包装'], needs: [] }),
      M({ id: 'cm_guangying2', name: '光影小棚', kind: 'opc', stage: 'hc_media', entityId: 'e_guangying', district: 'wukang', summary: '手艺人工作照与作品静物。', offers: ['作品摄影'], needs: [] }),
      M({ id: 'cm_wedding', name: '甜爱写真馆', kind: 'merchant', stage: 'hc_media', entityId: 'e_wedding', district: 'sichuan_n', summary: '中式写真可以用上刺绣与旗袍元素。', offers: ['中式写真'], needs: ['刺绣服饰合作'] }),
      M({ id: 'cm_books', name: '街角书店', kind: 'merchant', stage: 'hc_channel', entityId: 'e_books', district: 'sichuan_n', summary: '二楼可以办 30 人手作体验与讲座。', offers: ['体验课场地', '寄售'], needs: ['非遗讲座与工坊'] }),
      M({ id: 'cm_huike', name: '邻里会客厅', kind: 'opc', stage: 'hc_channel', entityId: 'e_huike', district: 'yangjing', summary: '社区会客厅，可以办手作沙龙。', offers: ['沙龙场地'], needs: ['社区活动内容'] }),
      M({ id: 'cm_school', name: '某区青少年研学中心（虚构）', kind: 'prospect', stage: 'hc_buyer', city: '上海', summary: '寻找非遗研学课程供应方（公开信息）。', offers: [], needs: ['非遗研学课程'] }),
    ],
  },
  {
    id: 'education', name: '教育培训', emoji: '🎓',
    summary: '从课程研发、内容制作、师资交付到招生渠道与学员，一门课如何被做出来、卖出去、教好。',
    stages: [
      { id: 'ed_rd', name: '课程研发', layer: 'upstream', desc: '课程设计、教研、教材与题库。', roles: ['课程设计师', '教研', '教材编写'], caps: ['consulting', 'copywriting'], keywords: ['课程', '教研', '教材', '题库', '咨询'] },
      { id: 'ed_tech', name: '内容与技术', layer: 'upstream', desc: '课程视频拍摄剪辑、配音、在线学习平台与 AI 助教。', roles: ['课程拍摄', '配音', '学习平台', 'AI 助教'], caps: ['video', 'voice', 'software', 'ai_app'], keywords: ['录课', '剪辑', '配音', '平台', 'ai 助教', '小程序'] },
      { id: 'ed_teach', name: '师资与交付', layer: 'midstream', desc: '讲师、教练、助教与上课场地。', roles: ['讲师 / 教练', '助教', '教室 / 场地'], caps: ['teaching', 'fitness_coach', 'venue_provider'], keywords: ['讲师', '老师', '教练', '助教', '教室'] },
      { id: 'ed_growth', name: '招生与运营', layer: 'midstream', desc: '课程顾问、社群运营、内容营销与转介绍。', roles: ['课程顾问', '社群运营', '内容营销'], caps: ['community_ops', 'planning', 'copywriting'], keywords: ['招生', '社群', '运营', '转介绍', '营销'] },
      { id: 'ed_channel', name: '合作渠道', layer: 'downstream', desc: '社区、企业 HR、学校与机构的合作入口。', roles: ['社区', '企业 HR', '学校', '机构'], caps: ['bookstore', 'community_ops'], keywords: ['渠道', '企业培训', '学校', '社区'] },
      { id: 'ed_learner', name: '学员与机构客户', layer: 'downstream', desc: '个人学员、企业内训、社区居民。', roles: ['个人学员', '企业内训', '社区居民'], caps: [], keywords: ['学员', '内训'] },
      { id: 'ed_service', name: '服务支撑', layer: 'service', desc: '办学资质咨询、合规收费、教育 SaaS 与场地。', roles: ['资质咨询', '合规收费', '教育 SaaS', '场地'], caps: ['consulting', 'software', 'legal', 'venue_provider'], keywords: ['资质', '合规', 'saas', '系统'] },
    ],
    flows: [
      { from: 'ed_rd', to: 'ed_tech', what: '课程大纲' }, { from: 'ed_rd', to: 'ed_teach', what: '教案' },
      { from: 'ed_tech', to: 'ed_teach', what: '课件 / 平台' }, { from: 'ed_growth', to: 'ed_teach', what: '学员' },
      { from: 'ed_channel', to: 'ed_growth', what: '线索' }, { from: 'ed_teach', to: 'ed_learner', what: '课程交付' },
      { from: 'ed_growth', to: 'ed_learner', what: '报名' },
    ],
    members: [
      M({ id: 'cm_rd', name: '知行课程工作室（虚构）', kind: 'opc', stage: 'ed_rd', city: '上海', summary: '帮小机构把经验变成标准课程（AI 应用入门、店长培训）。', offers: ['课程设计', '教案与题库'], needs: ['录课团队', '讲师'] }),
      M({ id: 'cm_asheng2', name: '阿声 · 配音', kind: 'individual', stage: 'ed_tech', entityId: 'e_asheng', district: 'sichuan_n', summary: '课程旁白 48 小时交稿。', offers: ['课程旁白'], needs: [] }),
      M({ id: 'cm_dawei', name: '大伟 · AI 伴侣玩偶计划', kind: 'individual', stage: 'ed_tech', entityId: 'e_dawei', district: 'yangjing', summary: '会做 AI 助教原型。', offers: ['AI 助教原型'], needs: ['教育场景合作'] }),
      M({ id: 'cm_fitness', name: '轻燃健身', kind: 'prospect', stage: 'ed_teach', entityId: 'e_fitness', district: 'yangjing', summary: '团课教练可以接企业工间操培训（公开信息）。', offers: ['团课教练'], needs: [] }),
      M({ id: 'cm_huike2', name: '邻里会客厅', kind: 'opc', stage: 'ed_teach', entityId: 'e_huike', district: 'yangjing', summary: '6–20 人小教室，按小时预约。', offers: ['小班教室'], needs: ['课程内容方'] }),
      M({ id: 'cm_xiaoyu', name: '小鱼 · 兼职文案', kind: 'individual', stage: 'ed_growth', entityId: 'e_xiaoyu', district: 'sichuan_n', summary: '招生文案与小红书笔记。', offers: ['招生文案'], needs: ['长期合作'] }),
      M({ id: 'cm_books2', name: '街角书店', kind: 'merchant', stage: 'ed_channel', entityId: 'e_books', district: 'sichuan_n', summary: '读书会会员是很好的成人学习人群。', offers: ['会员渠道', '讲座场地'], needs: ['讲座内容'] }),
      M({ id: 'cm_hr', name: '某科技公司 HR（虚构）', kind: 'prospect', stage: 'ed_learner', city: '上海', summary: '想采购“AI 办公提效”内训（公开信息）。', offers: [], needs: ['AI 办公内训 2 场'] }),
      M({ id: 'cm_saas', name: '小课表 SaaS（虚构）', kind: 'service', stage: 'ed_service', city: '上海', summary: '排课、签到、续费提醒（服务商展位演示）。', offers: ['排课系统'], needs: ['小机构客户'] }),
    ],
  },
];

export const industryById = (id: string) => INDUSTRY_CHAINS.find((x) => x.id === id);
export const stageById = (id: string) => INDUSTRY_CHAINS.flatMap((x) => x.stages).find((s) => s.id === id);
