-- Schema for the UTM & QR Code Builder.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.

create table if not exists public.codes (
  id                text         primary key,
  target_url        text         not null,
  team              text         not null,
  project           text         not null,
  deployment        text         not null,
  deployment_detail text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  tracked_url       text,        -- /r/:id full URL
  short_url         text,        -- TinyURL / Bit.ly of tracked_url
  label             text,
  created_at        timestamptz  not null default now()
);

create table if not exists public.scans (
  id          bigserial    primary key,
  code_id     text         not null references public.codes(id) on delete cascade,
  scanned_at  timestamptz  not null default now(),
  ip          text,
  user_agent  text,
  referer     text
);

create index if not exists scans_code_id_idx     on public.scans(code_id);
create index if not exists scans_scanned_at_idx  on public.scans(scanned_at desc);
create index if not exists codes_created_at_idx  on public.codes(created_at desc);

-- View: codes with aggregated scan stats. Used by /api/codes.
create or replace view public.codes_with_stats as
select
  c.*,
  coalesce(count(s.id), 0)::int as scan_count,
  max(s.scanned_at)             as last_scan
from public.codes c
left join public.scans s on s.code_id = c.id
group by c.id;
