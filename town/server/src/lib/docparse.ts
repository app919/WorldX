/**
 * 店铺资料解析：公司简介 / 产品简介，支持 PPT / PDF / Word（新旧格式）/ TXT。
 *
 * 流程：识别文件类型（看文件头，不只看扩展名）→ 抽取正文（只取文字，图片 / 二维码一律不取）
 *     → 去掉手机号、微信号、邮箱等联系方式 → 提炼成统一的可展示内容。
 *
 * 用到的都是免费、成熟的开源组件：
 *   pdf-parse（PDF）、mammoth（docx）、JSZip（pptx）、LibreOffice（旧版 .doc / .ppt 先转换成新格式）。
 * 提炼默认用免费的规则；如果配置了 ANTHROPIC_API_KEY，会改用 Claude 提炼（付费、可选）。
 */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { z } from 'zod/v4';
import { config } from '../config.js';
import { redactContacts } from './crypto.js';

const run = promisify(execFile);

export type DocKind = 'company' | 'product';
export type FileType = 'pdf' | 'docx' | 'pptx' | 'doc' | 'ppt' | 'txt';
export const ACCEPT = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md'];

export const Summary = z.object({
  title: z.string().describe('公司名 / 产品线名称'),
  oneLiner: z.string().describe('一句话介绍，40 字以内'),
  about: z.string().describe('简介，200 字以内'),
  highlights: z.array(z.string()).describe('核心亮点 / 优势，最多 5 条，每条 30 字以内'),
  products: z.array(z.object({ name: z.string(), desc: z.string() })).describe('产品或服务，最多 8 个'),
  customers: z.array(z.string()).describe('服务过的客户类型或案例（不写具体联系人），最多 5 条'),
});
export type Summary = z.infer<typeof Summary>;

