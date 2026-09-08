create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  brief jsonb not null,
  plan jsonb not null,
  source_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trip_plans_created_at_idx on public.trip_plans (created_at desc);

alter table public.trip_plans enable row level security;
