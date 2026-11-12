-- 沪上软萌生意街 · 核心数据模型（PostgreSQL / Supabase）
-- 与 town/src/domain/types.ts 一一对应。当前 Demo 使用浏览器本地存储，接入 Supabase 时执行本迁移。
-- 原则：商业关系由结构化数据生成；联系方式受授权保护；关键操作写审计日志；虚拟积分与真实订单分表。

create extension if not exists "pgcrypto";

-- ---------- 用户与角色 ----------
create table users (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null check (char_length(nickname) <= 24),
  life_tag      text not null default 'explorer' check (life_tag in ('worker','freelancer','opc','retiree','student','explorer')),
  -- 授权状态：画像公开、被推荐、营销推荐、联系方式（默认全部关闭，由用户主动开启）
  consent_profile_public boolean not null default false,
  consent_open_to_connect boolean not null default false,
  consent_marketing      boolean not null default false,
  is_test_account        boolean not null default false, -- 测试/演示角色不计入真实统计
  created_at    timestamptz not null default now()
);

create table avatars (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  look       jsonb not null,               -- { body, skin, hair, accessory }
  pos_x      real not null default 0,      -- 游戏局部坐标（不是经纬度）
  pos_z      real not null default 0,
  district_block text not null default 'wukang_anfu',
  updated_at timestamptz not null default now()
);

-- 联系方式单独存表：只有 introductions 双方同意后才可读（见 RLS）
create table user_contacts (
  user_id  uuid primary key references users(id) on delete cascade,
  wechat   text, email text, phone text
);

-- ---------- 商业画像 ----------
create table business_profiles (
  user_id      uuid primary key references users(id) on delete cascade,
  display_name text not null,
  headline     text,
  industries   text[] not null default '{}',
  districts    text[] not null default '{}',
  mode         text not null default 'both' check (mode in ('remote','onsite','both')),
  intents      text[] not null default '{}',
  price_min int, price_max int, budget_min int, budget_max int,
  stage        text,
  confirmed    boolean not null default false,  -- 必须由用户确认后才参与匹配
  source       text not null default 'self_described',
  updated_at   timestamptz not null default now()
);

create table capabilities (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tag     text not null,   -- taxonomy 标签
  detail  text,
  unique (user_id, tag)
);

create table needs (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tag     text not null,
  detail  text,
  ai_suggested boolean not null default false, -- AI 推测且经用户勾选
  unique (user_id, tag)
);

-- ---------- OPC 店铺 ----------
create table opc_profiles (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users(id) on delete cascade,
  name          text not null,
  tagline       text,
  category      text not null,
  entity_status text not null default 'personal_page'
                check (entity_status in ('personal_page','opc_entity','verified_company')),
  verified_at   timestamptz,       -- 只有平台审核后才能写入 verified_company
  stage         text,
  facade        text not null default 'studio',
  lot_id        text not null unique,
  open_needs    text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table products (
  id              uuid primary key default gen_random_uuid(),
  opc_id          uuid not null references opc_profiles(id) on delete cascade,
  name            text not null,
  description     text,
  price_from      int,
  unit            text,
  price_confirmed boolean not null default false,  -- Agent 只能引用 true 的价格
  sort            int not null default 0
);

-- ---------- 商业关系（推测）与连接（真实） ----------
create table relationships (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references users(id) on delete cascade,
  to_user_id    uuid not null references users(id) on delete cascade,
  type          text not null check (type in ('upstream','downstream','peer','channel','resource')),
  score         smallint check (score between 0 and 100),  -- null = 信息不足
  breakdown     jsonb not null,   -- { industry, complement, geo, budget, willingness }
  reasons       text[] not null,
  possible_collabs text[] not null default '{}',
  missing       text[] not null default '{}',
  algo_version  text not null default 'rule-based-v1',
  computed_at   timestamptz not null default now(),
  unique (from_user_id, to_user_id)
);

create table introductions (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references users(id) on delete cascade,
  to_user_id    uuid not null references users(id) on delete cascade,
  relationship_id uuid references relationships(id) on delete set null,
  message       text not null check (char_length(message) <= 200),
  status        text not null default 'sent' check (status in
                ('sent','accepted','declined','contact_exchanged','meeting_booked','collab_proposed','collab_confirmed')),
  contact_from  boolean not null default false,
  contact_to    boolean not null default false,
  collab_from   boolean not null default false,
  collab_to     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create index on introductions (to_user_id, status);

create table meetings (
  id              uuid primary key default gen_random_uuid(),
  introduction_id uuid not null references introductions(id) on delete cascade,
  host_id uuid not null references users(id), guest_id uuid not null references users(id),
  duration_min    smallint not null check (duration_min in (15,30,60)),
  starts_at       timestamptz not null,
  topic           text,
  status          text not null default 'booked' check (status in ('booked','done','cancelled'))
);

-- ---------- AI Agent ----------
create table agents (
  id              uuid primary key default gen_random_uuid(),
  opc_id          uuid not null unique references opc_profiles(id) on delete cascade,
  persona         text,
  l2_enabled      boolean not null default true,  -- L1 恒开；L3 不存在开关（永远本人确认）
  auto_reception  boolean not null default true,
  owner_takeover  boolean not null default false,
  faqs            jsonb not null default '[]'
);

create table agent_messages (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references agents(id) on delete cascade,
  visitor_id uuid references users(id),
  role       text not null check (role in ('visitor','agent','owner')),
  text       text not null,
  level      text check (level in ('L1','L2','L3')),
  citations  text[] not null default '{}',
  handoff    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 社区与赞助 ----------
create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null, space text not null check (space in ('coffee_lounge','startup_lounge','street_market'))
);

create table community_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id),
  host_id uuid not null references users(id),
  title text not null, online boolean not null, starts_at timestamptz not null,
  capacity int not null check (capacity > 1), fee int not null default 0,
  sponsor_allowed boolean not null default false, needs_approval boolean not null default false,
  ai_host boolean not null default false
);

