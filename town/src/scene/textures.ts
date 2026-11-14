/**
 * 程序化贴图（Canvas 生成，无需外部图片资源）：沥青、人行道砖、红砖铺地、清水红砖墙、石材、屋瓦、招牌文字。
 * 统一做成“奶油软陶”的柔和版本：纹理存在，但对比度克制。
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { rng } from '../world/geom';
import { BADGE_ROLE, ROLE_COLORS } from '../domain/palette';

const cache = new Map<string, Texture>();

function make(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = true): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; }
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function noise(g: CanvasRenderingContext2D, s: number, n: number, colors: string[], r: [number, number], seed = 1) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(R() * colors.length)];
    const rr = r[0] + R() * (r[1] - r[0]);
    g.beginPath(); g.arc(R() * s, R() * s, rr, 0, Math.PI * 2); g.fill();
  }
}

export const asphaltTex = () => make('asphalt', 256, (g, s) => {
  g.fillStyle = '#8E8A88'; g.fillRect(0, 0, s, s);
  noise(g, s, 2600, ['#85817F', '#97938F', '#7D7977', '#A19C97'], [0.6, 1.6], 3);
});

export const tileTex = (tone: 'cream' | 'grey') => make(`tile_${tone}`, 256, (g, s) => {
  const base = tone === 'cream' ? '#EFE4D2' : '#D9D5CF';
  const line = tone === 'cream' ? '#DCCFB9' : '#C3BEB6';
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  noise(g, s, 900, tone === 'cream' ? ['#E8DCC8', '#F4EBDD'] : ['#D2CDC6', '#E0DCD6'], [0.5, 1.2], 5);
  g.strokeStyle = line; g.lineWidth = 3;
  const step = s / 4;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, s); g.stroke(); g.beginPath(); g.moveTo(0, i * step); g.lineTo(s, i * step); g.stroke(); }
});

export const brickPaveTex = () => make('brickpave', 256, (g, s) => {
  g.fillStyle = '#CFA392'; g.fillRect(0, 0, s, s);
  const R = rng(9);
  const bw = s / 4, bh = s / 8;
  for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) {
    const x = i * bw + (j % 2 ? bw / 2 : 0);
    const shade = ['#C9907D', '#D4A796', '#C59886', '#D9AF9F'][Math.floor(R() * 4)];
    g.fillStyle = shade; g.fillRect(x + 2, j * bh + 2, bw - 4, bh - 4);
  }
});

export const brickWallTex = () => make('brickwall', 256, (g, s) => {
  g.fillStyle = '#E3D2C4'; g.fillRect(0, 0, s, s);
  const R = rng(17);
  const bw = s / 8, bh = s / 16;
  for (let j = 0; j < 16; j++) for (let i = -1; i < 9; i++) {
    const x = i * bw + (j % 2 ? bw / 2 : 0);
    g.fillStyle = ['#B8644C', '#C2705A', '#AE5D47', '#C77B63', '#B46A52'][Math.floor(R() * 5)];
    g.fillRect(x + 1.5, j * bh + 1.5, bw - 3, bh - 3);
  }
});

export const greyBrickTex = () => make('greybrick', 256, (g, s) => {
  g.fillStyle = '#D6D1C9'; g.fillRect(0, 0, s, s);
  const R = rng(23);
  const bw = s / 8, bh = s / 16;
  for (let j = 0; j < 16; j++) for (let i = -1; i < 9; i++) {
    const x = i * bw + (j % 2 ? bw / 2 : 0);
    g.fillStyle = ['#8F8B86', '#9A9690', '#86827D', '#A39F99'][Math.floor(R() * 4)];
    g.fillRect(x + 1.5, j * bh + 1.5, bw - 3, bh - 3);
  }
  // 石库门常见的红砖腰线
  g.fillStyle = '#B8644C'; g.fillRect(0, s * 0.5 - 4, s, 8);
});

export const stuccoTex = (tone: string, key: string) => make(`stucco_${key}`, 128, (g, s) => {
  g.fillStyle = tone; g.fillRect(0, 0, s, s);
  noise(g, s, 500, ['rgba(255,255,255,0.18)', 'rgba(120,100,80,0.06)'], [0.5, 1.5], key.length);
});

export const roofTileTex = (tone: 'grey' | 'red') => make(`roof_${tone}`, 128, (g, s) => {
  g.fillStyle = tone === 'grey' ? '#6E6A68' : '#B06650'; g.fillRect(0, 0, s, s);
  g.strokeStyle = tone === 'grey' ? '#5D5957' : '#9A5643'; g.lineWidth = 2;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    g.beginPath(); g.arc(i * 16 + (j % 2) * 8 + 8, j * 16 + 16, 8, Math.PI, 0); g.stroke();
  }
});

export const grassTex = () => make('grass', 256, (g, s) => {
  g.fillStyle = '#A8C985'; g.fillRect(0, 0, s, s);
  noise(g, s, 3000, ['#9EC17A', '#B3D290', '#94B972', '#BCD89B'], [0.6, 1.8], 31);
});

export const soilTex = () => make('soil', 64, (g, s) => {
  g.fillStyle = '#9B7E63'; g.fillRect(0, 0, s, s);
  noise(g, s, 200, ['#8C705A', '#A88B6F'], [0.6, 1.5], 41);
});

/** 店铺屋顶颜色 = 全站身份色（见 domain/palette.ts） */
export type { ShopCategory } from '../domain/palette';
export const ROOF_COLORS = ROLE_COLORS;

