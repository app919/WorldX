/** 游戏时钟（不依赖 three.js，供 UI 使用） */
export function isNight(hour: number) {
  return hour < 6.5 || hour >= 18.5;
}

export function hourLabel(hour: number) {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const period = h < 5 ? '凌晨' : h < 8 ? '清晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 17 ? '午后' : h < 19 ? '傍晚' : '夜晚';
  return `${period} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 当地时间（小时，带小数）。国内城市都在东八区，默认 Asia/Shanghai */
export function localHour(tz = 'Asia/Shanghai', now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h + m / 60;
}

/** 工作时间（默认 9:00–18:00）。非工作时间照常可以发消息；双方都在线时照常聊天，不受影响 */
export const WORK_HOURS = { start: 9, end: 18 } as const;
export const isWorkTime = (hour: number) => hour >= WORK_HOURS.start && hour < WORK_HOURS.end;
