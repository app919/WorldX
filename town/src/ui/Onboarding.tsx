import { useState } from 'react';
import { APP_BUILD_NOTE, APP_VERSION } from '../version';
import type { AvatarLook, LifeTag } from '../domain/types';
import type { DistrictKey } from '../domain/commerce';
import { DISTRICTS, DISTRICT_ORDER } from '../world';
import { useTown } from '../store/useTown';
import { Btn } from './kit';

export const LIFE_TAGS: { tag: LifeTag; label: string; emoji: string; desc: string; look: AvatarLook }[] = [
  { tag: 'worker', label: '打工牛马', emoji: '💼', desc: '朝九晚六，下班后逛逛', look: { body: '#6F8BA4', skin: '#F6DCC8', hair: '#3A2C24', accessory: 'glasses' } },
  { tag: 'freelancer', label: '自由职业者', emoji: '🎧', desc: '接点项目，自由生活', look: { body: '#A9C2A0', skin: '#EFCFB4', hair: '#5A3E2B', accessory: 'headphones' } },
  { tag: 'opc', label: 'OPC 主理人', emoji: '🏪', desc: '一个人的小公司', look: { body: '#E8C77A', skin: '#F6DCC8', hair: '#4A3426', accessory: 'beret' } },
  { tag: 'retiree', label: '退休生活家', emoji: '🍵', desc: '散步、喝茶、认识邻居', look: { body: '#C98068', skin: '#F2D4BE', hair: '#D8D3CC', accessory: 'scarf' } },
  { tag: 'student', label: '学生', emoji: '📚', desc: '探索城市，找点兼职', look: { body: '#F0C4C6', skin: '#F6DCC8', hair: '#2E2420', accessory: 'cap' } },
  { tag: 'explorer', label: '城市玩家', emoji: '📷', desc: '喜欢上海，喜欢逛街', look: { body: '#9DB6CA', skin: '#EFCFB4', hair: '#7A5539', accessory: 'none' } },
];

const BODY_COLORS = ['#E8C77A', '#A9C2A0', '#9DB6CA', '#F0C4C6', '#C98068', '#A47B5B', '#6F8BA4'];

export function Onboarding() {
  const start = useTown((s) => s.start);
  const [step, setStep] = useState<0 | 1>(0);
  const [pick, setPick] = useState(0);
  const [body, setBody] = useState<string | undefined>();
  const [name, setName] = useState('');
  const preset = LIFE_TAGS[pick];
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-gradient-to-b from-cream-100/80 to-sakura-200/70 p-4 backdrop-blur-sm">
      <div className="wobble-in w-full max-w-xl rounded-[2rem] bg-cream-50 p-6 shadow-soft ring-1 ring-cream-200">
        <div className="text-center">
          <div className="text-xs font-bold tracking-[0.3em] text-sage-700">SANLINBANG</div>
          <h1 className="mt-1 text-3xl font-black text-cocoa-800">三邻邦 <span className="align-middle text-xs font-bold text-stone-400">v{APP_VERSION}</span></h1>
          <div className="mt-1 text-[11px] text-stone-500">本版更新：{APP_BUILD_NOTE}</div>
          <p className="mt-1 text-sm text-stone-600">在上海，逛着逛着，就可能找到下一位客户。</p>
        </div>
        {step === 0 ? (
          <div className="mt-5" data-testid="onboard-step-avatar">
            <div className="mb-2 text-sm font-bold">① 选一个小人（只是生活标签，随时能换）</div>
            <div className="grid grid-cols-3 gap-2">
              {LIFE_TAGS.map((t, i) => (
                <button key={t.tag} onClick={() => { setPick(i); setBody(undefined); }} className={`jelly flex flex-col items-center gap-1 rounded-2xl p-3 text-center ${i === pick ? 'bg-almond-300 ring-2 ring-almond-500' : 'bg-cream-100'}`}>
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-sm text-cocoa-800">{t.label}</span>
                  <span className="text-[10px] font-normal text-stone-600">{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-600">衣服颜色</span>
              {BODY_COLORS.map((c) => <button key={c} aria-label={c} onClick={() => setBody(c)} className={`h-6 w-6 rounded-full shadow-soft ${((body ?? preset.look.body) === c) ? 'ring-2 ring-cocoa-600 ring-offset-2' : ''}`} style={{ background: c }} />)}
            </div>
            <input className="input mt-3" placeholder="给小人起个昵称（可选）" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
            <Btn size="lg" className="mt-4 w-full" onClick={() => setStep(1)}>下一步</Btn>
          </div>
        ) : (
          <div className="mt-5" data-testid="onboard-step-spawn">
            <div className="mb-2 text-sm font-bold">② 选择你出发的街道</div>
            <div className="grid gap-2">
              {DISTRICT_ORDER.map((d: DistrictKey) => (
                <button key={d} onClick={() => start(name.trim(), preset.tag, { ...preset.look, body: body ?? preset.look.body }, d)} className="jelly flex items-center justify-between rounded-2xl bg-cream-100 px-4 py-3 text-left hover:bg-almond-300">
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
