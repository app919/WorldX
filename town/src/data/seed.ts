/**
 * 演示数据：以下人物与店铺全部为虚构的演示角色（isDemo = true），
 * 不对应任何真实个人或真实商户。UI 中会显示“演示角色”标签。
 * 测试角色 / 演示角色不得计入真实用户的社交与交易统计。
 */
import type { AgentConfig, AvatarLook, BusinessProfile, CommunityEvent, LifeTag, OpcProfile } from '../domain/types';

export interface Resident {
  id: string;
  nickname: string;
  lifeTag: LifeTag;
  look: AvatarLook;
  bio: string;
  /** 演示角色的“性格”：决定演示脚本里是否接受招呼 */
  demoAcceptsHello: boolean;
  online: boolean;
  /** 常驻地点：landmark id 或 lot id，用于摆放与巡游 */
  haunt: string;
  contact: string;
  profile: BusinessProfile;
  opc?: OpcProfile;
  agent?: AgentConfig;
}

const base = (p: Partial<BusinessProfile> & Pick<BusinessProfile, 'userId' | 'displayName' | 'headline'>): BusinessProfile => ({
  industries: [], capabilities: [], needs: [], districts: ['xuhui'], mode: 'both', intents: ['project'],
  openToConnect: true, confirmed: true, source: 'demo_seed', isDemo: true, ...p,
});


