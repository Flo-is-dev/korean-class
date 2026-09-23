-- Migration appliquée sur le projet Supabase « Korean-class » (create_cards_and_progress)

create table public.cards (
  id           text primary key,
  category     text not null check (category in ('vocab','colors','numbers','classifiers','interrogatives','grammar')),
  word_type    text check (word_type in ('verb','adjective')),
  book         text check (book in ('초급1','초급2')),
  lesson       smallint,
  ko           text not null,
  fr           text not null,
  short_form   text,
  added_by_ai  boolean not null default false,
  sort_order   integer not null,
  created_at   timestamptz not null default now()
);
create index cards_category_idx on public.cards (category);
create index cards_word_type_idx on public.cards (word_type) where word_type is not null;

alter table public.cards enable row level security;
create policy "cards are readable by everyone"
  on public.cards for select to anon, authenticated using (true);

create table public.user_progress (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id      text not null references public.cards (id) on delete cascade,
  right_count  integer not null default 0 check (right_count >= 0),
  wrong_count  integer not null default 0 check (wrong_count >= 0),
  streak       integer not null default 0 check (streak >= 0),
  last_seen    timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index user_progress_card_id_idx on public.user_progress (card_id);

alter table public.user_progress enable row level security;
create policy "users read their own progress"   on public.user_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert their own progress" on public.user_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update their own progress" on public.user_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete their own progress" on public.user_progress for delete to authenticated using ((select auth.uid()) = user_id);

grant select on public.cards to anon, authenticated;
grant select, insert, update, delete on public.user_progress to authenticated;

-- Migration add_profiles_and_admin_role -------------------------------------
create schema if not exists private;

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  role        text not null default 'user' check (role in ('user','admin')),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create policy "users read their own profile, admins read all"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));
grant select on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create policy "admins insert cards" on public.cards for insert to authenticated with check ((select private.is_admin()));
create policy "admins update cards" on public.cards for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete cards" on public.cards for delete to authenticated using ((select private.is_admin()));
grant insert, update, delete on public.cards to authenticated;

-- Promotion admin (à rejouer pour un autre compte) :
-- update public.profiles set role = 'admin' where email = 'f.gironde.dev@gmail.com';