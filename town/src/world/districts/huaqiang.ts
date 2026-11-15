/**
 * 深圳 · 华强北（福田区华强北街道）
 *
 * 华强北路南北贯穿，被深南中路（南）与红荔路（北）截断的约 900 多米路段，60 米宽的步行街；
 * 南端有赛格广场。振华路东西向穿过华强北；西侧中航路一带是深圳中心公园，东侧燕南路。
 * 路名均为真实名称，道路长度与建筑为示意。
 */
import type { DistrictDef, RoadDef } from '../types';
import { v } from '../geom';
import { frontage } from '../helpers';

const hqb: RoadDef = { id: 'huaqiangbei', name: '华强北路', a: v(0, -112), b: v(0, 116), carriage: 0, sidewalk: 7.5, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'camphor', treeSpacing: 10, paving: 'tile_cream' };
const hongli: RoadDef = { id: 'hongli', name: '红荔路', a: v(-150, -112), b: v(160, -112), carriage: 16, sidewalk: 4.2, lanes: 4, centerLine: 'double_yellow', trees: 'camphor', treeSpacing: 8, paving: 'tile_grey' };
const shennan: RoadDef = { id: 'shennan', name: '深南中路', a: v(-150, 116), b: v(160, 116), carriage: 18, sidewalk: 4.6, lanes: 4, centerLine: 'double_yellow', trees: 'camphor', treeSpacing: 8, paving: 'tile_grey' };
const zhenhua: RoadDef = { id: 'zhenhua', name: '振华路', a: v(-150, 0), b: v(160, 0), carriage: 9, sidewalk: 3.6, lanes: 2, centerLine: 'dashed', trees: 'camphor', treeSpacing: 7, paving: 'tile_grey' };
const zhonghang: RoadDef = { id: 'zhonghang', name: '中航路', a: v(-96, -112), b: v(-96, 116), carriage: 9, sidewalk: 3.6, lanes: 2, centerLine: 'dashed', trees: 'camphor', treeSpacing: 7, paving: 'tile_grey' };
const yannan: RoadDef = { id: 'yannan', name: '燕南路', a: v(104, -112), b: v(104, 116), carriage: 10, sidewalk: 3.6, lanes: 2, centerLine: 'dashed', trees: 'camphor', treeSpacing: 7, paving: 'tile_grey' };

export const HUAQIANG: DistrictDef = {
  id: 'huaqiang',
  name: '华强北',
  subtitle: '深圳 · 福田区 · 电子与硬件街区',
  geoRef: { lat: 22.543, lng: 114.088, note: '街道级近似位置；道路相对位置为示意' },
  ground: 'paving',
  ambience: '电子元器件、硬件创业、跨境出海、潮玩',
  roads: [hqb, hongli, shennan, zhenhua, zhonghang, yannan],
  crosswalks: [],
  filler: {
    seed: 71,
    kinds: [
      { kind: 'tower', w: [14, 18], d: [12, 14], floors: [6, 12], palettes: ['blue', 'grey', 'white'], setback: 0.6, lot: true, roads: ['huaqiangbei', 'shennan', 'hongli'], weight: 2.5 },
      { kind: 'shop', w: [9, 11], d: [8, 9], floors: [3, 4], palettes: ['white', 'blue', 'grey'], lot: true, weight: 3 },
      { kind: 'tower', w: [12, 14], d: [10, 12], floors: [4, 8], palettes: ['white', 'grey'], lot: true, roads: ['zhenhua', 'zhonghang', 'yannan'], weight: 1.5 },
    ],
  },
  areas: [
    { id: 'sz_central', kind: 'park', box: { cx: -128, cz: 58, w: 40, d: 90, rot: 0 }, label: '深圳中心公园' },
    { id: 'lizhi', kind: 'park', box: { cx: 136, cz: -56, w: 40, d: 86, rot: 0 }, label: '荔枝公园' },
  ],
  buildings: [
    { id: 'saige', kind: 'tower', box: frontage(hqb, 206, 'L', 20, 18, 1), floors: 18, name: '赛格广场', palette: 'blue', doors: [{ offset: 0, label: '赛格广场（电子市场）' }], setback: 1, seed: 71 },
  ],
  props: [],
  spawn: v(-9, -20),
};
