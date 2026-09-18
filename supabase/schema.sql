create extension if not exists "pgcrypto";

create type public.team_side as enum ('blue', 'red');
create type public.unlock_kind as enum ('hero', 'skin');
create type public.bot_level as enum ('easy', 'medium', 'hard');
create type public.rank_tier as enum ('warren', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic', 'legend');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (char_length(username) between 3 and 18),
  display_name text not null default '',
  avatar_hero text not null default 'bolt',
  account_level int not null default 1 check (account_level between 1 and 500),
  account_xp int not null default 0 check (account_xp >= 0),
  coins int not null default 6500 check (coins >= 0),
  gems int not null default 150 check (gems >= 0),
  rank_points int not null default 0,
  tier public.rank_tier not null default 'warren',
  wins int not null default 0,
  losses int not null default 0,
  games_played int not null default 0,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  profile_id uuid primary key references public.profiles on delete cascade,
  control_scheme text not null default 'auto',
  camera_locked boolean not null default true,
  quick_cast boolean not null default false,
  show_damage_numbers boolean not null default true,
  show_all_heroes_on_map boolean not null default true,
  music_volume numeric(3,2) not null default 0.55 check (music_volume between 0 and 1),
  sfx_volume numeric(3,2) not null default 0.80 check (sfx_volume between 0 and 1),
  graphics_quality text not null default 'high',
  hud_scale numeric(3,2) not null default 1.00,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.unlocks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  kind public.unlock_kind not null,
  content_id text not null,
  hero_id text,
  source text not null default 'purchase',
  acquired_at timestamptz not null default now(),
  unique (profile_id, kind, content_id)
);
create index unlocks_profile_idx on public.unlocks (profile_id, kind);

