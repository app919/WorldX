import { Color } from 'three';
import { hourLabel } from './clock';
export { hourLabel, isNight } from './clock';

/** 奶油软陶色板 —— 保留上海的砖红、梧桐绿、石库门灰、咖啡馆木色 */
export const PALETTE = {
  cream: '#FBF6EC',
  creamDeep: '#F4EBDA',
  almond: '#E8C77A',
  sage: '#A9C2A0',
  sageDeep: '#86A57C',
  plane: '#9DBA7E', // 梧桐绿
  planeDeep: '#7FA064',
  trunk: '#B8A48C',
  sakura: '#F0C4C6',
  haze: '#C2D3E0',
  brick: '#C98068',
  brickDeep: '#B5654E',
  stone: '#A9A39A',
  stoneDeep: '#8D877F',
  wood: '#A47B5B',
  cocoa: '#4A3426',
  road: '#E3D9C9',
  sidewalk: '#EFE6D6',
  grass: '#CFDDB8',
  window: '#DCE6EE',
  windowNight: '#FFD99A',
};

const lerpColor = (a: string, b: string, t: number) => new Color(a).lerp(new Color(b), Math.max(0, Math.min(1, t))).getStyle();

export interface Lighting {
  sky: string;
  fog: string;
  sunColor: string;
  sunIntensity: number;
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  sunPos: [number, number, number];
  night: number; // 0 白天 … 1 深夜
  label: string;
}

export function lightingFor(hour: number): Lighting {
  // night: 0 白天 → 1 夜晚，在黄昏/清晨平滑过渡
  const night =
    hour < 5 ? 1 : hour < 7 ? 1 - (hour - 5) / 2 : hour < 17 ? 0 : hour < 19.5 ? (hour - 17) / 2.5 : 1;
  const dusk = hour > 16 && hour < 20 ? 1 - Math.abs(hour - 18) / 2 : hour > 5 && hour < 8 ? 1 - Math.abs(hour - 6.5) / 1.5 : 0;

  const dayAngle = ((hour - 6) / 12) * Math.PI; // 6 点升起，18 点落下
  const sunY = Math.max(0.15, Math.sin(dayAngle)) * 60;
  const sunX = Math.cos(dayAngle) * 60;

  let sky = lerpColor('#DDEBF2', '#3E4C78', night);
  sky = lerpColor(sky, '#F6D3C4', dusk * 0.7);
  return {
    sky,
    fog: sky,
    sunColor: lerpColor(lerpColor('#FFF4E0', '#FFB98A', dusk), '#9FB0E0', night),
    sunIntensity: 2.1 * (1 - night) + 0.45,
    ambient: 0.55 - night * 0.05,
    hemiSky: lerpColor('#FFF8EC', '#9AA8D8', night),
    hemiGround: lerpColor('#E3D9C9', '#6A6080', night),
    sunPos: [sunX, sunY, 30],
    night,
    label: hourLabel(hour),
  };
}

