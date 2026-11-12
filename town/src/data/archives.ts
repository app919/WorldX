/**
 * 重点建筑与街道地标的数字档案。只收录较确定的公开信息，不确定的写“待核实”。
 * 模型状态均为“待人工审核”：需对照授权实景照片逐项校准后才能标记 approved。
 */
import type { GeoPoint } from './geo';

export interface Archive {
  id: string;
  name: string;
  nameEn: string;
  address: string;
  geo: GeoPoint;
  era: string;
  architect?: string;
  style: string;
  features: string[];
  story: string;
  modelVersion: string;
  reviewStatus: 'draft' | 'pending_review' | 'approved';
  reviewNotes: string;
  commercial: boolean;
}

const approx = (lat: number, lng: number): GeoPoint => ({ lat, lng, crs: 'WGS84', accuracy: 'approx_100m' });

export const ARCHIVES: Archive[] = [
  {
    id: 'wukang_mansion', name: '武康大楼', nameEn: 'Wukang Mansion (former Normandie Apartments)',
    address: '淮海中路 1842–1858 号（淮海中路与武康路交汇处）', geo: approx(31.2049, 121.4372),
    era: '1924 年建成', architect: '邬达克（László Hudec）', style: '法国文艺复兴风格公寓，熨斗形（船形）平面',
    features: ['锐角船形转角朝向路口', '底层连续外廊（拱廊）', '红砖主体与浅色基座、顶层', '成对白色窗框与转角阳台'],
    story: '原名诺曼底公寓，是上海最有辨识度的街角建筑之一，也是武康路 CityWalk 的起点。',
    modelVersion: 'q-0.2', reviewStatus: 'pending_review',
    reviewNotes: 'Q 版按公开照片特征建模：层数分段（2+5+1）、窗洞节奏、拱数与转角弧度需对照授权实景照片校准。',
    commercial: false,
  },
  {
    id: 'soong_residence', name: '宋庆龄故居', nameEn: "Soong Ching-ling's Former Residence",
    address: '淮海中路 1843 号', geo: approx(31.2038, 121.4392), era: '20 世纪 20 年代前后建成（具体年份待核实）',
    style: '花园洋房', features: ['独立花园洋房', '草坪与树木环绕'],
    story: '宋庆龄 1949–1963 年在此居住和工作，现为纪念馆。文保建筑，游戏内只做参观介绍，不设商业铺位。',
    modelVersion: 'q-0.2', reviewStatus: 'pending_review', reviewNotes: '屋顶形式、立面颜色、门窗位置需按照片校准。', commercial: false,
  },
];

export const archiveById = (id: string) => ARCHIVES.find((a) => a.id === id);
