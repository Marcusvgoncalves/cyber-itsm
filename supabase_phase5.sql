-- DATABASE SCHEMA UPDATE FOR FASE 5 (KNOWLEDGE BASE)
-- Run this in the Supabase SQL Editor

-- 1. CREATE KB_ARTICLES TABLE
create table if not exists public.kb_articles (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  framework text not null check (framework in ('nist', 'cis', 'iso', 'sabsa')),
  framework_category text,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on kb_articles
alter table public.kb_articles enable row level security;

-- 2. RLS POLICIES FOR KB_ARTICLES
create policy "Allow all authenticated users to read articles"
  on public.kb_articles for select using (
    auth.role() = 'authenticated'
  );

create policy "Allow admins and analysts to insert articles"
  on public.kb_articles for insert with check (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and public.profiles.role in ('admin', 'analyst')
    )
  );

create policy "Allow admins and analysts to update articles"
  on public.kb_articles for update using (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and public.profiles.role in ('admin', 'analyst')
    )
  ) with check (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and public.profiles.role in ('admin', 'analyst')
    )
  );

create policy "Allow only admins to delete articles"
  on public.kb_articles for delete using (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and public.profiles.role = 'admin'
    )
  );
