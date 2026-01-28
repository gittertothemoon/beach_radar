-- Waitlist rate limit tracking
create table if not exists public.waitlist_rate_limits (
  ip_hash text not null,
  ua_hash text not null,
  window_start timestamptz not null,
  count int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (ip_hash, ua_hash, window_start)
);

create or replace function public.waitlist_rate_limit_touch(
  ip_hash text,
  ua_hash text,
  window_start timestamptz
) returns table(count int)
language plpgsql
as $$
begin
  insert into public.waitlist_rate_limits (ip_hash, ua_hash, window_start, count, updated_at)
  values (ip_hash, ua_hash, window_start, 1, now())
  on conflict (ip_hash, ua_hash, window_start)
  do update set count = public.waitlist_rate_limits.count + 1,
    updated_at = now();

  return query
    select public.waitlist_rate_limits.count
    from public.waitlist_rate_limits
    where public.waitlist_rate_limits.ip_hash = waitlist_rate_limit_touch.ip_hash
      and public.waitlist_rate_limits.ua_hash = waitlist_rate_limit_touch.ua_hash
      and public.waitlist_rate_limits.window_start = waitlist_rate_limit_touch.window_start;
end;
$$;
