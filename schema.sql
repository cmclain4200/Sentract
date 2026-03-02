-- Sentract Database Schema (RBAC Edition)
-- Full schema including RBAC tables, helper functions, and policies

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

-- ============================================
-- 1. ORGANIZATIONS
-- ============================================
create table if not exists public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.organizations enable row level security;
create trigger update_organizations_updated_at
  before update on public.organizations
  for each row execute procedure public.update_updated_at();

-- ============================================
-- 2. ROLES
-- ============================================
create table if not exists public.roles (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations on delete cascade not null,
  name text not null,
  permissions jsonb default '{}'::jsonb not null,
  is_system_default boolean default true,
  created_at timestamptz default now(),
  unique(org_id, name)
);
alter table public.roles enable row level security;
create index idx_roles_org_id on public.roles(org_id);

-- ============================================
-- 3. PROFILES (extends auth.users)
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  organization text,
  avatar_url text,
  org_id uuid references public.organizations on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create index idx_profiles_org_id on public.profiles(org_id);
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

-- ============================================
-- 4. ORG MEMBERS (one org per user)
-- ============================================
create table if not exists public.org_members (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  org_id uuid references public.organizations on delete cascade not null,
  role_id uuid references public.roles on delete restrict not null,
  created_at timestamptz default now(),
  unique(user_id)
);
alter table public.org_members enable row level security;
-- FK to profiles for PostgREST resource embedding (org_members → profiles join)
alter table public.org_members add constraint org_members_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade;
create index idx_org_members_org_id on public.org_members(org_id);
create index idx_org_members_user_id on public.org_members(user_id);
create index idx_org_members_role_id on public.org_members(role_id);

-- ============================================
-- 5. TEAMS
-- ============================================
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now(),
  unique(org_id, name)
);
alter table public.teams enable row level security;
create index idx_teams_org_id on public.teams(org_id);

-- ============================================
-- 6. TEAM MEMBERS
-- ============================================
create table if not exists public.team_members (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  team_id uuid references public.teams on delete cascade not null,
  added_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  unique(user_id, team_id)
);
alter table public.team_members enable row level security;
create index idx_team_members_team_id on public.team_members(team_id);
create index idx_team_members_user_id on public.team_members(user_id);

-- ============================================
-- 7. CASES
-- ============================================
create table if not exists public.cases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  name text not null,
  type text not null check (type in ('EP', 'CT', 'CI')),
  description text,
  status text default 'active' check (status in ('active', 'archived', 'closed')),
  client_name text,
  team_id uuid references public.teams on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.cases enable row level security;
create index idx_cases_team_id on public.cases(team_id);
create trigger update_cases_updated_at
  before update on public.cases
  for each row execute procedure public.update_updated_at();

-- ============================================
-- 8. CASE ASSIGNMENTS
-- ============================================
create table if not exists public.case_assignments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  case_id uuid references public.cases on delete cascade not null,
  assigned_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  unique(user_id, case_id)
);
alter table public.case_assignments enable row level security;
-- FK to profiles for PostgREST resource embedding
alter table public.case_assignments add constraint case_assignments_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade;
create index idx_case_assignments_case_id on public.case_assignments(case_id);
create index idx_case_assignments_user_id on public.case_assignments(user_id);

-- ============================================
-- 9. SUBJECTS
-- ============================================
create table if not exists public.subjects (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references public.cases on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  name text not null,
  role text,
  organization text,
  profile_data jsonb default '{}'::jsonb,
  data_completeness integer default 0,
  hidden boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.subjects enable row level security;
create trigger update_subjects_updated_at
  before update on public.subjects
  for each row execute procedure public.update_updated_at();

-- ============================================
-- 10. ASSESSMENTS
-- ============================================
create table if not exists public.assessments (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references public.subjects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  type text not null check (type in ('recon_mirror', 'aegis_score', 'pattern_lens', 'crosswire')),
  module text,
  case_id uuid references public.cases on delete set null,
  data jsonb default '{}'::jsonb,
  parameters jsonb default '{}'::jsonb,
  narrative_output text,
  scenario_json jsonb,
  score_data jsonb,
  model_used text,
  status text default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'published')),
  reviewer_id uuid references auth.users on delete set null,
  reviewer_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.assessments enable row level security;
