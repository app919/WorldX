import { Color, MeshStandardMaterial } from 'three';
import { PALETTE } from './lighting';

/** 共享材质：奶油软陶 / 磨砂树脂质感（高粗糙度、零金属度） */
const clay = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra });

export const M = {
  cream: clay(PALETTE.cream),
  creamDeep: clay(PALETTE.creamDeep),
  brick: clay(PALETTE.brick),
  brickDeep: clay(PALETTE.brickDeep),
  stone: clay(PALETTE.stone),
  stoneDeep: clay(PALETTE.stoneDeep),
  wood: clay(PALETTE.wood),
  cocoa: clay(PALETTE.cocoa),
  sage: clay(PALETTE.sage),
  sageDeep: clay(PALETTE.sageDeep),
  plane: clay(PALETTE.plane),
  planeDeep: clay(PALETTE.planeDeep),
  trunk: clay(PALETTE.trunk),
  grass: clay(PALETTE.grass),
  road: clay(PALETTE.road),
  sidewalk: clay(PALETTE.sidewalk),
  almond: clay(PALETTE.almond),
  sakura: clay(PALETTE.sakura),
  haze: clay(PALETTE.haze),
  roofGrey: clay('#7E7A76'),
  roofRed: clay('#B36A55'),
  roofFlat: clay('#CDBFAE'),
  /** 窗户：夜晚发出暖光 */
  window: clay('#A9BFD0', { emissive: new Color(PALETTE.windowNight), emissiveIntensity: 0, roughness: 0.4 }),
  lampHead: clay('#FFF4DA', { emissive: new Color('#FFD99A'), emissiveIntensity: 0 }),
};

/** 每帧由 DayNight 组件调用 */
export function applyNight(night: number) {
  M.window.emissiveIntensity = night * 0.9;
  M.window.color.set(night > 0.5 ? '#E9D6B0' : '#A9BFD0');
  M.lampHead.emissiveIntensity = night * 2.2;
}
