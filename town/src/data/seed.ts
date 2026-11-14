/**
 * 演示数据 V2（全部虚构，isDemo = true）。
 *
 * 三类数据：
 * - Counterparty：经营主体（已入驻 OPC / 已入驻商家 / 未入驻公开信息 / 个人），商业撮合的对象；
 * - Resident：街上走动的人（主体的主理人、自由职业者），可以打招呼；
 * - OpcProfile：可以走进去逛、由 AI 分身接待的店铺。
 * 未入驻主体（prospect）只展示“公开商业信息”，没有主理人账号，不能直接打招呼。
 * 名称、联系方式全部虚构，不对应任何真实个人或商户。
 */
import type { Counterparty, DistrictKey } from '../domain/commerce';
import type { AvatarLook, LifeTag, OpcProfile } from '../domain/types';

export interface Resident {
  id: string;
  nickname: string;
  lifeTag: LifeTag;
  look: AvatarLook;
  bio: string;
  online: boolean;
  demoAcceptsHello: boolean;
  district: DistrictKey;
  entityId: string;
  contact: string;
}

const C = (c: Omit<Counterparty, 'isDemo' | 'openToConnect' | 'mode' | 'intents'> & Partial<Pick<Counterparty, 'mode' | 'intents'>>): Counterparty => ({
  mode: 'both', intents: ['project'], openToConnect: true, isDemo: true, ...c,
});

