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
