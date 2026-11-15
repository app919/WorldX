/**
 * 北京 · 南锣鼓巷（东城区交道口街道）
 *
 * 南锣鼓巷南北走向、全长约 786 米，两侧各 8 条胡同，形似“蜈蚣街”。这里取：
 * 西侧帽儿胡同、雨儿胡同；东侧菊儿胡同（最北头）、东棉花胡同（中段，中央戏剧学院所在）。
 * 北端鼓楼东大街（西头是鼓楼），南端地安门东大街，东边交道口南大街。
 * 南锣鼓巷与胡同为步行街；路名均为真实名称，道路长度与建筑为示意。
 */
import type { DistrictDef, RoadDef } from '../types';
import { v } from '../geom';
import { frontage } from '../helpers';

const nanluo: RoadDef = { id: 'nanluo', name: '南锣鼓巷', a: v(0, -112), b: v(0, 112), carriage: 0, sidewalk: 4.2, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'ginkgo', treeSpacing: 11, paving: 'tile_grey' };
const gulou: RoadDef = { id: 'gulou_e', name: '鼓楼东大街', a: v(-160, -112), b: v(150, -112), carriage: 10, sidewalk: 3.6, lanes: 2, centerLine: 'dashed', trees: 'ginkgo', treeSpacing: 8, paving: 'tile_grey' };
const dianmen: RoadDef = { id: 'dianmen_e', name: '地安门东大街', a: v(-160, 112), b: v(150, 112), carriage: 14, sidewalk: 4, lanes: 4, centerLine: 'double_yellow', trees: 'ginkgo', treeSpacing: 8, paving: 'tile_grey' };
const jiaodaokou: RoadDef = { id: 'jiaodaokou_s', name: '交道口南大街', a: v(112, -112), b: v(112, 112), carriage: 12, sidewalk: 3.8, lanes: 4, centerLine: 'double_yellow', trees: 'ginkgo', treeSpacing: 8, paving: 'tile_grey' };
const maoer: RoadDef = { id: 'maoer', name: '帽儿胡同', a: v(-150, 20), b: v(0, 20), carriage: 0, sidewalk: 2.8, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'none', treeSpacing: 10, paving: 'tile_grey' };
const yuer: RoadDef = { id: 'yuer', name: '雨儿胡同', a: v(-150, 58), b: v(0, 58), carriage: 0, sidewalk: 2.8, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'none', treeSpacing: 10, paving: 'tile_grey' };
const juer: RoadDef = { id: 'juer', name: '菊儿胡同', a: v(0, -78), b: v(112, -78), carriage: 0, sidewalk: 2.8, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'none', treeSpacing: 10, paving: 'tile_grey' };
const mianhua: RoadDef = { id: 'dongmianhua', name: '东棉花胡同', a: v(0, 40), b: v(112, 40), carriage: 0, sidewalk: 2.8, lanes: 0, centerLine: 'none', pedestrian: true, trees: 'none', treeSpacing: 10, paving: 'tile_grey' };

export const NANLUO: DistrictDef = {
  id: 'nanluo',
  name: '南锣鼓巷',
  subtitle: '北京 · 东城区 · 胡同里的小店',
  geoRef: { lat: 39.937, lng: 116.403, note: '街道级近似位置；道路相对位置为示意' },
  ground: 'paving',
  ambience: '胡同、四合院、文创小店、戏剧学院',
  roads: [nanluo, gulou, dianmen, jiaodaokou, maoer, yuer, juer, mianhua],
  crosswalks: [],
  filler: {
    seed: 61,
    kinds: [
      { kind: 'siheyuan', w: [9, 12], d: [8, 10], floors: [1, 2], palettes: ['grey'], setback: 0.3, lot: true, roads: ['nanluo', 'maoer', 'yuer', 'juer', 'dongmianhua'], weight: 4 },
      { kind: 'siheyuan', w: [14, 18], d: [12, 14], floors: [1, 1], palettes: ['grey'], setback: 0.3, roads: ['maoer', 'yuer', 'juer', 'dongmianhua'], weight: 1.5 },
      { kind: 'shop', w: [9, 11], d: [8, 9], floors: [2, 3], palettes: ['grey', 'brick', 'cream'], lot: true, roads: ['gulou_e', 'dianmen_e', 'jiaodaokou_s'], weight: 3 },
    ],
  },
  areas: [
    { id: 'shichahai', kind: 'park', box: { cx: -100, cz: -40, w: 60, d: 40, rot: 0 }, label: '什刹海' },
    { id: 'jingshan', kind: 'park', box: { cx: -92, cz: 88, w: 64, d: 24, rot: 0 }, label: '景山公园' },
  ],
  buildings: [
    { id: 'gulou', kind: 'temple', box: frontage(gulou, 30, 'R', 22, 16, 3), floors: 3, name: '鼓楼', palette: 'brick', doors: [{ offset: 0, label: '鼓楼（参观）' }], setback: 3, seed: 61 },
    { id: 'zhongxi', kind: 'civic', box: frontage(mianhua, 70, 'R', 18, 12, 2), floors: 3, name: '中央戏剧学院', palette: 'grey', doors: [{ offset: 0, label: '中央戏剧学院' }], setback: 2, seed: 62 },
  ],
  props: [],
  spawn: v(-2.2, -10),
};