export const COUNTERPARTIES: Counterparty[] = [
  // —— 武康大楼 ——
  C({ id: 'e_wutong', name: '梧桐豆子', kind: 'opc', summary: '独立咖啡品牌，小批量烘焙，正在筹备秋季新品', industries: ['food', 'brand_retail'],
    place: { district: 'wukang', street: '武康路', lotId: 'wk_w2' }, districts: ['xuhui'], capabilities: ['coffee'],
    publishedNeeds: [{ tag: 'video', detail: '秋季新品上市短视频 2 支（15–30 秒）' }, { tag: 'graphic', detail: '新品包装与杯套设计' }],
    budgetRange: { min: 3000, max: 8000 }, ownerId: 'u_xiaoman', intents: ['project', 'long_term'], badge: '品' }),
  C({ id: 'e_guangying', name: '光影小棚', kind: 'opc', summary: '产品摄影工作室，自带 20㎡ 小摄影棚', industries: ['media'],
    place: { district: 'wukang', street: '武康路', lotId: 'wk_e2' }, districts: ['xuhui', 'changning'], capabilities: ['photo', 'venue_provider'],
    publishedNeeds: [{ tag: 'video', detail: '摄影项目的视频后期合作（按项目结算）' }], priceRange: { min: 800, max: 3000 }, budgetRange: { min: 1000, max: 4000 },
    ownerId: 'u_aqiang', intents: ['project', 'part_time'] }),
  C({ id: 'e_chunri', name: '春日花房', kind: 'prospect', summary: '街角花店，经营鲜花与节日花礼（公开信息，演示）', industries: ['brand_retail', 'wedding'],
    place: { district: 'wukang', street: '淮海中路', lotId: 'wk_s1' }, districts: ['xuhui'], capabilities: ['florist'], publishedNeeds: [] }),
  C({ id: 'e_xiaobu', name: '小步营销', kind: 'merchant', summary: '本地生活品牌整合营销，视频制作常外包', industries: ['marketing'],
    place: { district: 'wukang', street: '淮海中路', lotId: 'wk_n1' }, districts: ['jingan', 'xuhui'], capabilities: ['planning', 'copywriting', 'community_ops'],
    publishedNeeds: [{ tag: 'ai_video', detail: '客户品牌 AI 宣传片外包（每月 1–2 个）' }, { tag: 'video', detail: '探店短视频剪辑' }],
    budgetRange: { min: 5000, max: 20000 }, ownerId: 'u_zhou', intents: ['long_term', 'project'] }),
  C({ id: 'e_lulu', name: '鹿鹿 · 平面设计', kind: 'individual', summary: '自由平面设计师，擅长咖啡与甜品品牌视觉', industries: ['design'],
    place: { district: 'wukang', street: '武康路' }, districts: ['xuhui', 'jingan'], capabilities: ['graphic'], publishedNeeds: [{ tag: 'client', detail: '品牌视觉项目' }],
    priceRange: { min: 2000, max: 10000 }, ownerId: 'u_lulu', intents: ['project', 'team_up'] }),

  // —— 洋泾社区 ——
  C({ id: 'e_market', name: '社区菜场摊主联盟（示意）', kind: 'merchant', summary: '十几位摊主联合运营线上订菜，想让更多年轻住户知道', industries: ['community', 'food'],
    place: { district: 'yangjing', street: '张杨路', lotId: 'yj_market' }, districts: ['pudong'], capabilities: ['grocery'],
    publishedNeeds: [{ tag: 'video', detail: '摊位与线上订菜的宣传短视频' }, { tag: 'software', detail: '订菜小程序维护' }],
    budgetRange: { min: 2000, max: 5000 }, ownerId: 'u_laozhang', intents: ['long_term'] }),
  C({ id: 'e_meiyu', name: '美玉阿姨 · 邻里团', kind: 'individual', summary: '社区团购团长，熟悉周边几个小区', industries: ['community', 'marketing'],
    place: { district: 'yangjing', street: '张杨路' }, districts: ['pudong'], capabilities: ['community_ops'], publishedNeeds: [{ tag: 'copywriting', detail: '团购文案' }],
    ownerId: 'u_meiyu', intents: ['part_time', 'long_term'] }),
  C({ id: 'e_fitness', name: '轻燃健身（虚构）', kind: 'prospect', summary: '社区健身房，团课与私教（公开信息，演示）', industries: ['fitness'],
    place: { district: 'yangjing', street: '羽山路', lotId: 'yj_c1' }, districts: ['pudong'], capabilities: ['fitness_coach'], publishedNeeds: [] }),
  C({ id: 'e_huike', name: '邻里会客厅', kind: 'opc', summary: '共享会议室 / 沙龙场地，按小时预约', industries: ['space'],
    place: { district: 'yangjing', street: '张杨路', lotId: 'yj_n1' }, districts: ['pudong'], capabilities: ['venue_provider'],
    publishedNeeds: [{ tag: 'client', detail: '活动主办方、培训机构' }], priceRange: { min: 120, max: 600 }, ownerId: 'u_lin', intents: ['long_term'] }),
  C({ id: 'e_apo', name: '阿婆糕团店（虚构）', kind: 'merchant', summary: '手工糕团、节令点心，三十年社区老店', industries: ['food', 'community'],
    place: { district: 'yangjing', street: '张杨路', lotId: 'yj_s1' }, districts: ['pudong'], capabilities: ['bakery'], publishedNeeds: [],
    ownerId: 'u_apo', intents: ['long_term'], badge: '品' }),
  C({ id: 'e_dawei', name: '大伟 · AI 伴侣玩偶计划', kind: 'individual', summary: '下班后做 AI 伴侣玩偶，正在找队友', industries: ['hardware', 'tech'],
    place: { district: 'yangjing', street: '羽山路' }, districts: ['pudong'], capabilities: ['hardware_eng'],
    publishedNeeds: [{ tag: 'industrial_design' }, { tag: 'ai_app' }, { tag: 'graphic' }, { tag: 'ai_video', detail: '众筹宣传片' }],
    ownerId: 'u_dawei', intents: ['team_up'] }),

  // —— 甜爱路及四川北路 ——
  C({ id: 'e_dimsum', name: '北路点心铺（虚构）', kind: 'prospect', summary: '生煎、小笼与节令点心（公开信息，演示）', industries: ['food'],
    place: { district: 'sichuan_n', street: '四川北路', lotId: 'sc_w1' }, districts: ['hongkou'], capabilities: ['bakery'], publishedNeeds: [] }),
  C({ id: 'e_tianai', name: '甜爱文创', kind: 'opc', summary: '情书信纸、明信片与城市文创，七夕是全年最忙的时候', industries: ['brand_retail', 'culture'],
    place: { district: 'sichuan_n', street: '四川北路', lotId: 'sc_e2' }, districts: ['hongkou'], capabilities: ['graphic'],
    publishedNeeds: [{ tag: 'ai_video', detail: '七夕主题 AI 宣传短片 1 支' }, { tag: 'copywriting', detail: '产品故事文案' }],
    budgetRange: { min: 2000, max: 6000 }, ownerId: 'u_xiaotian', intents: ['project'], badge: '品' }),
  C({ id: 'e_wedding', name: '甜爱写真馆（虚构）', kind: 'merchant', summary: '情侣写真与婚纱样片，常在甜爱路取景', industries: ['wedding', 'media'],
    place: { district: 'sichuan_n', street: '甜爱路', lotId: 'ta_n1' }, districts: ['hongkou'], capabilities: ['wedding_photo'],
    publishedNeeds: [{ tag: 'ai_video', detail: '婚纱样片 AI 宣传片，用于小红书投放' }], budgetRange: { min: 4000, max: 12000 },
    ownerId: 'u_ajie', intents: ['project', 'long_term'] }),
  C({ id: 'e_asheng', name: '阿声 · 配音', kind: 'individual', summary: '宣传片 / 课程旁白配音，48 小时交稿', industries: ['media'],
    place: { district: 'sichuan_n', street: '四川北路' }, districts: ['hongkou', 'jingan'], capabilities: ['voice'],
    publishedNeeds: [{ tag: 'client' }], priceRange: { min: 300, max: 2000 }, ownerId: 'u_asheng', mode: 'remote', intents: ['part_time', 'project'] }),
  C({ id: 'e_xiaoyu', name: '小鱼 · 兼职文案', kind: 'individual', summary: '会写小红书和公众号，周末有空', industries: ['marketing'],
    place: { district: 'sichuan_n', street: '甜爱路' }, districts: ['hongkou'], capabilities: ['copywriting'], publishedNeeds: [{ tag: 'client' }],
    priceRange: { min: 200, max: 1500 }, ownerId: 'u_xiaoyu', mode: 'remote', intents: ['part_time'] }),
  C({ id: 'e_books', name: '街角书店（虚构）', kind: 'merchant', summary: '独立书店，二楼可办 30 人读书会', industries: ['culture', 'space'],
    place: { district: 'sichuan_n', street: '四川北路', lotId: 'sc_w3' }, districts: ['hongkou'], capabilities: ['bookstore', 'venue_provider'],
    publishedNeeds: [{ tag: 'client', detail: '读书会、作者见面会主办方' }], priceRange: { min: 300, max: 1200 }, ownerId: 'u_shuyi', intents: ['long_term'] }),
];

