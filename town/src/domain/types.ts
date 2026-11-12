/**
 * 核心领域模型（与 3D 场景完全解耦）。
 * 字段命名与 supabase/migrations/0001_init.sql 中的表结构一一对应，
 * 方便未来把本地实现（LocalApi）替换为 Supabase / PostgreSQL。
 */

/** 玩家自选的生活标签 —— 不是职业审核，随时可换 */
export type LifeTag = 'worker' | 'freelancer' | 'opc' | 'retiree' | 'student' | 'explorer';

export type DistrictId = 'xuhui' | 'jingan' | 'huangpu' | 'changning' | 'pudong' | 'other';

/** 商业主体状态：必须区分，不能让玩家误以为开虚拟店 = 获得法人资格 */
export type EntityStatus =
  | 'personal_page' // 个人创业主页（默认，未注册任何主体）
  | 'opc_entity' // 用户自述已有经营主体（未核验）
  | 'verified_company'; // 平台已核验的企业

export type StartupStage =
  | 'exploring' // 正在探索
  | 'has_product' // 已有产品，寻找客户
  | 'seeking_partner' // 正在找合伙人
  | 'seeking_supplier' // 正在寻找供应商
  | 'has_orders' // 有订单，寻找外包团队
  | 'scaling'; // 正在扩大业务

export type CooperationMode = 'remote' | 'onsite' | 'both';
export type CooperationIntent = 'part_time' | 'project' | 'long_term' | 'team_up';

export interface AvatarLook {
  body: string; // 衣服主色
  skin: string;
  hair: string;
  accessory: 'none' | 'beret' | 'headphones' | 'scarf' | 'glasses' | 'cap';
}

export interface Avatar {
  id: string;
  userId: string;
  nickname: string;
  lifeTag: LifeTag;
  look: AvatarLook;
  /** 游戏局部坐标（不是经纬度！经纬度由 data/geo.ts 转换） */
  position: { x: number; z: number };
}

/** 用户能提供的能力 / 资源（结构化标签，而不是聊天记录） */
export interface Capability {
  tag: string; // 来自 taxonomy 的能力标签 id
  label: string;
  detail?: string;
}

/** 用户的需求 */
export interface Need {
  tag: string; // 需要的能力标签 id，或特殊需求：client / channel / venue / funding / policy
  label: string;
  detail?: string;
}

/** 商业画像（必须经用户确认后才进入匹配） */
export interface BusinessProfile {
  userId: string;
  displayName: string;
  headline: string;
  industries: string[]; // 行业 id
  capabilities: Capability[];
  needs: Need[];
  districts: DistrictId[];
  mode: CooperationMode;
  intents: CooperationIntent[];
  /** 报价区间（元），用于预算适配。未知为 undefined */
  priceRange?: { min: number; max: number };
  /** 预算区间（元），作为需求方时 */
  budgetRange?: { min: number; max: number };
  stage?: StartupStage;
  openToConnect: boolean;
  /** 用户是否已确认 AI 提取的画像 */
  confirmed: boolean;
  /** 信息来源说明（展示在推荐理由里） */
  source: 'self_described' | 'public_shop_page' | 'demo_seed';
  isDemo?: boolean;
}

export interface Product {
  id: string;
  opcId: string;
  name: string;
  description: string;
  /** 明码标价（起价）。undefined = 询价 */
  priceFrom?: number;
  unit?: string;
  /** 主理人是否确认过此价格 —— Agent 只能引用 confirmed 的价格 */
  priceConfirmed: boolean;
}

export interface OpcProfile {
  id: string;
  ownerId: string;
  name: string;
  tagline: string;
  category: string; // 开店第一步：你能提供什么
  entityStatus: EntityStatus;
  stage: StartupStage;
  facade: FacadeStyle;
  /** 街区内的铺位 id（见 data/buildings.ts） */
  lotId: string;
  products: Product[];
  cases: string[];
  faqs: { q: string; a: string }[];
  openNeeds: string[];
  createdAt: number;
  isDemo?: boolean;
}

