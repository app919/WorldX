/**
 * 成都 · 春熙路（锦江区）
 *
 * 春熙路修建于 1924 年，连接东大街与总府路，如今是步行街；东侧红星路边是 IFS（国际金融中心），
 * 再往东是远洋太古里与大慈寺（大慈寺入口就在太古里街区之中），大慈寺路沿线是太古里的川西风格街坊。
 * 人民公园在西面。路名均为真实名称，道路长度与建筑为示意。
 */
import type { DistrictDef, RoadDef } from '../types';
import { v } from '../geom';
import { frontage } from '../helpers';

const chunxi: RoadDef = { id: 'chunxi', name: '春熙路', a: v(-40, -104), b: v(-40, 112), carriage: 0, sidewalk: 6.5, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'ginkgo', treeSpacing: 10, paving: 'tile_cream' };
const zongfu: RoadDef = { id: 'zongfu', name: '总府路', a: v(-160, -104), b: v(160, -104), carriage: 16, sidewalk: 4.2, lanes: 4, centerLine: 'double_yellow', trees: 'ginkgo', treeSpacing: 8, paving: 'tile_grey' };
const dongda: RoadDef = { id: 'dongdajie', name: '东大街', a: v(-160, 112), b: v(160, 112), carriage: 18, sidewalk: 4.6, lanes: 4, centerLine: 'double_yellow', trees: 'ginkgo', treeSpacing: 8, paving: 'tile_grey' };
const hongxing: RoadDef = { id: 'hongxing', name: '红星路', a: v(40, -104), b: v(40, 112), carriage: 14, sidewalk: 4, lanes: 4, centerLine: 'double_yellow', trees: 'ginkgo', treeSpacing: 8, paving: 'tile_grey' };
const daci: RoadDef = { id: 'daci', name: '大慈寺路', a: v(40, -10), b: v(160, -10), carriage: 8, sidewalk: 4, lanes: 2, centerLine: 'dashed', trees: 'ginkgo', treeSpacing: 7, paving: 'tile_grey' };

export const CHUNXI: DistrictDef = {
  id: 'chunxi',
  name: '春熙路 · 太古里',
  subtitle: '成都 · 锦江区 · 步行街与川西街坊',
  geoRef: { lat: 30.656, lng: 104.081, note: '街道级近似位置；道路相对位置为示意' },
  ground: 'grass',
  ambience: '潮流、设计、独立游戏、大熊猫与火锅',
  roads: [chunxi, zongfu, dongda, hongxing, daci],
  crosswalks: [],
  filler: {
    seed: 91,
    kinds: [
      { kind: 'chuanxi', w: [10, 14], d: [9, 11], floors: [1, 2], palettes: ['white'], setback: 0.6, lot: true, roads: ['daci'], weight: 3 },
      { kind: 'shop', w: [9, 11], d: [8, 9], floors: [3, 5], palettes: ['cream', 'white', 'grey', 'pink'], lot: true, roads: ['chunxi', 'zongfu', 'dongdajie'], weight: 3 },
      { kind: 'tower', w: [14, 18], d: [12, 14], floors: [5, 9], palettes: ['white', 'grey'], lot: true, roads: ['hongxing', 'zongfu', 'dongdajie'], weight: 1.4 },
      { kind: 'chuanxi', w: [10, 12], d: [9, 10], floors: [2, 2], palettes: ['white'], setback: 0.6, lot: true, roads: ['hongxing'], weight: 1 },
    ],
  },
  areas: [
    { id: 'renmin', kind: 'park', box: { cx: -122, cz: 4, w: 52, d: 120, rot: 0 }, label: '人民公园' },
  ],
  buildings: [
    { id: 'ifs', kind: 'tower', box: frontage(hongxing, 46, 'L', 22, 18, 1), floors: 16, name: '成都国际金融中心（IFS）', palette: 'grey', doors: [{ offset: 0, label: '成都国际金融中心（IFS）' }], setback: 1, seed: 91 },
    { id: 'dacisi', kind: 'temple', box: frontage(daci, 80, 'R', 26, 18, 3), floors: 2, name: '大慈寺', palette: 'brick', doors: [{ offset: 0, label: '大慈寺（参观）' }], setback: 3, seed: 92 },
  ],
  props: [],
  spawn: v(-43, 0),
};
