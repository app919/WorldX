import type { ReactNode, ButtonHTMLAttributes } from 'react';

type Tone = 'almond' | 'sage' | 'cream' | 'sakura' | 'haze' | 'brick';
const TONE: Record<Tone, string> = {
  almond: 'bg-almond-400 text-cocoa-800',
  sage: 'bg-sage-400 text-white',
  cream: 'bg-cream-100 text-cocoa-600 ring-1 ring-cream-300',
  sakura: 'bg-sakura-300 text-cocoa-800',
  haze: 'bg-haze-300 text-cocoa-800',
  brick: 'bg-brick-400 text-white',
};

export function Btn({ tone = 'almond', size = 'md', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm';
  return <button {...p} className={`jelly ${TONE[tone]} ${sz} ${className}`} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-blob bg-cream-50 p-4 shadow-soft ring-1 ring-cream-200 ${className}`}>{children}</div>;
}

export function Chip({ children, tone = 'cream', className = '' }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`chip ${TONE[tone]} ${className}`}>{children}</span>;
}

export function Panel({ title, subtitle, onClose, children, className = '', testId }: { title: ReactNode; subtitle?: ReactNode; onClose?: () => void; children: ReactNode; className?: string; testId?: string }) {
  return (
    <div data-testid={testId} className={`wobble-in pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-blob glass ring-1 ring-cream-200 ${className}`}>
      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        <div>
          <div className="text-lg font-black text-cocoa-800">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-stone-600">{subtitle}</div>}
        </div>
        {onClose && (
          <button aria-label="关闭" onClick={onClose} className="jelly grid h-8 w-8 shrink-0 place-items-center bg-cream-100 text-cocoa-600">✕</button>
        )}
      </div>
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">{children}</div>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-cocoa-800/25 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-haze-200/70 px-3 py-2 text-[11px] leading-relaxed text-haze-600">ⓘ {children}</div>;
}

export function Avatar({ color, hair, label, size = 36 }: { color: string; hair?: string; label?: string; size?: number }) {
  return (
    <div className="relative grid shrink-0 place-items-center rounded-full shadow-soft" style={{ width: size, height: size, background: `radial-gradient(circle at 50% 65%, #F6DCC8 0 46%, ${hair ?? '#4A3426'} 47% 100%)`, outline: `3px solid ${color}` }}>
      {label && <span className="absolute -bottom-1 -right-1 rounded-full bg-cream-50 px-1 text-[9px] font-bold shadow">{label}</span>}
    </div>
  );
}

/**
 * 侧边抽屉（桌面）/ 底部弹出层（手机）：地图始终是视觉主体，面板不遮挡太多城市。
 */
export function Drawer({ title, subtitle, onClose, children, testId, wide }: { title: ReactNode; subtitle?: ReactNode; onClose?: () => void; children: ReactNode; testId?: string; wide?: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-[5.2rem] z-20 flex max-h-[58%] md:inset-x-auto md:bottom-24 md:right-3 md:top-[10.5rem] md:max-h-none ${wide ? 'md:w-[30rem]' : 'md:w-[26rem]'}`}>
      <Panel testId={testId} title={title} subtitle={subtitle} onClose={onClose} className="w-full rounded-b-none md:rounded-b-blob">{children}</Panel>
    </div>
  );
}

export function Pill({ children, tone = 'cream', title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[tone]}`}>{children}</span>;
}
