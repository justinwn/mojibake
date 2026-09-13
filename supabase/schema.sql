-- Mojibake leaderboard schema.
--
-- Paste this whole file into the Supabase SQL editor and run it. It is
-- idempotent, so re-running after a change is safe.
--
-- The security model has two halves, and the second is the important one:
--
--   1. Postgres enforces SHAPE. Row Level Security lets anyone read scores and
--      insert one, but nobody update or delete, so rows are immutable once
--      written. Constraints reject impossible values, and a trigger sanitises
--      the handle and rate-limits by IP.
--
--   2. The BROWSER enforces TRUTH. Postgres cannot replay a run -- that needs
--      the font pool and the game's own logic -- so every client re-simulates
--      each entry from its seed and hides any whose score does not reconcile.
--      See replayRun() in src/game.js.
--
-- Neither half makes this cryptographically cheat-proof, and nothing can while
-- the game runs on the player's machine. Together they mean a forged entry has
-- to be a complete, self-consistent playthrough with human-plausible timings.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- scores ---

create table if not exists public.scores (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  handle       text        not null,
  country      text        not null default '',
  score        integer     not null,
  rounds       integer     not null,
  seed         text        not null,
  log          jsonb       not null,
  started_at   bigint      not null,
  submitted_at bigint      not null,
  gen          integer     not null,
  pool         text        not null,
  sig          text        not null,

  constraint handle_len    check (char_length(handle) between 1 and 14),
  constraint country_len   check (char_length(country) <= 2),
  constraint score_range   check (score >= 0),
  constraint rounds_range  check (rounds between 1 and 2000),
  constraint seed_len      check (char_length(seed) <= 200),
  constraint pool_len      check (char_length(pool) <= 32),
  constraint sig_len       check (char_length(sig) = 24),
  constraint log_is_array  check (jsonb_typeof(log) = 'array'),
  constraint log_len       check (jsonb_array_length(log) = rounds),

  -- A single round can pay at most (100 base + 75 tier + 100 speed) * 3 streak
  -- = 825. Anything above rounds * 825 could not have been played.
  constraint score_possible check (score <= rounds * 825)
);

create index if not exists scores_rank_idx
  on public.scores (score desc, created_at asc);

-- ------------------------------------------------------------- throttle ---
-- Holds a one-way hash of the submitting address, never the address itself,
-- and is pruned hourly. No RLS policies exist for it, so PostgREST cannot
-- reach it at all; only the SECURITY DEFINER trigger below touches it.

create table if not exists public.submit_throttle (
  ip_hash      text        primary key,
  window_start timestamptz not null default now(),
  hits         integer     not null default 0,
  last_at      timestamptz not null default now()
);

alter table public.submit_throttle enable row level security;

-- --------------------------------------------------------------- guards ---

create or replace function public.guard_score_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  forwarded text;
  addr      text;
  hashed    text;
  seen      public.submit_throttle%rowtype;
begin
  -- Never trust the client's sanitising; redo it here.
  new.handle := btrim(regexp_replace(new.handle, '[[:cntrl:]<>&"''`\\]', '', 'g'));
  if char_length(new.handle) = 0 then
    raise exception 'That handle is empty once special characters are removed.';
  end if;
  new.handle  := left(new.handle, 14);
  new.country := upper(left(coalesce(new.country, ''), 2));

  -- Server owns the clock.
  new.created_at := now();

  forwarded := coalesce(
    current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''
  );
  addr   := btrim(split_part(forwarded, ',', 1));
  hashed := encode(
    digest(coalesce(nullif(addr, ''), 'unknown') || '|mojibake', 'sha256'),
    'hex'
  );

  select * into seen
    from public.submit_throttle
    where ip_hash = hashed
    for update;

  if not found then
    insert into public.submit_throttle (ip_hash, window_start, hits, last_at)
      values (hashed, now(), 1, now());
  elsif seen.last_at > now() - interval '15 seconds' then
    raise exception 'Slow down — one score every 15 seconds.';
  elsif seen.window_start < now() - interval '1 hour' then
    update public.submit_throttle
      set window_start = now(), hits = 1, last_at = now()
      where ip_hash = hashed;
  elsif seen.hits >= 20 then
    raise exception 'Too many scores from this connection in the last hour.';
  else
    update public.submit_throttle
      set hits = seen.hits + 1, last_at = now()
      where ip_hash = hashed;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_score_insert on public.scores;
create trigger guard_score_insert
  before insert on public.scores
  for each row execute function public.guard_score_insert();

-- Keep the table bounded, and keep throttle rows short-lived (the privacy
-- notice promises the address hash is not retained).
create or replace function public.prune_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.scores
   where id in (
     select id from public.scores
      order by score desc, created_at asc
      offset 500
   );

  delete from public.submit_throttle
   where last_at < now() - interval '2 hours';

  return null;
end;
$$;

drop trigger if exists prune_scores_after_insert on public.scores;
create trigger prune_scores_after_insert
  after insert on public.scores
  for each statement execute function public.prune_scores();

-- ------------------------------------------------------------------ RLS ---

alter table public.scores enable row level security;

drop policy if exists scores_public_read on public.scores;
create policy scores_public_read
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists scores_public_insert on public.scores;
create policy scores_public_insert
  on public.scores for insert
  to anon, authenticated
  with check (true);

-- Deliberately no UPDATE and no DELETE policy: rows are write-once, and only
-- the pruning trigger (SECURITY DEFINER) ever removes them.
