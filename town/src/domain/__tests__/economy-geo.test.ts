import { describe, expect, it } from 'vitest';
import * as economy from '../economy';
import { DISTRICT_PROJECTION, fromGame, realDistanceMeters, toGame } from '../../data/geo';
import { GAME_LANDMARKS, LANDMARKS, SHOP_LOTS, distToRoads } from '../../data/buildings';

describe('游戏经济：虚拟奖励与真实货币分离', () => {
  it('奖励只产生星星/成长值/徽章', () => {
    let w = economy.emptyWallet();
    w = economy.reward(w, 'daily_login');
    w = economy.reward(w, 'shop_opened');
    expect(w.stars).toBe(5);
    expect(w.growth).toBe(20);
    expect(w.badges).toContain('开张大吉');
  });
  it('模块不提供任何兑换、转账或购买排名的能力', () => {
    const names = Object.keys(economy).join(',').toLowerCase();
    for (const bad of ['exchange', 'redeem', 'transfer', 'withdraw', 'buyrank', 'cash']) expect(names).not.toContain(bad);
  });
});

describe('坐标转换层', () => {
  it('经纬度 → 游戏坐标 → 经纬度 往返误差 < 1 米', () => {
    for (const b of LANDMARKS) {
      const g = toGame(b.geo);
      const back = fromGame(g);
      expect(Math.abs(back.lat - b.geo.lat) * 110_574).toBeLessThan(1);
      expect(Math.abs(back.lng - b.geo.lng) * 95_000).toBeLessThan(1);
    }
  });
  it('游戏距离可换算为真实米数', () => {
    expect(realDistanceMeters({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe(10 * DISTRICT_PROJECTION.metersPerUnit);
  });
  it('建筑档案：Demo 坐标都标注为近似值，且未审核的模型不能标为 approved', () => {
    for (const b of LANDMARKS) {
      expect(b.geo.accuracy).toBe('approx_100m');
      expect(b.reviewStatus).not.toBe('approved');
      expect(b.photos.front).toBeUndefined();
    }
  });
  it('重点建筑与铺位不压在马路上', () => {
    for (const b of GAME_LANDMARKS) expect(distToRoads(b.pos)).toBeGreaterThan(2);
    for (const l of SHOP_LOTS) expect(distToRoads(l.pos)).toBeGreaterThan(2);
  });
});
