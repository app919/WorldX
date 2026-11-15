/**
 * 游戏天气：在线模式读后端（凌晨 3 点查的预报）；离线演示版直接向 Open-Meteo 查今天的逐小时预报（按天缓存在本机）。
 * 拿不到数据时默认晴天。
 */
import { create } from 'zustand';
import { CITY_GEO, cnDate, forecastUrl, kindForDay, type CityId, type WeatherKind } from '../domain/weather';
import { api } from '../net/api';

interface WeatherState {
  day?: string;
  cities: Partial<Record<CityId, WeatherKind>>;
  source: 'server' | 'browser' | 'default';
  load(online: boolean): Promise<void>;
}

const CACHE = 'sanlinbang-weather';

export const useWeather = create<WeatherState>()((set) => ({
  cities: {},
  source: 'default',
  async load(online) {
    const day = cnDate();
    if (online) {
      try {
        const r = await api<{ day: string; cities: Record<CityId, { kind: WeatherKind; source: string }> }>('/api/weather');
        set({ day: r.day, cities: Object.fromEntries(Object.entries(r.cities).map(([k, v]) => [k, v.kind])), source: 'server' });
        return;
      } catch { /* 后端不可用时退回浏览器直查 */ }
    }
    try {
      const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { day: string; cities: Record<CityId, WeatherKind> } | null;
      if (c?.day === day) { set({ day, cities: c.cities, source: 'browser' }); return; }
    } catch { /* 本机存储不可用 */ }
    const out: Partial<Record<CityId, WeatherKind>> = {};
    await Promise.all((Object.keys(CITY_GEO) as CityId[]).map(async (id) => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
        const r = await fetch(forecastUrl(id), { signal: ctl.signal }); clearTimeout(t);
        const k = r.ok ? kindForDay(await r.json(), day) : undefined;
        if (k) out[id] = k;
      } catch { /* 网络不可用：默认晴 */ }
    }));
    if (Object.keys(out).length) { set({ day, cities: out, source: 'browser' }); try { localStorage.setItem(CACHE, JSON.stringify({ day, cities: out })); } catch { /* 忽略 */ } }
    else set({ day, source: 'default' });
  },
}));

export const weatherNow = (city: CityId): WeatherKind => useWeather.getState().cities[city] ?? 'sunny';
