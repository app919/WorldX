import { useMemo, useState } from 'react';
import { useServer, type Intro, type PublicShop } from '../store/useServer';
import { api } from '../net/api';
import { remoteToOpc } from '../net/shopMap';
import { draftAgentKnowledge } from '../domain/agent';
import type { FacadeStyle, OpcProfile, Product, StartupStage } from '../domain/types';
import { allLots, districtName } from '../world';
import { checkOwner, isGolden, maskPhone, takenByDemo, validPhone, validUSCC } from '../domain/lots';
import { useLots } from '../store/useLots';
import { ME, defaultAgent, useTown } from '../store/useTown';
import { Btn, Chip, Disclaimer, Modal, Panel } from './kit';

const CATEGORIES = ['AI技术服务', '设计与创意', '咨询与培训', '内容与传媒', '生活服务', '商品零售', '软件与开发', '其他服务'];
const NEEDS = ['客户', '供应商', '合伙人', '渠道', '资金', '场地', '技术'];
const STAGES: { v: StartupStage; l: string }[] = [
  { v: 'exploring', l: '正在探索' }, { v: 'has_product', l: '已有产品，寻找客户' }, { v: 'seeking_partner', l: '正在找合伙人' },
  { v: 'seeking_supplier', l: '正在寻找供应商' }, { v: 'has_orders', l: '有订单，寻找外包团队' }, { v: 'scaling', l: '正在扩大业务' },
];
const FACADES: { v: FacadeStyle; l: string; e: string }[] = [
  { v: 'cafe', l: '奶油咖啡馆', e: '☕' }, { v: 'studio', l: '雾蓝工作室', e: '🎬' }, { v: 'shikumen', l: '石库门小铺', e: '🏮' }, { v: 'kiosk', l: '樱花小亭', e: '🌸' },
];

/** 五分钟开店（只在打开时挂载，保证每次都用最新的画像预填） */
export function OpcWizard() {
  const open = useTown((s) => s.wizardOpen);
  return open ? <WizardInner /> : null;
}