export type FacadeStyle = 'cafe' | 'studio' | 'shikumen' | 'kiosk';

/** 五种商业关系 */
export type RelationType = 'upstream' | 'downstream' | 'peer' | 'channel' | 'resource';

export interface ScoreBreakdown {
  industry: number; // I 0-100
  complement: number; // C 0-100
  geo: number; // G 0-100
  budget: number | null; // B 0-100，null = 双方均无价格信息
  willingness: number; // W 0-100
}

/** 一条“可能性”关系 —— 永远是系统推测，不是确定需求 */
export interface Relationship {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: RelationType;
  /** 系统估算分（0-100），信息不足时为 null */
  score: number | null;
  breakdown: ScoreBreakdown;
  insufficientInfo: boolean;
  missing: string[];
  reasons: string[]; // 推荐理由
  fateReasons: string[]; // 商业缘分值的可爱理由
  possibleCollabs: string[];
  source: string; // 信息来源
  demandStatus: 'unconfirmed'; // 需求状态：永远是“未确认”，直到对方自己确认
  suggestedAction: string;
}

export type IntroStatus =
  | 'sent' // 已打招呼
  | 'accepted' // 对方接受
  | 'declined' // 对方婉拒
  | 'contact_exchanged' // 双方同意后交换联系方式
  | 'meeting_booked' // 预约线上见面
  | 'collab_proposed' // 一方提出“我们合作了”
  | 'collab_confirmed'; // 双方确认合作记录

export interface Introduction {
  id: string;
  fromUserId: string;
  toUserId: string;
  relationshipId?: string;
  message: string;
  status: IntroStatus;
  /** 联系方式交换必须双方都同意 */
  contactConsent: { from: boolean; to: boolean };
  /** 合作记录必须双方确认，AI 不能擅自认定 */
  collabConfirm: { from: boolean; to: boolean };
  createdAt: number;
  updatedAt: number;
}

export interface Meeting {
  id: string;
  introductionId: string;
  hostId: string;
  guestId: string;
  durationMin: 15 | 30 | 60;
  startsAt: number;
  topic: string;
  status: 'booked' | 'done' | 'cancelled';
}

/** Agent 权限分级 */
export type AgentLevel = 'L1' | 'L2' | 'L3';

export interface AgentConfig {
  id: string;
  opcId: string;
  persona: string; // 主理人授权的对外表达风格
  enabledLevels: { L1: boolean; L2: boolean }; // L3 永远需要本人确认，不可开启
  autoReception: boolean;
  ownerOnline: boolean;
  ownerTakeover: boolean;
}

export interface AgentReply {
  text: string;
  level: AgentLevel;
  /** 回答引用的数据（可追溯，不能编造） */
  citations: string[];
  /** 是否转交主理人本人 */
  handoff: boolean;
  /** L2 动作：收集需求 / 预约 */
  action?: { kind: 'collect_need' | 'suggest_meeting'; payload?: Record<string, unknown> };
}

export interface CommunityEvent {
  id: string;
  title: string;
  space: 'coffee_lounge' | 'startup_lounge' | 'street_market';
  online: boolean;
  weekday: string;
  time: string;
  capacity: number;
  attendees: string[];
  fee: number; // 0 = 免费
  sponsorAllowed: boolean;
  sponsor?: SponsorLabel;
  needsApproval: boolean;
  hostId: string;
  aiHost: boolean;
  isDemo?: boolean;
}

/** 赞助内容必须明确标注 */
export interface SponsorLabel {
  brand: string;
  kind: 'street_naming' | 'building' | 'event' | 'scene' | 'startup_support';
  disclosure: string; // 例如 “赞助内容”
}

export interface AuditLog {
  id: string;
  at: number;
  actor: string; // userId 或 agent:<id>
  action: string;
  target?: string;
  detail?: string;
}

/** 三套互不相通的经济体系 */
export interface Wallet {
  stars: number; // 街区星星：打卡/探索/社交，不可兑换人民币
  growth: number; // 创业成长值：店铺成长/社区贡献，不可兑换人民币
  badges: string[];
  stickers: string[];
}
