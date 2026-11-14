import { useState } from 'react';
import { APP_BUILD_NOTE, APP_VERSION } from '../version';
import type { AvatarLook, LifeTag } from '../domain/types';
import { IDENTITIES } from '../domain/identity';
import { Chibi } from '../scene/Chibi';
import { Canvas } from '@react-three/fiber';
import type { DistrictKey } from '../domain/commerce';
import { DISTRICTS, DISTRICT_ORDER } from '../world';
import { useTown } from '../store/useTown';
import { Btn } from './kit';

/** 可选身份（着装跟身份走：OPC 粉色背带裤、投资人西装……见 domain/identity.ts） */
export const LIFE_TAGS: { tag: LifeTag; label: string; emoji: string; desc: string; look: AvatarLook }[] = IDENTITIES.map((i) => ({
  tag: i.tag, label: i.label, emoji: i.emoji, desc: i.desc,
  look: { body: i.body, pants: i.pants, accent: i.accent, outfit: i.outfit, skin: '#F6DCC8', hair: '#3A2C24', accessory: i.accessory },
}));

const HAIR_COLORS = ['#3A2C24', '#5A3E2B', '#7A5539', '#2E2420', '#B07A4F', '#D8D3CC'];

export function Onboarding() {
  const start = useTown((s) => s.start);
  const [step, setStep] = useState<0 | 1>(0);
  const [pick, setPick] = useState(0);
  const [gender, setGender] = useState<'f' | 'm'>('f');
  const [hair, setHair] = useState(HAIR_COLORS[0]);
  const [name, setName] = useState('');
  const preset = LIFE_TAGS[pick];
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-gradient-to-b from-cream-100/80 to-sakura-200/70 p-4 backdrop-blur-sm">
      <div className="wobble-in w-full max-w-xl rounded-[2rem] bg-cream-50 p-6 shadow-soft ring-1 ring-cream-200">
        <div className="text-center">
          <div className="text-xs font-bold tracking-[0.3em] text-sage-700">OPC Town</div>
          <h1 className="mt-1 text-3xl font-black text-cocoa-800">三邻邦<span className="text-xl">（OPC Town）</span> <span className="align-middle text-xs font-bold text-stone-400">v{APP_VERSION}</span></h1>
          <div className="mt-1 text-[11px] text-stone-500">本版更新：{APP_BUILD_NOTE}</div>
          <p className="mt-1 text-sm text-stone-600">在上海，逛着逛着，就可能找到下一位客户。</p>
        </div>
        {step === 0 ? (
          <div className="mt-5" data-testid="onboard-step-avatar">
            <div className="mb-2 text-sm font-bold">① 你今天以什么身份来逛？（随时能换，着装跟身份走）</div>
            <div className="grid grid-cols-3 gap-2" data-testid="identity-grid">
              {LIFE_TAGS.map((t, i) => (
                <button key={t.tag} data-testid={`identity-${t.tag}`} onClick={() => setPick(i)} className={`jelly flex flex-col items-center gap-1 rounded-2xl p-3 text-center ${i === pick ? 'bg-almond-300 ring-2 ring-almond-500' : 'bg-cream-100'}`}>
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-sm text-cocoa-800">{t.label}</span>
                  <span className="text-[10px] font-normal text-stone-600">{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 to-cream-100" data-testid="avatar-preview">
                <Canvas camera={{ position: [0, 1.3, 3.6], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
                  <ambientLight intensity={1.1} /><directionalLight position={[2, 4, 3]} intensity={1.4} />
                  <group position-y={-0.55} rotation-y={-0.35}><Chibi look={{ ...preset.look, hair, gender }} /></group>
                </Canvas>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-600">性别</span>
                  {(['f', 'm'] as const).map((g) => <button key={g} data-testid={`gender-${g}`} onClick={() => setGender(g)} className={`chip ${gender === g ? 'bg-almond-400' : 'bg-cream-100 text-stone-600'}`}>{g === 'f' ? '👧 女生' : '👦 男生'}</button>)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-stone-600">发色</span>
                  {HAIR_COLORS.map((c) => <button key={c} aria-label={`发色 ${c}`} onClick={() => setHair(c)} className={`h-6 w-6 rounded-full shadow-soft ${hair === c ? 'ring-2 ring-cocoa-600 ring-offset-2' : ''}`} style={{ background: c }} />)}
                </div>
                <div className="text-[11px] text-stone-500">着装：{preset.label}专属（街上【例】示范店主理人统一穿蓝色背带裤）</div>
              </div>
            </div>
            <input className="input mt-3" placeholder="给小人起个昵称（可选）" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
            <Btn size="lg" className="mt-4 w-full" onClick={() => setStep(1)}>下一步</Btn>
          </div>
        ) : (
          <div className="mt-5" data-testid="onboard-step-spawn">
            <div className="mb-2 text-sm font-bold">② 选择你出发的街道</div>
            <div className="grid gap-2">
              {DISTRICT_ORDER.map((d: DistrictKey) => (
                <button key={d} onClick={() => start(name.trim(), preset.tag, { body: preset.look.body, skin: preset.look.skin, hair, gender, accessory: preset.look.accessory }, d)} className="jelly flex items-center justify-between rounded-2xl bg-cream-100 px-4 py-3 text-left hover:bg-almond-300">
                  <span>
                    <span className="block text-base text-cocoa-800">{DISTRICTS[d].name}</span>
                    <span className="block text-xs font-normal text-stone-600">{DISTRICTS[d].subtitle} · {DISTRICTS[d].ambience}</span>
                  </span>
                  <span className="text-xl">→</span>
                </button>
              ))}
            </div>
            <button className="mt-3 w-full text-center text-xs text-stone-600 underline" onClick={() => setStep(0)}>返回</button>
          </div>
        )}
      </div>
    </div>
  );
}
