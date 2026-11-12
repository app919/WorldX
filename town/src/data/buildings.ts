/**
 * 建筑数字档案 + 街道骨架 + 可开店铺位。
 *
 * 规则：
 * - 重点建筑：真实名称 / 地址 / 年代等仅收录较确定的公开信息；不确定的一律写“待核实”。
 * - 每栋建筑都有 reviewStatus。当前 Q 版模型是“特征简化版”，必须对照实地照片人工审核后才能标记 approved。
 * - 不凭空编造历史建筑外观：模型只表达公认的体量特征（如武康大楼的熨斗形平面、底层外廊），
 *   细节等待照片资料补齐（photos 字段）。
 * - 普通建筑（生活街屋、店铺）由程序化生成，与真实门牌无对应关系。
 */
import { type GeoPoint, toGame } from './geo';

export type LandmarkModel = 'wukang_mansion' | 'garden_villa' | 'lane_cluster' | 'theatre' | 'villa_red';

export interface BuildingArchive {
  id: string;
  name: string;
  nameEn: string;
  address: string;
  geo: GeoPoint;
  era: string;
  architect?: string;
  style: string;
  facadeFeatures: string[];
  palette: string[];
  story: string;
  /** 建筑正面/侧面/屋顶照片（授权素材链接），Demo 阶段为空 */
  photos: { front?: string; side?: string; roof?: string };
  model: LandmarkModel;
  modelVersion: string;
  reviewStatus: 'draft' | 'pending_review' | 'approved';
  reviewNotes: string;
  /** 游戏内朝向（弧度）与占地尺寸 */
  rotation: number;
  footprint: { w: number; d: number };
  /** 商业定位（街区规划，不代表建筑内真实商户） */
  businessRole: string;
}

const approx = (lat: number, lng: number): GeoPoint => ({ lat, lng, crs: 'WGS84', accuracy: 'approx_100m' });

export const LANDMARKS: BuildingArchive[] = [
  {
    id: 'wukang_mansion',
    name: '武康大楼',
    nameEn: 'Wukang Mansion (former Normandie Apartments)',
    address: '淮海中路 1842–1858 号（武康路、淮海中路交汇处）',
    geo: approx(31.2057, 121.4366),
    era: '1924 年建成',
    architect: '邬达克（László Hudec）',
    style: '法国文艺复兴风格公寓，熨斗形平面',
    facadeFeatures: ['三角形“熨斗”平面，锐角朝向路口', '底层连续外廊（骑楼）', '红砖与浅色饰面', '顶部檐口与阳台'],
    palette: ['#C98068', '#F4EBDA', '#8E5A47'],
    story: '原名诺曼底公寓，是上海最有辨识度的街角建筑之一，也是武康路 CityWalk 的起点。',
    photos: {},
    model: 'wukang_mansion',
    modelVersion: 'q-0.1',
    reviewStatus: 'pending_review',
    reviewNotes: 'Q 版简化：层数、窗洞节奏、外廊拱数需对照实景照片校准。',
    rotation: 0.55,
    footprint: { w: 9, d: 7 },
    businessRole: '城市漫步起点 · 建筑打卡',
  },
  {
    id: 'soong_residence',
    name: '宋庆龄故居',
    nameEn: "Soong Ching-ling's Former Residence",
    address: '淮海中路 1843 号',
    geo: approx(31.2038, 121.4392),
    era: '20 世纪 20 年代前后建成（具体年份待核实）',
    style: '花园洋房',
    facadeFeatures: ['独立花园洋房', '大草坪与树木环绕'],
    palette: ['#F4EBDA', '#86A57C', '#6F6A63'],
    story: '宋庆龄 1949–1963 年在此居住和工作，现为纪念馆。',
    photos: {},
    model: 'garden_villa',
    modelVersion: 'q-0.1',
    reviewStatus: 'pending_review',
    reviewNotes: '屋顶形式、立面颜色、门窗位置均需按照片校准；文保建筑，游戏内只做参观介绍，不设商业铺位。',
    rotation: 0,
    footprint: { w: 7, d: 6 },
    businessRole: '文化参观（非商业）',
  },
  {
    id: 'ferguson_lane',
    name: '武康庭',
    nameEn: 'Ferguson Lane',
    address: '武康路 376 号',
    geo: approx(31.2078, 121.4376),
    era: '待核实',
    style: '低层院落式商业空间',
    facadeFeatures: ['内院', '低层建筑围合', '户外座位'],
    palette: ['#F4EBDA', '#C98068', '#A47B5B'],
    story: '武康路上的院落式小商业空间，适合咖啡、设计与生活方式小店聚集。',
    photos: {},
    model: 'lane_cluster',
    modelVersion: 'q-0.1',
    reviewStatus: 'pending_review',
    reviewNotes: '院落布局为示意，需按实景照片与授权平面校准。',
    rotation: -0.25,
    footprint: { w: 8, d: 7 },
    businessRole: '设计 · 文化 · 生活方式',
  },
  {
    id: 'bajin_residence',
    name: '巴金故居',
    nameEn: "Ba Jin's Former Residence",
    address: '武康路 113 号',
    geo: approx(31.2117, 121.4381),
    era: '1923 年前后建成（待核实）',
    style: '花园洋房',
    facadeFeatures: ['独立花园住宅', '前院草坪'],
    palette: ['#F4EBDA', '#86A57C', '#8E5A47'],
    story: '作家巴金 1955 年起在此居住直至 2005 年，现为纪念馆。',
    photos: {},
    model: 'villa_red',
    modelVersion: 'q-0.1',
    reviewStatus: 'pending_review',
    reviewNotes: '立面颜色与屋顶需按照片校准；文保建筑，只做参观介绍。',
    rotation: 0.1,
    footprint: { w: 7, d: 6 },
    businessRole: '文学参观（非商业）',
  },
  {
    id: 'drama_center',
    name: '上海话剧艺术中心',
    nameEn: 'Shanghai Dramatic Arts Centre',
    address: '安福路 288 号',
    geo: approx(31.2139, 121.4436),
    era: '待核实',
    style: '现代剧场建筑（外观待核实）',
    facadeFeatures: ['剧场主入口', '海报墙'],
    palette: ['#A9A39A', '#C98068', '#DCE6EE'],
    story: '安福路的文化地标，周边聚集了大量咖啡馆与小店，是城市社交的热点。',
    photos: {},
    model: 'theatre',
    modelVersion: 'q-0.1',
    reviewStatus: 'draft',
    reviewNotes: '外观仅为体块示意，必须补充实景照片后重新建模。',
    rotation: 0,
    footprint: { w: 9, d: 6 },
    businessRole: '文化 · 创意 · 社交',
  },
];

