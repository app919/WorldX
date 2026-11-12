import { useState } from 'react';
import type { CommunityEvent } from '../domain/types';
import { ME, residentById, useTown } from '../store/useTown';
import { Btn, Card, Chip, Disclaimer, Panel } from './kit';

const SPACES: { id: CommunityEvent['space']; name: string; emoji: string; desc: string }[] = [
  { id: 'coffee_lounge', name: '咖啡客厅', emoji: '☕', desc: '兴趣交流、自由聊天' },
  { id: 'startup_lounge', name: '创业会客厅', emoji: '🛋️', desc: '商务对接、产品介绍' },
  { id: 'street_market', name: '街区小市集', emoji: '🎪', desc: '品牌展示、线下活动' },
];

export function CommunityPanel() {
  const events = useTown((s) => s.events);
  const join = useTown((s) => s.joinEvent);
  const setTab = useTown((s) => s.setTab);
  const marketing = useTown((s) => s.marketingOptIn);
  const [creating, setCreating] = useState(false);
  const [space, setSpace] = useState<CommunityEvent['space'] | 'all'>('all');
  const list = events.filter((e) => space === 'all' || e.space === space).filter((e) => marketing || !e.sponsor);

  return (
    <Panel testId="community-panel" title="☕ 社区" subtitle="线上会议 · 线下见面会 · 主题市集 —— 任何人都可以发起" onClose={() => setTab('city')} className="h-full w-full">
      <div className="grid grid-cols-3 gap-2">
        {SPACES.map((s) => (
          <button key={s.id} onClick={() => setSpace(space === s.id ? 'all' : s.id)} className={`jelly flex flex-col items-center rounded-2xl p-2 text-center ${space === s.id ? 'bg-almond-300' : 'bg-cream-100'}`}>
            <span className="text-2xl">{s.emoji}</span>
            <span className="text-xs text-cocoa-800">{s.name}</span>
            <span className="text-[10px] font-normal text-stone-600">{s.desc}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm font-black">本周活动</div>
        <Btn size="sm" onClick={() => setCreating(!creating)}>{creating ? '收起' : '+ 发起活动'}</Btn>
      </div>
      {creating && <CreateEvent onDone={() => setCreating(false)} />}
      <div className="mt-2 space-y-2">
        {list.map((e) => {
          const host = e.hostId === ME ? '我' : residentById(e.hostId)?.nickname;
          const joined = e.attendees.includes(ME);
          return (
            <Card key={e.id} className="!p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-black">{e.title}</div>
                  <div className="text-xs text-stone-600">{e.weekday} {e.time} · {e.online ? '线上' : '线下'} · {SPACES.find((s) => s.id === e.space)?.name} · 主办：{host}</div>
                </div>
                {e.sponsor && <Chip tone="sakura">{e.sponsor.disclosure} · {e.sponsor.brand}</Chip>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <Chip tone="cream">{e.attendees.length}/{e.capacity} 人</Chip>
                <Chip tone="cream">{e.fee ? `¥${e.fee}` : '免费'}</Chip>
                {e.needsApproval && <Chip tone="cream">需主理人审核</Chip>}
                {e.aiHost && <Chip tone="haze">🤖 AI 社区主持人</Chip>}
                {e.isDemo && <Chip tone="cream">演示活动</Chip>}
                <Btn size="sm" className="ml-auto" tone={joined ? 'sage' : 'almond'} onClick={() => join(e.id)} disabled={joined}>{joined ? '已报名' : '报名'}</Btn>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-3"><Disclaimer>AI 社区主持人可以欢迎新成员、介绍主题、分配话题、整理纪要与可能的合作；涉及真实人物评价、个人隐私、收费、承诺和争议处理时，由主理人本人决定。赞助内容均明确标注，可在「我的」中关闭营销推荐。</Disclaimer></div>
    </Panel>
  );
}

function CreateEvent({ onDone }: { onDone: () => void }) {
  const create = useTown((s) => s.createEvent);
  const [f, setF] = useState({ title: '', space: 'coffee_lounge' as CommunityEvent['space'], online: false, weekday: '周四', time: '19:30', capacity: 12, fee: 0, sponsorAllowed: false, needsApproval: false, aiHost: true });
  return (
    <Card className="mt-2 space-y-2 !p-3 wobble-in">
      <input className="input" placeholder="活动标题，例如：AI 视频创作者夜聊" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <div className="flex flex-wrap gap-2 text-xs">
        <select className="input !w-auto" value={f.space} onChange={(e) => setF({ ...f, space: e.target.value as CommunityEvent['space'] })}>
          {SPACES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input !w-auto" value={f.weekday} onChange={(e) => setF({ ...f, weekday: e.target.value })}>
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((d) => <option key={d}>{d}</option>)}
        </select>
        <input className="input !w-24" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        <label className="flex items-center gap-1">人数上限 <input className="input !w-16" type="number" min={2} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></label>
        <label className="flex items-center gap-1">费用 ¥ <input className="input !w-16" type="number" min={0} value={f.fee} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} /></label>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label><input type="checkbox" checked={f.online} onChange={(e) => setF({ ...f, online: e.target.checked })} /> 线上</label>
        <label><input type="checkbox" checked={f.sponsorAllowed} onChange={(e) => setF({ ...f, sponsorAllowed: e.target.checked })} /> 允许品牌赞助</label>
        <label><input type="checkbox" checked={f.needsApproval} onChange={(e) => setF({ ...f, needsApproval: e.target.checked })} /> 报名需审核</label>
        <label><input type="checkbox" checked={f.aiHost} onChange={(e) => setF({ ...f, aiHost: e.target.checked })} /> 我不在时由 AI 主持</label>
      </div>
      <Btn size="sm" disabled={!f.title.trim()} onClick={() => { create(f); onDone(); }}>发布活动</Btn>
    </Card>
  );
}
