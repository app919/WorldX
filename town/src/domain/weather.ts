/**
 * 天气：跟当地天气预报走，只用四种 —— 晴、阴、雨、雪。
 * 每天凌晨 3 点（当地时间）查第二天的逐小时预报，取当天出现时间最长的天气作为游戏天气。
 * 数据源：Open-Meteo（免费、无需密钥、开源、长期可用）；拿不到预报时用“晴”。
 */
export type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'snow';
export const WEATHER_LABEL: Record<WeatherKind, string> = { sunny: '晴', cloudy: '阴', rain: '雨', snow: '雪' };
export const WEATHER_ICON: Record<WeatherKind, string> = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️' };

/** WMO 天气代码 → 四种天气 */
export function wmoToKind(code: number): WeatherKind {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if (code >= 2) return 'cloudy'; // 2 多云、3 阴、45/48 雾
  return 'sunny'; // 0 晴、1 少云
}

/** 一天里出现时间最长的天气（平局时：雪 > 雨 > 阴 > 晴，更有“天气感”） */
export function dominantKind(hourlyCodes: number[]): WeatherKind {
  const count: Record<WeatherKind, number> = { sunny: 0, cloudy: 0, rain: 0, snow: 0 };
  for (const c of hourlyCodes) count[wmoToKind(c)]++;
  const order: WeatherKind[] = ['snow', 'rain', 'cloudy', 'sunny'];
  return order.reduce((best, k) => (count[k] > count[best] ? k : best), order[0]);
}

export type CityId = 'shanghai' | 'beijing' | 'shenzhen' | 'changsha' | 'chengdu';
/** 城市坐标（城区中心，WGS84 近似值） */
export const CITY_GEO: Record<CityId, { lat: number; lng: number }> = {
  shanghai: { lat: 31.23, lng: 121.47 },
  beijing: { lat: 39.94, lng: 116.40 },
  shenzhen: { lat: 22.54, lng: 114.09 },
  changsha: { lat: 28.19, lng: 112.98 },
  chengdu: { lat: 30.66, lng: 104.08 },
};

/** Open-Meteo 逐小时预报地址（东八区；2 天，含今天和明天） */
export const forecastUrl = (c: CityId) => {
  const g = CITY_GEO[c];
  return `https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lng}&hourly=weather_code&timezone=Asia%2FShanghai&forecast_days=2`;
};

/** 从预报里取某一天（YYYY-MM-DD）的天气 */
export function kindForDay(json: { hourly?: { time?: string[]; weather_code?: number[] } }, day: string): WeatherKind | undefined {
  const t = json.hourly?.time ?? [], c = json.hourly?.weather_code ?? [];
  const codes = t.map((x, i) => (x.startsWith(day) ? c[i] : undefined)).filter((x): x is number => typeof x === 'number');
  return codes.length ? dominantKind(codes) : undefined;
}

/** 东八区的日期（YYYY-MM-DD），offsetDays = 1 表示明天 */
export function cnDate(now = new Date(), offsetDays = 0): string {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