export const RESIDENTS: Resident[] = [
  {
    id: 'u_xiaoman', nickname: '小满', lifeTag: 'opc', online: false, demoAcceptsHello: true, haunt: 'anfu_rd_2',
    look: { body: '#A47B5B', skin: '#F6DCC8', hair: '#4A3426', accessory: 'beret' },
    bio: '独立咖啡品牌「梧桐豆子」主理人，正在筹备新品，常在安福路的小店里烘豆子。',
    contact: '演示联系方式：wutong-beans（虚构）',
    profile: base({
      userId: 'u_xiaoman', displayName: '小满 · 梧桐豆子', headline: '独立咖啡品牌，想给新品拍一支有温度的宣传片',
      industries: ['food', 'brand_retail'],
      capabilities: [{ tag: 'coffee', label: '咖啡与烘焙' }],
      needs: [{ tag: 'video', label: '短视频制作' }, { tag: 'graphic', label: '平面设计' }],
      districts: ['xuhui'], intents: ['project', 'long_term'], budgetRange: { min: 3000, max: 8000 }, stage: 'has_product',
    }),
    opc: {
      id: 'opc_wutong', ownerId: 'u_xiaoman', name: '梧桐豆子', tagline: '小批量手冲豆与梧桐树下的咖啡时光',
      category: '商品零售', entityStatus: 'opc_entity', stage: 'has_product', facade: 'cafe', lotId: 'anfu_rd_2',
      products: [
        { id: 'p_beans', opcId: 'opc_wutong', name: '梧桐拼配咖啡豆', description: '中深烘拼配豆，适合手冲与意式', priceFrom: 88, unit: '250g', priceConfirmed: true },
        { id: 'p_coop', opcId: 'opc_wutong', name: '联名饮品合作', description: '为品牌活动定制联名饮品', priceConfirmed: false },
      ],
      cases: ['安福路街区周末市集咖啡摊（演示）'],
      faqs: [
        { q: '可以企业团购吗', a: '可以的，20 份起可以团购，具体价格需要主理人确认。' },
        { q: '营业时间', a: '演示店铺：每天 10:00–19:00。' },
      ],
      openNeeds: ['新品宣传片', '包装设计'], createdAt: 0, isDemo: true,
    },
  },
  {
    id: 'u_aqiang', nickname: '阿强', lifeTag: 'freelancer', online: true, demoAcceptsHello: true, haunt: 'ferguson_lane',
    look: { body: '#5E7D96', skin: '#EFCFB4', hair: '#2E2420', accessory: 'cap' },
    bio: '自由摄影师，有一间小摄影棚，偶尔需要视频后期伙伴。',
    contact: '演示联系方式：aqiang-photo（虚构）',
    profile: base({
      userId: 'u_aqiang', displayName: '阿强 · 光影小棚', headline: '产品摄影 / 门店形象照，自带小摄影棚',
      industries: ['media'], capabilities: [{ tag: 'photo', label: '摄影' }, { tag: 'venue_provider', label: '场地提供' }],
      needs: [{ tag: 'video', label: '短视频制作' }], districts: ['xuhui', 'changning'], intents: ['project', 'part_time'],
      priceRange: { min: 800, max: 3000 },
    }),
    opc: {
      id: 'opc_guangying', ownerId: 'u_aqiang', name: '光影小棚', tagline: '把小品牌的产品拍得像大片',
      category: '内容与传媒', entityStatus: 'personal_page', stage: 'has_product', facade: 'studio', lotId: 'anfu_rd_6',
      products: [
        { id: 'p_photo', opcId: 'opc_guangying', name: '产品摄影', description: '白底图 + 场景图，适合电商与小红书', priceFrom: 800, unit: '组', priceConfirmed: true },
        { id: 'p_studio', opcId: 'opc_guangying', name: '摄影棚时租', description: '20 平米小棚，含基础灯光', priceFrom: 150, unit: '小时', priceConfirmed: true },
      ],
      cases: ['为两家独立咖啡品牌拍摄产品图（演示）'], faqs: [{ q: '可以上门拍摄吗', a: '可以，徐汇、长宁上门拍摄需提前预约。' }],
      openNeeds: ['视频后期合作'], createdAt: 0, isDemo: true,
    },
  },
  {
    id: 'u_lulu', nickname: '鹿鹿', lifeTag: 'freelancer', online: true, demoAcceptsHello: true, haunt: 'anfu_rd_4',
    look: { body: '#F0C4C6', skin: '#F6DCC8', hair: '#7A5539', accessory: 'glasses' },
    bio: '平面设计师，做过很多咖啡和甜品品牌的视觉。',
    contact: '演示联系方式：lulu-design（虚构）',
    profile: base({
      userId: 'u_lulu', displayName: '鹿鹿 · 平面设计', headline: '品牌视觉 / 包装 / 插画，喜欢小而美的品牌',
      industries: ['design'], capabilities: [{ tag: 'graphic', label: '平面设计' }],
      needs: [{ tag: 'client', label: '企业客户' }], districts: ['xuhui', 'jingan'], intents: ['project', 'team_up'],
      priceRange: { min: 2000, max: 10000 },
    }),
  },
  {
    id: 'u_zhou', nickname: '周老师', lifeTag: 'opc', online: false, demoAcceptsHello: false, haunt: 'urumqi_rd_2',
    look: { body: '#86A57C', skin: '#EFCFB4', hair: '#3B3B3B', accessory: 'none' },
    bio: '一人营销策划公司，常有视频制作外包需求。',
    contact: '演示联系方式：zhou-mkt（虚构）',
    profile: base({
      userId: 'u_zhou', displayName: '周老师 · 小步营销', headline: '为本地生活品牌做整合营销，视频制作常外包',
      industries: ['marketing'], capabilities: [{ tag: 'planning', label: '创意策划' }, { tag: 'copywriting', label: '文案策划' }],
      needs: [{ tag: 'video', label: '短视频制作' }, { tag: 'ai_video', label: 'AI 宣传片' }], districts: ['jingan'],
      intents: ['long_term', 'project'], budgetRange: { min: 5000, max: 20000 }, stage: 'has_orders',
    }),
    opc: {
      id: 'opc_xiaobu', ownerId: 'u_zhou', name: '小步营销', tagline: '一个人也能做好整合营销',
      category: '营销策划', entityStatus: 'verified_company', stage: 'has_orders', facade: 'shikumen', lotId: 'urumqi_rd_2',
      products: [{ id: 'p_mkt', opcId: 'opc_xiaobu', name: '本地品牌整合营销', description: '小红书 + 短视频 + 线下活动整合方案', priceConfirmed: false }],
      cases: [], faqs: [], openNeeds: ['视频制作外包'], createdAt: 0, isDemo: true,
    },
  },
  {
    id: 'u_meiyu', nickname: '美玉阿姨', lifeTag: 'retiree', online: true, demoAcceptsHello: true, haunt: 'hunan_rd_1',
    look: { body: '#C5D6BE', skin: '#F2D4BE', hair: '#D8D3CC', accessory: 'scarf' },
    bio: '退休后在社区做团购团长，认识很多邻居。',
    contact: '演示联系方式：meiyu-community（虚构）',
    profile: base({
      userId: 'u_meiyu', displayName: '美玉阿姨 · 邻里团', headline: '社区团购团长，熟悉周边几个小区',
      industries: ['marketing', 'service'], capabilities: [{ tag: 'community_ops', label: '社群运营' }],
      needs: [{ tag: 'copywriting', label: '文案策划' }], districts: ['xuhui'], intents: ['part_time', 'long_term'],
    }),
  },
  {
    id: 'u_space', nickname: '小林', lifeTag: 'opc', online: false, demoAcceptsHello: true, haunt: 'urumqi_rd_3',
    look: { body: '#9DB6CA', skin: '#EFCFB4', hair: '#4A3426', accessory: 'headphones' },
    bio: '经营一间共享会议室，欢迎沙龙和见面会。',
    contact: '演示联系方式：lin-space（虚构）',
    profile: base({
      userId: 'u_space', displayName: '小林 · 梧桐会客厅', headline: '共享会议室 / 沙龙场地，按小时预约',
      industries: ['space'], capabilities: [{ tag: 'venue_provider', label: '场地提供' }],
      needs: [{ tag: 'client', label: '企业客户' }], districts: ['xuhui'], intents: ['long_term'],
    }),
    opc: {
      id: 'opc_huike', ownerId: 'u_space', name: '梧桐会客厅', tagline: '适合 6–20 人的创业会客厅',
      category: '生活服务', entityStatus: 'opc_entity', stage: 'scaling', facade: 'shikumen', lotId: 'urumqi_rd_3',
      products: [{ id: 'p_room', opcId: 'opc_huike', name: '会议室时租', description: '可容纳 12 人，含投影与白板', priceFrom: 120, unit: '小时', priceConfirmed: true }],
      cases: ['每周三晚 OPC 交流会场地（演示）'], faqs: [{ q: '可以办沙龙吗', a: '可以，最多 20 人，需要提前两天预约。' }],
      openNeeds: ['活动主办方'], createdAt: 0, isDemo: true,
    },
  },
  {
    id: 'u_dawei', nickname: '大伟', lifeTag: 'worker', online: true, demoAcceptsHello: true, haunt: 'wukang_mansion',
    look: { body: '#6F6A63', skin: '#EFCFB4', hair: '#2E2420', accessory: 'none' },
    bio: '朝九晚六的硬件工程师，下班后想做一个 AI 伴侣玩偶。',
    contact: '演示联系方式：dawei-hw（虚构）',
    profile: base({
      userId: 'u_dawei', displayName: '大伟 · 下班后的玩偶计划', headline: '想做 AI 伴侣玩偶，正在找队友',
      industries: ['hardware', 'tech'], capabilities: [{ tag: 'hardware_eng', label: '硬件工程' }],
      needs: [{ tag: 'industrial_design', label: '工业设计' }, { tag: 'ai_app', label: 'AI 应用落地' }, { tag: 'graphic', label: '平面设计' }, { tag: 'channel', label: '销售渠道' }],
      districts: ['xuhui', 'pudong'], intents: ['team_up'], stage: 'seeking_partner',
    }),
  },
  {
    id: 'u_asheng', nickname: '阿声', lifeTag: 'freelancer', online: true, demoAcceptsHello: true, haunt: 'hunan_rd_3',
    look: { body: '#C2D3E0', skin: '#F6DCC8', hair: '#3B3B3B', accessory: 'headphones' },
    bio: '自由配音演员，家里有个小录音角，接宣传片和课程旁白。',
    contact: '演示联系方式：asheng-voice（虚构）',
    profile: base({
      userId: 'u_asheng', displayName: '阿声 · 配音', headline: '宣传片 / 课程旁白配音，48 小时交稿',
      industries: ['media'], capabilities: [{ tag: 'voice', label: '配音' }],
      needs: [{ tag: 'client', label: '企业客户' }], districts: ['jingan'], mode: 'remote', intents: ['part_time', 'project'],
      priceRange: { min: 300, max: 2000 },
    }),
  },
  {
    id: 'u_xiaoyu', nickname: '小鱼', lifeTag: 'student', online: true, demoAcceptsHello: true, haunt: 'bajin_residence',
    look: { body: '#E8C77A', skin: '#F6DCC8', hair: '#5A3E2B', accessory: 'headphones' },
    bio: '大三学生，会写公众号，也想找点兼职文案。',
    contact: '演示联系方式：xiaoyu-writes（虚构）',
    profile: base({
      userId: 'u_xiaoyu', displayName: '小鱼 · 兼职文案', headline: '会写小红书和公众号，周末有空',
      industries: ['marketing'], capabilities: [{ tag: 'copywriting', label: '文案策划' }],
      needs: [{ tag: 'client', label: '企业客户' }], districts: ['xuhui'], mode: 'remote', intents: ['part_time'],
    }),
  },
];