/** 街道骨架（近似经纬度，正式版替换为授权 GIS 路网） */
export interface Road {
  id: string;
  name: string;
  width: number;
  points: GeoPoint[];
}

export const ROADS: Road[] = [
  {
    id: 'wukang_rd', name: '武康路', width: 3.2,
    points: [approx(31.2049, 121.4377), approx(31.2076, 121.4389), approx(31.2104, 121.4389), approx(31.2128, 121.4392), approx(31.2156, 121.4386)],
  },
  {
    id: 'anfu_rd', name: '安福路', width: 3.0,
    points: [approx(31.2128, 121.4392), approx(31.2131, 121.4425), approx(31.2133, 121.4462), approx(31.2135, 121.4492)],
  },
  {
    id: 'urumqi_rd', name: '乌鲁木齐中路', width: 3.4,
    points: [approx(31.2068, 121.4462), approx(31.2100, 121.4462), approx(31.2133, 121.4462), approx(31.2162, 121.4460)],
  },
  {
    id: 'huaihai_rd', name: '淮海中路', width: 4.2,
    points: [approx(31.2052, 121.4340), approx(31.2049, 121.4377), approx(31.2058, 121.4420), approx(31.2068, 121.4462), approx(31.2076, 121.4500)],
  },
  {
    id: 'hunan_rd', name: '湖南路（示意）', width: 2.6,
    points: [approx(31.2104, 121.4389), approx(31.2104, 121.4430), approx(31.2100, 121.4462)],
  },
];

export interface GameRoad { id: string; name: string; width: number; pts: { x: number; z: number }[] }
export const GAME_ROADS: GameRoad[] = ROADS.map((r) => ({ id: r.id, name: r.name, width: r.width, pts: r.points.map((p) => toGame(p)) }));

export interface GameLandmark extends BuildingArchive { pos: { x: number; z: number } }
export const GAME_LANDMARKS: GameLandmark[] = LANDMARKS.map((b) => ({ ...b, pos: toGame(b.geo) }));

