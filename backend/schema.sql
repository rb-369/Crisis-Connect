-- CrisisConnect shared schema (Dev A + Dev B agree; run ONCE against Supabase).
-- `if not exists` added throughout so re-running is safe and never clobbers Dev A's run.

create extension if not exists cube;
create extension if not exists earthdistance;

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  category text not null,                        -- blood/food/medicine/oxygen/shelter/transport/rescue
  urgency text not null default 'normal',        -- auto-high for oxygen/rescue
  status text not null default 'requested',      -- requested/matched/in_progress/resolved/expired
  lat double precision not null,
  lng double precision not null,
  requester_device_id text not null,
  requester_name text,
  requester_phone text,
  details text,
  photo_url text,
  admin_status text not null default 'pending',  -- pending/approved/rejected/flagged
  zone_confirmed boolean default false,
  ml_status text,
  linked_request_id uuid references requests(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists helpers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text unique not null,
  role text not null,                            -- volunteer/ngo_admin
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
  status text not null default 'en_route',       -- en_route/arrived/resolved
  matched_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) not null,
  sender_id text not null,
  body text not null,
  sent_at timestamptz default now()
);

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

-- ---------------------------------------------------------------------------
-- Additive hardening (Dev B). Safe to run on top of the base schema above.
-- ---------------------------------------------------------------------------

-- One match per request, enforced by the DB. Second half of first-accept-wins:
-- even if the atomic UPDATE guard were ever bypassed, the DB refuses a dup row.
create unique index if not exists matches_request_id_uniq on matches (request_id);

-- Feed / dedupe / zone queries all filter on these.
create index if not exists requests_status_idx        on requests (status, admin_status);
create index if not exists requests_created_at_idx    on requests (created_at desc);
create index if not exists requests_linked_idx        on requests (linked_request_id);
create index if not exists zone_reports_cat_time_idx  on zone_reports (category, reported_at desc);
create index if not exists confirmed_zones_cat_idx    on confirmed_zones (category, confirmed_at desc);
create index if not exists messages_match_idx         on messages (match_id, sent_at);

-- Push notification readiness (docs/NOTIFICATIONS-HAPTICS-SHORTCUTS.md).
-- Registered today; nothing sends a real push until a Firebase project's
-- credentials exist -- see that doc. Table exists now so the client-side
-- registration flow has somewhere real to write to.
create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  helper_id uuid references helpers(id) not null,
  platform text not null,              -- 'ios' | 'android'
  token text not null,
  created_at timestamptz default now(),
  unique (helper_id, token)
);

create index if not exists device_tokens_helper_idx on device_tokens (helper_id);

-- ---------------------------------------------------------------------------
-- Critical/non-critical emergency flow (docs/AGENT-FLOW.md).
--
-- Two layers deliberately kept separate from what already exists:
--   - `incidents` groups CRITICAL requests (flood/earthquake/fire/accident/
--     rescue) raised from the same disaster site into one aggregate with its
--     own status/priority/assessment. Distinct from `linked_request_id`
--     above, which is the pre-existing NON-critical duplicate-request link
--     ("someone else already asked for this") -- different mechanism for a
--     different question.
--   - `verification_status` is a rule-based pre-check layer, separate from
--     `admin_status` (human NGO moderation, pre-existing). A request can be
--     verification_status='verified' and admin_status='pending' at once --
--     they answer different questions ("does this look complete/genuine?"
--     vs. "has a human approved it?"). Only computed for non-critical
--     requests; critical/SOS requests skip verification entirely for
--     minimum-interaction speed and go straight to broadcast.
-- ---------------------------------------------------------------------------
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  category text not null,                        -- flood/earthquake/fire/accident/rescue
  center_lat double precision not null,
  center_lng double precision not null,
  status text not null default 'sos_triggered',
    -- sos_triggered/alert_sent/responder_accepted/on_the_way/assessed/coordinated/resolved
  priority integer not null default 1,           -- bumps as more requests join
  request_count integer not null default 1,
  assessment jsonb,                              -- responder's on-scene report, see app/incidents.py
  coordinating_orgs text[] not null default '{}',-- informational, admin-tagged
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists incidents_status_idx on incidents (status, created_at desc);

alter table requests add column if not exists incident_id uuid references incidents(id);
alter table requests add column if not exists severity_class text; -- 'critical' | 'non_critical'
-- (renamed to service_details in the v2 block below)
alter table requests add column if not exists verification_status text; -- pending/incomplete/verified/rejected (null for critical)
alter table requests add column if not exists verification_reasons text[] not null default '{}';
alter table requests add column if not exists offline_created_at timestamptz; -- original client-side SOS time, if synced late

create index if not exists requests_incident_idx on requests (incident_id);

-- Donor blood type, for compatibility matching on blood-category requests.
alter table helpers add column if not exists blood_type text; -- O-/O+/A-/A+/B-/B+/AB-/AB+

-- ---------------------------------------------------------------------------
-- v2 (docs/INTEGRATION-CONTRACT.md): co-dev field names, media/proof, and the
-- richer helper profile behind multi-step volunteer/NGO verification.
-- `service_details` is the canonical name (was `structured_details`).
-- ---------------------------------------------------------------------------
alter table requests add column if not exists service_details jsonb;
alter table requests add column if not exists voice_note_url text;
alter table requests add column if not exists proof_video_url text;

alter table helpers add column if not exists email text;
alter table helpers add column if not exists darpan_id text;
alter table helpers add column if not exists skills text[] not null default '{}';
alter table helpers add column if not exists domains text[] not null default '{}';
alter table helpers add column if not exists badge text;
alter table helpers add column if not exists vehicle_type text;
alter table helpers add column if not exists id_file_name text;

create index if not exists helpers_role_avail_idx    on helpers (role, available);
create index if not exists requests_verification_idx on requests (verification_status);
