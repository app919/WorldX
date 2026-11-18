/**
 * 店门口的一幕：按店铺类别和当地时间画出门面（雨棚用身份色、招牌写店名、橱窗里是行业图标、夜里亮灯），
 * 再配一句「此刻店里正在发生什么」。让人一进店就有「站在这家店门口」的感觉。
 */
import { useTown } from '../store/useTown';
import { isNight } from '../scene/clock';

/** 行业关键词 → 最贴切的图标（用图要准：咖啡店是咖啡，摄影棚是相机） */
const CAT_ICON: [RegExp, string][] = [
  [/咖啡|烘焙|茶/, '☕'], [/摄影|拍|影像|影棚/, '📷'], [/视频|剪辑|短片|宣传片/, '🎬'], [/直播/, '🎥'], [/设计|视觉|品牌|插画|包装/, '🎨'],
  [/AI|智能|Agent|算法/i, '🤖'], [/开发|软件|程序|小程序|网站|SaaS/i, '💻'], [/餐|面|饭|糕|甜|食|厨/, '🍜'], [/花/, '💐'],
  [/宠物/, '🐾'], [/教育|培训|课程|辅导|内训/, '📚'], [/财税|会计|记账|法律|合规|知识产权/, '📑'], [/咨询|顾问|策划|营销|增长/, '💡'],
  [/电商|货源|零售|选品/, '🛍️'], [/手作|文创|手工|陶|布/, '🧵'], [/硬件|制造|打样|智造/, '🔧'], [/出海|跨境|外贸|翻译/, '🌏'],
  [/投资|基金|孵化|资本/, '💼'], [/健康|健身|瑜伽|医/, '🧘'], [/音乐|声音|配音/, '🎧'], [/写作|文案|内容|出版/, '✍️'],
];
export function catIcon(text: string): string {
  for (const [re, ic] of CAT_ICON) if (re.test(text)) return ic;
  return '🏪';
}

/** 当地时段的一句场景 */
export function timeScene(h: number): { label: string; line: string } {
  if (h < 5) return { label: '深夜', line: '街上很安静，只有橱窗还亮着' };
  if (h < 9) return { label: '清晨', line: '卷帘门刚拉起来，门口在洒水' };
  if (h < 11.5) return { label: '上午', line: '梧桐影子落在门口，店里刚忙起来' };
  if (h < 13.5) return { label: '中午', line: '午休的人路过，顺手推门看了一眼' };
  if (h < 17) return { label: '午后', line: '阳光斜斜照进橱窗，正是聊合作的时候' };
  if (h < 19.5) return { label: '傍晚', line: '招牌灯刚亮，下班的人陆续路过' };
  return { label: '夜里', line: '橱窗还亮着，AI 分身在门口守店' };
}
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

export function StoreFront({ name, category, color, online, owner, tint = '#FFF6EC', note }: { name: string; category: string; color: string; online?: boolean; owner?: string; tint?: string; note?: string }) {
  const hour = useTown((s) => s.hour);
  const night = isNight(hour);
  const icon = catIcon(`${category} ${name}`);
  const sc = timeScene(hour);
  const who = owner ? `主理人${owner}` : '主理人';
  const status = note ?? (online ? `${who}在店里，可以直接聊` : `${who}暂时不在，AI 分身在门口接待`);
  const sky = night ? 'linear-gradient(180deg,#2B2F55,#4A3D6B)' : hour >= 17 ? 'linear-gradient(180deg,#F6B97A,#F3D6A6)' : 'linear-gradient(180deg,#BFE3F5,#EAF6FB)';
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-cream-200" data-testid="storefront">
      <div className="relative h-28" style={{ background: sky }}>
        <svg viewBox="0 0 360 112" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden>
          {/* 梧桐 */}
          <circle cx="30" cy="34" r="26" fill={night ? '#2F4A3A' : '#7DBB6E'} /><circle cx="52" cy="22" r="20" fill={night ? '#355441' : '#8FCB7C'} />
          <rect x="36" y="44" width="6" height="68" fill="#7A5A44" />
          {/* 楼体 */}
          <rect x="70" y="8" width="230" height="104" fill={night ? '#5A4A44' : '#E9D6C3'} />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={86 + i * 54} y="16" width="34" height="18" rx="2" fill={night ? (i % 2 ? '#F9D77E' : '#3A3140') : '#CFE3EE'} />)}
          {/* 招牌 */}
          <rect x="84" y="40" width="202" height="20" rx="4" fill="#2B1D16" />
          {/* 雨棚（身份色条纹） */}
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${80 + i * 23.3} 60 h23.3 l-3 14 h-17.3 z`} fill={i % 2 ? '#FFF6EC' : color} />)}
          {/* 橱窗 + 门 */}
          <rect x="90" y="76" width="120" height="36" rx="3" fill={night ? '#FFD88A' : '#DDEEF5'} opacity={night ? 0.95 : 0.9} />
          <rect x="222" y="74" width="52" height="38" rx="3" fill="#6B4A36" /><circle cx="266" cy="94" r="2" fill="#F9D77E" />
          {online && <rect x="222" y="74" width="52" height="38" rx="3" fill="#FFE7A8" opacity="0.35" />}
          {/* 门口小盆栽与灯 */}
          <rect x="300" y="96" width="14" height="16" rx="2" fill="#B5733E" /><circle cx="307" cy="92" r="9" fill={night ? '#3D5E47' : '#6FAE60'} />
          <rect x="324" y="40" width="3" height="72" fill="#2B1D16" /><circle cx="325.5" cy="38" r="6" fill={night ? '#FFE08A' : '#E8E1D4'} />
          {night && <circle cx="325.5" cy="38" r="18" fill="#FFE08A" opacity="0.25" />}
        </svg>
        <div className="absolute left-[23.5%] right-[20.5%] top-[35.5%] truncate text-center text-[11px] font-black tracking-wider text-[#F9D77E]">{name}</div>
        <div className="absolute bottom-1.5 left-[26%] text-2xl drop-shadow">{icon}</div>
        <div className="absolute right-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-white">{sc.label} {hhmm(hour)}</div>
      </div>
      <div className="px-3 py-2 text-xs leading-relaxed" style={{ background: tint }}>
        <span className="font-bold text-cocoa-800">{sc.line}。</span>
        <span className="text-stone-600">{status}。</span>
      </div>
    </div>
  );
}
