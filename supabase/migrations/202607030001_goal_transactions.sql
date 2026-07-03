-- ===========================================================
-- Goal Transactions
-- Histórico de movimentos dos Objetivos
-- ===========================================================

create table if not exists public.goal_transactions (

    id uuid primary key default gen_random_uuid(),

    goal_id uuid not null
        references public.goals(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    -- positivo = adicionar valor
    -- negativo = retirar valor
    amount numeric(18,2) not null,

    note text,

    created_at timestamptz not null default now()

);

---------------------------------------------------------------
-- Índices
---------------------------------------------------------------

create index if not exists idx_goal_transactions_goal
on public.goal_transactions(goal_id);

create index if not exists idx_goal_transactions_user
on public.goal_transactions(user_id);

create index if not exists idx_goal_transactions_created
on public.goal_transactions(created_at desc);

---------------------------------------------------------------
-- RLS
---------------------------------------------------------------

alter table public.goal_transactions
enable row level security;

---------------------------------------------------------------
-- Policies
---------------------------------------------------------------

create policy "Users can view own goal transactions"
on public.goal_transactions
for select
using (auth.uid() = user_id);

create policy "Users can insert own goal transactions"
on public.goal_transactions
for insert
with check (auth.uid() = user_id);

create policy "Users can update own goal transactions"
on public.goal_transactions
for update
using (auth.uid() = user_id);

create policy "Users can delete own goal transactions"
on public.goal_transactions
for delete
using (auth.uid() = user_id);

---------------------------------------------------------------
-- Atualizar current_amount automaticamente
---------------------------------------------------------------

create or replace function public.update_goal_current_amount()
returns trigger
language plpgsql
as
$$
begin

    update goals
    set current_amount = (
        select coalesce(sum(amount),0)
        from goal_transactions
        where goal_id = coalesce(new.goal_id, old.goal_id)
    )
    where id = coalesce(new.goal_id, old.goal_id);

    return coalesce(new, old);

end;
$$;

create trigger trg_goal_transactions_update_goal
after insert or update or delete
on public.goal_transactions
for each row
execute function public.update_goal_current_amount();
