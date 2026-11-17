/**
 * 店主管理「公司主页」资料（正式版）：公司介绍视频、路演 / 演讲 PPT（自动转 PDF 在线翻看）、产品资料 PDF。
 * 视频较大，上传带进度条；被管理员下架的资料会显示原因。
 */
import { useEffect, useState } from 'react';
import { api } from '../net/api';
import { useServer, type ShopMedia } from '../store/useServer';
import { Card } from './kit';

const KIND: Record<ShopMedia['kind'], { label: string; accept: string; hint: string }> = {
  video: { label: '🎬 公司介绍视频', accept: '.mp4,.webm,.mov', hint: 'MP4 / WebM / MOV，最大 200MB，最多 5 个' },
  deck: { label: '📑 路演 / 演讲 PPT', accept: '.pdf,.ppt,.pptx', hint: 'PPT / PPTX / PDF，自动转成在线翻看，最多 3 份' },
  product: { label: '📄 产品资料', accept: '.pdf', hint: 'PDF，最多 6 份' },
};

export function ShopMediaManager() {
  const mode = useServer((s) => s.mode);
  const me = useServer((s) => s.me);
  const [list, setList] = useState<ShopMedia[]>([]);
  const [prog, setProg] = useState<{ kind: string; pct: number } | null>(null);
  const [err, setErr] = useState('');
  const load = () => api<{ media: ShopMedia[] }>('/api/shops/mine/media').then((r) => setList(r.media)).catch(() => {});
  useEffect(() => { if (mode === 'online' && me?.shopId) void load(); }, [mode, me?.shopId]);
  if (mode !== 'online') {
    return (
      <Card className="!p-3">
        <div className="text-sm font-black">🎬 公司主页资料</div>
        <div className="mt-1 text-xs text-stone-600">正式版可以给小店上传公司介绍视频、路演 PPT 和产品资料，逛到你店的人会看到一张完整的公司主页。离线演示不上传文件。</div>
      </Card>
    );
  }
  if (!me?.shopId) return null;
  const upload = (kind: ShopMedia['kind'], file: File) => {
    setErr('');
    const fd = new FormData();
    fd.append('kind', kind); fd.append('title', file.name.replace(/\.[^.]+$/, '').slice(0, 60)); fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/shops/mine/media');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProg({ kind, pct: Math.round((e.loaded / e.total) * 100) }); };
    xhr.onload = () => {
      setProg(null);
      if (xhr.status >= 300) { try { setErr(JSON.parse(xhr.responseText).error ?? '上传失败'); } catch { setErr('上传失败'); } return; }
      void load(); void useServer.getState().loadShops();
    };
    xhr.onerror = () => { setProg(null); setErr('网络中断，请重试'); };
    setProg({ kind, pct: 0 });
    xhr.send(fd);
  };
  const remove = async (id: string) => { await api(`/api/shops/mine/media/${id}`, { method: 'DELETE' }); void load(); void useServer.getState().loadShops(); };
  return (
    <Card className="!p-3">
      <div className="text-sm font-black">🎬 公司主页资料</div>
      <div className="mt-0.5 text-xs text-stone-600">逛到你店的人会看到：介绍视频 → 公司简介 → 产品 → 路演 PPT → 正在寻找的合作。</div>
      <div className="mt-2 space-y-2" data-testid="media-manager">
        {(Object.keys(KIND) as ShopMedia['kind'][]).map((k) => (
          <div key={k} className="rounded-xl bg-cream-100 p-2 text-xs">
            <div className="flex items-center gap-2">
              <b>{KIND[k].label}</b>
              <label className="ml-auto cursor-pointer rounded-full bg-almond-300 px-2 py-0.5 font-bold">上传
                <input type="file" className="hidden" accept={KIND[k].accept} data-testid={`media-input-${k}`} disabled={!!prog} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(k, f); e.target.value = ''; }} />
              </label>
            </div>
            <div className="text-[10px] text-stone-400">{KIND[k].hint}</div>
            {prog?.kind === k && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream-200"><i className="block h-full bg-almond-500" style={{ width: `${prog.pct}%` }} /></div>}
            {list.filter((m) => m.kind === k && m.status !== 'removed').map((m) => (
              <div key={m.id} className="mt-1 flex items-center gap-2">
                <a href={m.url} target="_blank" rel="noreferrer" className="truncate underline">{m.title}</a>
                <span className="text-[10px] text-stone-400">{m.status === 'converting' ? '转换中…' : m.status === 'failed' ? '转换失败，请另存为 PDF 再传' : `${(m.size / 1048576).toFixed(1)}MB`}</span>
                <button className="ml-auto text-[10px] text-stone-400 underline" onClick={() => remove(m.id)}>删除</button>
              </div>
            ))}
            {list.filter((m) => m.kind === k && m.status === 'removed' && m.removedReason && m.removedReason !== '店主删除').map((m) => (
              <div key={m.id} className="mt-1 text-[10px] text-brick-500">「{m.title}」已被下架：{m.removedReason}（详见「消息」里的整改提醒）</div>
            ))}
          </div>
        ))}
        {err && <div className="text-xs text-brick-500">{err}</div>}
      </div>
    </Card>
  );
}
