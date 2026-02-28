-- Sentract Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  organization text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, organization)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'organization', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 2. CASES
-- ============================================
create table if not exists public.cases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  name text not null,
  type text not null check (type in ('EP', 'CT', 'CI')),
  description text,
  status text default 'active' check (status in ('active', 'archived', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cases enable row level security;

create policy "Users can view own cases"
  on public.cases for select
  using (auth.uid() = user_id);

create policy "Users can create cases"
  on public.cases for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cases"
  on public.cases for update
  using (auth.uid() = user_id);

create policy "Users can delete own cases"
  on public.cases for delete
  using (auth.uid() = user_id);

-- ============================================
-- 3. SUBJECTS
-- ============================================
create table if not exists public.subjects (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references public.cases on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  name text not null,
  role text,
  organization text,
  profile_data jsonb default '{}'::jsonb,
  data_completeness numeric default 0,
  hidden boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subjects enable row level security;

create policy "Users can view own subjects"
  on public.subjects for select
  using (auth.uid() = user_id);

create policy "Users can create subjects"
  on public.subjects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own subjects"
  on public.subjects for update
  using (auth.uid() = user_id);

create policy "Users can delete own subjects"
  on public.subjects for delete
  using (auth.uid() = user_id);

-- ============================================
-- 4. ASSESSMENTS
-- ============================================
create table if not exists public.assessments (
  id uuid default gen_random_uuid() primary key,
  subject_id uuid references public.subjects on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  type text not null check (type in ('recon_mirror', 'aegis_score', 'pattern_lens', 'crosswire')),
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.assessments enable row level security;

create policy "Users can view own assessments"
  on public.assessments for select
  using (auth.uid() = user_id);

create policy "Users can create assessments"
  on public.assessments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own assessments"
  on public.assessments for update
  using (auth.uid() = user_id);

create policy "Users can delete own assessments"
  on public.assessments for delete
  using (auth.uid() = user_id);

-- ============================================
-- 5. UPLOADS
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

create policy "Users can view own uploads"
  on public.uploads for select
  using (auth.uid() = user_id);

create policy "Users can create uploads"
  on public.uploads for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own uploads"
  on public.uploads for delete
  using (auth.uid() = user_id);

-- ============================================
-- Updated_at trigger function
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_cases_updated_at
  before update on public.cases
  for each row execute procedure public.update_updated_at();

create trigger update_subjects_updated_at
  before update on public.subjects
  for each row execute procedure public.update_updated_at();

create trigger update_assessments_updated_at
  before update on public.assessments
  for each row execute procedure public.update_updated_at();

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();