/** 点到线段的距离 */
export function distToSegment(p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return { d: Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)), t };
}

export function distToRoads(p: { x: number; z: number }) {
  let best = Infinity;
  for (const r of GAME_ROADS) for (let i = 0; i < r.pts.length - 1; i++) best = Math.min(best, distToSegment(p, r.pts[i], r.pts[i + 1]).d - r.width / 2);
  return best;
}

/** 可开店铺位：沿安福路 / 乌鲁木齐中路 / 武康路的程序化小店 */
export interface ShopLot { id: string; road: string; pos: { x: number; z: number }; rotation: number }

function lotsAlong(roadId: string, count: number, offset: number, startT = 0.12, endT = 0.88): ShopLot[] {
  const r = GAME_ROADS.find((x) => x.id === roadId)!;
  const out: ShopLot[] = [];
  // 按总长度等距
  const segs = r.pts.slice(1).map((p, i) => ({ a: r.pts[i], b: p, len: Math.hypot(p.x - r.pts[i].x, p.z - r.pts[i].z) }));
  const total = segs.reduce((s, x) => s + x.len, 0);
  for (let k = 0; k < count; k++) {
    let d = total * (startT + ((endT - startT) * k) / Math.max(1, count - 1));
    const side = k % 2 === 0 ? 1 : -1;
    for (const s of segs) {
      if (d <= s.len) {
        const t = d / s.len;
        const ux = (s.b.x - s.a.x) / s.len, uz = (s.b.z - s.a.z) / s.len;
        const nx = -uz * side, nz = ux * side;
        const pos = { x: s.a.x + ux * d + nx * (r.width / 2 + offset), z: s.a.z + uz * d + nz * (r.width / 2 + offset) };
        void t;
        out.push({ id: `${roadId}_${k}`, road: r.name, pos, rotation: Math.atan2(-nx, -nz) });
        break;
      }
      d -= s.len;
    }
  }
  return out;
}

export const SHOP_LOTS: ShopLot[] = [
  ...lotsAlong('anfu_rd', 8, 2.6),
  ...lotsAlong('urumqi_rd', 6, 2.6, 0.2, 0.8),
  ...lotsAlong('hunan_rd', 4, 2.4, 0.2, 0.8),
].filter((l) => distToRoads(l.pos) > 2 && GAME_LANDMARKS.every((b) => Math.hypot(b.pos.x - l.pos.x, b.pos.z - l.pos.z) > 8));

export const SPAWN_POINTS = [
  { id: 'wukang_mansion', label: '武康大楼', desc: '从最经典的街角出发' },
  { id: 'anfu', label: '安福路', desc: '咖啡、潮流与社交' },
  { id: 'ferguson_lane', label: '武康庭', desc: '院子里的设计小店' },
] as const;

export function spawnPosition(id: string): { x: number; z: number } {
  if (id === 'anfu') {
    const r = GAME_ROADS.find((x) => x.id === 'anfu_rd')!;
    return { x: (r.pts[1].x + r.pts[2].x) / 2, z: (r.pts[1].z + r.pts[2].z) / 2 };
  }
  const lm = GAME_LANDMARKS.find((b) => b.id === id) ?? GAME_LANDMARKS[0];
  // 站到建筑最近的路上
  let best = { x: lm.pos.x, z: lm.pos.z, d: Infinity };
  for (const r of GAME_ROADS) for (let i = 0; i < r.pts.length - 1; i++) {
    const a = r.pts[i], b = r.pts[i + 1];
    const { d, t } = distToSegment(lm.pos, a, b);
    if (d < best.d) best = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, d };
  }
  return { x: best.x, z: best.z };
}

/** 自动 CityWalk 路线：武康大楼 → 武康庭 → 巴金故居 → 安福路 → 乌鲁木齐中路 */
export function cityWalkRoute(): { x: number; z: number }[] {
  const w = GAME_ROADS.find((r) => r.id === 'wukang_rd')!.pts;
  const a = GAME_ROADS.find((r) => r.id === 'anfu_rd')!.pts;
  const u = GAME_ROADS.find((r) => r.id === 'urumqi_rd')!.pts;
  return [w[0], w[1], w[2], w[3], a[1], a[2], u[1], u[0]];
}
