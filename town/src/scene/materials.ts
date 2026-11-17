import { Color, MeshPhysicalMaterial, MeshStandardMaterial, Vector2, type Texture } from 'three';
import { asphaltTex, brickPaveTex, brickWallTex, detailMaps, grassTex, greyBrickTex, roofTileTex, soilTex, stuccoTex, tileTex } from './textures';
import { LOW_GFX } from './quality';

/**
 * 材质库：不同对象使用不同材质 —— 沥青、石材、砖、灰泥、玻璃、金属、植物。
 * 整体仍然是“奶油软陶”调性：高粗糙度、柔和颜色；玻璃和车漆带反射，让画面更精致。
 */
const clay = (color: string, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, ...extra });

/** 带凹凸与粗糙度细节的材质（流畅模式下省掉细节贴图） */
const detailed = (key: string, map: Texture, o: { strength?: number; invert?: boolean; rough?: [number, number]; scale?: number } = {}) => {
  if (LOW_GFX) return clay('#ffffff', { map });
  const d = detailMaps(key, map, o);
  return clay('#ffffff', { map, normalMap: d.normal, normalScale: new Vector2(o.scale ?? 1, o.scale ?? 1), roughnessMap: d.rough, roughness: 1 });
};

let built: ReturnType<typeof buildMaterials> | null = null;

function buildMaterials() {
  return {
    asphalt: detailed('asphalt', asphaltTex(), { strength: 1.2, rough: [0.98, 0.82], scale: 0.6 }),
    tileGrey: detailed('tileGrey', tileTex('grey'), { strength: 3, rough: [0.95, 0.72] }),
    tileCream: detailed('tileCream', tileTex('cream'), { strength: 3, rough: [0.95, 0.72] }),
    brickPave: detailed('brickPave', brickPaveTex(), { strength: 3, invert: true, rough: [0.72, 0.98] }),
    curb: clay('#E4E0D8', { roughness: 0.7 }),
    curbDark: clay('#B9B3AA'),
    grass: clay('#ffffff', { map: grassTex() }),
    soil: clay('#ffffff', { map: soilTex() }),
    paint: clay('#FBFAF5', { roughness: 0.6 }),
    paintYellow: clay('#F1C95A', { roughness: 0.6 }),
    // 建筑
    brickWall: detailed('brickWall', brickWallTex(), { strength: 3.5, invert: true, rough: [0.78, 0.98] }),
    greyBrick: detailed('greyBrick', greyBrickTex(), { strength: 3.5, invert: true, rough: [0.8, 0.98] }),
    stuccoCream: detailed('stuccoCream', stuccoTex('#F3E7D3', 'cream'), { strength: 1.4, rough: [0.95, 0.85], scale: 0.5 }),
    stuccoWhite: detailed('stuccoWhite', stuccoTex('#F7F3EA', 'white'), { strength: 1.4, rough: [0.95, 0.85], scale: 0.5 }),
    stuccoPink: detailed('stuccoPink', stuccoTex('#F2D6CF', 'pink'), { strength: 1.4, rough: [0.95, 0.85], scale: 0.5 }),
    stuccoBlue: detailed('stuccoBlue', stuccoTex('#D9E4EC', 'blue'), { strength: 1.4, rough: [0.95, 0.85], scale: 0.5 }),
    stuccoGrey: detailed('stuccoGrey', stuccoTex('#DAD5CC', 'grey'), { strength: 1.4, rough: [0.95, 0.85], scale: 0.5 }),
    stone: clay('#EDE6DA', { roughness: 0.75 }),
    stoneDark: clay('#C9C0B2'),
    trim: clay('#FBF8F1', { roughness: 0.6 }),
    roofGrey: detailed('roofGrey', roofTileTex('grey'), { strength: 4, rough: [0.92, 0.7] }),
    roofRed: detailed('roofRed', roofTileTex('red'), { strength: 4, rough: [0.92, 0.7] }),
    roofFlat: clay('#E6DACA'),
    wood: clay('#9A6F4E'),
    woodDark: clay('#5E4332'),
    door: clay('#4A3426', { roughness: 0.6 }),
    frame: clay('#F8F5EE', { roughness: 0.5 }),
    frameDark: clay('#4E4A47', { roughness: 0.5 }),
    metal: clay('#5E6468', { metalness: 0.5, roughness: 0.45 }),
    metalLight: clay('#C9CDD0', { metalness: 0.4, roughness: 0.4 }),
    /** 玻璃：带环境反射；夜晚由 applyNight 点亮室内暖光 */
    glass: new MeshPhysicalMaterial({ color: '#6C8696', roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1, emissive: new Color('#FFD59A'), emissiveIntensity: 0, envMapIntensity: 1.2 }),
    /** 夜里没开灯 / 拉着窗帘的窗：让一栋楼的窗户亮暗错落，而不是整片一样亮 */
    glassDim: new MeshPhysicalMaterial({ color: '#5E7482', roughness: 0.1, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1, emissive: new Color('#FFC27A'), emissiveIntensity: 0, envMapIntensity: 1.3 }),
    shopGlass: new MeshPhysicalMaterial({ color: '#C7DCE6', roughness: 0.08, metalness: 0.05, clearcoat: 1, transparent: true, opacity: 0.55, emissive: new Color('#FFE2AE'), emissiveIntensity: 0.15 }),
    interior: clay('#F6E3C2', { emissive: new Color('#FFD59A'), emissiveIntensity: 0.25 }),
    lampHead: clay('#FFF4DA', { emissive: new Color('#FFD99A'), emissiveIntensity: 0 }),
    red: clay('#C9493F', { roughness: 0.5 }),
    hedge: clay('#6E9A55'),
    awningCream: clay('#FBF6EC'),
  };
}

export function mats() {
  if (!built) built = buildMaterials();
  return built;
}

/** 每帧由昼夜系统调用 */
export function applyNight(night: number) {
  const M = mats();
  M.glass.emissiveIntensity = night * 0.85;
  M.glassDim.emissiveIntensity = night * 0.12;
  M.shopGlass.emissiveIntensity = 0.15 + night * 0.9;
  M.interior.emissiveIntensity = 0.25 + night * 0.9;
  M.lampHead.emissiveIntensity = night * 2.4;
}

/** 天气对地面的影响：下雨时路面与地砖变湿（更光滑，能倒映天空与灯光） */
let wetNow = -1;
export function applyWet(wet: number) {
  if (Math.abs(wet - wetNow) < 0.01) return;
  wetNow = wet;
  const M = mats();
  for (const m of [M.asphalt, M.tileGrey, M.tileCream, M.brickPave]) {
    m.roughness = 1 - wet * 0.55;
    m.envMapIntensity = 1 + wet * 1.6;
    m.color.setScalar(1 - wet * 0.18); // 湿了颜色更深
  }
}
