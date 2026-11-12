/**
 * 街区三：甜爱路及四川北路（虹口区）
 *
 * 四川北路：虹口的商业主街，沿街多为近代多层建筑与骑楼式商业。
 * 甜爱路：与四川北路相接的一条安静小马路，以“甜爱”路名和沿路的情诗墙、爱心邮筒为人熟知。
 * 布局、建筑与路口位置均为示意，正式版需按授权路网与实景照片校准。
 * 情诗墙上的诗句选用公有领域的古诗词。
 */
import type { DistrictDef, RoadDef } from '../types';
import { v } from '../geom';
import { frontage, buildingside } from '../helpers';

const sichuan: RoadDef = {
  id: 'sichuan_n', name: '四川北路', a: v(0, -64), b: v(0, 74), carriage: 12, sidewalk: 5, lanes: 4,
  centerLine: 'double_yellow', trees: 'plane', treeSpacing: 7, paving: 'tile_grey',
};
const tianai: RoadDef = {
  id: 'tianai', name: '甜爱路', a: v(0, -12), b: v(86, -12), carriage: 5, sidewalk: 3.2, lanes: 1,
  centerLine: 'none', oneWay: true, trees: 'plane', treeSpacing: 5.5, paving: 'brick_red',
};

const POEMS = ['愿得一心人，白头不相离', '两情若是久长时，又岂在朝朝暮暮', '曾经沧海难为水，除却巫山不是云', '执子之手，与子偕老', '身无彩凤双飞翼，心有灵犀一点通'];

export const SICHUAN: DistrictDef = {
  id: 'sichuan_n',
  name: '甜爱路及四川北路',
  subtitle: '虹口区 · 商业主街与情诗小路（示意）',
  geoRef: { lat: 31.266, lng: 121.481, note: '街道级近似位置；路口与建筑为示意' },
  bounds: { minX: -42, maxX: 86, minZ: -64, maxZ: 74 },
  ground: 'grass',
  ambience: '老字号、骑楼、情诗墙、爱心邮筒',
  roads: [sichuan, tianai],
  crosswalks: [
    { road: 'sichuan_n', t: 40 / 138, width: 3.4 },
    { road: 'sichuan_n', t: 96 / 138, width: 3.4 },
    { road: 'tianai', t: 8.5 / 86, width: 2.8 },
  ],
  areas: [
    // 甜爱路南侧情诗墙（不可穿越）
    { id: 'poem_wall', kind: 'wall', box: { cx: 46, cz: -12 + 2.5 + 3.2 + 0.5, w: 60, d: 0.9, rot: 0 }, label: '情诗墙' },
    { id: 'ta_lawn', kind: 'lawn', box: { cx: 52, cz: 3, w: 52, d: 17, rot: 0 } },
  ],
  buildings: [
    // 四川北路西侧：骑楼与近代建筑（右侧 = 西侧，因为道路向南）
    { id: 'scw1', kind: 'arcade', box: frontage(sichuan, 12, 'R', 15, 10, 0.2), floors: 4, palette: 'cream', doors: [{ offset: -3.5, lotId: 'sc_w1' }, { offset: 3.5 }], seed: 41 },
    { id: 'scw2', kind: 'arcade', box: frontage(sichuan, 28, 'R', 15, 10, 0.2), floors: 4, palette: 'brick', doors: [{ offset: 0, lotId: 'sc_w2' }], seed: 42 },
    { id: 'scw3', kind: 'artdeco', box: frontage(sichuan, 58, 'R', 18, 12), floors: 6, palette: 'grey', doors: [{ offset: 0 }], seed: 43 },
    { id: 'scw4', kind: 'shop', box: frontage(sichuan, 80, 'R', 10, 8), floors: 3, palette: 'cream', doors: [{ offset: 0, lotId: 'sc_w3' }], seed: 44 },
    { id: 'scw5', kind: 'arcade', box: frontage(sichuan, 100, 'R', 15, 10, 0.2), floors: 4, palette: 'cream', doors: [{ offset: 0, lotId: 'sc_w4' }], seed: 45 },
    { id: 'scw6', kind: 'shop', box: frontage(sichuan, 120, 'R', 10, 8), floors: 2, palette: 'pink', doors: [{ offset: 0, lotId: 'sc_w5' }], seed: 46 },
    // 四川北路东侧（甜爱路以北）
    { id: 'sce1', kind: 'artdeco', box: frontage(sichuan, 16, 'L', 16, 12), floors: 5, palette: 'cream', doors: [{ offset: 0, lotId: 'sc_e1' }], seed: 47 },
    { id: 'sce2', kind: 'shop', box: frontage(sichuan, 36, 'L', 9, 8), floors: 2, palette: 'brick', doors: [{ offset: 0, lotId: 'sc_e2' }], seed: 48 },
    // 四川北路东侧（甜爱路以南）
    { id: 'sce3', kind: 'shop', box: frontage(sichuan, 72, 'L', 10, 8), floors: 3, palette: 'cream', doors: [{ offset: 0, lotId: 'sc_e3' }], seed: 49 },
    { id: 'sce4', kind: 'arcade', box: frontage(sichuan, 92, 'L', 15, 10, 0.2), floors: 4, palette: 'brick', doors: [{ offset: 0, lotId: 'sc_e4' }], seed: 50 },
    // 甜爱路北侧：石库门里弄与花园住宅
    { id: 'tan1', kind: 'shikumen_row', box: frontage(tianai, 30, 'L', 18, 9, 1), floors: 2, palette: 'grey', doors: [{ offset: -5 }, { offset: 0 }, { offset: 5 }], seed: 51 },
    { id: 'tan2', kind: 'garden_villa', box: frontage(tianai, 52, 'L', 12, 9, 4), floors: 3, palette: 'cream', doors: [{ offset: 0 }], setback: 4, seed: 52 },
    { id: 'tan3', kind: 'shop', box: frontage(tianai, 70, 'L', 10, 8, 1), floors: 2, palette: 'pink', doors: [{ offset: 0, lotId: 'ta_n1' }], seed: 53 },
  ],
  props: [
    { kind: 'mailbox', ...(() => { const b = buildingside(tianai, 45.1, 'L', 0.5); return { p: b.p, rot: b.rot }; })(), text: '甜爱路爱心邮筒（示意）' },
    ...POEMS.map((t, i) => ({ kind: 'poem_wall' as const, p: v(22 + i * 12, -12 + 2.5 + 3.2 + 0.05), rot: Math.PI, text: t })),
  ],
  spawn: v(-6.5, -20),
};
