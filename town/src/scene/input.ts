import { LOW_GFX } from './quality';

/** 虚拟摇杆等 UI 输入（非 React 状态，供每帧读取） */
export const input = { joyX: 0, joyY: 0, run: false };

/** 镜头远近（1 = 默认；越小越近）。滚轮、双指捏合、键盘 + / -、屏幕上的 ＋ / － 按钮都改这里 */
export const CAM_MIN = 0.4;
export const CAM_MAX = LOW_GFX ? 1.6 : 2.1;
export const cam = { dist: 1 };
export function zoomBy(f: number) { cam.dist = Math.max(CAM_MIN, Math.min(CAM_MAX, cam.dist * f)); }
