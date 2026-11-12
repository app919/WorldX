/**
 * 街区二：洋泾社区（浦东新区）
 *
 * 表达的是浦东老社区的典型街景：六层“新村”住宅、社区菜场、底商、社区服务中心、
 * 香樟与桂花、社区小广场与健身器材、路边停车位、公交站。
 * 道路名称、建筑位置均为示意，不对应具体门牌；正式版需按授权路网校准。
 */
import type { DistrictDef, RoadDef } from '../types';
import { v } from '../geom';
import { frontage } from '../helpers';

const main: RoadDef = {
  id: 'yj_main', name: '洋泾社区主路（示意）', a: v(-140, 0), b: v(170, 0), carriage: 12, sidewalk: 4, lanes: 2,
  centerLine: 'double_yellow', trees: 'camphor', treeSpacing: 7.5, paving: 'tile_grey',
  note: '南侧为路边停车带',
};
const cross: RoadDef = {
  id: 'yj_cross', name: '社区支路（示意）', a: v(20, -130), b: v(20, 122), carriage: 7, sidewalk: 3.4, lanes: 2,
  centerLine: 'dashed', trees: 'osmanthus', treeSpacing: 6, paving: 'tile_cream',
};

const west: RoadDef = {
  id: 'yj_west', name: '社区西路（示意）', a: v(-80, -130), b: v(-80, 122), carriage: 7, sidewalk: 3.4, lanes: 2,
  centerLine: 'dashed', trees: 'camphor', treeSpacing: 7, paving: 'tile_grey',
};
const east: RoadDef = {
  id: 'yj_east', name: '社区东路（示意）', a: v(112, -130), b: v(112, 122), carriage: 7, sidewalk: 3.4, lanes: 2,
  centerLine: 'dashed', trees: 'osmanthus', treeSpacing: 6, paving: 'tile_cream',
};
const north: RoadDef = {
  id: 'yj_north', name: '社区北路（示意）', a: v(-140, -96), b: v(170, -96), carriage: 9, sidewalk: 3.8, lanes: 2,
  centerLine: 'double_yellow', trees: 'camphor', treeSpacing: 7.5, paving: 'tile_grey',
};

