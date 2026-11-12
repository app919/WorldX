import { describe, expect, it } from 'vitest';
import * as economy from '../economy';
import { DISTRICT_PROJECTION, fromGame, realDistanceMeters, toGame } from '../../data/geo';
import { ARCHIVES } from '../../data/archives';

describe('游戏经济：虚拟奖励与真实货币分离', () => {
  it('奖励只产生星星 / 成长值 / 徽章', () => {
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

describe('坐标转换层与建筑档案', () => {
  it('经纬度 → 游戏坐标 → 经纬度 往返误差 < 1 米', () => {
    for (const a of ARCHIVES) {
      const back = fromGame(toGame(a.geo));
      expect(Math.abs(back.lat - a.geo.lat) * 110_574).toBeLessThan(1);
      expect(Math.abs(back.lng - a.geo.lng) * 95_000).toBeLessThan(1);
    }
  });
  it('游戏距离可换算为真实米数', () => {
    expect(realDistanceMeters({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe(10 * DISTRICT_PROJECTION.metersPerUnit);
  });
  it('Demo 坐标都标注为近似值，未经照片校准的模型不能标为 approved', () => {
    for (const a of ARCHIVES) {
      expect(a.geo.accuracy).toBe('approx_100m');
      expect(a.reviewStatus).not.toBe('approved');
    }
  });
});