create table event_attendees (
  event_id uuid references community_events(id) on delete cascade,
  user_id  uuid references users(id) on delete cascade,
  status   text not null default 'joined' check (status in ('applied','joined','rejected')),
  primary key (event_id, user_id)
);

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  kind text not null check (kind in ('street_naming','building','event','scene','startup_support')),
  target_id text,                         -- 街区/建筑/活动 id
  disclosure text not null default '赞助内容', -- 必须明确标注
  starts_at timestamptz, ends_at timestamptz
);

-- ---------- 经济：虚拟奖励（不可兑换）与真实订单分表 ----------
create table wallets (
  user_id uuid primary key references users(id) on delete cascade,
  stars   int not null default 0 check (stars >= 0),   -- 街区星星：不可兑换人民币
  growth  int not null default 0 check (growth >= 0),  -- 创业成长值：不可兑换人民币
  badges  text[] not null default '{}'
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references users(id), seller_opc_id uuid not null references opc_profiles(id),
  product_id uuid references products(id),
  kind text not null default 'intent' check (kind in ('inquiry','intent','paid')), -- 先做询价/意向单，再接支付
  amount_cents bigint check (amount_cents >= 0),
  status text not null default 'created' check (status in ('created','confirmed','paid','delivered','refunded','cancelled')),
  payment_ref text,          -- 第三方持牌支付机构流水号；平台不自建支付
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- 审计 ----------
create table audit_logs (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,       -- user uuid 或 agent:<id>
  action text not null,
  target text,
  detail jsonb
);
create index on audit_logs (actor, at desc);

-- ---------- 行级安全（示例，正式上线前需完整评审） ----------
alter table user_contacts enable row level security;
create policy "本人可读写自己的联系方式" on user_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "双方同意交换后可读对方联系方式" on user_contacts
  for select using (exists (
    select 1 from introductions i
    where i.contact_from and i.contact_to
      and ((i.from_user_id = auth.uid() and i.to_user_id = user_contacts.user_id)
        or (i.to_user_id = auth.uid() and i.from_user_id = user_contacts.user_id))
  ));

alter table introductions enable row level security;
create policy "参与双方可见" on introductions for select using (auth.uid() in (from_user_id, to_user_id));
create policy "只能以自己的身份打招呼" on introductions for insert with check (auth.uid() = from_user_id);
-- 状态流转通过 security definer 函数完成（与 domain/introductions.ts 同一套规则），不开放直接 update。
