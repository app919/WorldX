import { useMemo, useState } from 'react';
import { draftAgentKnowledge } from '../domain/agent';
import type { FacadeStyle, OpcProfile, Product, StartupStage } from '../domain/types';
import { COUNTERPARTIES, SHOPS } from '../data/seed';
import { allLots, districtName } from '../world';
import { checkOwner, isGolden, maskPhone, validPhone, validUSCC } from '../domain/lots';
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
    const taken = new Set([...SHOPS.map((x) => x.lotId), ...COUNTERPARTIES.map((c) => c.place.lotId).filter(Boolean)]);
    // 黄金位留给赞助商：OPC 只能在 60% 的招租位开店
    return allLots().filter((l) => !taken.has(l.door.lotId) && !isGolden(l.door.lotId!)).sort((a, b) => (a.district === district ? -1 : 0) - (b.district === district ? -1 : 0));
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
  const finish = () => {
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
            <div className="grid grid-cols-2 gap-1.5">
              <input className="input" data-testid="owner-name" placeholder="店主姓名" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              <input className="input" data-testid="owner-phone" placeholder="手机号" inputMode="numeric" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="flex items-center gap-1.5">
              <input className="input" data-testid="owner-sms" placeholder="短信验证码" maxLength={6} value={sms} onChange={(e) => setSms(e.target.value)} />
              <Btn size="sm" tone="cream" data-testid="owner-sms-send" onClick={() => { if (!validPhone(phone)) { setErr(['请先填写 11 位手机号']); return; } const c = String(100000 + Math.floor(Math.random() * 899999)); setSmsCode(c); setErr([]); }}>获取验证码</Btn>
            </div>
            {smsCode && <div className="text-[11px] text-stone-500" data-testid="sms-demo">演示：验证码已发送到 {maskPhone(phone)}，本次验证码 <b data-testid="sms-code">{smsCode}</b></div>}
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
            : <Btn tone="sage" onClick={finish} data-testid="wizard-finish">🎉 确认开张</Btn>}
        </div>
      </Panel>
    </Modal>
  );
}
