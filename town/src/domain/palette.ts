/**
 * 全站身份色（固定，不可修改）：屋顶、招牌角标、人物服装、小地图、搜索结果都用同一套颜色，一眼认出“这是谁”。
 * - 【例】系统预设的示范店 / 示范主理人：粉色（表示系统设置，无法交易）
 * - 【企】有营业执照的公司：蓝色
 * - 【投】投资人 / 投资机构：黑色
 * - 【品】品牌方（含黄金位赞助品牌）：金色
 * - 其他（个人开的店、OPC 主理人、游客、在职看副业、商业服务者）：紫色
 */
export type ShopCategory = 'example' | 'company' | 'investor' | 'brand' | 'personal';

export const ROLE_COLORS: Readonly<Record<ShopCategory, string>> = Object.freeze({
  example: '#F07FAF',
  company: '#3D7BD8',
  investor: '#2A2A2E',
  brand: '#D9A62E',
  personal: '#8C6BD6',
});
/** 深一档：衣服阴影、文字 */
export const ROLE_DARK: Readonly<Record<ShopCategory, string>> = Object.freeze({
  example: '#B8457A', company: '#24549E', investor: '#000000', brand: '#8A6511', personal: '#5B3FA6',
});
/** 浅一档：卡片底色 */
export const ROLE_TINT: Readonly<Record<ShopCategory, string>> = Object.freeze({
  example: '#FDE7F0', company: '#E4EEFB', investor: '#ECECEE', brand: '#FBF1D6', personal: '#EFE9FB',
});
export const ROLE_BADGE: Readonly<Record<ShopCategory, string>> = Object.freeze({ example: '例', company: '企', investor: '投', brand: '品', personal: '' });
export const ROLE_LABEL: Readonly<Record<ShopCategory, string>> = Object.freeze({ example: '例 · 系统示范', company: '企 · 公司', investor: '投 · 投资人', brand: '品 · 品牌', personal: '个人 / 其他' });
export const BADGE_ROLE: Readonly<Record<string, ShopCategory>> = Object.freeze({ 例: 'example', 企: 'company', 投: 'investor', 品: 'brand', 赞: 'brand' });