/** 按文件头识别类型 */
export function detectType(buf: Buffer, filename: string): FileType | null {
  const ext = extname(filename).toLowerCase();
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (buf[0] === 0x50 && buf[1] === 0x4b) { // ZIP：docx / pptx
    if (ext === '.pptx') return 'pptx';
    if (ext === '.docx') return 'docx';
    const s = buf.toString('latin1');
    if (s.includes('ppt/')) return 'pptx';
    if (s.includes('word/')) return 'docx';
    return null;
  }
  if (buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return ext === '.ppt' ? 'ppt' : 'doc'; // 旧版 Office
  if (ext === '.txt' || ext === '.md') return 'txt';
  return null;
}

async function pdfText(buf: Buffer): Promise<string> {
  // 直接引用实现文件，避开 pdf-parse 入口里的调试代码
  const mod = (await import('pdf-parse/lib/pdf-parse.js')) as unknown as { default: (b: Buffer) => Promise<{ text: string }> };
  return (await mod.default(buf)).text;
}

async function pptxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const out: string[] = [];
  for (const f of slides) {
    const xml = await zip.file(f)!.async('string');
    // 每个段落 <a:p> 一行，段落内的 <a:t> 拼起来
    const paras = xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('')).map(decodeXml).filter((t) => t.trim());
    if (paras.length) out.push(paras.join('\n'));
  }
  return out.join('\n\n');
}
const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** 旧版 .doc / .ppt：用 LibreOffice 转成 docx / pptx 再解析 */
async function convertLegacy(buf: Buffer, type: 'doc' | 'ppt'): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'slb-'));
  try {
    const src = join(dir, `in.${type}`);
    await (await import('node:fs/promises')).writeFile(src, buf);
    await run('soffice', ['--headless', '--convert-to', type === 'doc' ? 'docx' : 'pptx', '--outdir', dir, src], { timeout: 60_000 });
    const outName = (await readdir(dir)).find((f) => f.endsWith(type === 'doc' ? '.docx' : '.pptx'));
    if (!outName) throw new Error('转换失败');
    return await readFile(join(dir, outName));
  } catch {
    throw new Error(`旧版 .${type} 文件无法解析，请另存为 .${type}x 或 PDF 后再上传`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractText(buf: Buffer, type: FileType): Promise<string> {
  let text = '';
  if (type === 'pdf') text = await pdfText(buf);
  else if (type === 'docx') text = (await mammoth.extractRawText({ buffer: buf })).value;
  else if (type === 'pptx') text = await pptxText(buf);
  else if (type === 'doc') text = (await mammoth.extractRawText({ buffer: await convertLegacy(buf, 'doc') })).value;
  else if (type === 'ppt') text = await pptxText(await convertLegacy(buf, 'ppt'));
  else text = buf.toString('utf8');
  text = text.replace(/\r/g, '').replace(/[ \t　]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 10) throw new Error('没有读到文字内容（可能是扫描件或纯图片），请上传含文字的文件');
  return redactContacts(text).slice(0, 60_000);
}

/** —— 免费的规则提炼 —— */
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const BULLET = /^\s*(?:[•●◆■▪\-*·]|\d+[.、)）]|[一二三四五六七八九十]+[、.])\s*/;

export function summarizeByRules(text: string, kind: DocKind, filename: string): Summary {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\n/g, '').trim()).filter((p) => p.length > 12);
  // 按行再按句号切分（不把标题行和正文拼在一起）
  const sentences = lines.flatMap((l) => l.replace(BULLET, '').split(/(?<=[。！？!?])/)).map((s) => s.trim()).filter((s) => s.length >= 8);
  const title = lines.find((l) => l.length >= 2 && l.length <= 24 && !BULLET.test(l)) ?? filename.replace(/\.[^.]+$/, '');
  const oneLiner = cut(sentences.find((s) => s !== title && s.length <= 60) ?? sentences[0] ?? title, 40);
  const about = cut(paras.slice(0, 2).join(' ') || sentences.slice(0, 3).join(''), 200);
  const highlights = lines.filter((l) => BULLET.test(l) || /优势|特点|核心|亮点|专注|经验|获得|荣誉|认证/.test(l))
    .map((l) => cut(l.replace(BULLET, ''), 30)).filter((l) => l.length >= 4).slice(0, 5);
  // 产品：PPT 每页标题、带“产品 / 服务 / 方案 / 套餐 / 课程”的行，冒号前是名称
  const products: Summary['products'] = [];
  for (const l of lines) {
    if (products.length >= 8) break;
    const m = l.replace(BULLET, '').match(/^([^：:]{2,20})[：:]\s*(.{4,})$/);
    if (m && (kind === 'product' || /产品|服务|方案|套餐|课程|系列/.test(m[1]))) products.push({ name: m[1], desc: cut(m[2], 60) });
    else if (kind === 'product' && /产品|服务|方案|套餐|课程|系列/.test(l) && l.length <= 24) products.push({ name: l.replace(BULLET, ''), desc: '' });
  }
  const customers = lines.filter((l) => /客户|合作|案例|服务过/.test(l)).map((l) => cut(l.replace(BULLET, ''), 40)).slice(0, 5);
  return Summary.parse({ title: cut(title, 24), oneLiner, about, highlights, products, customers });
}

/** —— 可选：Claude 提炼（结构化输出） —— */
export async function summarizeByClaude(text: string, kind: DocKind): Promise<Summary | null> {
  if (!config.anthropicKey) return null;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod');
  const client = new Anthropic({ apiKey: config.anthropicKey });
  const res = await client.beta.messages.parse({
    model: config.anthropicModel,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: zodOutputFormat(Summary) },
    system: '你是商业信息编辑。从用户上传的资料中提炼可以公开展示在店铺页的内容。只使用资料里有的信息，不编造；不要输出任何手机号、微信号、邮箱、二维码、个人姓名等联系方式或隐私信息；用简体中文，简洁、具体。',
    messages: [{ role: 'user', content: `这是一份${kind === 'company' ? '公司简介' : '产品简介'}资料的全文：\n\n${text}\n\n请按字段提炼。` }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) return null;
  return Summary.parse(JSON.parse(redactContacts(JSON.stringify(res.parsed_output))));
}

export async function parseDoc(buf: Buffer, filename: string, kind: DocKind): Promise<{ type: FileType; text: string; summary: Summary; method: 'rules' | 'claude' }> {
  const type = detectType(buf, filename);
  if (!type) throw new Error('不支持的文件格式，请上传 PPT / PDF / Word / TXT');
  const text = await extractText(buf, type);
  let summary: Summary | null = null;
  try { summary = await summarizeByClaude(text, kind); } catch (e) { console.warn('[文档解析] Claude 提炼失败，改用规则：', String(e)); }
  return { type, text, summary: summary ?? summarizeByRules(text, kind, filename), method: summary ? 'claude' : 'rules' };
}
