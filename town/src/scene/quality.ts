/**
 * 画质档位：“流畅模式”适合低端手机 / 无独显电脑（也用于自动化测试）。
 * 开启方式：URL 带 ?lowgfx，或在「我的」里打开（保存在本机浏览器）。
 */
function readLow(): boolean {
  try {
    if (typeof location !== 'undefined' && location.search.includes('lowgfx')) return true;
    return localStorage.getItem('opc-town-lowgfx') === '1';
  } catch { return false; }
}
export const LOW_GFX = readLow();
/** 极致画质：4K 阴影、全分辨率高质量环境光遮蔽、更远的视距、景深（需要独显或较新的手机） */
function readUltra(): boolean {
  try { return !readLow() && (location.search.includes('ultra') || localStorage.getItem('opc-town-ultra') === '1'); } catch { return false; }
}
export const ULTRA_GFX = readUltra();
export function setUltraGfx(on: boolean) {
  try { localStorage.setItem('opc-town-ultra', on ? '1' : '0'); if (on) localStorage.setItem('opc-town-lowgfx', '0'); } catch { /* 存储不可用时忽略 */ }
  location.reload();
}
/** 建筑 / 街道家具的绘制距离 */
export const DRAW_DIST = LOW_GFX ? 55 : ULTRA_GFX ? 150 : 95;
export function setLowGfx(on: boolean) {
  try { localStorage.setItem('opc-town-lowgfx', on ? '1' : '0'); } catch { /* 存储不可用时忽略 */ }
  location.reload();
}