create table public.hero_mastery (
  profile_id uuid not null references public.profiles on delete cascade,
  hero_id text not null,
  points int not null default 0 check (points >= 0),
  mastery_level int not null default 1 check (mastery_level between 1 and 10),
  games int not null default 0,
  wins int not null default 0,
  best_kda numeric(6,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (profile_id, hero_id)
);

create table public.loadouts (
  profile_id uuid not null references public.profiles on delete cascade,
  hero_id text not null,
  skin_id text not null default 'default',
  spell_one text not null default 'flash',
  spell_two text not null default 'ignite',
  item_build jsonb not null default '[]'::jsonb,
  rune_page jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (profile_id, hero_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.profiles on delete set null,
  mode text not null default 'rift_5v5',
  bot_difficulty public.bot_level not null default 'medium',
  map_id text not null default 'menagerie_rift',
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  winner public.team_side,
  surrendered boolean not null default false,
  blue_kills int not null default 0,
  red_kills int not null default 0,
  created_at timestamptz not null default now()
);
create index matches_host_idx on public.matches (host_id, created_at desc);

create table public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  slot int not null check (slot between 0 and 9),
  team public.team_side not null,
  hero_id text not null,
  skin_id text not null default 'default',
  display_name text not null default 'Bot',
  is_bot boolean not null default true,
  bot_difficulty public.bot_level,
  kills int not null default 0,
  deaths int not null default 0,
  assists int not null default 0,
  creep_score int not null default 0,
  gold_earned int not null default 0,
  hero_level int not null default 1,
  damage_dealt int not null default 0,
  damage_taken int not null default 0,
  healing_done int not null default 0,
  turrets_destroyed int not null default 0,
  largest_multikill int not null default 0,
  items jsonb not null default '[]'::jsonb,
  unique (match_id, slot)
);
create index match_players_profile_idx on public.match_players (profile_id, match_id);

create or replace view public.leaderboard
with (security_invoker = on) as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_hero,
  p.tier,
  p.rank_points,
  p.wins,
  p.losses,
  p.account_level,
  case when (p.wins + p.losses) = 0 then 0
       else round((p.wins::numeric / (p.wins + p.losses)) * 100, 1) end as win_rate
from public.profiles p
where (p.wins + p.losses) > 0
order by p.rank_points desc, p.wins desc
limit 200;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();
create trigger loadouts_touch before update on public.loadouts
  for each row execute function public.touch_updated_at();
create trigger hero_mastery_touch before update on public.hero_mastery
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  base_name text;
  final_name text;
  suffix int := 0;
begin
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'pet'), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base_name) < 3 then
    base_name := base_name || 'rift';
  end if;
  base_name := left(base_name, 14);
  final_name := base_name;
  while exists (select 1 from public.profiles where username = final_name) loop
    suffix := suffix + 1;
    final_name := left(base_name, 14) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, final_name, coalesce(new.raw_user_meta_data->>'display_name', final_name));

  insert into public.settings (profile_id) values (new.id);

  insert into public.unlocks (profile_id, kind, content_id, hero_id, source)
  values
    (new.id, 'hero', 'bolt', 'bolt', 'starter'),
    (new.id, 'hero', 'mochi', 'mochi', 'starter'),
    (new.id, 'hero', 'bruno', 'bruno', 'starter'),
    (new.id, 'hero', 'nimbus', 'nimbus', 'starter'),
    (new.id, 'skin', 'bolt:default', 'bolt', 'starter'),
    (new.id, 'skin', 'mochi:default', 'mochi', 'starter'),
    (new.id, 'skin', 'bruno:default', 'bruno', 'starter'),
    (new.id, 'skin', 'nimbus:default', 'nimbus', 'starter')
  on conflict do nothing;

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.record_match(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  new_match_id uuid;
  player jsonb;
  me uuid := auth.uid();
  my_team text;
  won boolean;
  rp_delta int;
  gained_xp int;
  gained_coins int;
begin
  if me is null then
    raise exception 'authentication required';
  end if;

  gained_xp := least(900, greatest(0, coalesce((payload->>'account_xp')::int, 180)));
  gained_coins := least(1200, greatest(0, coalesce((payload->>'coins_earned')::int, 120)));

  insert into public.matches (host_id, mode, bot_difficulty, map_id, duration_seconds, winner, surrendered, blue_kills, red_kills)
  values (
    me,
    coalesce(payload->>'mode', 'rift_5v5'),
    coalesce((payload->>'bot_difficulty')::public.bot_level, 'medium'),
    coalesce(payload->>'map_id', 'menagerie_rift'),
    coalesce((payload->>'duration_seconds')::int, 0),
    nullif(payload->>'winner', '')::public.team_side,
    coalesce((payload->>'surrendered')::boolean, false),
    coalesce((payload->>'blue_kills')::int, 0),
    coalesce((payload->>'red_kills')::int, 0)
  )
  returning id into new_match_id;

  for player in select * from jsonb_array_elements(payload->'players')
  loop
    insert into public.match_players (
      match_id, profile_id, slot, team, hero_id, skin_id, display_name, is_bot, bot_difficulty,
      kills, deaths, assists, creep_score, gold_earned, hero_level,
      damage_dealt, damage_taken, healing_done, turrets_destroyed, largest_multikill, items
    )
    values (
      new_match_id,
      case when coalesce((player->>'is_bot')::boolean, true) then null else me end,
      (player->>'slot')::int,
      (player->>'team')::public.team_side,
      player->>'hero_id',
      coalesce(player->>'skin_id', 'default'),
      coalesce(player->>'display_name', 'Bot'),
      coalesce((player->>'is_bot')::boolean, true),
      nullif(player->>'bot_difficulty', '')::public.bot_level,
      coalesce((player->>'kills')::int, 0),
      coalesce((player->>'deaths')::int, 0),
      coalesce((player->>'assists')::int, 0),
      coalesce((player->>'creep_score')::int, 0),
      coalesce((player->>'gold_earned')::int, 0),
      coalesce((player->>'hero_level')::int, 1),
      coalesce((player->>'damage_dealt')::int, 0),
      coalesce((player->>'damage_taken')::int, 0),
      coalesce((player->>'healing_done')::int, 0),
      coalesce((player->>'turrets_destroyed')::int, 0),
      coalesce((player->>'largest_multikill')::int, 0),
      coalesce(player->'items', '[]'::jsonb)
    );
  end loop;

  select mp.team::text into my_team from public.match_players mp
  where mp.match_id = new_match_id and mp.profile_id = me limit 1;

  won := my_team is not null and my_team = payload->>'winner';
  rp_delta := case when won then 22 + floor(random() * 8)::int else -(14 + floor(random() * 7)::int) end;

  update public.profiles p set
    wins = p.wins + case when won then 1 else 0 end,
    losses = p.losses + case when won then 0 else 1 end,
    games_played = p.games_played + 1,
    rank_points = greatest(0, p.rank_points + rp_delta),
    account_xp = p.account_xp + gained_xp,
    coins = p.coins + gained_coins,
    account_level = greatest(p.account_level, 1 + ((p.account_xp + gained_xp) / 1000)),
    tier = case
      when greatest(0, p.rank_points + rp_delta) >= 2600 then 'legend'::public.rank_tier
      when greatest(0, p.rank_points + rp_delta) >= 2100 then 'mythic'::public.rank_tier
      when greatest(0, p.rank_points + rp_delta) >= 1650 then 'diamond'::public.rank_tier
      when greatest(0, p.rank_points + rp_delta) >= 1200 then 'platinum'::public.rank_tier
      when greatest(0, p.rank_points + rp_delta) >= 800 then 'gold'::public.rank_tier
      when greatest(0, p.rank_points + rp_delta) >= 450 then 'silver'::public.rank_tier
      when greatest(0, p.rank_points + rp_delta) >= 180 then 'bronze'::public.rank_tier
      else 'warren'::public.rank_tier
    end,
    last_seen = now()
  where p.id = me;

  insert into public.hero_mastery (profile_id, hero_id, points, games, wins, best_kda)
  select
    me,
    mp.hero_id,
    case when won then 320 else 140 end,
    1,
    case when won then 1 else 0 end,
    round((mp.kills + mp.assists)::numeric / greatest(1, mp.deaths), 2)
  from public.match_players mp
  where mp.match_id = new_match_id and mp.profile_id = me
  on conflict (profile_id, hero_id) do update set
    points = public.hero_mastery.points + excluded.points,
    games = public.hero_mastery.games + 1,
    wins = public.hero_mastery.wins + excluded.wins,
    best_kda = greatest(public.hero_mastery.best_kda, excluded.best_kda),
    mastery_level = least(10, 1 + ((public.hero_mastery.points + excluded.points) / 1800));

  return new_match_id;
end;
$fn$;

create or replace function public.purchase_content(p_kind public.unlock_kind, p_content_id text, p_hero_id text, p_price int, p_currency text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  me uuid := auth.uid();
  result public.profiles;
begin
  if me is null then
    raise exception 'authentication required';
  end if;
  if p_price < 0 or p_price > 100000 then
    raise exception 'invalid price';
  end if;
  if exists (select 1 from public.unlocks where profile_id = me and kind = p_kind and content_id = p_content_id) then
    raise exception 'already owned';
  end if;

  if p_currency = 'gems' then
    update public.profiles set gems = gems - p_price where id = me and gems >= p_price returning * into result;
  else
    update public.profiles set coins = coins - p_price where id = me and coins >= p_price returning * into result;
  end if;

  if result.id is null then
    raise exception 'insufficient funds';
  end if;

  insert into public.unlocks (profile_id, kind, content_id, hero_id, source)
  values (me, p_kind, p_content_id, p_hero_id, 'purchase');

  return result;
end;
$fn$;

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.unlocks enable row level security;
alter table public.hero_mastery enable row level security;
alter table public.loadouts enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

create policy "profiles readable by everyone" on public.profiles for select using (true);
create policy "profiles updatable by owner" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles insertable by owner" on public.profiles for insert with check (auth.uid() = id);

create policy "settings owner read" on public.settings for select using (auth.uid() = profile_id);
create policy "settings owner write" on public.settings for insert with check (auth.uid() = profile_id);
create policy "settings owner update" on public.settings for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "unlocks owner read" on public.unlocks for select using (auth.uid() = profile_id);
create policy "unlocks owner write" on public.unlocks for insert with check (auth.uid() = profile_id);

create policy "mastery public read" on public.hero_mastery for select using (true);
create policy "mastery owner write" on public.hero_mastery for insert with check (auth.uid() = profile_id);
create policy "mastery owner update" on public.hero_mastery for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "loadouts owner read" on public.loadouts for select using (auth.uid() = profile_id);
create policy "loadouts owner write" on public.loadouts for insert with check (auth.uid() = profile_id);
create policy "loadouts owner update" on public.loadouts for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "matches owner read" on public.matches for select using (auth.uid() = host_id);
create policy "matches owner write" on public.matches for insert with check (auth.uid() = host_id);

create policy "match players read" on public.match_players for select using (
  exists (select 1 from public.matches m where m.id = match_id and m.host_id = auth.uid())
);
create policy "match players write" on public.match_players for insert with check (
  exists (select 1 from public.matches m where m.id = match_id and m.host_id = auth.uid())
);

grant usage on schema public to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
grant execute on function public.record_match(jsonb) to authenticated;
grant execute on function public.purchase_content(public.unlock_kind, text, text, int, text) to authenticated;
