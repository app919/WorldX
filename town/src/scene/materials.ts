import { Color, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { asphaltTex, brickPaveTex, brickWallTex, grassTex, greyBrickTex, roofTileTex, soilTex, stuccoTex, tileTex } from './textures';

/**
 * 材质库：不同对象使用不同材质 —— 沥青、石材、砖、灰泥、玻璃、金属、植物。
 * 整体仍然是“奶油软陶”调性：高粗糙度、柔和颜色；玻璃和车漆带反射，让画面更精致。
 */
const clay = (color: string, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, ...extra });

let built: ReturnType<typeof buildMaterials> | null = null;

function buildMaterials() {
  return {
    asphalt: clay('#ffffff', { map: asphaltTex(), roughness: 0.95 }),
    tileGrey: clay('#ffffff', { map: tileTex('grey') }),
    tileCream: clay('#ffffff', { map: tileTex('cream') }),
    brickPave: clay('#ffffff', { map: brickPaveTex() }),
    curb: clay('#E4E0D8', { roughness: 0.7 }),
    curbDark: clay('#B9B3AA'),
    grass: clay('#ffffff', { map: grassTex() }),
    soil: clay('#ffffff', { map: soilTex() }),
    paint: clay('#FBFAF5', { roughness: 0.6 }),
    paintYellow: clay('#F1C95A', { roughness: 0.6 }),
    // 建筑
    brickWall: clay('#ffffff', { map: brickWallTex() }),
    greyBrick: clay('#ffffff', { map: greyBrickTex() }),
    stuccoCream: clay('#ffffff', { map: stuccoTex('#F3E7D3', 'cream') }),
    stuccoWhite: clay('#ffffff', { map: stuccoTex('#F7F3EA', 'white') }),
    stuccoPink: clay('#ffffff', { map: stuccoTex('#F2D6CF', 'pink') }),
    stuccoBlue: clay('#ffffff', { map: stuccoTex('#D9E4EC', 'blue') }),
    stuccoGrey: clay('#ffffff', { map: stuccoTex('#DAD5CC', 'grey') }),
    stone: clay('#EDE6DA', { roughness: 0.75 }),
    stoneDark: clay('#C9C0B2'),
    trim: clay('#FBF8F1', { roughness: 0.6 }),
    roofGrey: clay('#ffffff', { map: roofTileTex('grey') }),
    roofRed: clay('#ffffff', { map: roofTileTex('red') }),
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
  M.shopGlass.emissiveIntensity = 0.15 + night * 0.9;
  M.interior.emissiveIntensity = 0.25 + night * 0.9;
  M.lampHead.emissiveIntensity = night * 2.4;
}
