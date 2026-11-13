# 架构与数据模型

## 1. 设计原则

1. **游戏场景与商业逻辑分离**：`src/domain` 是纯 TypeScript，不依赖 three.js / React，可以原样搬到服务端（Node）或用作 FastAPI 服务的规格说明。
2. **关系由结构化数据生成**：匹配只在 `taxonomy.ts` 的标签表上推理；AI（现在是规则，将来是大模型）只负责把自然语言映射到标签，并且必须经用户确认。
3. **可解释优先**：每条推荐都带理由、分项得分、信息来源、缺失信息与“未确认”状态。
4. **人做决定，AI 做准备**：Agent 的 L3 动作、联系方式交换、合作记录都只能由本人完成。
5. **简单到非专业程序员也能维护**：一个前端项目 + 一份 SQL；没有 UE5、没有物理引擎、没有 Agent 集群。

## 2. 当前（Phase 1 Demo）架构

```
┌──────────────────────── 浏览器 ────────────────────────┐
│  ui/  (React + Tailwind)        scene/ (R3F + three.js) │
│  底部五入口 · 卡片 · 弹窗        街区 · 角色 · 反馈动画   │
│            │                          │                 │
│            └──── store/useTown (Zustand) ────┘          │
│                     │  persist → localStorage           │
│                     ▼                                    │
│  domain/  commerce · agent · introductions · economy    │
│  world/   街区 · 导航网格 · 碰撞   data/ 档案 · 演示数据 │
│  services/aiProvider  ──(可选)──▶ HTTP AI 服务           │
└──────────────────────────────────────────────────────────┘
```

## 3. 目标架构（Phase 2–3）

```
客户端：三邻邦（3D 城市 / Q 版角色 / 店铺 / UI / 社区）
        │
统一业务 API（Supabase：Auth · RLS 权限 · Realtime 在线状态与聊天）
        │
 ┌──────────┬──────────────┬───────────────┬──────────────┐
 游戏服务    OPC 服务        AI 服务           社区服务
 地图/坐标   公司/店铺/产品   FastAPI：画像/    活动/群组/
 角色/建筑   订单(意向→支付)  匹配/Agent       会议/赞助
        │
PostgreSQL + 文件存储 + 任务队列（Agent 托管、提醒）+ 审计日志
```

迁移路径（不需要重写）：
- `store/useTown.ts` 的 `persist` 层 → Supabase 客户端；每个 action 对应一个表写入或一个 `security definer` 函数。
- `domain/introductions.ts` 的规则 → Postgres 函数（同一套状态流转），前端保留作为乐观更新与单测规格。
- `services/aiProvider.ts` 设置 `VITE_AI_BASE_URL` 即切换到 HTTP 版；服务端必须重复执行 L1/L2/L3 校验，客户端已对 L3 兜底。

## 4. 核心数据模型

完整 SQL 见 [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)。

| 表 | 作用 | 关键约束 |
| --- | --- | --- |
| users / avatars | 身份、生活标签、角色外观与游戏坐标 | 授权默认关闭；测试账号单独标记 |
| user_contacts | 联系方式 | RLS：只有双方同意交换后可读 |
| business_profiles / capabilities / needs | 商业画像 | `confirmed=true` 才参与匹配；AI 推测需求单独标记 |
| opc_profiles / products | 店铺与橱窗 | `entity_status` 区分个人主页/自述主体/已认证；`price_confirmed` 控制 Agent 能否报价 |
| relationships | 推测关系 | 分项得分、理由、缺失信息、算法版本 |
| introductions / meetings | 真实连接 | 状态机；联系方式与合作记录都是双方确认 |
| agents / agent_messages | AI 分身 | L2 可关；L3 不存在开关；每条回复记录 level 与 citations |
| communities / community_events / sponsors | 社区与赞助 | 赞助必须带 disclosure |
| wallets | 星星 / 成长值 | 不可兑换，与 orders 完全分表 |
| orders | 真实订单 | 先询价/意向单；支付走持牌机构 |
| audit_logs | 审计 | 所有商业操作与 Agent 动作 |

## 5. 城市空间规则（V2）

三层分工：**导航**（world/nav.ts：哪里能走）· **碰撞**（同一网格的障碍物分类 + 滑动）· **动画**（scene/Chibi：怎么走、怎么回弹）。

空间分类优先级：建筑 > 障碍物（树池、路灯、消防栓、花箱、长椅、单车、骑楼柱、围墙）> 斑马线 > 机动车道 > 人行道 / 广场 / 门前通道 > 绿化。
只有人行道、斑马线、广场、门前通道可步行；网格按角色半径腐蚀一格；寻路为 8 邻域 A* + 拉绳平滑。
街道家具按规则放置：行道树在路缘一侧的树池，避开斑马线、门口与路口；花箱只在宽度 ≥ 4.2 的人行道上放，保证通行带宽度；单车只停在划定区域。
单元测试会对三条街道逐一验证：车道不可走、跨街必经斑马线、每扇门可达、障碍物不可穿。

## 6. 商业撮合算法（commerce.ts，rule-based-v2）

- 关系主体是“经营主体”（Counterparty），不是头像：已入驻 OPC / 已入驻商家 / 未入驻公开信息 / 个人。
- 五类关系按价值流向分层：潜在客户（默认）、上游供应、横向合作、渠道、资源；同一主体可有多条关系。
- 需求证据：published（对方公开发布）优先于 inferred（行业场景推测，必须标“尚未核实”）。
- 未入驻主体不能直接打招呼；个人只显示到街区级别。

## 7. 匹配评分

```
S = 0.30·I + 0.30·C + 0.15·G + 0.15·B + 0.10·W     （各项 0–100）
```

- **I 行业关联度**：行业亲和矩阵（`INDUSTRIES[].related`）。
- **C 能力需求互补度**：对方明确需求命中我的能力 = 100；按行业惯例推断 = 60–65；横向互补 60 + 12×对数。
- **G 地域适配度**：同区 100；相邻区 70–80；都接受远程 60。
- **B 预算价格适配度**：报价区间与预算区间重叠 = 100，否则按差距衰减；非买卖关系或缺失时 **不计分并按其余权重归一化**，同时在 `missing` 中写明。
- **W 合作意愿匹配度**：意向（兼职/项目/长期/组队）的 Jaccard 相似度。
- 能力/需求、行业、区域任一缺失 → `insufficientInfo=true`，`score=null`，UI 显示“信息不足”。
- 关系类型：上游供应 / 下游客户 / 横向合作 / 渠道伙伴 / 资源伙伴，取互补度最高的一种。

## 8. 坐标体系

`经纬度(WGS84|GCJ02) ──project──▶ 局部 ENU 米制 ──toGame──▶ 游戏坐标（1 单位 = 12 米）`

- 记录 `crs` 与 `accuracy`（`approx_100m` / `licensed` / `survey`）。
- 不内置坐标纠偏算法；接入地图服务商时使用其官方 SDK 或授权数据。
- 单测保证往返误差 < 1 米、重点建筑与铺位不压在马路上。

## 9. 页面与状态

单页应用，五个底部入口：`我的上海 | 我的生意 | 我的社区 | 消息 | 我的`（`store.tab`），顶部切换三条街道（`store.district`）。
弹层：建筑卡片 / 居民卡片 / 空铺卡片、店铺 + AI 分身、打招呼与邀请函、五分钟开店。
玩家每帧坐标放在 `playerRuntime`（可变对象），避免每帧触发 React 渲染；每 5 秒写回一次 store。
