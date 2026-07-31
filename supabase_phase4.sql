-- DATABASE SCHEMA UPDATE FOR FASE 4 (ATTACHMENTS & STORAGE)
-- Run this in the Supabase SQL Editor

-- 1. CREATE ATTACHMENTS TABLE
create table if not exists public.attachments (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  file_name text not null,
  file_path text not null, -- format: "ticket-id/filename"
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on attachments
alter table public.attachments enable row level security;

-- 2. CREATE PRIVATE STORAGE BUCKET
insert into storage.buckets (id, name, public) 
values ('evidence-attachments', 'evidence-attachments', false)
on conflict (id) do nothing;

-- 3. RLS POLICIES FOR ATTACHMENTS TABLE
create policy "Allow read attachments" 
  on public.attachments for select using (
    exists (
      select 1 from public.tickets
      where public.tickets.id = attachments.ticket_id
    )
  );

create policy "Allow insert attachments" 
  on public.attachments for insert with check (
    auth.uid() = uploaded_by and exists (
      select 1 from public.tickets
      where public.tickets.id = ticket_id
    )
  );

create policy "Allow delete attachments" 
  on public.attachments for delete using (
    auth.uid() = uploaded_by or exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid() and public.profiles.role = 'admin'
    )
  );

-- 4. RLS POLICIES FOR STORAGE OBJECTS
-- In Supabase Storage, foldername(name) extracts the directory path parts.
-- The first segment (index 1 in PG array) is the ticket_id.

create policy "Allow select objects in evidence-attachments"
  on storage.objects for select using (
    bucket_id = 'evidence-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.tickets
      where public.tickets.id::text = (storage.foldername(name))[1]
    )
  );

create policy "Allow insert objects in evidence-attachments"
  on storage.objects for insert with check (
    bucket_id = 'evidence-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.tickets
      where public.tickets.id::text = (storage.foldername(name))[1]
    )
  );

create policy "Allow delete objects in evidence-attachments"
  on storage.objects for delete using (
    bucket_id = 'evidence-attachments'
    and auth.role() = 'authenticated'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.profiles
        where public.profiles.id = auth.uid() and public.profiles.role = 'admin'
      )
    )
  );
