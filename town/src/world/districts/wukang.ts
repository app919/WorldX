/**
 * 街区一：武康大楼（淮海中路 × 武康路）
 *
 * 形态依据（公开资料，近似）：武康大楼位于淮海中路与武康路交汇的锐角地块，
 * 船形（熨斗形）转角朝向路口，底层连续外廊，主体红砖，上下部浅色。
 * 路网角度、道路宽度、周边建筑为示意，正式版需替换为授权路网与实测数据。
 * 1 游戏单位 ≈ 1.5 米。
 */
import type { DistrictDef, RoadDef } from '../types';
import { add, intersect, leftOf, mul, norm, v, type V2 } from '../geom';
import { frontage } from '../helpers';

const J = v(0, 0); // 路口
const ANG = (32 * Math.PI) / 180; // 武康路与淮海中路夹角（示意）
const WU = norm(v(Math.cos(ANG), -Math.sin(ANG)));

const huaihai: RoadDef = {
  id: 'huaihai', name: '淮海中路', a: v(-150, 0), b: v(190, 0), carriage: 12, sidewalk: 4.5, lanes: 4,
  centerLine: 'double_yellow', trees: 'plane', treeSpacing: 6.5, paving: 'tile_grey',
};
const wukang: RoadDef = {
  id: 'wukang', name: '武康路', a: J, b: add(J, mul(WU, 190)), carriage: 6.5, sidewalk: 3.6, lanes: 2,
  centerLine: 'dashed', trees: 'plane', treeSpacing: 6, paving: 'brick_red',
};

// 五岔路口的另外两条路（方向为示意）
const tianping: RoadDef = {
  id: 'tianping', name: '天平路', a: J, b: add(J, mul(norm(v(-0.28, 1)), 120)), carriage: 7, sidewalk: 3.4, lanes: 2,
  centerLine: 'dashed', trees: 'plane', treeSpacing: 6.5, paving: 'tile_grey',
};
const xingguo: RoadDef = {
  id: 'xingguo', name: '兴国路', a: J, b: add(J, mul(norm(v(-0.62, -0.78)), 130)), carriage: 7, sidewalk: 3.4, lanes: 2,
  centerLine: 'dashed', trees: 'plane', treeSpacing: 6.5, paving: 'tile_grey',
};
// 武康路北段向东的安福路（示意）
const ANFU_A = add(J, mul(WU, 150));
const anfu: RoadDef = {
  id: 'anfu', name: '安福路', a: ANFU_A, b: add(ANFU_A, v(150, 6)), carriage: 6, sidewalk: 3.2, lanes: 2,
  centerLine: 'none', oneWay: true, trees: 'plane', treeSpacing: 5.5, paving: 'brick_red',
};

/** 武康大楼占地：两条建筑控制线（人行道外沿 + 0.4 退界）在锐角处相交，转角做圆润的船头 */
function mansionPolygon(): V2[] {
  const hzLine = -(huaihai.carriage / 2 + huaihai.sidewalk + 0.4);
  const n = mul(leftOf(WU), -1); // 武康路东南侧（朝向楔形地块）
  const wkOff = wukang.carriage / 2 + wukang.sidewalk + 0.4;
  const prow = intersect(v(0, hzLine), v(1, 0), add(J, mul(n, wkOff)), WU);
  const L = 36; // 沿淮海中路长度（示意）
  const backX = prow.x + L;
  const backTop = intersect(v(backX, 0), v(0, 1), add(J, mul(n, wkOff)), WU);
  // 圆润船头：在船头附近用圆弧过渡
  const r = 2.2;
  const pA = add(prow, mul(v(1, 0), r * 2.2)); // 淮海一侧
  const pB = add(prow, mul(WU, r * 2.2)); // 武康一侧
  const tip: V2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    // 二次贝塞尔：pA → prow → pB
    const a = mul(pA, (1 - t) * (1 - t)), b = mul(prow, 2 * (1 - t) * t), c = mul(pB, t * t);
    tip.push(add(add(a, b), c));
  }
  return [...tip, backTop, v(backX, hzLine)];
}

