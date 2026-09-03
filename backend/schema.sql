-- CrisisConnect PostgreSQL Schema
-- Run this in Supabase SQL Editor

create extension if not exists cube;
create extension if not exists earthdistance;

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  urgency text not null default 'normal',
  status text not null default 'requested',
  lat double precision not null,
  lng double precision not null,
  requester_device_id text not null,
  requester_name text,
  requester_phone text,
  details text,
  photo_url text,
  admin_status text not null default 'pending',
  zone_confirmed boolean default false,
  ml_status text,
  linked_request_id uuid references requests(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Helpful indexes for query performance (following supabase-postgres-best-practices)
create index if not exists idx_requests_status on requests (status);
create index if not exists idx_requests_admin_status on requests (admin_status);
create index if not exists idx_requests_urgency_created on requests (urgency desc, created_at asc);
create index if not exists idx_requests_linked on requests (linked_request_id);

create table if not exists helpers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text unique not null,
  role text not null,
  org_name text,
  verified boolean default false,
  available boolean default false,
  lat double precision,
  lng double precision
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id) not null,
  helper_id uuid references helpers(id) not null,
  status text not null default 'en_route',
  matched_at timestamptz default now()
);

create index if not exists idx_matches_request on matches (request_id);
create index if not exists idx_matches_helper on matches (helper_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) not null,
  sender_id text not null,
  body text not null,
  sent_at timestamptz default now()
);

create index if not exists idx_messages_match on messages (match_id, sent_at asc);

create table if not exists zone_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  lat double precision not null,
  lng double precision not null,
  device_id text not null,
  reported_at timestamptz default now()
);

create table if not exists confirmed_zones (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  ml_status text,
  confirmed_at timestamptz default now()
);
