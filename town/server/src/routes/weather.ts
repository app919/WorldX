/** 今天各城市的游戏天气（晴 / 阴 / 雨 / 雪），由凌晨 3 点的预报任务写入 */
import type { FastifyInstance } from 'fastify';
import { cnDate } from '../../../src/domain/weather.js';
import { weatherOf } from '../lib/weather.js';

export async function weatherRoutes(app: FastifyInstance) {
  app.get('/api/weather', async () => {
    const day = cnDate();
    return { day, cities: weatherOf(app.db, day) };
  });
}