/** 招牌：圆角底板 + 文字（中文使用系统字体） */
export function signTex(text: string, bg: string, fg: string, w = 512, h = 128): Texture {
  // 文字以「例|」「企|」「投|」「品|」「赞|」开头时，在招牌左上角画角标（颜色 = 身份色）
  const badge = /^(企|赞|例|投|品)\|/.test(text) ? text[0] : '';
  const body = badge ? text.slice(2) : text;
  return make(`sign_${text}_${bg}_${fg}_${w}`, w, (g) => {
    g.canvas.height = h;
    g.fillStyle = bg;
    const r = h * 0.3;
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, r); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4; g.stroke();
    g.fillStyle = fg;
    g.font = `bold ${Math.round(h * 0.46)}px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = Math.round(h * 0.46);
    while (g.measureText(body).width > w - (badge ? 120 : 40) && size > 14) { size -= 2; g.font = `bold ${size}px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif`; }
    g.fillText(body, w / 2, h / 2 + 2);
    // 角标：例 = 系统示范（粉）；企 = 公司（蓝）；投 = 投资人（黑）；品 / 赞 = 品牌（金）
    if (badge) {
      g.fillStyle = ROLE_COLORS[BADGE_ROLE[badge]];
      g.beginPath(); g.moveTo(4, 4); g.lineTo(h * 0.95, 4); g.lineTo(4, h * 0.95); g.closePath(); g.fill();
      g.fillStyle = '#FFFFFF';
      g.font = `bold ${Math.round(h * 0.3)}px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif`;
      g.fillText(badge, h * 0.27, h * 0.3);
    }
  }, false);
}

/** 道路文字（“P”等） */
export function paintTex(text: string): Texture {
  return make(`paint_${text}`, 128, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = `bold ${s * 0.7}px sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, s / 2, s / 2 + 4);
  }, false);
}

/** 路面路名：白色半透明喷涂字，带一点磨损 */
export function roadNameTex(text: string): Texture {
  return make(`roadname_${text}`, 512, (g) => {
    g.canvas.height = 112;
    g.clearRect(0, 0, 512, 112);
    g.fillStyle = 'rgba(255,255,255,0.86)';
    let size = 76;
    g.font = `900 ${size}px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif`;
    while (g.measureText(text).width > 490 && size > 30) { size -= 4; g.font = `900 ${size}px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 58);
    // 磨损
    g.globalCompositeOperation = 'destination-out';
    const R = rng(text.length * 31);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.5})`; g.fillRect(R() * 512, R() * 112, 2 + R() * 3, 2 + R() * 3); }
    g.globalCompositeOperation = 'source-over';
  }, false);
}

const ROAD_EN: Record<string, string> = {
  淮海中路: 'Middle Huaihai Rd.', 武康路: 'Wukang Rd.', 天平路: 'Tianping Rd.', 兴国路: 'Xingguo Rd.', 安福路: 'Anfu Rd.',
  四川北路: 'N. Sichuan Rd.', 甜爱路: "Tian'ai Rd.", 山阴路: 'Shanyin Rd.', 横浜路: 'Hengbang Rd.', 甜爱支路: "Tian'ai Branch Rd.",
  张杨路: 'Zhangyang Rd.', 源深路: 'Yuanshen Rd.', 羽山路: 'Yushan Rd.', 灵山路: 'Lingshan Rd.', 巨野路: 'Juye Rd.',
};

/** 上海样式的蓝底白字路名牌（附英文路名，示意道路不写英文） */
export function streetPlateTex(name: string): Texture {
  const clean = name.replace('（示意）', '');
  return make(`plate_${name}`, 512, (g) => {
    g.canvas.height = 160;
    g.fillStyle = '#1F4E8C'; g.beginPath(); g.roundRect(0, 0, 512, 160, 14); g.fill();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 6; g.beginPath(); g.roundRect(9, 9, 494, 142, 10); g.stroke();
    g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 70;
    g.font = `bold ${size}px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif`;
    while (g.measureText(clean).width > 450 && size > 30) { size -= 4; g.font = `bold ${size}px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif`; }
    const en = ROAD_EN[clean];
    g.fillText(clean, 256, en ? 64 : 82);
    if (en) { g.font = '600 30px "Helvetica Neue",Arial,sans-serif'; g.fillText(en, 256, 122); }
  }, false);
}