create index if not exists idx_assessments_status on public.assessments(status);
create index if not exists idx_assessments_reviewer_id on public.assessments(reviewer_id);
create trigger update_assessments_updated_at
  before update on public.assessments
  for each row execute procedure public.update_updated_at();

-- ============================================
-- 10b. ASSESSMENT COMMENTS
-- ============================================
create table if not exists public.assessment_comments (
  id uuid default gen_random_uuid() primary key,
  assessment_id uuid references public.assessments on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  content text not null,
  comment_type text default 'note' check (comment_type in ('note', 'rejection_reason', 'approval_note')),
  created_at timestamptz default now()
);
alter table public.assessment_comments enable row level security;
create index if not exists idx_assessment_comments_assessment on public.assessment_comments(assessment_id);

-- ============================================
-- 11. UPLOADS
-- ============================================
create table if not exists public.uploads (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references public.subjects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  filename text not null,
  file_type text,
  file_size bigint,
  storage_path text,
  created_at timestamptz default now()
);
alter table public.uploads enable row level security;

-- ============================================
-- 12. MONITORING CONFIGS
-- ============================================
create table if not exists public.monitoring_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  subject_id uuid references public.subjects on delete cascade not null,
  check_type text default 'breach',
  frequency_hours integer default 168,
  enabled boolean default true,
  last_checked_at timestamptz,
  next_check_at timestamptz,
  created_at timestamptz default now()
);
alter table public.monitoring_configs enable row level security;

-- ============================================
-- 13. MONITORING ALERTS
-- ============================================
create table if not exists public.monitoring_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  subject_id uuid references public.subjects on delete cascade not null,
  alert_type text default 'new_breach',
  title text not null,
  detail text,
  data jsonb default '{}'::jsonb,
  read boolean default false,
  created_at timestamptz default now()
);
alter table public.monitoring_alerts enable row level security;

-- ============================================
-- 14. CHAT MESSAGES
-- ============================================
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references public.cases on delete cascade not null,
  subject_id uuid references public.subjects on delete set null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
alter table public.chat_messages enable row level security;

