alter table public.profiles enable row level security;

create policy "admins can update profiles"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and (
        admin_profile.account_type = true
        or admin_profile.role = 'admin'
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and (
        admin_profile.account_type = true
        or admin_profile.role = 'admin'
      )
  )
);

create policy "admins can read all profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and (
        admin_profile.account_type = true
        or admin_profile.role = 'admin'
      )
  )
);

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        account_type = true
        or role = 'admin'
      )
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

drop policy if exists "admins can update profiles" on public.profiles;
drop policy if exists "admins can read all profiles" on public.profiles;

create policy "admins can read all profiles"
on public.profiles
for select
to authenticated
using (
  public.is_admin_user()
);

create policy "admins can update profiles"
on public.profiles
for update
to authenticated
using (
  public.is_admin_user()
)
with check (
  public.is_admin_user()
);
