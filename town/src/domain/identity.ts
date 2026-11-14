/**
 * 身份与着装：一类人一种着装风格，街上一眼就能认出对方是谁。
 * - OPC 主理人：粉色背带裤；【例】示范店主理人：蓝色背带裤；
 * - 投资人：深蓝西装 + 领带；在职看副业：浅蓝衬衫 + 工牌；商业服务者：驼色马甲；品牌方：珊瑚色夹克；游客：黄色 T 恤 + 背包。
 */
import type { AvatarLook, LifeTag, Outfit } from './types';
import { ROLE_COLORS, ROLE_DARK } from './palette';

export interface Identity { tag: LifeTag; label: string; emoji: string; desc: string; outfit: Outfit; body: string; pants: string; accent: string; accessory: AvatarLook['accessory'] }

/**
 * 进街区时可选的六种身份。颜色 = 全站身份色（domain/palette.ts，固定不可改）：
 * 投资人 黑、品牌方 金、其他身份 紫（着装款式各不相同）；有营业执照的公司主理人穿蓝色；系统【例】示范主理人穿粉色背带裤。
 */
const P = ROLE_COLORS.personal, PD = ROLE_DARK.personal;
export const IDENTITIES: Identity[] = [
  { tag: 'investor', label: '投资人', emoji: '💼', desc: '看项目、找好团队', outfit: 'suit', body: ROLE_COLORS.investor, pants: '#1E1E21', accent: ROLE_COLORS.brand, accessory: 'none' },
  { tag: 'side_hustle', label: '在职看副业', emoji: '🧑‍💻', desc: '下班后找点副业机会', outfit: 'office', body: P, pants: PD, accent: '#FFF6EA', accessory: 'glasses' },
  { tag: 'opc', label: 'OPC 主理人', emoji: '🏪', desc: '一个人的小公司', outfit: 'overalls', body: P, pants: P, accent: '#FFF6EA', accessory: 'none' },
  { tag: 'service', label: '商业服务者', emoji: '🧾', desc: '法务、财税、设计、营销…', outfit: 'vest', body: P, pants: PD, accent: '#FFFFFF', accessory: 'none' },
  { tag: 'brand', label: '品牌方', emoji: '🛍️', desc: '找内容、找渠道、找合作', outfit: 'jacket', body: ROLE_COLORS.brand, pants: ROLE_DARK.brand, accent: '#FFFFFF', accessory: 'cap' },
  { tag: 'visitor', label: '游客', emoji: '📷', desc: '随便逛逛街区', outfit: 'tee', body: P, pants: PD, accent: '#FFF6EA', accessory: 'none' },
];

/** 【例】示范店主理人：统一粉色背带裤（系统设置，无法交易） */
export const EXAMPLE_DRESS = { outfit: 'overalls' as Outfit, body: ROLE_COLORS.example, pants: ROLE_COLORS.example, accent: '#FFF6EA' };
/** 有营业执照的公司主理人：蓝色 */
export const COMPANY_COLOR = ROLE_COLORS.company;

/** 旧版生活标签对应的着装 */
const LEGACY: Partial<Record<LifeTag, LifeTag>> = { worker: 'side_hustle', freelancer: 'service', retiree: 'visitor', student: 'visitor', explorer: 'visitor' };

export const identityOf = (tag?: LifeTag) => IDENTITIES.find((i) => i.tag === (tag && (LEGACY[tag] ?? tag))) ?? IDENTITIES[5];

/** 所有标签（含旧版）的显示名 */
export const LIFE_TAG_LABEL: Record<LifeTag, string> = {
  investor: '投资人', side_hustle: '在职看副业', opc: 'OPC 主理人', service: '商业服务者', brand: '品牌方', visitor: '游客',
  worker: '上班族', freelancer: '自由职业者', retiree: '退休生活家', student: '学生', explorer: '城市玩家',
};

/** 按身份穿衣服：着装风格与颜色跟身份走，保留肤色、发色、性别和配饰；company = 有营业执照的公司主理人（蓝色） */
export function dress(look: AvatarLook, tag?: LifeTag, opts: { company?: boolean } = {}): AvatarLook {
  if (look.outfit) return look;
  const id = identityOf(tag);
  const blue = opts.company && id.tag !== 'investor' && id.tag !== 'brand';
  return { ...look, outfit: id.outfit, body: blue ? COMPANY_COLOR : id.body, pants: blue ? (id.outfit === 'overalls' ? COMPANY_COLOR : ROLE_DARK.company) : id.pants, accent: id.accent };
}
