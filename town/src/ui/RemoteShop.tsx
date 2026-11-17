/**
 * 真实用户的店 = 一张完整的「公司主页」：
 * 封面（店名蓝字、企业认证、类别、店主）→ 公司介绍视频 → 公司简介 → 产品与服务（明码标价）+ 产品介绍 + 产品资料 →
 * 路演 / 演讲 PPT（在线翻看）→ 正在寻找的合作 → 私信店主。
 * 不展示任何手机号、微信、实名。
 */
import { useRef } from 'react';
import { useServer, type Intro, type ShopMedia } from '../store/useServer';
import { REAL_BLUE } from '../domain/palette';
import { Btn } from './kit';

export function RemoteShopPanel() {
  const id = useServer((s) => s.shopView);
  const shop = useServer((s) => s.shops.find((x) => x.id === s.shopView));
  const me = useServer((s) => s.me);
  const body = useRef<HTMLDivElement>(null);
  const close = () => useServer.getState().openShop(undefined);
  if (!id || !shop) return null;
  const mine = me?.id === shop.ownerUserId;
  const media = shop.media ?? [];
  const videos = media.filter((m) => m.kind === 'video');
  const decks = media.filter((m) => m.kind === 'deck');
  const docs = media.filter((m) => m.kind === 'product');
  const sections: [string, string, boolean][] = [
    ['about', '公司简介', !!shop.companyIntro], ['video', '介绍视频', videos.length > 0], ['products', '产品与服务', true],
    ['deck', '路演 PPT', decks.length > 0], ['needs', '寻找合作', shop.needs.length > 0],
  ];
  const go = (k: string) => body.current?.querySelector(`[data-sec="${k}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-cocoa-800/20 md:items-center md:p-4" onClick={close}>
      <div className="wobble-in flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.6rem] bg-cream-50 shadow-soft md:rounded-[1.6rem]" data-testid="remote-shop" onClick={(e) => e.stopPropagation()}>
        {/* 封面 */}
        <div className="relative bg-gradient-to-br from-[#E8F0FF] via-[#F6F1FF] to-[#FFF4E6] px-5 pb-3 pt-4">
          <button aria-label="关闭" onClick={close} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-cocoa-600">✕</button>
          <div className="text-[11px] font-bold text-stone-500">{shop.category}{shop.licensed ? ' · 企业认证' : ' · 个人创业主页'}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xl font-black" style={{ color: REAL_BLUE }} data-testid="remote-name">
            {shop.name}
            {shop.licensed && <span data-testid="remote-badge" className="rounded bg-[#3D7BD8] px-1 text-xs font-black text-white">企</span>}
          </div>
          {shop.tagline && <div className="mt-0.5 text-sm text-stone-700">{shop.tagline}</div>}
          <div className="mt-1 text-[11px] text-stone-500">店主 {shop.ownerNickname}{shop.licensed && shop.licenseCompany ? ` · ${shop.licenseCompany}` : ''}</div>
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {sections.filter((x) => x[2]).map(([k, l]) => <button key={k} onClick={() => go(k)} className="chip shrink-0 bg-white/80 text-stone-600">{l}</button>)}
          </div>
        </div>
        <div ref={body} className="scroll-soft min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3 text-xs">
          {videos.length > 0 && (
            <section data-sec="video" data-testid="remote-video">
              <H>🎬 公司介绍视频</H>
              {videos.map((v) => (
                <div key={v.id} className="mt-1">
                  <video src={v.url} controls playsInline preload="metadata" className="aspect-video w-full rounded-2xl bg-black" />
                  <div className="mt-0.5 text-[11px] text-stone-500">{v.title}</div>
                </div>
              ))}
            </section>
          )}
          {shop.companyIntro && <section data-sec="about"><IntroBlock title="公司简介" intro={shop.companyIntro} testId="remote-company" /></section>}
          <section data-sec="products">
            <H>🛍️ 产品与服务</H>
            <div className="mt-1 grid gap-1.5 md:grid-cols-2">
              {shop.products.map((p, i) => (
                <div key={i} className="rounded-2xl bg-white p-3 ring-1 ring-cream-200">
                  <div className="font-black text-cocoa-800">{p.name}</div>
                  {p.description && <div className="mt-0.5 text-stone-600">{p.description}</div>}
                  <div className="mt-1 font-bold text-cocoa-600">{p.priceConfirmed && p.priceFrom !== undefined ? `¥${p.priceFrom}${p.unit ? `/${p.unit}` : ''} 起` : '询价'}</div>
                </div>
              ))}
              {!shop.products.length && <div className="text-stone-500">店主还没有上架产品。</div>}
            </div>
            {shop.productIntro && <IntroBlock title="产品介绍" intro={shop.productIntro} testId="remote-product" />}
            {docs.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" data-testid="remote-docs">{docs.map((d) => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="chip bg-cream-100 text-cocoa-700">📄 {d.title}</a>)}</div>}
          </section>
          {decks.length > 0 && (
            <section data-sec="deck" data-testid="remote-deck">
              <H>📑 路演 / 演讲 PPT</H>
              {decks.map((d) => <DeckViewer key={d.id} m={d} />)}
            </section>
          )}
          {shop.needs.length > 0 && (
            <section data-sec="needs" className="rounded-2xl bg-[#FFF4D6] p-3">
              <H>🤝 正在寻找的合作</H>
              <div className="mt-1 flex flex-wrap gap-1.5">{shop.needs.map((n) => <span key={n} className="chip bg-white text-cocoa-700">{n}</span>)}</div>
            </section>
          )}
          {shop.faqs.length > 0 && (
            <section><H>❓ 常见问题</H>{shop.faqs.map((f, i) => <div key={i} className="mt-1"><b>{f.q}</b><div className="text-stone-600">{f.a}</div></div>)}</section>
          )}
        </div>
        <div className="border-t border-cream-200 px-5 py-2.5">
          {mine ? <div className="text-xs text-stone-500">这是你的店。在「我的」里可以上传公司介绍视频、路演 PPT 和产品资料。</div>
            : me ? <Btn className="w-full" data-testid="remote-dm" onClick={() => useServer.getState().openDm(shop.ownerUserId, `shop:${shop.id}`)}>💬 给店主发私信</Btn>
            : <div className="text-xs text-stone-500">登录后可以给店主发私信</div>}
          <div className="mt-1 text-[10px] text-stone-400">平台不展示店主的手机号与微信；请在站内沟通，合同与付款由双方本人确认。</div>
        </div>
      </div>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <div className="text-sm font-black text-cocoa-800">{children}</div>;

/** 演讲稿在线翻看（服务器已把 PPT 转成 PDF）；手机上可全屏打开 */
function DeckViewer({ m }: { m: ShopMedia }) {
  return (
    <div className="mt-1">
      <iframe src={`${m.url}#view=FitH&toolbar=0`} title={m.title} className="h-[52vh] w-full rounded-2xl bg-white ring-1 ring-cream-200" />
      <div className="mt-0.5 flex items-center text-[11px] text-stone-500">{m.title}<a href={m.url} target="_blank" rel="noreferrer" className="ml-auto underline">全屏查看</a></div>
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
