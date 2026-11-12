import type { DistrictKey } from '../domain/commerce';
import type { OBB, V2 } from './geom';

/**
 * 街区数据格式（手工编写 + 程序化补全）。
 * 道路采用城市道路横断面：建筑退界/绿化 | 人行道 | 路缘石 | 机动车道 | 路缘石 | 人行道 | 建筑退界/绿化
 */

export interface RoadDef {
  id: string;
  name: string;
  a: V2;
  b: V2;
  /** 机动车道总宽 */
  carriage: number;
  /** 单侧人行道宽 */
  sidewalk: number;
  lanes: number;
  /** 中心线：双黄实线 / 白色虚线 / 无（单行或窄路） */
  centerLine: 'double_yellow' | 'dashed' | 'none';
  oneWay?: boolean;
  /** 行道树树种 */
  trees: TreeSpecies | 'none';
  /** 树间距（游戏单位） */
  treeSpacing: number;
  /** 人行道铺装 */
  paving: 'tile_cream' | 'tile_grey' | 'brick_red';
  /** 两端是否在路口截断人行道（与其他道路相交处由路口转角广场衔接） */
  note?: string;
}

export interface CrosswalkDef { road: string; t: number; width: number }

export type TreeSpecies = 'plane' | 'osmanthus' | 'camphor' | 'ginkgo';

export type BuildingKind =
  | 'wukang_mansion' | 'garden_villa' | 'shikumen_row' | 'artdeco' | 'arcade'
  | 'workers_housing' | 'market_hall' | 'shop' | 'civic';

export interface DoorDef {
  /** 门在建筑正面（局部 +z 面）的横向偏移 */
  offset: number;
  /** 绑定的铺位（可开店 / 已入驻主体）；无则是住宅门 */
  lotId?: string;
  label?: string;
}

export interface BuildingDef {
  id: string;
  kind: BuildingKind;
  /** 占地（局部 +z 面为正立面，朝向街道） */
  box?: OBB;
  /** 不规则占地（武康大楼） */
  polygon?: V2[];
  floors: number;
  name?: string;
  palette?: 'cream' | 'brick' | 'grey' | 'white' | 'pink' | 'blue';
  doors: DoorDef[];
  /** 门前通往人行道的通道长度（建筑退界） */
  setback?: number;
  /** 重点建筑档案 id */
  archiveId?: string;
  seed?: number;
}

export interface AreaDef {
  id: string;
  kind: 'plaza' | 'lawn' | 'flowerbed' | 'courtyard' | 'parking' | 'bike_zone' | 'wall';
  box?: OBB;
  polygon?: V2[];
  label?: string;
}

export interface PropDef {
  kind: 'bench' | 'hydrant' | 'bin' | 'lamp' | 'mailbox' | 'bus_stop' | 'fitness' | 'planter' | 'poem_wall' | 'stall' | 'umbrella_table' | 'bike' | 'car' | 'tree' | 'shrub';
  p: V2;
  rot?: number;
  species?: TreeSpecies;
  scale?: number;
  text?: string;
  color?: string;
}

export interface DistrictDef {
  id: DistrictKey;
  name: string;
  subtitle: string;
  /** 参考中心点（WGS84 近似值，仅用于说明，布局为示意） */
  geoRef: { lat: number; lng: number; note: string };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roads: RoadDef[];
  crosswalks: CrosswalkDef[];
  /** 路口转角、街角广场等额外的可步行区域 */
  areas: AreaDef[];
  buildings: BuildingDef[];
  props: PropDef[];
  spawn: V2;
  /** 地面风格 */
  ground: 'grass' | 'paving';
  ambience: string;
}
