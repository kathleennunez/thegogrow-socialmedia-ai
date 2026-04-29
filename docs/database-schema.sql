-- Multi-tenant schema for social publishing + analytics.

create table if not exists workspaces (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id text not null references workspaces(id),
  user_id text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists social_accounts (
  id text primary key,
  workspace_id text not null references workspaces(id),
  user_id text not null,
  platform text not null,
  provider_account_id text not null,
  handle text not null,
  display_name text not null,
  scopes jsonb not null default '[]'::jsonb,
  status text not null check (status in ('connected', 'disconnected', 'error')),
  connected_at timestamptz not null,
  updated_at timestamptz not null,
  unique (workspace_id, platform, provider_account_id)
);

create table if not exists social_account_tokens (
  account_id text primary key references social_accounts(id),
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists posts (
  id text primary key,
  workspace_id text not null references workspaces(id),
  user_id text not null,
  topic text not null,
  body text not null,
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists publish_jobs (
  id text primary key,
  workspace_id text not null references workspaces(id),
  post_id text not null references posts(id),
  social_account_id text not null references social_accounts(id),
  platform text not null,
  scheduled_for_utc timestamptz not null,
  timezone text not null,
  status text not null check (status in ('queued', 'processing', 'published', 'failed', 'cancelled')),
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists published_posts (
  id text primary key,
  publish_job_id text not null references publish_jobs(id),
  provider_post_id text not null,
  permalink text,
  published_at timestamptz not null
);

create table if not exists analytics_snapshots (
  id text primary key,
  workspace_id text not null references workspaces(id),
  post_id text not null references posts(id),
  platform text not null,
  snapshot_date date not null,
  impressions int not null default 0,
  engagement int not null default 0,
  clicks int not null default 0,
  likes int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  raw_payload jsonb,
  created_at timestamptz not null
);

create index if not exists idx_publish_jobs_schedule on publish_jobs (scheduled_for_utc, status);
create index if not exists idx_analytics_workspace_date on analytics_snapshots (workspace_id, snapshot_date);