/** 演示居民的外观：着装由身份决定（见 domain/identity.ts 的 dress），这里只定发色、配饰、肤色和性别（均为虚构角色设定） */
// —— 投资机构（【投】黑色屋顶）：每个上海街区一家办公室（虚构） ——
COUNTERPARTIES.push(
  C({ id: 'e_inv_wutong', name: '梧桐早期基金（虚构）', kind: 'merchant', badge: '投', summary: '天使轮基金，偏好消费品牌与内容电商；每周四下午开放“一人公司路演”', industries: ['tech'],
    place: { district: 'wukang', street: '淮海中路', lotId: 'wukang_lot30' }, districts: ['xuhui'], capabilities: [], publishedNeeds: [{ tag: 'client', detail: '寻找已有客户验证的一人公司项目' }], budgetRange: { min: 500000, max: 3000000 }, intents: ['long_term'] }),
  C({ id: 'e_inv_pujiang', name: '浦江天使会（虚构）', kind: 'merchant', badge: '投', summary: '社区天使投资人联盟，关注 AI 应用、具身智能与社区服务', industries: ['tech'],
    place: { district: 'yangjing', street: '张杨路', lotId: 'yangjing_lot50' }, districts: ['pudong'], capabilities: [], publishedNeeds: [{ tag: 'client', detail: 'AI / 硬件方向早期项目' }], budgetRange: { min: 300000, max: 2000000 }, intents: ['long_term'] }),
  C({ id: 'e_inv_haipai', name: '海派文化创投（虚构）', kind: 'merchant', badge: '投', summary: '关注非遗、文创与城市文化消费，Pre-A / A 轮', industries: ['culture'],
    place: { district: 'sichuan_n', street: '四川北路', lotId: 'sichuan_n_lot30' }, districts: ['hongkou'], capabilities: [], publishedNeeds: [{ tag: 'client', detail: '文创、非遗、文旅项目' }], budgetRange: { min: 1000000, max: 5000000 }, intents: ['long_term'] }),
);

