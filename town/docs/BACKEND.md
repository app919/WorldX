# 三邻邦（OPC Town）· 后端说明

## 架构
- **一个 Node.js 服务**（Fastify）同时提供 `/api` 接口和构建好的前端页面（同源，Cookie 会话）。
- **数据库：SQLite**（Node 内置 `node:sqlite`，单文件、WAL 模式，免费、无需单独安装数据库服务）。表结构在 `server/src/db.ts` 里集中定义并自动迁移；数据量变大后可以平滑迁移到 PostgreSQL（标准 SQL）。
- **全部免费开源组件**：Fastify、zod、mammoth（Word）、pdf-parse（PDF）、JSZip（PPTX）、LibreOffice（旧版 .doc / .ppt）。
- 唯一必须付费的是**短信验证码**（国内没有长期免费的正规短信渠道，阿里云 / 腾讯云约 ¥0.04–0.05 / 条，腾讯云新用户有免费试用条数）；微信扫码登录接口免费，但微信开放平台开发者认证 ¥300 / 年。Claude 提炼资料是可选项，不配置就用免费的规则提炼。

## 需求对照
| 需求 | 实现 |
|---|---|
| 1. 注册：手机号或微信扫码授权 | `/api/auth/sms/*`（手机号 + 验证码，限频：同号 60 秒 / 每天 10 次、同 IP 每小时 30 次，验证码 5 分钟有效、最多试 5 次）；`/api/auth/wechat/*`（开放平台 qrconnect，前端展示官方二维码并轮询结果）。首次登录即注册，必须同意协议。微信用户开店前要绑定手机号。 |
| 2. 信息保存数据库、真实有效 | 用户、会话、商业画像、店铺、上传资料、会话与消息、埋点、管理审计都在数据库；各模块的游戏进度也同步保存（换设备可继续）。手机号由短信验证，店铺规则（每人一家、实名唯一、铺位唯一、黄金位、营业执照校验位）由服务端校验并有数据库唯一约束兜底。 |
| 3. 不透露手机号与二维码 | 手机号 / 微信标识只存 **HMAC 哈希**（查重）+ **AES-256-GCM 密文**；本人只看到脱敏手机号；公开接口全部白名单字段；店铺文字与上传资料里的手机号、座机、微信号、邮箱自动替换为「已隐藏」；资料只提取文字，不保存 / 展示图片和二维码；私信里对方看到的联系方式也被隐藏（原文仅供管理员审计）。 |
| 4. 管理员看板 | `/admin.html`：注册用户（手机 / 微信）、DAU / WAU / MAU、PV / UV 趋势、每个功能模块 PV / UV、每个按钮 / 链接点击 PV / UV、「留微信号」点击、店铺、上传资料、用户列表。管理员由 `ADMIN_PHONES` 指定。 |
| 5. 消息可追踪 | 所有私信原文入库，管理员可按昵称 / 内容搜索、只看含联系方式的会话、查看完整聊天；每次查看写入审计日志。用户注册时同意的协议里已告知。 |
| 6. 开店资料解析 | 公司简介 / 产品简介支持 PPT、PPTX、PDF、DOC、DOCX、TXT；按文件头识别类型，抽取文字，去掉联系方式，提炼成「标题 · 一句话介绍 · 简介 · 亮点 · 产品 · 服务过的客户」，开店时展示在店铺页。 |
| 7. 用户互发消息 + 留微信号按钮 | 站内私信（会话列表、未读数、已读、3 秒刷新）；「留微信号」按钮暂不开放，点击写入埋点，看板可见。 |

## 本地开发
```bash
npm install
npm run server          # 后端：http://localhost:8787（短信验证码打印在日志里，微信为模拟扫码页）
npm run dev             # 前端：http://localhost:5180（/api 自动转发到后端）
```
- 不启动后端、或直接双击打开单文件 HTML 时，进入**离线演示模式**（和以前一样，数据只在本机浏览器）。
- 测试：`npm test`（含后端接口测试）；全链路：启动后端后 `BASE_URL=http://localhost:8787 node e2e/backend-flow.cjs`。

## 部署（自有服务器 / 云主机）
1. 复制 `server/.env.example` 为环境变量，填好 `SESSION_SECRET`、`DATA_KEY`、`PUBLIC_URL`、短信与微信配置、`ADMIN_PHONES`。
2. Docker：`docker build -t sanlinbang . && docker run -d -p 8787:8787 -v /srv/sanlinbang:/data --env-file .env sanlinbang`
   或直接：`npm ci && npm run build && npm run server:start`
3. 前面放 Nginx / Caddy 做 HTTPS（Caddy 自动申请免费的 Let's Encrypt 证书）。
4. 备份：定期复制 `/data/sanlinbang.db`（SQLite 可在线 `.backup`）和 `/data/uploads`。
5. 国内上线需要：域名 ICP 备案；短信签名与模板审核；微信开放平台网站应用审核（回调域名填你的域名）。
