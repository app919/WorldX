/**
 * 打包可下载的游戏：
 *   release/三邻邦-OPC-Town-<版本>.zip
 *     ├─ 三邻邦.html   双击即可在浏览器里离线游玩（单文件，所有代码与资源已内嵌）
 *     ├─ 使用说明.txt
 *     └─ source/              完整源码（不含 node_modules），可二次开发
 *
 * 用法：npm run package
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const out = join(root, 'release');
const stage = join(out, 'stage');
const name = `三邻邦-OPC-Town-v${pkg.version}`;

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

console.log('1/4 构建单文件版本…');
execSync('npx tsc -b && npx vite build -c vite.single.config.ts', { cwd: root, stdio: 'inherit' });
cpSync(join(root, 'dist-single', 'index.html'), join(stage, '三邻邦.html'));

console.log('2/4 复制源码…');
const skip = new Set(['node_modules', 'dist', 'dist-single', 'dist-v9', 'release', 'e2e/screenshots', 'e2e/playtest', 'e2e/backend-flow', 'server/data', 'tsconfig.tsbuildinfo']);
// 逐个复制顶层条目（不能把项目目录整体复制进自己的子目录）
for (const entry of readdirSync(root)) {
  if (skip.has(entry)) continue;
  cpSync(join(root, entry), join(stage, 'source', entry), {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(root.length + 1).replace(/\\/g, '/');
      return ![...skip].some((s) => rel === s || rel.startsWith(`${s}/`));
    },
  });
}

// 测试链路、需求核对与最近一次自检报告（截图 + 结果）
cpSync(join(root, 'docs', 'TEST_GUIDE.md'), join(stage, '测试链路与检验标准.md'));
cpSync(join(root, 'docs', 'REQUIREMENTS_CHECK.md'), join(stage, '需求核对.md'));
cpSync(join(root, 'docs', 'BACKEND.md'), join(stage, '后端与部署说明.md'));
// 自检截图：缩到 960 宽、转成 JPG（体积约为 PNG 的 1/8，看得清就够了）；没有 ImageMagick 时原样复制
if (existsSync(join(root, 'e2e', 'playtest'))) {
  const dst = join(stage, '自检报告');
  mkdirSync(dst, { recursive: true });
  let hasConvert = true;
  try { execSync('convert -version', { stdio: 'ignore' }); } catch { hasConvert = false; }
  for (const f of readdirSync(join(root, 'e2e', 'playtest'))) {
    const src = join(root, 'e2e', 'playtest', f);
    if (hasConvert && f.endsWith('.png')) execSync(`convert "${src}" -resize '960x>' -quality 70 "${join(dst, f.replace(/\.png$/, '.jpg'))}"`);
    else cpSync(src, join(dst, f), { recursive: true });
  }
}
console.log('3/4 写使用说明…');
writeFileSync(join(stage, '使用说明.txt'), `三邻邦（OPC Town）  v${pkg.version}
在上海，逛着逛着，就可能找到下一位客户。

【直接玩】
  双击「三邻邦.html」，用 Chrome / Edge / Safari 等现代浏览器打开即可，无需联网、无需安装。
  进度保存在当前浏览器里；换浏览器或清除浏览数据后会重新开始。

【操作】
  WASD / 方向键：走路   Shift：跑步   空格：蹦一下   鼠标点击地面：自动寻路   滚轮：缩放
  手机：左下角摇杆
  规则：只能走人行道，从斑马线过马路，从门口进店。

【三条街道】
  武康大楼（淮海中路 × 武康路 · 五岔路口 · 安福路）
  洋泾社区（社区主路、支路、东西路、北路）
  甜爱路及四川北路（甜爱路、甜爱支路、山阴路、横浜路）
  路网、建筑位置为示意；重点建筑模型待按授权实景照片校准。

【说明】
  街上的人物与店铺全部是虚构的演示数据；AI 为离线规则引擎，不联网、不调用大模型。
  星星与成长值只用于游戏内成长，不能兑换人民币。

【二次开发】
  进入 source 文件夹：
    npm install
    npm run dev        开发模式（http://localhost:5180）
    npm test           单元测试（含全量道路走查）
    npm run package    重新打包
  只部署服务器（不需要开发工具）：npm run build 之后在服务器上 npm ci --omit=dev，依赖体积约为完整安装的 1/4。

【体积】
  「三邻邦.html」就是完整的游戏（约 2MB）。node_modules 是开发工具链（构建、测试、类型检查），只在二次开发时需要，不影响游戏本身。
`);

console.log('4/4 压缩…');
const zip = join(out, `${name}.zip`);
if (existsSync(zip)) rmSync(zip);
execSync(`cd "${stage}" && zip -9 -qr "${zip}" .`, { stdio: 'inherit' });
rmSync(stage, { recursive: true, force: true });
// 只保留最近两个版本的发布包（更早的自动删除）
const verOf = (f) => (f.match(/v(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
const vers = [...new Set(readdirSync(out).map((f) => verOf(f).join('.')).filter(Boolean))]
  .sort((a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; });
const keep = new Set(vers.slice(0, 2));
for (const f of readdirSync(out)) { const v = verOf(f).join('.'); if (v && !keep.has(v)) rmSync(join(out, f), { force: true }); }
console.log(`完成：${zip}（保留版本：${[...keep].join('、')}）`);
