/**
 * 注册 / 登录：手机号 + 短信验证码，或微信扫码。首次登录即注册，需同意《用户协议》《隐私政策》。
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../net/api';
import { useServer, type Me } from '../store/useServer';
import { Btn } from './kit';

export function Login({ onLoggedIn }: { onLoggedIn: (me: Me) => void }) {
  const [tab, setTab] = useState<'phone' | 'wechat'>('phone');
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <div className="wobble-in glass w-full max-w-sm rounded-blob p-6" data-testid="login">
        <div className="text-2xl font-black text-cocoa-800">三邻邦<span className="text-base">（OPC Town）</span></div>
        <div className="mt-1 text-xs text-stone-600">在上海，逛着逛着，就可能找到下一位客户。</div>
        <div className="mt-4 flex gap-1 rounded-full bg-cream-100 p-1 text-sm font-bold">
          <button data-testid="login-tab-phone" onClick={() => setTab('phone')} className={`flex-1 rounded-full py-1.5 ${tab === 'phone' ? 'bg-almond-400 text-cocoa-800' : 'text-stone-500'}`}>📱 手机号</button>
          <button data-testid="login-tab-wechat" onClick={() => setTab('wechat')} className={`flex-1 rounded-full py-1.5 ${tab === 'wechat' ? 'bg-[#07c160] text-white' : 'text-stone-500'}`}>🟩 微信扫码</button>
        </div>
        <label className="mt-3 flex items-start gap-2 text-[11px] text-stone-600">
          <input type="checkbox" data-testid="login-agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
          <span>我已阅读并同意<button className="mx-0.5 font-bold text-almond-600 underline" onClick={() => setShowTerms(!showTerms)}>《用户协议》《隐私政策》</button>，包括：为了交易安全与合规，平台会保存站内消息并可能进行审查。</span>
        </label>
        {showTerms && <Terms />}
        {tab === 'phone' ? <PhoneLogin agree={agree} onLoggedIn={onLoggedIn} /> : <WechatLogin agree={agree} onLoggedIn={onLoggedIn} />}
      </div>
    </div>
  );
}

function PhoneLogin({ agree, onLoggedIn }: { agree: boolean; onLoggedIn: (me: Me) => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState('');
  useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const send = async () => {
    setMsg('');
    if (!/^1[3-9]\d{9}$/.test(phone)) { setMsg('请输入 11 位手机号'); return; }
    try { const r = await api<{ devCode?: string }>('/api/auth/sms/send', { method: 'POST', json: { phone } }); setWait(60); setDevCode(r.devCode ?? ''); setMsg('验证码已发送'); }
    catch (e) { setMsg((e as Error).message); }
  };
  const submit = async () => {
    setMsg('');
    if (!agree) { setMsg('请先阅读并同意用户协议和隐私政策'); return; }
    setBusy(true);
    try {
      await api('/api/auth/sms/verify', { method: 'POST', json: { phone, code, agree } });
      const me = await useServer.getState().refreshMe();
      if (me) onLoggedIn(me);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 grid gap-2">
      <input className="input" data-testid="login-phone" inputMode="numeric" maxLength={11} placeholder="手机号" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
      <div className="flex gap-2">
        <input className="input" data-testid="login-code" inputMode="numeric" maxLength={6} placeholder="短信验证码" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        <Btn tone="cream" size="sm" data-testid="login-send" disabled={wait > 0} onClick={send}>{wait ? `${wait}s` : '获取验证码'}</Btn>
      </div>
      {devCode && <div className="text-[11px] text-stone-500" data-testid="login-devcode">开发环境未接短信服务，本次验证码：<b>{devCode}</b></div>}
      <Btn data-testid="login-submit" disabled={busy || code.length !== 6} onClick={submit}>{busy ? '登录中…' : '登录 / 注册'}</Btn>
      {msg && <div className="text-xs text-brick-500" data-testid="login-msg">{msg}</div>}
    </div>
  );
}

function WechatLogin({ agree, onLoggedIn }: { agree: boolean; onLoggedIn: (me: Me) => void }) {
  const [qr, setQr] = useState<{ state: string; url: string; mode: string } | null>(null);
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = async () => {
    setMsg('');
    if (!agree) { setMsg('请先阅读并同意用户协议和隐私政策'); return; }
    try { setQr(await api('/api/auth/wechat/start', { method: 'POST', json: { agree } })); } catch (e) { setMsg((e as Error).message); }
  };
  useEffect(() => {
    if (!qr) return;
    timer.current = setInterval(async () => {
      try {
        const r = await api<{ done: boolean }>(`/api/auth/wechat/poll?state=${encodeURIComponent(qr.state)}`);
        if (r.done) {
          clearInterval(timer.current!);
          const me = await useServer.getState().refreshMe();
          if (me) onLoggedIn(me);
        }
      } catch (e) { clearInterval(timer.current!); setMsg((e as Error).message); setQr(null); }
    }, 1500);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [qr, onLoggedIn]);
  return (
    <div className="mt-3 grid place-items-center gap-2">
      {!qr ? <Btn data-testid="wechat-start" className="!bg-[#07c160] !text-white" onClick={start}>显示微信登录二维码</Btn> : (
        <>
          <iframe title="微信扫码登录" data-testid="wechat-frame" src={qr.url} className="h-[360px] w-[300px] rounded-2xl bg-white" />
          <div className="text-[11px] text-stone-500">{qr.mode === 'mock' ? '开发模式：点击「确认登录」模拟扫码' : '请用微信扫一扫，在手机上确认登录'}</div>
        </>
      )}
      {msg && <div className="text-xs text-brick-500">{msg}</div>}
    </div>
  );
}

function Terms() {
  return (
    <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-cream-100 p-2 text-[11px] leading-relaxed text-stone-600" data-testid="terms">
      <b>用户协议与隐私政策（摘要）</b><br />
      1. 账号：用手机号或微信登录，一个手机号只能注册一个账号、开一家店。<br />
      2. 我们收集：手机号（加密保存，对外只显示脱敏形式）、微信授权标识（加密保存）、你填写的资料与店铺信息、你上传的公司 / 产品资料（只提取文字用于展示）、站内消息、页面浏览与点击记录（用于统计与改进产品）。<br />
      3. 我们不会：在店铺、名片、消息等任何对外内容里展示你的手机号或微信二维码；店铺介绍和资料中的手机号、微信号、邮箱会被自动隐藏。<br />
      4. 站内消息：为了交易安全、防诈骗与合规，平台保存消息记录，管理员在必要时可以查看，每次查看都会留下审计记录。<br />
      5. 交易：平台提供撮合与信息服务，合同由双方签署，平台不代收款、不担保交易。<br />
      6. 你可以随时联系我们更正或删除你的个人信息、注销账号。
    </div>
  );
}
