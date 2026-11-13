/**
 * 真实用户开的店（来自后端）：店名、「企」角标、从上传资料提炼的公司简介 / 产品简介、商品、正在找；
 * 不展示任何手机号、微信、实名。可以给店主发私信。
 */
import { useServer, type Intro } from '../store/useServer';
import { Btn, Chip, Panel } from './kit';

export function RemoteShopPanel() {
  const id = useServer((s) => s.shopView);
  const shop = useServer((s) => s.shops.find((x) => x.id === s.shopView));
  const me = useServer((s) => s.me);
  const close = () => useServer.getState().openShop(undefined);
  if (!id || !shop) return null;
  const mine = me?.id === shop.ownerUserId;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center p-3 md:items-center md:justify-end">
      <Panel testId="remote-shop" title={<span>🏪 {shop.name} {shop.licensed && <span data-testid="remote-badge" className="ml-1 rounded bg-brick-400 px-1 align-middle text-xs font-black text-white">企</span>}</span>} subtitle={shop.tagline || shop.category} onClose={close} className="max-h-[80vh] w-full max-w-md">
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="haze">{shop.licensed ? `营业执照：${shop.licenseCompany}` : '个人创业主页'}</Chip>
          <Chip tone="cream">店主 {shop.ownerNickname}</Chip>
          <Chip tone="cream">{shop.category}</Chip>
        </div>
        {shop.companyIntro && <IntroBlock title="公司简介" intro={shop.companyIntro} testId="remote-company" />}
        {shop.productIntro && <IntroBlock title="产品简介" intro={shop.productIntro} testId="remote-product" />}
        <div className="mt-2 grid gap-1.5">
          {shop.products.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-1.5 text-xs">
              <span><b>{p.name}</b>{p.description ? ` · ${p.description}` : ''}</span>
              <span className="shrink-0 pl-2 font-bold text-cocoa-600">{p.priceConfirmed && p.priceFrom !== undefined ? `¥${p.priceFrom}${p.unit ? `/${p.unit}` : ''} 起` : '询价'}</span>
            </div>
          ))}
        </div>
        {shop.needs.length > 0 && <div className="mt-2 text-xs"><b>正在寻找：</b>{shop.needs.join('、')}</div>}
        <div className="mt-3">
          {mine ? <div className="text-xs text-stone-500">这是你的店。</div>
            : me ? <Btn data-testid="remote-dm" onClick={() => useServer.getState().openDm(shop.ownerUserId, `shop:${shop.id}`)}>💬 给店主发私信</Btn>
            : <div className="text-xs text-stone-500">登录后可以给店主发私信</div>}
        </div>
        <div className="mt-2 text-[10px] text-stone-400">平台不展示店主的手机号与微信；请在站内沟通，合同与付款由双方本人确认。</div>
      </Panel>
    </div>
  );
}

function IntroBlock({ title, intro, testId }: { title: string; intro: Intro; testId: string }) {
  return (
    <div className="mt-2 rounded-2xl bg-haze-200/50 p-3 text-xs" data-testid={testId}>
      <div className="text-sm font-black text-cocoa-800">{title} · {intro.title}</div>
      {intro.oneLiner && <div className="mt-0.5 font-bold text-stone-700">{intro.oneLiner}</div>}
      {intro.about && <p className="mt-1 text-stone-600">{intro.about}</p>}
      {intro.highlights.length > 0 && <ul className="mt-1 list-disc pl-4 text-stone-600">{intro.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
      {intro.products.length > 0 && <div className="mt-1">{intro.products.map((p, i) => <div key={i}><b>{p.name}</b>{p.desc ? `：${p.desc}` : ''}</div>)}</div>}
      {intro.customers.length > 0 && <div className="mt-1 text-stone-500">服务过：{intro.customers.join('；')}</div>}
    </div>
  );
}
