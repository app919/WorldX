import type { OpcProfile } from '../domain/types';
import type { PublicShop } from '../store/useServer';

/** 把服务端返回的店铺转换成游戏里使用的小店结构 */
export function remoteToOpc(s: PublicShop, ownerId: string): OpcProfile {
  return {
    id: s.id, ownerId: ownerId === s.ownerUserId ? 'me' : s.ownerUserId, name: s.name, tagline: s.tagline, category: s.category,
    entityStatus: s.licensed ? 'opc_entity' : 'personal_page', stage: 'has_product', facade: s.facade, lotId: s.lotId,
    license: s.licensed && s.licenseCompany ? { company: s.licenseCompany, code: '' } : undefined,
    products: s.products.map((p, i) => ({ id: `p${i}`, opcId: s.id, name: p.name, description: p.description, priceFrom: p.priceFrom, unit: p.unit, priceConfirmed: p.priceConfirmed })),
    cases: [], faqs: s.faqs, openNeeds: s.needs, createdAt: s.createdAt,
  };
}
