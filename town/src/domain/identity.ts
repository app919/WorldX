/**
 * 身份与着装：一类人一种着装风格，街上一眼就能认出对方是谁。
 * - OPC 主理人：粉色背带裤；【例】示范店主理人：蓝色背带裤；
 * - 投资人：深蓝西装 + 领带；在职看副业：浅蓝衬衫 + 工牌；商业服务者：驼色马甲；品牌方：珊瑚色夹克；游客：黄色 T 恤 + 背包。
 */
import type { AvatarLook, LifeTag, Outfit } from './types';

export interface Identity { tag: LifeTag; label: string; emoji: string; desc: string; outfit: Outfit; body: string; pants: string; accent: string; accessory: AvatarLook['accessory'] }

/** 进街区时可选的六种身份 */
export const IDENTITIES: Identity[] = [
  { tag: 'investor', label: '投资人', emoji: '💼', desc: '看项目、找好团队', outfit: 'suit', body: '#34446A', pants: '#2B3550', accent: '#E2B24A', accessory: 'none' },
  { tag: 'side_hustle', label: '在职看副业', emoji: '🧑‍💻', desc: '下班后找点副业机会', outfit: 'office', body: '#A9C8E8', pants: '#4B5563', accent: '#E86A5C', accessory: 'glasses' },
  { tag: 'opc', label: 'OPC 主理人', emoji: '🏪', desc: '一个人的小公司', outfit: 'overalls', body: '#F29BB5', pants: '#F29BB5', accent: '#FFF6EA', accessory: 'none' },
  { tag: 'service', label: '商业服务者', emoji: '🧾', desc: '法务、财税、设计、营销…', outfit: 'vest', body: '#C89A63', pants: '#5B4636', accent: '#FFFFFF', accessory: 'none' },
  { tag: 'brand', label: '品牌方', emoji: '🛍️', desc: '找内容、找渠道、找合作', outfit: 'jacket', body: '#F2785C', pants: '#3F4C6B', accent: '#FFFFFF', accessory: 'cap' },
  { tag: 'visitor', label: '游客', emoji: '📷', desc: '随便逛逛上海街区', outfit: 'tee', body: '#F7C948', pants: '#6B8FB3', accent: '#7FB77E', accessory: 'none' },
];

/** 【例】示范店主理人：统一蓝色背带裤 */
export const EXAMPLE_DRESS = { outfit: 'overalls' as Outfit, body: '#4F8EDB', pants: '#4F8EDB', accent: '#FFF6EA' };

/** 旧版生活标签对应的着装 */
const LEGACY: Partial<Record<LifeTag, LifeTag>> = { worker: 'side_hustle', freelancer: 'service', retiree: 'visitor', student: 'visitor', explorer: 'visitor' };

export const identityOf = (tag?: LifeTag) => IDENTITIES.find((i) => i.tag === (tag && (LEGACY[tag] ?? tag))) ?? IDENTITIES[5];

/** 所有标签（含旧版）的显示名 */
export const LIFE_TAG_LABEL: Record<LifeTag, string> = {
  investor: '投资人', side_hustle: '在职看副业', opc: 'OPC 主理人', service: '商业服务者', brand: '品牌方', visitor: '游客',
  worker: '上班族', freelancer: '自由职业者', retiree: '退休生活家', student: '学生', explorer: '城市玩家',
};

/** 按身份穿衣服：着装风格与颜色跟身份走，保留肤色、发色、性别和配饰 */
export function dress(look: AvatarLook, tag?: LifeTag): AvatarLook {
  if (look.outfit) return look;
  const id = identityOf(tag);
  return { ...look, outfit: id.outfit, body: id.body, pants: id.pants, accent: id.accent };
}
