/**
 * 快速开张：OPC 主理人 / 投资人一进街区就弹出——上传公司（机构）介绍或产品介绍，
 * 自动提炼店名、一句话介绍、类别、主营产品，预填进开店向导，并自动选好离你最近的空铺。
 * 正式版上传 PPT / PDF / Word 由服务器解析；离线演示可以直接粘贴一段介绍。
 */
import { useState } from 'react';
import { useTown } from '../store/useTown';
import { useServer } from '../store/useServer';
import { useQuick, type DocState, type Prefill } from '../store/useQuick';
import { extractProfile } from '../domain/profileExtractor';
import { CAPABILITIES } from '../domain/taxonomy';
import { DocUpload } from './OpcWizard';
import { Btn } from './kit';
import { track } from '../net/api';

const IND_CATEGORY: Record<string, string> = {
  tech: 'AI技术服务', hardware: '软件与开发', design: '设计与创意', media: '内容与传媒', marketing: '内容与传媒', education: '咨询与培训',
  food: '商品零售', brand_retail: '商品零售', culture: '设计与创意', service: '生活服务', community: '生活服务', space: '生活服务', wedding: '内容与传媒', fitness: '生活服务',
};

/** 离线：从一段文字里提炼开店信息（与服务器提炼规则同一套能力标签） */
export function prefillFromText(text: string, investor: boolean): Prefill {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? '';
  const name = first.length <= 20 ? first.replace(/[：:，,。.].*$/, '') : '';
  const sentence = (text.replace(/\s+/g, ' ').match(/[^。！？.!?]{6,40}[。！？.!?]?/) ?? [''])[0].trim();
  const x = extractProfile(text);
  const caps = x.capabilities.map((c) => c.tag);
  const ind = caps.map((c) => CAPABILITIES.find((d) => d.id === c)?.industry).find(Boolean);
  return {
    name: name || undefined,
    tagline: sentence || undefined,
    category: investor ? '投资与孵化' : (ind && IND_CATEGORY[ind]) || '其他服务',
    products: investor ? [{ name: '项目投资与孵化', description: '看早期项目，提供融资对接与陪跑' }] : x.capabilities.slice(0, 3).map((c) => ({ name: c.label, description: c.detail ?? '' })),
    needs: investor ? ['好项目', '联合投资方'] : x.needs.slice(0, 3).map((n) => n.label).concat(x.needs.length ? [] : ['客户']),
  };
}

function prefillFromDocs(docs: { company?: DocState; product?: DocState }, investor: boolean): Prefill {
  const c = docs.company?.summary, p = docs.product?.summary;
  const all = [c, p].filter(Boolean).map((i) => `${i!.title}\n${i!.oneLiner}\n${i!.about}\n${i!.highlights.join('\n')}`).join('\n');
  const base = prefillFromText(all, investor);
  return {
    ...base,
    name: c?.title || base.name,
    tagline: c?.oneLiner || p?.oneLiner || base.tagline,
    products: investor ? base.products : ([...(p?.products ?? []), ...(c?.products ?? [])].slice(0, 4).map((x) => ({ name: x.name, description: x.desc })) || base.products),
    docs,
  };
}

export function QuickStart() {
  const tag = useTown((s) => s.avatar?.lifeTag);
  const myOpc = useTown((s) => s.myOpc);
  const tab = useTown((s) => s.tab);
  const wizard = useTown((s) => s.wizardOpen);
  const dismissed = useQuick((s) => s.dismissed);
  const online = useServer((s) => s.mode === 'online');
  const [docs, setDocs] = useState<{ company?: DocState; product?: DocState }>({});
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const investor = tag === 'investor';
  if ((tag !== 'opc' && !investor) || myOpc || dismissed || tab !== 'city' || wizard) return null;
  if (!open) return <button className="pointer-events-auto glass fixed bottom-[9.5rem] left-1/2 z-30 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-black text-cocoa-800 md:bottom-28" data-testid="quick-reopen" onClick={() => setOpen(true)}>⚡ {investor ? '上传机构介绍，开间会客室' : '上传资料，1 分钟开张'}</button>;
  const parsing = Object.values(docs).some((d) => d && (d.status === 'uploading' || d.status === 'parsing'));
  const ready = online ? Object.values(docs).some((d) => d?.status === 'done') : text.trim().length >= 10;
  const go = () => {
    const pre = online ? prefillFromDocs(docs, investor) : prefillFromText(text, investor);
    useQuick.getState().setPrefill(pre);
    useQuick.getState().dismiss();
    useTown.getState().setWizard(true);
    track('action', 'quick_start', online ? 'docs' : 'text', { investor });
  };
  return (
    <div className="pointer-events-auto fixed inset-0 z-[56] flex items-end justify-center bg-cocoa-800/25 p-3 md:items-center" onClick={() => setOpen(false)}>
      <div className="wobble-in w-full max-w-md rounded-3xl bg-cream-50 p-4 shadow-soft ring-1 ring-cream-200" data-testid="quick-start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-base font-black text-cocoa-800">⚡ {investor ? '上传机构介绍，开一间投资人会客室' : '上传资料，1 分钟开张'}</div>
            <div className="mt-0.5 text-xs text-stone-600">{investor ? '自动提炼机构名、投资方向，屋顶是【投】黑色，OPC 一眼就能找到你。' : '上传公司介绍或产品介绍（PPT / PDF / Word），自动帮你填好店名、介绍、类别和产品，还会选好离你最近的空铺。'}</div>
          </div>
          <button aria-label="收起" className="text-stone-400" onClick={() => setOpen(false)}>—</button>
        </div>
        {online ? (
          <div className="mt-2 grid gap-1.5">
            <DocUpload kind="company" label={investor ? '机构介绍' : '公司介绍'} state={docs.company} onChange={(d) => setDocs((x) => ({ ...x, company: d }))} />
            {!investor && <DocUpload kind="product" label="产品介绍" state={docs.product} onChange={(d) => setDocs((x) => ({ ...x, product: d }))} />}
          </div>
        ) : (
          <div className="mt-2">
            <textarea className="input min-h-[84px] w-full text-xs" data-testid="quick-text" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={investor ? '粘贴机构介绍：机构名、投资阶段、关注方向、单笔金额……' : '粘贴公司 / 产品介绍：公司名、做什么、给谁、主营产品……（离线演示；正式版可直接上传 PPT / PDF / Word）'} />
            <label className="mt-1 inline-block cursor-pointer text-[11px] text-stone-500 underline">或选一个 .txt / .md 文件
              <input type="file" accept=".txt,.md" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText((await f.text()).slice(0, 2000)); e.target.value = ''; }} />
            </label>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Btn size="sm" data-testid="quick-go" disabled={!ready || parsing} onClick={go}>{parsing ? '正在提炼…' : '下一步：自动填好开店信息'}</Btn>
          <button className="text-[11px] text-stone-400" onClick={() => { useQuick.getState().setPrefill(undefined); useQuick.getState().dismiss(); useTown.getState().setWizard(true); }}>不上传，直接开店</button>
          <button className="ml-auto text-[11px] text-stone-400" data-testid="quick-later" onClick={() => useQuick.getState().dismiss()}>稍后再说</button>
        </div>
        <div className="mt-1 text-[10px] text-stone-400">资料里的手机号、微信会被自动隐藏；原始文件不对外提供下载。</div>
      </div>
    </div>
  );
}
