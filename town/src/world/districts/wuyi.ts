/**
 * 长沙 · 五一商圈（天心区 / 芙蓉区）
 *
 * 黄兴南路步行街：北端在解放西路（司门口一带），向南延伸；五一大道在北面东西贯通，黄兴中路连接两者。
 * 太平街：南起解放西路、北止五一大道，长约 400 米（贾谊故居在此）；坡子街：东起黄兴南路、西至湘江大道。
 * 蔡锷中路在东侧；天心阁在东南方向。路名均为真实名称，道路长度与建筑为示意。
 */
import type { DistrictDef, RoadDef } from '../types';
import { v } from '../geom';
import { frontage } from '../helpers';

const huangxing: RoadDef = { id: 'huangxing_s', name: '黄兴南路步行街', a: v(0, -20), b: v(0, 130), carriage: 0, sidewalk: 7, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'camphor', treeSpacing: 10, paving: 'brick_red' };
const huangxingZ: RoadDef = { id: 'huangxing_z', name: '黄兴中路', a: v(0, -120), b: v(0, -20), carriage: 12, sidewalk: 4, lanes: 4, centerLine: 'double_yellow', trees: 'camphor', treeSpacing: 8, paving: 'tile_grey' };
const wuyi: RoadDef = { id: 'wuyi', name: '五一大道', a: v(-160, -120), b: v(150, -120), carriage: 18, sidewalk: 4.6, lanes: 4, centerLine: 'double_yellow', trees: 'camphor', treeSpacing: 8, paving: 'tile_grey' };
const jiefang: RoadDef = { id: 'jiefang_w', name: '解放西路', a: v(-160, -20), b: v(150, -20), carriage: 10, sidewalk: 3.8, lanes: 2, centerLine: 'dashed', trees: 'camphor', treeSpacing: 7, paving: 'tile_grey' };
const taiping: RoadDef = { id: 'taiping', name: '太平街', a: v(-90, -120), b: v(-90, -20), carriage: 0, sidewalk: 3, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'none', treeSpacing: 10, paving: 'tile_grey' };
const pozi: RoadDef = { id: 'pozi', name: '坡子街', a: v(-160, 64), b: v(0, 64), carriage: 0, sidewalk: 3.6, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'osmanthus', treeSpacing: 9, paving: 'tile_grey' };
const xiangjiang: RoadDef = { id: 'xiangjiang', name: '湘江大道', a: v(-160, -150), b: v(-160, 140), carriage: 14, sidewalk: 4, lanes: 4, centerLine: 'double_yellow', trees: 'camphor', treeSpacing: 8, paving: 'tile_grey' };
const caie: RoadDef = { id: 'caie', name: '蔡锷中路', a: v(110, -120), b: v(110, 140), carriage: 12, sidewalk: 3.8, lanes: 4, centerLine: 'double_yellow', trees: 'camphor', treeSpacing: 8, paving: 'tile_grey' };

export const WUYI: DistrictDef = {
  id: 'wuyi',
  name: '五一商圈',
  subtitle: '长沙 · 黄兴南路步行街与太平老街',
  geoRef: { lat: 28.192, lng: 112.976, note: '街道级近似位置；道路相对位置为示意' },
  ground: 'grass',
  ambience: '茶饮、小吃、直播、夜生活',
  roads: [huangxing, huangxingZ, wuyi, jiefang, taiping, pozi, xiangjiang, caie],
  crosswalks: [],
  filler: {
    seed: 81,
    kinds: [
      { kind: 'horsewall', w: [9, 12], d: [8, 10], floors: [2, 2], palettes: ['white'], setback: 0.6, lot: true, roads: ['taiping', 'pozi'], weight: 3 },
      { kind: 'shop', w: [9, 11], d: [8, 9], floors: [2, 4], palettes: ['cream', 'white', 'brick', 'pink'], lot: true, roads: ['huangxing_s', 'jiefang_w', 'huangxing_z', 'caie'], weight: 3 },
      { kind: 'tower', w: [14, 18], d: [12, 14], floors: [6, 10], palettes: ['white', 'grey', 'blue'], lot: true, roads: ['wuyi', 'caie', 'xiangjiang'], weight: 1.8 },
    ],
  },
  areas: [
    { id: 'tianxinge', kind: 'park', box: { cx: 58, cz: 100, w: 70, d: 52, rot: 0 }, label: '天心阁' },
    { id: 'wuyi_sq', kind: 'plaza', box: { cx: 30, cz: -97, w: 30, d: 18, rot: 0 }, label: '五一广场' },
  ],
  buildings: [
    { id: 'jiayi', kind: 'temple', box: frontage(taiping, 52, 'L', 14, 11, 1.5), floors: 1, name: '贾谊故居', palette: 'grey', doors: [{ offset: 0, label: '贾谊故居（参观）' }], setback: 1.5, seed: 81 },
  ],
  props: [],
  spawn: v(-3, 10),
};