const look = (body: string, hair: string, accessory: AvatarLook['accessory'], skin = '#F6DCC8', gender: 'f' | 'm' = 'f'): AvatarLook => ({ body, hair, accessory, skin, gender });

export const RESIDENTS: Resident[] = [
  { id: 'u_xiaoman', nickname: '小满', lifeTag: 'opc', look: look('#A47B5B', '#4A3426', 'beret', '#F6DCC8', 'f'), bio: '梧桐豆子主理人，常在店里烘豆子。', online: false, demoAcceptsHello: true, district: 'wukang', entityId: 'e_wutong', contact: '演示：wutong-beans（虚构）' },
  { id: 'u_aqiang', nickname: '阿强', lifeTag: 'freelancer', look: look('#5E7D96', '#2E2420', 'cap', '#EFCFB4', 'm'), bio: '摄影师，有间小摄影棚。', online: true, demoAcceptsHello: true, district: 'wukang', entityId: 'e_guangying', contact: '演示：aqiang-photo（虚构）' },
  { id: 'u_zhou', nickname: '周老师', lifeTag: 'opc', look: look('#86A57C', '#3B3B3B', 'glasses', '#EFCFB4', 'm'), bio: '一人营销公司，视频常外包。', online: false, demoAcceptsHello: true, district: 'wukang', entityId: 'e_xiaobu', contact: '演示：zhou-mkt（虚构）' },
  { id: 'u_lulu', nickname: '鹿鹿', lifeTag: 'freelancer', look: look('#F0C4C6', '#7A5539', 'glasses', '#F6DCC8', 'f'), bio: '平面设计师，喜欢小而美的品牌。', online: true, demoAcceptsHello: true, district: 'wukang', entityId: 'e_lulu', contact: '演示：lulu-design（虚构）' },
  { id: 'u_laozhang', nickname: '老张', lifeTag: 'opc', look: look('#9DB6CA', '#3B3B3B', 'cap', '#EFCFB4', 'm'), bio: '菜场摊主联盟的召集人。', online: true, demoAcceptsHello: true, district: 'yangjing', entityId: 'e_market', contact: '演示：yj-market（虚构）' },
  { id: 'u_meiyu', nickname: '美玉阿姨', lifeTag: 'retiree', look: look('#C5D6BE', '#D8D3CC', 'scarf', '#F2D4BE', 'f'), bio: '社区团购团长，认识很多邻居。', online: true, demoAcceptsHello: true, district: 'yangjing', entityId: 'e_meiyu', contact: '演示：meiyu-tuan（虚构）' },
  { id: 'u_lin', nickname: '小林', lifeTag: 'opc', look: look('#C2D3E0', '#4A3426', 'headphones', '#EFCFB4', 'm'), bio: '经营一间共享会客厅。', online: false, demoAcceptsHello: true, district: 'yangjing', entityId: 'e_huike', contact: '演示：lin-space（虚构）' },
  { id: 'u_apo', nickname: '阿婆', lifeTag: 'retiree', look: look('#E8C77A', '#E6E1DA', 'scarf', '#F2D4BE', 'f'), bio: '做了三十年糕团。', online: true, demoAcceptsHello: true, district: 'yangjing', entityId: 'e_apo', contact: '演示：apo-cake（虚构）' },
  { id: 'u_dawei', nickname: '大伟', lifeTag: 'worker', look: look('#6F8BA4', '#2E2420', 'none', '#EFCFB4', 'm'), bio: '朝九晚六的硬件工程师。', online: true, demoAcceptsHello: true, district: 'yangjing', entityId: 'e_dawei', contact: '演示：dawei-hw（虚构）' },
  { id: 'u_xiaotian', nickname: '小甜', lifeTag: 'opc', look: look('#F0C4C6', '#5A3E2B', 'beret', '#F6DCC8', 'f'), bio: '甜爱文创主理人。', online: false, demoAcceptsHello: true, district: 'sichuan_n', entityId: 'e_tianai', contact: '演示：tianai-shop（虚构）' },
  { id: 'u_ajie', nickname: '阿杰', lifeTag: 'opc', look: look('#F7F3EA', '#2E2420', 'none', '#EFCFB4', 'm'), bio: '写真馆摄影师。', online: true, demoAcceptsHello: true, district: 'sichuan_n', entityId: 'e_wedding', contact: '演示：ajie-photo（虚构）' },
  { id: 'u_asheng', nickname: '阿声', lifeTag: 'freelancer', look: look('#C2D3E0', '#3B3B3B', 'headphones', '#F6DCC8', 'm'), bio: '自由配音演员。', online: true, demoAcceptsHello: true, district: 'sichuan_n', entityId: 'e_asheng', contact: '演示：asheng-voice（虚构）' },
  { id: 'u_xiaoyu', nickname: '小鱼', lifeTag: 'student', look: look('#E8C77A', '#5A3E2B', 'headphones', '#F6DCC8', 'f'), bio: '大三学生，兼职写文案。', online: true, demoAcceptsHello: true, district: 'sichuan_n', entityId: 'e_xiaoyu', contact: '演示：xiaoyu-writes（虚构）' },
  { id: 'u_shuyi', nickname: '书逸', lifeTag: 'opc', look: look('#86A57C', '#4A3426', 'glasses', '#EFCFB4', 'm'), bio: '街角书店店主。', online: false, demoAcceptsHello: true, district: 'sichuan_n', entityId: 'e_books', contact: '演示：corner-books（虚构）' },
];