export const MANSION_POLY = mansionPolygon();
const mansionBackX = MANSION_POLY[MANSION_POLY.length - 1].x;

export const WUKANG: DistrictDef = {
  id: 'wukang',
  name: '武康大楼',
  subtitle: '淮海中路 × 武康路 · 徐汇区',
  geoRef: { lat: 31.2049, lng: 121.4372, note: '路口近似位置；路网角度与周边建筑为示意' },
  ground: 'grass',
  ambience: '梧桐、老洋房、五岔路口、城市漫步',
  roads: [huaihai, wukang, tianping, xingguo, anfu],
  crosswalks: [
    { road: 'huaihai', t: 138 / 340, width: 3.2 },
    { road: 'huaihai', t: 200 / 340, width: 3.2 },
    { road: 'huaihai', t: 270 / 340, width: 3.2 },
    { road: 'huaihai', t: 60 / 340, width: 3.2 },
    { road: 'wukang', t: 74 / 190, width: 3 },
    { road: 'wukang', t: 115 / 190, width: 3 },
    { road: 'anfu', t: 80 / 150, width: 2.8 },
    { road: 'tianping', t: 70 / 120, width: 3 },
    { road: 'xingguo', t: 75 / 130, width: 3 },
  ],
  filler: {
    seed: 11,
    kinds: [
      { kind: 'shop', w: [8, 10], d: [6.5, 8], floors: [2, 3], palettes: ['cream', 'brick', 'pink', 'blue', 'white'], lot: true, weight: 3 },
      { kind: 'garden_villa', w: [11, 13], d: [8, 10], floors: [2, 3], palettes: ['cream', 'white', 'pink'], setback: 4, weight: 2 },
      { kind: 'artdeco', w: [14, 17], d: [9, 11], floors: [4, 6], palettes: ['cream', 'grey'], roads: ['huaihai'], weight: 1.5 },
      { kind: 'shikumen_row', w: [11, 13], d: [8, 9], floors: [2, 2], palettes: ['grey'], lot: true, roads: ['wukang', 'anfu', 'tianping', 'xingguo'], weight: 1 },
    ],
  },
  areas: [
    // 宋庆龄故居花园围墙（不可通行）
    { id: 'soong_garden', kind: 'lawn', box: { cx: 22, cz: 25, w: 26, d: 26, rot: 0 } },
    // 武康大楼船头前的小广场（真实街角是人们拍照的地方）
    { id: 'prow_plaza', kind: 'plaza', box: { cx: MANSION_POLY[4].x - 3.2, cz: MANSION_POLY[4].z + 0.4, w: 6, d: 3.2, rot: -0.28 }, label: '拍照打卡点' },
  ],
  buildings: [
    {
      id: 'wukang_mansion', kind: 'wukang_mansion', polygon: MANSION_POLY, floors: 8, name: '武康大楼',
      archiveId: 'wukang_mansion', doors: [{ offset: 0, label: '武康大楼（参观外立面）' }],
    },
    {
      id: 'soong', kind: 'garden_villa', box: frontage(huaihai, 172, 'R', 14, 10, 9), floors: 2, name: '宋庆龄故居',
      archiveId: 'soong_residence', palette: 'white', doors: [{ offset: 0, label: '宋庆龄故居（参观）' }], setback: 9,
    },
    // 淮海中路南侧（东段）：沿街小店
    { id: 'hs1', kind: 'shop', box: frontage(huaihai, 206, 'R', 9, 7), floors: 2, palette: 'cream', doors: [{ offset: -1.5, lotId: 'wk_s1' }], seed: 1 },
    { id: 'hs2', kind: 'shop', box: frontage(huaihai, 216.5, 'R', 9, 7), floors: 2, palette: 'brick', doors: [{ offset: 1.5, lotId: 'wk_s2' }], seed: 2 },
    { id: 'hs3', kind: 'artdeco', box: frontage(huaihai, 233, 'R', 16, 10), floors: 5, palette: 'cream', doors: [{ offset: 0 }], seed: 3 },
    // 淮海中路南侧（西段）：花园洋房
    { id: 'hw1', kind: 'garden_villa', box: frontage(huaihai, 110, 'R', 12, 9, 5), floors: 3, palette: 'pink', doors: [{ offset: 0 }], setback: 5, seed: 4 },
    { id: 'hw2', kind: 'shop', box: frontage(huaihai, 128, 'R', 9, 7), floors: 2, palette: 'cream', doors: [{ offset: 0, lotId: 'wk_s3' }], seed: 5 },
    // 淮海中路北侧（西段）
    { id: 'hn1', kind: 'artdeco', box: frontage(huaihai, 108, 'L', 16, 10), floors: 4, palette: 'grey', doors: [{ offset: 0 }], seed: 6 },
    { id: 'hn2', kind: 'shop', box: frontage(huaihai, 90, 'L', 9, 7), floors: 2, palette: 'blue', doors: [{ offset: 0, lotId: 'wk_n3' }], seed: 7 },
    // 淮海中路北侧（大楼以东）
    { id: 'hn3', kind: 'shop', box: frontage(huaihai, mansionBackX + 150 + 6, 'L', 9, 7), floors: 2, palette: 'cream', doors: [{ offset: 0, lotId: 'wk_n1' }], seed: 8 },
    { id: 'hn4', kind: 'shop', box: frontage(huaihai, mansionBackX + 150 + 16.5, 'L', 9, 7), floors: 3, palette: 'brick', doors: [{ offset: 0, lotId: 'wk_n2' }], seed: 9 },
    // 武康路西北侧：老洋房与小店
    { id: 'ww1', kind: 'garden_villa', box: frontage(wukang, 26, 'L', 12, 9, 5), floors: 3, palette: 'cream', doors: [{ offset: 0 }], setback: 5, seed: 10 },
    { id: 'ww2', kind: 'shop', box: frontage(wukang, 42, 'L', 9, 7), floors: 2, palette: 'brick', doors: [{ offset: 0, lotId: 'wk_w1' }], seed: 11 },
    { id: 'ww3', kind: 'shop', box: frontage(wukang, 52.5, 'L', 9, 7), floors: 2, palette: 'cream', doors: [{ offset: 0, lotId: 'wk_w2' }], seed: 12 },
    { id: 'ww4', kind: 'garden_villa', box: frontage(wukang, 68, 'L', 12, 9, 5), floors: 3, palette: 'white', doors: [{ offset: 0 }], setback: 5, seed: 13 },
    { id: 'ww5', kind: 'shop', box: frontage(wukang, 84, 'L', 9, 7), floors: 2, palette: 'pink', doors: [{ offset: 0, lotId: 'wk_w3' }], seed: 14 },
    { id: 'ww6', kind: 'shop', box: frontage(wukang, 94.5, 'L', 9, 7), floors: 2, palette: 'cream', doors: [{ offset: 0, lotId: 'wk_w4' }], seed: 15 },
    // 武康路东南侧（大楼以北）
    { id: 'we1', kind: 'shop', box: frontage(wukang, 83, 'R', 9, 7), floors: 2, palette: 'cream', doors: [{ offset: 0, lotId: 'wk_e1' }], seed: 16 },
    { id: 'we2', kind: 'shikumen_row', box: frontage(wukang, 96, 'R', 12, 8), floors: 2, palette: 'grey', doors: [{ offset: -3 }, { offset: 3, lotId: 'wk_e2' }], seed: 17 },
  ],
  props: [],
  spawn: v(20, -8.4),
};
