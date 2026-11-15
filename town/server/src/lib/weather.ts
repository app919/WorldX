/**
 * 天气预报任务：每天凌晨 3 点（东八区）查各城市第二天的逐小时预报，
 * 取当天出现时间最长的天气（晴 / 阴 / 雨 / 雪）作为游戏天气，写入 weather 表。
 * 数据源 Open-Meteo：免费、无需密钥、开源，长期可用。查询失败时保留旧值，前端默认“晴”。
 */
import type { DB } from '../db.js';
import { CITY_GEO, cnDate, forecastUrl, kindForDay, type CityId, type WeatherKind } from '../../../src/domain/weather.js';

export const CITIES = Object.keys(CITY_GEO) as CityId[];

type Fetch = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function refreshWeather(db: DB, day: string, fetchImpl: Fetch = fetch as unknown as Fetch, log?: (m: string) => void): Promise<Record<string, WeatherKind | undefined>> {
  const out: Record<string, WeatherKind | undefined> = {};
  const up = db.prepare('INSERT INTO weather (city, day, kind, source, fetched_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(city, day) DO UPDATE SET kind = excluded.kind, source = excluded.source, fetched_at = excluded.fetched_at');
  for (const c of CITIES) {
    try {
      const r = await fetchImpl(forecastUrl(c));
      if (!r.ok) throw new Error('HTTP error');
      const k = kindForDay((await r.json()) as never, day);
      if (k) { up.run(c, day, k, 'open-meteo', Date.now()); out[c] = k; }
    } catch (e) { log?.(`天气预报获取失败：${c} ${day} ${(e as Error).message}`); }
  }
  return out;
}

export function weatherOf(db: DB, day: string): Record<CityId, { kind: WeatherKind; source: string }> {
  const rows = db.prepare('SELECT city, kind, source FROM weather WHERE day = ?').all(day) as { city: CityId; kind: WeatherKind; source: string }[];
  const out = {} as Record<CityId, { kind: WeatherKind; source: string }>;
  for (const c of CITIES) { const r = rows.find((x) => x.city === c); out[c] = r ? { kind: r.kind, source: r.source } : { kind: 'sunny', source: 'default' }; }
  return out;
}

/** 距离下一个东八区凌晨 3 点的毫秒数 */
export function msUntilNext3am(now = new Date()): number {
  const sh = new Date(now.getTime() + 8 * 3600_000); // 用 UTC 字段表示东八区时间
  const next = new Date(Date.UTC(sh.getUTCFullYear(), sh.getUTCMonth(), sh.getUTCDate(), 3, 0, 0));
  if (next.getTime() <= sh.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - sh.getTime();
}

/** 启动时补齐今天和明天；之后每天凌晨 3 点查第二天 */
export function scheduleWeather(db: DB, log: (m: string) => void) {
  const have = (day: string) => (db.prepare('SELECT COUNT(*) AS n FROM weather WHERE day = ?').get(day) as { n: number }).n >= CITIES.length;
  const now = new Date();
  for (const day of [cnDate(now), cnDate(now, 1)]) if (!have(day)) void refreshWeather(db, day, undefined, log);
  const tick = () => {
    void refreshWeather(db, cnDate(new Date(), 1), undefined, log).then((r) => log(`已更新明天的天气：${JSON.stringify(r)}`));
    setTimeout(tick, msUntilNext3am()).unref?.();
  };
  setTimeout(tick, msUntilNext3am()).unref?.();
}