const P = (id: string, opcId: string, name: string, description: string, priceFrom?: number, unit?: string) =>
  ({ id, opcId, name, description, priceFrom, unit, priceConfirmed: priceFrom !== undefined });

/** 可以走进去、由 AI 分身接待的店铺（已入驻主体） */
export const SHOPS: OpcProfile[] = [
  { id: 'opc_wutong', ownerId: 'u_xiaoman', name: '梧桐豆子', tagline: '小批量手冲豆与梧桐树下的咖啡时光', category: '商品零售', entityStatus: 'opc_entity', stage: 'has_product', facade: 'cafe', lotId: 'wk_w2',
    products: [P('p_beans', 'opc_wutong', '梧桐拼配咖啡豆', '中深烘拼配豆，适合手冲与意式', 88, '250g'), P('p_coop', 'opc_wutong', '联名饮品合作', '为品牌活动定制联名饮品')],
    cases: ['周末街区市集咖啡摊（演示）'], faqs: [{ q: '可以企业团购吗', a: '20 份起可以团购，价格需要主理人确认。' }, { q: '营业时间', a: '演示店铺：每天 10:00–19:00。' }],
    openNeeds: ['新品宣传短视频', '包装设计'], createdAt: 0, isDemo: true },
  { id: 'opc_guangying', ownerId: 'u_aqiang', name: '光影小棚', tagline: '把小品牌的产品拍得像大片', category: '内容与传媒', entityStatus: 'personal_page', stage: 'has_product', facade: 'studio', lotId: 'wk_e2',
    products: [P('p_photo', 'opc_guangying', '产品摄影', '白底图 + 场景图', 800, '组'), P('p_studio', 'opc_guangying', '摄影棚时租', '20㎡ 小棚，含基础灯光', 150, '小时')],
    cases: ['两家独立咖啡品牌产品图（演示）'], faqs: [{ q: '可以上门拍摄吗', a: '徐汇、长宁可以上门，需要提前预约。' }], openNeeds: ['视频后期合作'], createdAt: 0, isDemo: true },
  { id: 'opc_xiaobu', ownerId: 'u_zhou', name: '小步营销', tagline: '一个人也能做好整合营销', category: '营销策划', entityStatus: 'verified_company', stage: 'has_orders', facade: 'studio', lotId: 'wk_n1',
    products: [P('p_mkt', 'opc_xiaobu', '本地品牌整合营销', '小红书 + 短视频 + 线下活动')], cases: [], faqs: [], openNeeds: ['AI 宣传片外包'], createdAt: 0, isDemo: true },
  { id: 'opc_market', ownerId: 'u_laozhang', name: '社区菜场摊主联盟', tagline: '早上七点的新鲜，线上也能订', category: '生活服务', entityStatus: 'opc_entity', stage: 'scaling', facade: 'kiosk', lotId: 'yj_market',
    products: [P('p_veg', 'opc_market', '线上订菜', '小区内两小时送达', 0, '起送免运费')], cases: [], faqs: [{ q: '几点开门', a: '演示：每天 6:30–18:30。' }], openNeeds: ['宣传短视频', '小程序维护'], createdAt: 0, isDemo: true },
  { id: 'opc_huike', ownerId: 'u_lin', name: '邻里会客厅', tagline: '适合 6–20 人的社区会客厅', category: '生活服务', entityStatus: 'opc_entity', stage: 'scaling', facade: 'shikumen', lotId: 'yj_n1',
    products: [P('p_room', 'opc_huike', '会议室时租', '12 人，含投影与白板', 120, '小时')], cases: ['每周三 OPC 交流会场地（演示）'], faqs: [{ q: '可以办沙龙吗', a: '最多 20 人，需要提前两天预约。' }], openNeeds: ['活动主办方'], createdAt: 0, isDemo: true },
  { id: 'opc_apo', ownerId: 'u_apo', name: '阿婆糕团店', tagline: '三十年的手工糕团', category: '商品零售', entityStatus: 'opc_entity', stage: 'has_product', facade: 'kiosk', lotId: 'yj_s1',
    products: [P('p_cake', 'opc_apo', '节令糕团礼盒', '青团、条头糕、双酿团', 48, '盒')], cases: [], faqs: [], openNeeds: [], createdAt: 0, isDemo: true },
  { id: 'opc_tianai', ownerId: 'u_xiaotian', name: '甜爱文创', tagline: '把想说的话写成一张明信片', category: '商品零售', entityStatus: 'personal_page', stage: 'has_product', facade: 'kiosk', lotId: 'sc_e2',
    products: [P('p_card', 'opc_tianai', '甜爱路明信片套装', '8 张手绘明信片', 39, '套'), P('p_custom', 'opc_tianai', '定制情书信纸', '企业 / 婚礼定制')], cases: [], faqs: [{ q: '可以寄出吗', a: '可以代寄，邮费另计，以主理人确认为准。' }], openNeeds: ['七夕宣传短片', '产品文案'], createdAt: 0, isDemo: true },
  { id: 'opc_wedding', ownerId: 'u_ajie', name: '甜爱写真馆', tagline: '在梧桐树下拍一组情侣写真', category: '内容与传媒', entityStatus: 'verified_company', stage: 'has_orders', facade: 'studio', lotId: 'ta_n1',
    products: [P('p_couple', 'opc_wedding', '情侣街拍写真', '甜爱路取景 2 小时', 1299, '组')], cases: ['甜爱路街拍样片（演示）'], faqs: [], openNeeds: ['AI 宣传片'], createdAt: 0, isDemo: true },
  { id: 'opc_books', ownerId: 'u_shuyi', name: '街角书店', tagline: '一间可以办读书会的小书店', category: '其他服务', entityStatus: 'opc_entity', stage: 'scaling', facade: 'cafe', lotId: 'sc_w3',
    products: [P('p_hall', 'opc_books', '二楼活动空间', '30 人读书会 / 发布会', 300, '场起')], cases: [], faqs: [{ q: '可以带饮料吗', a: '一楼有咖啡吧，外带饮品请先问主理人。' }], openNeeds: ['活动主办方'], createdAt: 0, isDemo: true },
];

/** 我的故事：AI 视频制作人 */
export const STORY_INTRO_TEXT = '我会做短视频，也会用 AI 做宣传片和品牌短片。我现在没有固定工作，希望接一些企业宣传片的业务。我在徐汇、静安，远程线下均可，报价 3000-12000 元。';

export const entityById = (id: string) => COUNTERPARTIES.find((c) => c.id === id);
export const residentById = (id: string) => RESIDENTS.find((r) => r.id === id);
export const residentOfEntity = (entityId: string) => RESIDENTS.find((r) => r.entityId === entityId);
export const shopByLot = (lotId: string) => SHOPS.find((s) => s.lotId === lotId);
export const entityByLot = (lotId: string) => COUNTERPARTIES.find((c) => c.place.lotId === lotId);
export const shopOfEntity = (entityId: string) => {
  const e = entityById(entityId);
  return e?.place.lotId ? shopByLot(e.place.lotId) : undefined;
};