function WizardInner() {
  const setWizard = useTown((s) => s.setWizard);
  const openShop = useTown((s) => s.openShop);
  const profile = useTown((s) => s.profile);
  const avatar = useTown((s) => s.avatar);
  const preferred = useTown((s) => s.preferredLot);
  const district = useTown((s) => s.district);
  const freeLots = useMemo(() => {
    const taken = takenByDemo(); // 演示店铺 / 主体 /【例】示范店
    // 黄金位留给赞助商：OPC 只能在 60% 的招租位开店
    for (const s of useServer.getState().shops) taken.add(s.lotId);
    return allLots().filter((l) => !taken.has(l.door.lotId!) && !isGolden(l.door.lotId!)).sort((a, b) => (a.district === district ? -1 : 0) - (b.district === district ? -1 : 0));
  }, [district]);
  const [step, setStep] = useState(0);
  const [facade, setFacade] = useState<FacadeStyle>('studio');
  const [lotId, setLotId] = useState<string>(() => (preferred && !isGolden(preferred) ? preferred : freeLots[0]?.door.lotId ?? ''));
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [hasLicense, setHasLicense] = useState(false);
  const [company, setCompany] = useState('');
  const [uscc, setUscc] = useState('');
  const [err, setErr] = useState<string[]>([]);
  const register = useLots((s) => s.register);
  // 正式模式（连接后端）：手机号在登录时已验证；实名、铺位、执照由服务端最终校验
  const online = useServer((s) => s.mode === 'online');
  const me = useServer((s) => s.me);
  const [bindCode, setBindCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<Record<'company' | 'product', DocState | undefined>>({ company: undefined, product: undefined });
  const registry = useLots((s) => s.registry);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState(profile?.headline ?? '');
  const [category, setCategory] = useState('内容与传媒');
  const [products, setProducts] = useState<Product[]>([
    { id: 'p1', opcId: '', name: profile?.capabilities[0]?.label ?? '我的服务', description: '', priceFrom: profile?.priceRange?.min, unit: '项目', priceConfirmed: !!profile?.priceRange },
  ]);
  const [needs, setNeeds] = useState<string[]>(['客户']);
  const [stage, setStage] = useState<StartupStage>('has_product');
  const [l2, setL2] = useState(true);
  const shopName = name.trim() || `${avatar?.nickname ?? '我'}的小店`;
  const draft = draftAgentKnowledge({ name: shopName, tagline: tagline || '一人公司，用心做好每件事', products, openNeeds: needs });
  const [faqs, setFaqs] = useState<{ q: string; a: string }[] | null>(null);

  const close = () => { setWizard(false); setStep(0); };
  /** 每一步的校验：第 1 步实名（姓名 + 手机号唯一 + 验证码），第 3 步营业执照 */
  const check = (k: number): string[] => {
    if (k === 0 && online) {
      const e: string[] = [];
      if (ownerName.trim().length < 2) e.push('请填写店主真实姓名');
      if (!me?.phoneMasked) e.push('开店需要先绑定手机号（每人只能开一家店）');
      if (!lotId) e.push('请选择一个招租铺位');
      return e;
    }
    if (k === 0) {
      const e = checkOwner({ name: ownerName, phone }, registry());
      if (!smsCode) e.push('请先获取并填写短信验证码');
      else if (sms.trim() !== smsCode) e.push('验证码不正确');
      if (!lotId) e.push('请选择一个招租铺位');
      return e;
    }
    if (k === 2 && hasLicense) {
      const e: string[] = [];
      if (company.trim().length < 4) e.push('请填写营业执照上的企业名称');
      if (!validUSCC(uscc)) e.push('统一社会信用代码不正确（18 位，含校验位）');
      return e;
    }
    return [];
  };
  const next = () => { const e = check(step); setErr(e); if (!e.length) setStep(step + 1); };
  const finishOnline = async () => {
    const e = [...check(0), ...check(2)];
    if (Object.values(docs).some((d) => d?.status === 'parsing')) e.push('资料还在解析中，请稍等');
    if (e.length) { setErr(e); return; }
    setBusy(true);
    try {
      const { shop } = await api<{ shop: PublicShop }>('/api/shops', { method: 'POST', json: {
        lotId, name: shopName, tagline, category, facade, ownerName: ownerName.trim(),
        license: hasLicense ? { company: company.trim(), code: uscc.trim().toUpperCase() } : null,
        products: products.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), description: p.description, priceFrom: p.priceFrom, unit: p.unit, priceConfirmed: p.priceConfirmed })),
        needs, faqs: (faqs ?? draft.faqs).map((f) => ({ q: f.q.slice(0, 60), a: f.a.slice(0, 300) })),
        companyDocId: docs.company?.status === 'done' ? docs.company.id : undefined, productDocId: docs.product?.status === 'done' ? docs.product.id : undefined,
      } });
      const opc = remoteToOpc(shop, me!.id);
      openShop(opc, { ...defaultAgent(opc.id, true), enabledLevels: { L1: true, L2: l2 } });
      useServer.getState().loadShops().catch(() => {});
      setStep(0);
    } catch (x) { setErr([(x as Error).message]); } finally { setBusy(false); }
  };
  const finish = () => {
    if (online) { finishOnline(); return; }
    const e = [...check(0), ...check(2)];
    if (e.length) { setErr(e); return; }
    const r = register({ name: ownerName, phone });
    if (r.length) { setErr(r); setStep(0); return; }
    const id = `opc_me_${Date.now().toString(36)}`;
    const opc: OpcProfile = {
      id, ownerId: ME, name: shopName, tagline: tagline || '一人公司，用心做好每件事', category, entityStatus: hasLicense ? 'opc_entity' : 'personal_page', stage, facade, lotId,
      owner: { name: ownerName.trim(), phoneMasked: maskPhone(phone.trim()) },
      license: hasLicense ? { company: company.trim(), code: uscc.trim().toUpperCase() } : undefined,
      products: products.filter((p) => p.name.trim()).map((p) => ({ ...p, opcId: id })), cases: [], faqs: faqs ?? draft.faqs, openNeeds: needs, createdAt: Date.now(),
    };
    const agent = { ...defaultAgent(id, true), enabledLevels: { L1: true, L2: l2 } };
    openShop(opc, agent);
    setStep(0);
  };
  const patchP = (i: number, patch: Partial<Product>) => setProducts(products.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  return (
    <Modal onClose={close}>
      <Panel testId="opc-wizard" title="🏪 我的第一家小店" subtitle={`第 ${step + 1} / 4 步 · 免费创建基础主页`} onClose={close}>
        <div className="mb-3 flex gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-almond-400' : 'bg-cream-300'}`} />)}</div>

        {step === 0 && (
          <div className="space-y-3">
            <div className="text-sm font-bold">店主实名（每人只能开一家店：姓名与手机号唯一）</div>
            {online ? (
              <div className="grid gap-1.5" data-testid="owner-online">
                <input className="input" data-testid="owner-name" placeholder="店主真实姓名（不会公开展示）" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                {me?.phoneMasked ? <div className="text-[11px] text-stone-500">已验证手机号 {me.phoneMasked}（不会在店铺里展示）</div> : (
                  <div className="grid gap-1.5 rounded-xl bg-cream-100 p-2" data-testid="bind-phone">
                    <div className="text-[11px] text-stone-600">你用微信登录，开店前请绑定手机号：</div>
                    <div className="flex gap-1.5">
                      <input className="input" data-testid="bind-phone-input" placeholder="手机号" inputMode="numeric" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
                      <Btn size="sm" tone="cream" onClick={async () => { try { const r = await api<{ devCode?: string }>('/api/auth/sms/send', { method: 'POST', json: { phone, purpose: 'bind' } }); if (r.devCode) setBindCode(r.devCode); setErr([]); } catch (x) { setErr([(x as Error).message]); } }}>获取验证码</Btn>
                    </div>
                    <div className="flex gap-1.5">
                      <input className="input" placeholder="验证码" maxLength={6} value={sms} onChange={(e) => setSms(e.target.value)} />
                      <Btn size="sm" onClick={async () => { try { await api('/api/auth/phone/bind', { method: 'POST', json: { phone, code: sms } }); await useServer.getState().refreshMe(); setErr([]); } catch (x) { setErr([(x as Error).message]); } }}>绑定</Btn>
                    </div>
                    {bindCode && <div className="text-[11px] text-stone-500">开发环境验证码：{bindCode}</div>}
                  </div>
                )}
              </div>
            ) : (<>
            <div className="grid grid-cols-2 gap-1.5">
              <input className="input" data-testid="owner-name" placeholder="店主姓名" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              <input className="input" data-testid="owner-phone" placeholder="手机号" inputMode="numeric" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="flex items-center gap-1.5">
              <input className="input" data-testid="owner-sms" placeholder="短信验证码" maxLength={6} value={sms} onChange={(e) => setSms(e.target.value)} />
              <Btn size="sm" tone="cream" data-testid="owner-sms-send" onClick={() => { if (!validPhone(phone)) { setErr(['请先填写 11 位手机号']); return; } const c = String(100000 + Math.floor(Math.random() * 899999)); setSmsCode(c); setErr([]); }}>获取验证码</Btn>
            </div>
            {smsCode && <div className="text-[11px] text-stone-500" data-testid="sms-demo">演示：验证码已发送到 {maskPhone(phone)}，本次验证码 <b data-testid="sms-code">{smsCode}</b></div>}
            </>)}
            <div className="text-sm font-bold">选一个店铺外观和街区位置</div>
            <div className="grid grid-cols-4 gap-2">
              {FACADES.map((f) => (
                <button key={f.v} onClick={() => setFacade(f.v)} className={`jelly flex flex-col items-center rounded-2xl p-2 text-xs ${facade === f.v ? 'bg-almond-300 ring-2 ring-almond-500' : 'bg-cream-100'}`}>
                  <span className="text-2xl">{f.e}</span>{f.l}
                </button>
              ))}
            </div>
            <select className="input" data-testid="lot-select" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {freeLots.map((l) => <option key={l.door.lotId} value={l.door.lotId}>{districtName(l.district)} · {l.street} · 铺位 {l.door.lotId}</option>)}
            </select>
            <div className="text-[11px] text-stone-500">每条街 60% 的铺位是 OPC 招租位（有没有营业执照都能开），40% 黄金位留给赞助商。</div>
            <input className="input" placeholder={`店名（默认：${shopName}）`} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} data-testid="shop-name" />
            <input className="input" placeholder="一句话介绍" value={tagline} maxLength={40} onChange={(e) => setTagline(e.target.value)} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="text-sm font-bold">第一步：你能提供什么？</div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => <button key={c} onClick={() => setCategory(c)} className={`chip ${category === c ? 'bg-almond-400' : 'bg-cream-100 text-stone-600'}`}>{c}</button>)}
            </div>
            <div className="text-xs font-bold">商品橱窗（1–10 款）</div>
            {products.map((p, i) => (
              <div key={p.id} className="space-y-1 rounded-2xl bg-cream-100 p-2">
                <input className="input" placeholder="产品 / 服务名称" value={p.name} onChange={(e) => patchP(i, { name: e.target.value })} />
                <input className="input" placeholder="简单描述" value={p.description} onChange={(e) => patchP(i, { description: e.target.value })} />
                <div className="flex items-center gap-2">
                  <input className="input !w-28" type="number" min={0} placeholder="起价（元）" value={p.priceFrom ?? ''} onChange={(e) => patchP(i, { priceFrom: e.target.value ? Number(e.target.value) : undefined, priceConfirmed: false })} />
                  <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={p.priceConfirmed} disabled={p.priceFrom === undefined} onChange={(e) => patchP(i, { priceConfirmed: e.target.checked })} /> 我确认此价格可由 AI 分身对外报出</label>
                </div>
              </div>
            ))}
            {products.length < 10 && <Btn size="sm" tone="cream" onClick={() => setProducts([...products, { id: `p${products.length + 1}`, opcId: '', name: '', description: '', priceConfirmed: false }])}>+ 再加一款</Btn>}
            {online && (
              <div className="space-y-2" data-testid="doc-uploads">
                <div className="text-xs font-bold">上传资料（可选）：PPT / PDF / Word，系统自动提炼成店铺展示内容</div>
                {(['company', 'product'] as const).map((k) => <DocUpload key={k} kind={k} state={docs[k]} onChange={(d) => setDocs((x) => ({ ...x, [k]: d }))} />)}
                <div className="text-[10px] text-stone-400">只提取文字，图片和二维码不会展示；资料里的手机号、微信号、邮箱会被自动隐藏。原文件不对外公开。</div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="text-sm font-bold">第二步：你现在需要什么？</div>
            <div className="flex flex-wrap gap-1.5">
              {NEEDS.map((n) => <button key={n} onClick={() => setNeeds(needs.includes(n) ? needs.filter((x) => x !== n) : [...needs, n])} className={`chip ${needs.includes(n) ? 'bg-almond-400' : 'bg-cream-100 text-stone-600'}`}>{n}</button>)}
            </div>
            <div className="text-xs font-bold">我的创业状态</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => <button key={s.v} onClick={() => setStage(s.v)} className={`chip ${stage === s.v ? 'bg-sage-400 text-white' : 'bg-cream-100 text-stone-600'}`}>{s.l}</button>)}
            </div>
            <div className="text-xs font-bold">营业执照（有没有都可以开店）</div>
            <div className="grid gap-1.5 text-xs">
              <label className="flex items-center gap-2"><input type="radio" data-testid="license-no" checked={!hasLicense} onChange={() => setHasLicense(false)} /> 暂无营业执照（个人创业主页）</label>
              <label className="flex items-center gap-2"><input type="radio" data-testid="license-yes" checked={hasLicense} onChange={() => setHasLicense(true)} /> 我有营业执照 —— 店铺招牌显示 <span className="rounded bg-brick-400 px-1 font-black text-white">企</span> 角标</label>
            </div>
            {hasLicense && (
              <div className="grid gap-1.5">
                <input className="input" data-testid="license-company" placeholder="营业执照上的企业名称" value={company} onChange={(e) => setCompany(e.target.value)} />
                <input className="input" data-testid="license-code" placeholder="统一社会信用代码（18 位）" maxLength={18} value={uscc} onChange={(e) => setUscc(e.target.value.toUpperCase())} />
              </div>
            )}
            <Disclaimer>创建虚拟店铺不代表注册公司；执照信息由店主填写，正式版接入工商核验后显示「已核验」。</Disclaimer>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="text-sm font-bold">第三步：我的 AI 分身（自动生成，确认后上线）</div>
            <div className="rounded-2xl bg-haze-200/60 p-3 text-sm">🤖 {draft.intro}</div>
            {(faqs ?? draft.faqs).map((f, i) => (
              <div key={i} className="rounded-2xl bg-cream-100 p-2 text-xs">
                <div className="font-bold">Q：{f.q}</div>
                <textarea className="input mt-1 h-12 resize-none !text-xs" value={f.a} onChange={(e) => setFaqs((faqs ?? draft.faqs).map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))} />
              </div>
            ))}
            <div className="grid gap-1 text-xs">
              <label className="flex items-center gap-2"><input type="checkbox" checked disabled /> <Chip tone="sage">L1 接待</Chip> 介绍、产品、常见问题</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={l2} onChange={(e) => setL2(e.target.checked)} /> <Chip tone="almond">L2 商务</Chip> 收集需求、推荐服务、预约会议</label>
              <label className="flex items-center gap-2 text-stone-400"><input type="checkbox" disabled /> <Chip tone="sakura">L3 决策</Chip> 最终报价 / 折扣 / 合同 / 退款 —— 永远需要你本人确认</label>
            </div>
          </div>
        )}

        {err.length > 0 && <div className="mt-3 text-xs text-brick-500" data-testid="wizard-errors">{err.join('；')}</div>}
        <div className="mt-4 flex justify-between">
          <Btn tone="cream" onClick={() => (step ? setStep(step - 1) : close())}>{step ? '上一步' : '取消'}</Btn>
          {step < 3 ? <Btn onClick={next} data-testid="wizard-next">下一步</Btn>
            : <Btn tone="sage" onClick={finish} disabled={busy} data-testid="wizard-finish">{busy ? '开张中…' : '🎉 确认开张'}</Btn>}
        </div>
      </Panel>
    </Modal>
  );
}

