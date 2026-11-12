/**
 * 坐标转换层：真实坐标 ↔ 游戏坐标分开管理。
 *
 *   经纬度 (WGS84 / GCJ-02)  ──project()──▶  局部平面米制 ENU  ──toGame()──▶  游戏局部坐标
 *
 * 合规说明（重要）：
 * - 国内公开地图服务通常使用 GCJ-02。本项目 **不内置** 任何坐标纠偏算法，
 *   接入地图服务商时应使用其官方 SDK / 授权数据完成转换，并记录 crs 字段。
 * - 正式商业上线前，地图底图与建筑矢量数据需取得相应授权，遵循测绘资质与服务条款；
 *   禁止把地图截图直接当作商业游戏素材，禁止随意抓取地图建筑数据。
 * - 当前 Demo 中的经纬度均为“近似值（约百米级）”，只用于微缩布局，不可用于导航。
 */

export type Crs = 'WGS84' | 'GCJ02';

export interface GeoPoint {
  lat: number;
  lng: number;
  crs: Crs;
  /** 精度说明：approx_100m = Demo 近似值，survey = 实测/授权数据 */
  accuracy: 'approx_100m' | 'licensed' | 'survey';
}

export interface Projection {
  originLat: number;
  originLng: number;
  /** 微缩比例：1 个游戏单位 = 多少米 */
  metersPerUnit: number;
  /** 绕 Y 轴旋转（弧度），用于让主街道与镜头构图对齐 */
  rotation: number;
}

/** 第一期街区：武康路—安福路—乌鲁木齐中路 */
export const DISTRICT_PROJECTION: Projection = {
  originLat: 31.2090,
  originLng: 121.4415,
  metersPerUnit: 12,
  rotation: 0,
};

const M_PER_DEG_LAT = 110_574;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** 经纬度 → 局部 ENU（米），东为 +x，北为 +y。小范围（几公里）内误差可忽略 */
export function project(p: { lat: number; lng: number }, proj: Projection = DISTRICT_PROJECTION) {
  return {
    east: (p.lng - proj.originLng) * mPerDegLng(proj.originLat),
    north: (p.lat - proj.originLat) * M_PER_DEG_LAT,
  };
}

export function unproject(enu: { east: number; north: number }, proj: Projection = DISTRICT_PROJECTION) {
  return {
    lat: proj.originLat + enu.north / M_PER_DEG_LAT,
    lng: proj.originLng + enu.east / mPerDegLng(proj.originLat),
  };
}

/** ENU（米）→ 游戏坐标（three.js：x 向东，-z 向北） */
export function toGame(p: { lat: number; lng: number }, proj: Projection = DISTRICT_PROJECTION) {
  const { east, north } = project(p, proj);
  const x = east / proj.metersPerUnit;
  const z = -north / proj.metersPerUnit;
  const c = Math.cos(proj.rotation), s = Math.sin(proj.rotation);
  return { x: x * c - z * s, z: x * s + z * c };
}

export function fromGame(g: { x: number; z: number }, proj: Projection = DISTRICT_PROJECTION) {
  const c = Math.cos(-proj.rotation), s = Math.sin(-proj.rotation);
  const x = g.x * c - g.z * s;
  const z = g.x * s + g.z * c;
  return unproject({ east: x * proj.metersPerUnit, north: -z * proj.metersPerUnit }, proj);
}

/** 两点的真实距离（米），用于“离你 xx 米”这类展示 */
export function realDistanceMeters(a: { x: number; z: number }, b: { x: number; z: number }, proj: Projection = DISTRICT_PROJECTION) {
  return Math.hypot(a.x - b.x, a.z - b.z) * proj.metersPerUnit;
}
