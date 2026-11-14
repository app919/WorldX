# 三邻邦（OPC Town）· 启动步骤

只需要 **Node.js 22 或更高版本**（自带 SQLite，不用另装数据库）。在 macOS / Linux / Windows (PowerShell) 都可以。

## 一、最快：一条命令跑起来（本地体验 / 演示）

```bash
git clone https://github.com/app919/WorldX.git
cd WorldX/town
git checkout claude/shanghai-opc-town-redesign-rlcbnu
npm install
ADMIN_PHONES=13900000000 npm start
```

Windows PowerShell 把最后一行换成：

```powershell
$env:ADMIN_PHONES="13900000000"; npm start
```

首次会先构建前端（约 1 分钟），看到 `三邻邦后端已启动：http://localhost:8787` 后打开：

| 地址 | 是什么 |
|------|--------|
| http://localhost:8787 | 三邻邦街区（玩家端） |
| http://localhost:8787/admin.html | 管理后台（数据看板、消息审查） |

**登录：**
- 手机号：随便填一个 11 位手机号 → 点「获取验证码」。开发模式不发真短信，验证码会**直接显示在登录框下方**，同时打印在终端里。
- 微信扫码：开发模式会弹出模拟扫码页，点「确认登录」即可。
- 管理员：用 `ADMIN_PHONES` 里的手机号（上例 `13900000000`）登录，再打开 `/admin.html`。多个管理员用英文逗号分隔。

数据保存在 `town/server/data/sanlinbang.db`，删掉这个文件就是全新的数据库。

## 二、开发模式（改代码实时刷新）

开两个终端：

```bash
cd WorldX/town
ADMIN_PHONES=13900000000 npm run server
```

```bash
cd WorldX/town
npm run dev
```

打开 http://localhost:5180（前端，`/api` 自动转发到 8787 的后端）。

## 三、不需要后端的离线版

`release/` 里的 `三邻邦-OPC-Town-v1.0.0.html` 双击即可打开，无需登录，数据只存在本机浏览器里，适合路演现场断网演示。

## 四、自测

```bash
npm test                         # 单元 + 接口测试
node e2e/backend-flow.cjs        # 需先 npm start：注册→开店→上传资料→私信→后台 全链路
```

## 五、上线正式环境（要点）

1. 复制 `server/.env.example` 为 `server/.env`，至少设置：
   - `NODE_ENV=production`
   - `PUBLIC_URL=https://你的域名`
   - `SESSION_SECRET`、`DATA_KEY`：各一串 32 位以上随机字符（`openssl rand -hex 32`），**DATA_KEY 一旦使用不能更换**，否则加密的手机号无法解密
   - `SMS_PROVIDER=aliyun` 或 `tencent` 以及对应密钥（生产环境禁止开发模式短信）
   - `WECHAT_MODE=live`、`WECHAT_APP_ID`、`WECHAT_APP_SECRET`（微信开放平台「网站应用」，回调域名填你的域名）
   - `ADMIN_PHONES`
2. `npm ci && npm run build && npx tsx --env-file=server/.env server/src/server.ts`，用 pm2 / systemd 守护，前面放 Nginx 或 Caddy 做 HTTPS。
3. 定期备份 `DB_PATH` 指向的 SQLite 文件。

详见 `docs/BACKEND.md`。

## 常见问题

| 现象 | 处理 |
|------|------|
| `node:sqlite` 报错 / 找不到模块 | Node 版本低于 22，升级 Node |
| 端口被占用 | `PORT=8788 PUBLIC_URL=http://localhost:8788 npm start` |
| 登录后看不到后台 | 登录用的手机号不在 `ADMIN_PHONES` 里；改完要重启服务 |
| 上传旧版 .doc / .ppt 解析失败 | 需要本机安装 LibreOffice；.docx / .pptx / .pdf 不需要 |