-- ============================================
-- 15. TIMELINE EVENTS
-- ============================================
create table if not exists public.timeline_events (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references public.subjects on delete cascade not null,
  case_id uuid references public.cases on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  event_type text not null,
  category text,
  title text not null,
  detail text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.timeline_events enable row level security;

-- ============================================
-- 16. INVITATIONS
-- ============================================
create table if not exists public.invitations (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  org_id uuid references public.organizations on delete cascade not null,
  team_id uuid references public.teams on delete set null,
  team_ids uuid[] default '{}',
  role_id uuid references public.roles on delete restrict not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid references auth.users on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);
alter table public.invitations enable row level security;
create index idx_invitations_email on public.invitations(email);
create index idx_invitations_org_id on public.invitations(org_id);

-- ============================================
-- RLS HELPER FUNCTIONS
-- ============================================

create or replace function public.get_user_org_id()
returns uuid language plpgsql security definer stable set search_path = public as $$
begin
  return (select org_id from public.org_members where user_id = auth.uid() limit 1);
end;
$$;

create or replace function public.get_user_role_name()
returns text language plpgsql security definer stable set search_path = public as $$
begin
  return (select r.name from public.org_members om join public.roles r on r.id = om.role_id where om.user_id = auth.uid() limit 1);
end;
$$;

create or replace function public.user_has_permission(permission_key text)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare perms jsonb;
begin
  select r.permissions into perms from public.org_members om join public.roles r on r.id = om.role_id where om.user_id = auth.uid() limit 1;
  if perms is null then return false; end if;
  return coalesce((perms ->> permission_key)::boolean, false);
end;
$$;

create or replace function public.is_org_owner()
returns boolean language plpgsql security definer stable set search_path = public as $$
begin
  return (select r.name = 'org_owner' from public.org_members om join public.roles r on r.id = om.role_id where om.user_id = auth.uid() limit 1);
end;
$$;

create or replace function public.user_has_case_access(p_case_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare
  v_user_org_id uuid; v_role_name text; v_case_team_id uuid; v_case_user_id uuid; v_case_org_id uuid;
begin
  select om.org_id, r.name into v_user_org_id, v_role_name from public.org_members om join public.roles r on r.id = om.role_id where om.user_id = auth.uid() limit 1;
  if v_user_org_id is null then return (select user_id = auth.uid() from public.cases where id = p_case_id); end if;
  select c.team_id, c.user_id into v_case_team_id, v_case_user_id from public.cases c where c.id = p_case_id;
  if v_case_user_id is null then return false; end if;
  if v_case_team_id is null then return (v_case_user_id = auth.uid()); end if;
  select t.org_id into v_case_org_id from public.teams t where t.id = v_case_team_id;
  if v_case_org_id is null or v_case_org_id != v_user_org_id then return false; end if;
  if v_role_name = 'org_owner' then return true; end if;
  if v_role_name = 'team_manager' then return exists (select 1 from public.team_members tm where tm.user_id = auth.uid() and tm.team_id = v_case_team_id); end if;
  return exists (select 1 from public.case_assignments ca where ca.user_id = auth.uid() and ca.case_id = p_case_id);
end;
$$;

create or replace function public.user_has_subject_access(p_subject_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare v_case_id uuid;
begin
  select case_id into v_case_id from public.subjects where id = p_subject_id;
  if v_case_id is null then return false; end if;
  return public.user_has_case_access(v_case_id);
end;
$$;

create or replace function public.get_accessible_case_ids()
returns setof uuid language plpgsql security definer stable set search_path = public as $$
declare v_user_org_id uuid; v_role_name text;
begin
  select om.org_id, r.name into v_user_org_id, v_role_name from public.org_members om join public.roles r on r.id = om.role_id where om.user_id = auth.uid() limit 1;
  if v_user_org_id is null then return query select c.id from public.cases c where c.user_id = auth.uid(); return; end if;
  if v_role_name = 'org_owner' then return query select c.id from public.cases c join public.teams t on t.id = c.team_id where t.org_id = v_user_org_id union select c.id from public.cases c where c.team_id is null and c.user_id = auth.uid(); return; end if;
  if v_role_name = 'team_manager' then return query select c.id from public.cases c join public.team_members tm on tm.team_id = c.team_id where tm.user_id = auth.uid() union select c.id from public.cases c where c.team_id is null and c.user_id = auth.uid(); return; end if;
  return query select ca.case_id from public.case_assignments ca where ca.user_id = auth.uid() union select c.id from public.cases c where c.team_id is null and c.user_id = auth.uid(); return;
end;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- profiles
create policy "profiles_select" on public.profiles for select using (id = auth.uid() or org_id = public.get_user_org_id());
create policy "profiles_insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update using (id = auth.uid());

-- cases
create policy "cases_select" on public.cases for select using (user_id = auth.uid() or public.user_has_case_access(id));
create policy "cases_insert" on public.cases for insert with check (auth.uid() = user_id and (public.user_has_permission('create_case') or public.get_user_org_id() is null));
create policy "cases_update" on public.cases for update using (public.user_has_case_access(id));
create policy "cases_delete" on public.cases for delete using (public.user_has_case_access(id) and (public.user_has_permission('delete_case') or public.get_user_org_id() is null));

-- subjects
create policy "subjects_select" on public.subjects for select using (user_id = auth.uid() or public.user_has_case_access(case_id));
create policy "subjects_insert" on public.subjects for insert with check (public.user_has_case_access(case_id) and (public.user_has_permission('add_subject') or public.get_user_org_id() is null));
create policy "subjects_update" on public.subjects for update using (public.user_has_case_access(case_id) and (public.user_has_permission('edit_subject') or public.get_user_org_id() is null));
create policy "subjects_delete" on public.subjects for delete using (public.user_has_case_access(case_id) and (public.user_has_permission('delete_subject') or public.get_user_org_id() is null));

-- assessments
create policy "assessments_select" on public.assessments for select using (public.user_has_subject_access(subject_id));
create policy "assessments_insert" on public.assessments for insert with check (public.user_has_subject_access(subject_id) and (public.user_has_permission('run_assessment') or public.get_user_org_id() is null));
create policy "assessments_update" on public.assessments for update using (public.user_has_subject_access(subject_id) and (public.user_has_permission('edit_assessment') or public.user_has_permission('approve_assessment') or public.get_user_org_id() is null));
create policy "assessments_delete" on public.assessments for delete using (public.user_has_subject_access(subject_id) and (public.user_has_permission('delete_assessment') or public.get_user_org_id() is null));

-- assessment_comments
create policy "assessment_comments_select" on public.assessment_comments for select using (exists (select 1 from public.assessments a where a.id = assessment_id and public.user_has_subject_access(a.subject_id)));
create policy "assessment_comments_insert" on public.assessment_comments for insert with check (exists (select 1 from public.assessments a where a.id = assessment_id and public.user_has_subject_access(a.subject_id)));
create policy "assessment_comments_delete" on public.assessment_comments for delete using (user_id = auth.uid());

-- uploads
create policy "uploads_select" on public.uploads for select using (public.user_has_subject_access(subject_id));
create policy "uploads_insert" on public.uploads for insert with check (public.user_has_subject_access(subject_id));
create policy "uploads_delete" on public.uploads for delete using (public.user_has_subject_access(subject_id));

-- monitoring_configs
create policy "monitoring_configs_select" on public.monitoring_configs for select using (public.user_has_subject_access(subject_id));
create policy "monitoring_configs_insert" on public.monitoring_configs for insert with check (public.user_has_subject_access(subject_id));
create policy "monitoring_configs_update" on public.monitoring_configs for update using (public.user_has_subject_access(subject_id));
create policy "monitoring_configs_delete" on public.monitoring_configs for delete using (public.user_has_subject_access(subject_id));

-- monitoring_alerts
create policy "monitoring_alerts_select" on public.monitoring_alerts for select using (public.user_has_subject_access(subject_id));
create policy "monitoring_alerts_insert" on public.monitoring_alerts for insert with check (public.user_has_subject_access(subject_id));
create policy "monitoring_alerts_update" on public.monitoring_alerts for update using (public.user_has_subject_access(subject_id));
create policy "monitoring_alerts_delete" on public.monitoring_alerts for delete using (public.user_has_subject_access(subject_id));

-- chat_messages
create policy "chat_messages_select" on public.chat_messages for select using (public.user_has_case_access(case_id));
create policy "chat_messages_insert" on public.chat_messages for insert with check (public.user_has_case_access(case_id));
create policy "chat_messages_delete" on public.chat_messages for delete using (public.user_has_case_access(case_id) and user_id = auth.uid());

-- timeline_events
create policy "timeline_events_select" on public.timeline_events for select using (public.user_has_case_access(case_id));
create policy "timeline_events_insert" on public.timeline_events for insert with check (public.user_has_case_access(case_id));
create policy "timeline_events_delete" on public.timeline_events for delete using (public.user_has_case_access(case_id) and user_id = auth.uid());

-- organizations
create policy "organizations_select" on public.organizations for select using (id = public.get_user_org_id());
create policy "organizations_insert" on public.organizations for insert with check (auth.uid() is not null);
create policy "organizations_update" on public.organizations for update using (id = public.get_user_org_id() and public.is_org_owner());

-- roles
create policy "roles_select" on public.roles for select using (org_id = public.get_user_org_id());
create policy "roles_insert" on public.roles for insert with check (org_id = public.get_user_org_id() and public.is_org_owner());
create policy "roles_update" on public.roles for update using (org_id = public.get_user_org_id() and public.is_org_owner());

-- org_members
create policy "org_members_select" on public.org_members for select using (org_id = public.get_user_org_id());
create policy "org_members_insert" on public.org_members for insert with check (org_id = public.get_user_org_id());
create policy "org_members_update" on public.org_members for update using (org_id = public.get_user_org_id() and public.is_org_owner());
create policy "org_members_delete" on public.org_members for delete using (org_id = public.get_user_org_id() and (public.is_org_owner() or user_id = auth.uid()));

-- teams
create policy "teams_select" on public.teams for select using (org_id = public.get_user_org_id());
create policy "teams_insert" on public.teams for insert with check (org_id = public.get_user_org_id() and public.user_has_permission('manage_teams'));
create policy "teams_update" on public.teams for update using (org_id = public.get_user_org_id() and public.user_has_permission('manage_teams'));
create policy "teams_delete" on public.teams for delete using (org_id = public.get_user_org_id() and public.is_org_owner());

-- team_members
create policy "team_members_select" on public.team_members for select using (exists (select 1 from public.teams t where t.id = team_id and t.org_id = public.get_user_org_id()));
create policy "team_members_insert" on public.team_members for insert with check (exists (select 1 from public.teams t where t.id = team_id and t.org_id = public.get_user_org_id()) and public.user_has_permission('invite_member'));
create policy "team_members_delete" on public.team_members for delete using (exists (select 1 from public.teams t where t.id = team_id and t.org_id = public.get_user_org_id()) and (public.user_has_permission('remove_member') or user_id = auth.uid()));

-- case_assignments
create policy "case_assignments_select" on public.case_assignments for select using (public.user_has_case_access(case_id));
create policy "case_assignments_insert" on public.case_assignments for insert with check (public.user_has_case_access(case_id) and public.user_has_permission('assign_case'));
create policy "case_assignments_delete" on public.case_assignments for delete using (public.user_has_case_access(case_id) and public.user_has_permission('assign_case'));

-- invitations
create policy "invitations_select" on public.invitations for select using (org_id = public.get_user_org_id());
create policy "invitations_insert" on public.invitations for insert with check (org_id = public.get_user_org_id() and public.user_has_permission('invite_member'));
create policy "invitations_update" on public.invitations for update using (org_id = public.get_user_org_id() and public.user_has_permission('invite_member'));

-- ============================================
-- handle_new_user() TRIGGER
-- Supports invitation-based and fresh signups
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invitation record;
  v_org_id uuid;
  v_owner_role_id uuid;
  v_team_id uuid;
  v_tid uuid;
  v_slug text;
  v_counter int := 0;
begin
  -- Try metadata invitation_id first, then email match
  if new.raw_user_meta_data->>'invitation_id' is not null then
    select * into v_invitation from public.invitations where id = (new.raw_user_meta_data->>'invitation_id')::uuid and status = 'pending' and expires_at > now() limit 1;
  end if;
  if v_invitation is null then
    select * into v_invitation from public.invitations where lower(email) = lower(new.email) and status = 'pending' and expires_at > now() order by created_at desc limit 1;
  end if;

  if v_invitation is not null then
    insert into public.profiles (id, full_name, organization, org_id) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), (select name from public.organizations where id = v_invitation.org_id), v_invitation.org_id);
    insert into public.org_members (user_id, org_id, role_id) values (new.id, v_invitation.org_id, v_invitation.role_id);
    -- Add to multiple teams if team_ids is set
    if v_invitation.team_ids is not null and array_length(v_invitation.team_ids, 1) > 0 then
      foreach v_tid in array v_invitation.team_ids loop
        insert into public.team_members (user_id, team_id, added_by) values (new.id, v_tid, v_invitation.invited_by);
      end loop;
    elsif v_invitation.team_id is not null then
      insert into public.team_members (user_id, team_id, added_by) values (new.id, v_invitation.team_id, v_invitation.invited_by);
    end if;
    update public.invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;
  else
    v_slug := lower(regexp_replace(coalesce(nullif(new.raw_user_meta_data->>'organization', ''), coalesce(new.raw_user_meta_data->>'full_name', 'user') || '-org'), '[^a-z0-9]+', '-', 'g'));
    while exists (select 1 from public.organizations where slug = v_slug) loop v_counter := v_counter + 1; v_slug := v_slug || '-' || v_counter::text; end loop;
    insert into public.organizations (name, slug) values (coalesce(nullif(new.raw_user_meta_data->>'organization', ''), coalesce(new.raw_user_meta_data->>'full_name', 'User') || '''s Organization'), v_slug) returning id into v_org_id;
    insert into public.roles (org_id, name, permissions, is_system_default) values (v_org_id, 'org_owner', '{"create_case":true,"edit_case":true,"delete_case":true,"archive_case":true,"assign_case":true,"add_subject":true,"edit_subject":true,"delete_subject":true,"run_assessment":true,"edit_assessment":true,"delete_assessment":true,"publish_assessment":true,"approve_assessment":true,"approve_deliverable":true,"view_case":true,"view_subject_data":true,"invite_member":true,"remove_member":true,"manage_teams":true,"manage_billing":true,"manage_org_settings":true}'::jsonb, true) returning id into v_owner_role_id;
    insert into public.roles (org_id, name, permissions, is_system_default) values (v_org_id, 'team_manager', '{"create_case":true,"edit_case":true,"delete_case":false,"archive_case":true,"assign_case":true,"add_subject":true,"edit_subject":true,"delete_subject":true,"run_assessment":true,"edit_assessment":true,"delete_assessment":true,"publish_assessment":true,"approve_assessment":false,"approve_deliverable":false,"view_case":true,"view_subject_data":true,"invite_member":true,"remove_member":true,"manage_teams":true,"manage_billing":false,"manage_org_settings":false}'::jsonb, true);
    insert into public.roles (org_id, name, permissions, is_system_default) values (v_org_id, 'analyst', '{"create_case":false,"edit_case":false,"delete_case":false,"archive_case":false,"assign_case":false,"add_subject":true,"edit_subject":true,"delete_subject":false,"run_assessment":true,"edit_assessment":true,"delete_assessment":false,"publish_assessment":false,"approve_assessment":false,"approve_deliverable":false,"view_case":true,"view_subject_data":true,"invite_member":false,"remove_member":false,"manage_teams":false,"manage_billing":false,"manage_org_settings":false}'::jsonb, true);
    insert into public.roles (org_id, name, permissions, is_system_default) values (v_org_id, 'reviewer', '{"create_case":false,"edit_case":false,"delete_case":false,"archive_case":false,"assign_case":false,"add_subject":false,"edit_subject":false,"delete_subject":false,"run_assessment":false,"edit_assessment":false,"delete_assessment":false,"publish_assessment":false,"approve_assessment":true,"approve_deliverable":true,"view_case":true,"view_subject_data":true,"invite_member":false,"remove_member":false,"manage_teams":false,"manage_billing":false,"manage_org_settings":false}'::jsonb, true);
    insert into public.roles (org_id, name, permissions, is_system_default) values (v_org_id, 'client', '{"create_case":false,"edit_case":false,"delete_case":false,"archive_case":false,"assign_case":false,"add_subject":false,"edit_subject":false,"delete_subject":false,"run_assessment":false,"edit_assessment":false,"delete_assessment":false,"publish_assessment":false,"approve_assessment":false,"approve_deliverable":false,"view_case":true,"view_subject_data":true,"invite_member":false,"remove_member":false,"manage_teams":false,"manage_billing":false,"manage_org_settings":false}'::jsonb, true);
    insert into public.profiles (id, full_name, organization, org_id) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.raw_user_meta_data->>'organization', ''), v_org_id);
    insert into public.org_members (user_id, org_id, role_id) values (new.id, v_org_id, v_owner_role_id);
    insert into public.teams (org_id, name, description) values (v_org_id, 'General', 'Default team') returning id into v_team_id;
    insert into public.team_members (user_id, team_id, added_by) values (new.id, v_team_id, new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RBAC Notifications (workflow events, separate from monitoring_alerts)
create table if not exists public.rbac_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  org_id uuid references public.organizations on delete cascade not null,
  notification_type text not null check (notification_type in (
    'assessment_submitted', 'assessment_approved', 'assessment_rejected',
    'assessment_published', 'invitation_accepted'
  )),
  title text not null,
  detail text,
  link text,
  metadata jsonb default '{}'::jsonb,
  read boolean default false,
  created_at timestamptz default now()
);
alter table public.rbac_notifications enable row level security;
create index idx_rbac_notifications_user_unread on public.rbac_notifications(user_id, read) where read = false;

create policy "rbac_notifications_select" on public.rbac_notifications for select using (user_id = auth.uid());
create policy "rbac_notifications_insert" on public.rbac_notifications for insert with check (org_id = public.get_user_org_id());
create policy "rbac_notifications_update" on public.rbac_notifications for update using (user_id = auth.uid());
create policy "rbac_notifications_delete" on public.rbac_notifications for delete using (user_id = auth.uid());