export const YANGJING: DistrictDef = {
  id: 'yangjing',
  name: '洋泾社区',
  subtitle: '浦东新区 · 社区生活街区（示意）',
  geoRef: { lat: 31.236, lng: 121.53, note: '街道级近似位置；道路与建筑为典型社区街景示意' },
  ground: 'grass',
  ambience: '菜场、邻里、香樟树荫、社区团购',
  roads: [main, cross, west, east, north],
  crosswalks: [
    { road: 'yj_main', t: 106 / 310, width: 3.2 },
    { road: 'yj_main', t: 200 / 310, width: 3.2 },
    { road: 'yj_north', t: 120 / 310, width: 3.2 },
    { road: 'yj_cross', t: 70 / 252, width: 3 },
    { road: 'yj_cross', t: 190 / 252, width: 3 },
    { road: 'yj_west', t: 190 / 252, width: 3 },
    { road: 'yj_east', t: 60 / 252, width: 3 },
  ],
  filler: {
    seed: 23,
    kinds: [
      { kind: 'workers_housing', w: [18, 26], d: [9, 11], floors: [5, 6], palettes: ['cream', 'pink', 'blue', 'white'], setback: 6, weight: 3 },
      { kind: 'shop', w: [8, 10], d: [7, 8], floors: [2, 3], palettes: ['cream', 'blue', 'pink', 'brick', 'white'], lot: true, weight: 3 },
      { kind: 'civic', w: [14, 16], d: [10, 11], floors: [2, 3], palettes: ['white'], setback: 3, weight: 0.4 },
    ],
  },
  areas: [
    { id: 'yj_plaza', kind: 'plaza', box: { cx: 50, cz: 19.2, w: 24, d: 19.6, rot: 0 }, label: '社区小广场' },
    { id: 'yj_lawn1', kind: 'lawn', box: { cx: -26, cz: -16, w: 72, d: 9, rot: 0 } },
    { id: 'yj_parking', kind: 'parking', box: { cx: -34, cz: 4.9, w: 40, d: 2.2, rot: 0 }, label: '路边停车位' },
  ],
  buildings: [
    // 北侧：六层新村住宅（退界 + 绿化）
    { id: 'yjn1', kind: 'workers_housing', box: frontage(main, 98, 'L', 26, 10, 9), floors: 6, palette: 'cream', doors: [{ offset: -6 }, { offset: 6 }], setback: 9, seed: 21 },
    { id: 'yjn2', kind: 'workers_housing', box: frontage(main, 128, 'L', 22, 10, 9), floors: 6, palette: 'pink', doors: [{ offset: 0 }], setback: 9, seed: 22 },
    { id: 'yjn3', kind: 'civic', box: frontage(main, 176, 'L', 16, 11, 4), floors: 3, name: '社区服务中心（示意）', palette: 'white', doors: [{ offset: 0, label: '社区服务中心（示意）' }], setback: 4, seed: 23 },
    { id: 'yjn4', kind: 'shop', box: frontage(main, 194, 'L', 9, 7), floors: 2, palette: 'blue', doors: [{ offset: 0, lotId: 'yj_n1' }], seed: 24 },
    { id: 'yjn5', kind: 'shop', box: frontage(main, 204.5, 'L', 9, 7), floors: 2, palette: 'cream', doors: [{ offset: 0, lotId: 'yj_n2' }], seed: 25 },
    // 南侧：社区菜场 + 底商
    { id: 'yjs1', kind: 'market_hall', box: frontage(main, 100, 'R', 22, 13, 1.2), floors: 1, name: '社区菜场', palette: 'cream', doors: [{ offset: 0, lotId: 'yj_market' }], seed: 26 },
    { id: 'yjs2', kind: 'shop', box: frontage(main, 123, 'R', 9, 8), floors: 3, palette: 'cream', doors: [{ offset: 0, lotId: 'yj_s1' }], seed: 27 },
    { id: 'yjs3', kind: 'shop', box: frontage(main, 133.5, 'R', 9, 8), floors: 3, palette: 'brick', doors: [{ offset: 0, lotId: 'yj_s2' }], seed: 28 },
    { id: 'yjs4', kind: 'shop', box: frontage(main, 212, 'R', 9, 7), floors: 2, palette: 'pink', doors: [{ offset: 0, lotId: 'yj_s3' }], seed: 29 },
    // 支路两侧
    { id: 'yjc1', kind: 'shop', box: frontage(cross, 96, 'R', 9, 7), floors: 2, palette: 'cream', doors: [{ offset: 0, lotId: 'yj_c1' }], seed: 30 },
    { id: 'yjc2', kind: 'shop', box: frontage(cross, 106.5, 'R', 9, 7), floors: 2, palette: 'blue', doors: [{ offset: 0, lotId: 'yj_c3' }], seed: 31 },
    { id: 'yjc3', kind: 'shop', box: frontage(cross, 160, 'L', 10, 8), floors: 2, palette: 'white', doors: [{ offset: 0, lotId: 'yj_c2' }], seed: 32 },
    { id: 'yjc4', kind: 'workers_housing', box: frontage(cross, 162, 'R', 20, 10, 6), floors: 6, palette: 'cream', doors: [{ offset: 0 }], setback: 6, seed: 33 },
  ],
  props: [
    { kind: 'bus_stop', p: v(-48, -7.6), rot: Math.PI },
    { kind: 'fitness', p: v(40, 24) }, { kind: 'fitness', p: v(44, 26) },
    { kind: 'bench', p: v(52, 13), rot: Math.PI }, { kind: 'bench', p: v(58, 25), rot: -Math.PI / 2 },
    { kind: 'tree', p: v(38, 15), species: 'camphor', scale: 1.25 }, { kind: 'tree', p: v(56, 18), species: 'camphor', scale: 1.1 },
    { kind: 'tree', p: v(48, 27), species: 'osmanthus', scale: 1 },
    { kind: 'stall', p: v(11, 10.5) },
  ],
  spawn: v(-6, 8),
};