interface DocState { id: string; filename: string; status: 'uploading' | 'parsing' | 'done' | 'failed'; summary?: Intro; error?: string; method?: string }

/** 上传一份资料并轮询解析结果，展示提炼出的内容供确认 */
function DocUpload({ kind, state, onChange }: { kind: 'company' | 'product'; state?: DocState; onChange: (d: DocState | undefined) => void }) {
  const label = kind === 'company' ? '公司简介' : '产品简介';
  const upload = async (file: File) => {
    onChange({ id: '', filename: file.name, status: 'uploading' });
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('file', file);
    try {
      const r = await fetch('/api/uploads/shop-doc', { method: 'POST', body: fd, credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? '上传失败');
      onChange({ id: j.id, filename: file.name, status: 'parsing' });
      for (let i = 0; i < 120; i++) {
        await new Promise((res) => setTimeout(res, 1000));
        const { doc } = await api<{ doc: { status: DocState['status']; summary?: Intro; error?: string; method?: string } }>(`/api/uploads/shop-doc/${j.id}`);
        if (doc.status !== 'parsing') { onChange({ id: j.id, filename: file.name, status: doc.status, summary: doc.summary, error: doc.error, method: doc.method }); return; }
      }
      onChange({ id: j.id, filename: file.name, status: 'failed', error: '解析超时，请重试' });
    } catch (e) { onChange({ id: '', filename: file.name, status: 'failed', error: (e as Error).message }); }
  };
  return (
    <div className="rounded-xl bg-cream-100 p-2 text-xs" data-testid={`doc-${kind}`}>
      <div className="flex items-center justify-between gap-2">
        <b>{label}</b>
        <label className="cursor-pointer rounded-full bg-almond-300 px-2 py-0.5 font-bold">
          {state ? '重新上传' : '选择文件'}
          <input type="file" className="hidden" data-testid={`doc-input-${kind}`} accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>
      </div>
      {state && <div className="mt-1 text-stone-600">{state.filename} · {{ uploading: '上传中…', parsing: '解析中…', done: '已提炼 ✓', failed: '失败' }[state.status]}{state.error ? `：${state.error}` : ''}</div>}
      {state?.summary && (
        <div className="mt-1 rounded-lg bg-cream-50 p-2" data-testid={`doc-summary-${kind}`}>
          <b>{state.summary.title}</b> · {state.summary.oneLiner}
          {state.summary.highlights.length > 0 && <div className="text-stone-500">亮点：{state.summary.highlights.join('；')}</div>}
          {state.summary.products.length > 0 && <div className="text-stone-500">产品：{state.summary.products.map((p) => p.name).join('、')}</div>}
          <button className="mt-1 text-stone-400 underline" onClick={() => onChange(undefined)}>不使用这份资料</button>
        </div>
      )}
    </div>
  );
}
