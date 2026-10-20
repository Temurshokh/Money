-- VIGER MONEY: схема облачной синхронизации
-- Выполни целиком в Supabase → SQL Editor → New query.
-- Клиент использует только publishable/anon key. Никогда не вставляй service_role key во frontend.

create table if not exists public.wallets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'other' check (kind in ('cash','card','savings','other')),
  icon text not null default '▤',
  accent text not null default '#83e0a5',
  initial_balance bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  amount bigint not null check (amount > 0),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  to_wallet_id uuid references public.wallets(id) on delete restrict,
  description text not null default '',
  category text not null default 'Прочее',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transfer_destination_check check (
    (type = 'transfer' and to_wallet_id is not null and to_wallet_id <> wallet_id)
    or (type <> 'transfer' and to_wallet_id is null)
  )
);

create index if not exists transactions_user_occurred_idx on public.transactions(user_id, occurred_at desc);
create index if not exists transactions_user_updated_idx on public.transactions(user_id, updated_at desc);

create table if not exists public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount bigint not null check (target_amount > 0),
  wallet_id uuid references public.wallets(id) on delete set null,
  current_amount bigint not null default 0 check (current_amount >= 0),
  icon text not null default '◎',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.audit_log (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.audit_log enable row level security;

-- Политики изолируют данные каждого аккаунта. Клиент не может читать чужие строки.
drop policy if exists "wallets select own" on public.wallets;
create policy "wallets select own" on public.wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists "wallets insert own" on public.wallets;
create policy "wallets insert own" on public.wallets for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "wallets update own" on public.wallets;
create policy "wallets update own" on public.wallets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "wallets delete own" on public.wallets;
create policy "wallets delete own" on public.wallets for delete to authenticated using (user_id = auth.uid());

drop policy if exists "transactions select own" on public.transactions;
create policy "transactions select own" on public.transactions for select to authenticated using (user_id = auth.uid());
drop policy if exists "transactions insert own" on public.transactions;
create policy "transactions insert own" on public.transactions for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid())
  and (to_wallet_id is null or exists (select 1 from public.wallets w where w.id = to_wallet_id and w.user_id = auth.uid()))
);
drop policy if exists "transactions update own" on public.transactions;
create policy "transactions update own" on public.transactions for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid())
  and (to_wallet_id is null or exists (select 1 from public.wallets w where w.id = to_wallet_id and w.user_id = auth.uid()))
);
drop policy if exists "transactions delete own" on public.transactions;
create policy "transactions delete own" on public.transactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "goals select own" on public.goals;
create policy "goals select own" on public.goals for select to authenticated using (user_id = auth.uid());
drop policy if exists "goals insert own" on public.goals;
create policy "goals insert own" on public.goals for insert to authenticated with check (
  user_id = auth.uid() and (wallet_id is null or exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid()))
);
drop policy if exists "goals update own" on public.goals;
create policy "goals update own" on public.goals for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and (wallet_id is null or exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid()))
);
drop policy if exists "goals delete own" on public.goals;
create policy "goals delete own" on public.goals for delete to authenticated using (user_id = auth.uid());

drop policy if exists "audit select own" on public.audit_log;
create policy "audit select own" on public.audit_log for select to authenticated using (user_id = auth.uid());
drop policy if exists "audit insert own" on public.audit_log;
create policy "audit insert own" on public.audit_log for insert to authenticated with check (user_id = auth.uid());

-- PostgREST API schema reload
notify pgrst, 'reload schema';
