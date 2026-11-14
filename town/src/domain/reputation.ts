/**
 * 评价分：搜索结果按它排序（「买」要高效：先看最靠谱、最活跃的）。
 *
 *   评价分 = 用户评分 × 10（满分 50） + 信用分 × 0.3（满分 30） + 活跃度 × 0.2（满分 20）
 *
 * - 用户评分：双方确认完成的合作后的星级（演示数据为虚构）；
 * - 信用等级：来自服务中心信用体系（实名 / 企业认证、案例审核、按时履约、投诉），AAA / AA / A / B，新店为「新」；
 * - 活跃度：最近 7 天上线、回复、上新的频率；在线加分。
 * 演示数据用稳定的哈希生成（同一家店每次一样），真实店铺按后端数据计算（新店没有评分，靠信用与活跃度）。
 */
export type CreditLevel = 'AAA' | 'AA' | 'A' | 'B' | '新';
export interface Reputation { rating: number; reviews: number; credit: CreditLevel; creditScore: number; activity: number; online: boolean; score: number }

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

export const creditLevel = (score: number, reviews: number): CreditLevel => (reviews === 0 && score < 70 ? '新' : score >= 90 ? 'AAA' : score >= 80 ? 'AA' : score >= 70 ? 'A' : 'B');

export function scoreOf(rating: number, creditScore: number, activity: number) {
  return Math.round(rating * 10 + creditScore * 0.3 + activity * 0.2);
}

export interface RepInput { online?: boolean; certified?: boolean; done?: number; rating?: number; isNew?: boolean }

export function reputationOf(key: string, x: RepInput = {}): Reputation {
  const a = hash(key), b = hash(`${key}#c`), c = hash(`${key}#a`);
  if (x.isNew) {
    const creditScore = x.certified ? 72 : 60;
    const activity = Math.round((x.online ? 70 : 40) + c * 20);
    return { rating: 0, reviews: 0, credit: creditLevel(creditScore, 0), creditScore, activity, online: !!x.online, score: scoreOf(0, creditScore, activity) };
  }
  const reviews = x.done ?? Math.round(6 + a * 140);
  const rating = x.rating ? x.rating : Math.round((4.2 + a * 0.75) * 10) / 10;
  const creditScore = Math.min(99, Math.round(66 + b * 26 + (x.certified ? 6 : 0)));
  const activity = Math.min(100, Math.round((x.online ? 72 : 35) + c * 25));
  return { rating, reviews, credit: creditLevel(creditScore, reviews), creditScore, activity, online: !!x.online, score: scoreOf(rating, creditScore, activity) };
}
