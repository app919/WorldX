import { LOW_GFX } from './quality';

/** 虚拟摇杆等 UI 输入（非 React 状态，供每帧读取） */
export const input = { joyX: 0, joyY: 0, run: false };

/** 镜头远近（1 = 默认；越小越近）。滚轮、双指捏合、键盘 + / -、屏幕上的 ＋ / － 按钮都改这里 */
export const CAM_MIN = 0.4;
export const CAM_MAX = LOW_GFX ? 1.6 : 2.1;
export type ViewMode = 'top' | 'chase' | 'fp';
export const VIEW_LABEL: Record<ViewMode, string> = { top: '俯视', chase: '跟随', fp: '第一人称' };
/**
 * 镜头：dist 远近；mode 视角（俯视 / 跟随角色身后 / 第一人称）；yaw / pitch 跟随与第一人称时的朝向（鼠标拖动、Q / E 转身）
 */
export const cam = { dist: 1, mode: 'top' as ViewMode, yaw: 0, pitch: -0.08, listeners: new Set<() => void>() };
export function setView(m: ViewMode, heading?: number) {
  if (m !== 'top' && cam.mode === 'top' && heading !== undefined) cam.yaw = heading;
  cam.mode = m; cam.pitch = m === 'fp' ? -0.05 : -0.12;
  cam.listeners.forEach((f) => f());
}
export function cycleView(heading?: number) { setView(cam.mode === 'top' ? 'chase' : cam.mode === 'chase' ? 'fp' : 'top', heading); }
export function zoomBy(f: number) { cam.dist = Math.max(CAM_MIN, Math.min(CAM_MAX, cam.dist * f)); }

/** 当前渲染镜头（测试读取位置用） */
export const camRef: { current: { position: { x: number; y: number; z: number } } | null } = { current: null };