/** 玩家默认故事：AI 视频制作人 */
export const STORY_INTRO_TEXT = '我会做短视频，也会用 AI 做宣传片。我现在没有固定工作，希望接一些企业宣传片的业务。我在徐汇、静安，远程线下均可，报价 3000-12000 元。';

export const DEMO_EVENTS: CommunityEvent[] = [
  { id: 'ev_opc', title: '上海 OPC 创业者交流会', space: 'startup_lounge', online: false, weekday: '周三', time: '19:30', capacity: 20, attendees: ['u_space', 'u_zhou'], fee: 0, sponsorAllowed: false, needsApproval: false, hostId: 'u_space', aiHost: true, isDemo: true },
  { id: 'ev_video', title: 'AI 视频创作者见面会', space: 'coffee_lounge', online: true, weekday: '周五', time: '20:00', capacity: 50, attendees: ['u_aqiang'], fee: 0, sponsorAllowed: true, sponsor: { brand: '演示品牌·奶油咖啡', kind: 'event', disclosure: '赞助内容' }, needsApproval: false, hostId: 'u_aqiang', aiHost: true, isDemo: true },
  { id: 'ev_brand', title: '独立品牌产品体验日', space: 'street_market', online: false, weekday: '周六', time: '14:00', capacity: 80, attendees: ['u_xiaoman', 'u_lulu'], fee: 0, sponsorAllowed: true, needsApproval: false, hostId: 'u_xiaoman', aiHost: false, isDemo: true },
  { id: 'ev_free', title: '自由职业者资源互助会', space: 'coffee_lounge', online: false, weekday: '周日', time: '15:00', capacity: 16, attendees: ['u_xiaoyu', 'u_lulu'], fee: 39, sponsorAllowed: false, needsApproval: true, hostId: 'u_lulu', aiHost: true, isDemo: true },
];
