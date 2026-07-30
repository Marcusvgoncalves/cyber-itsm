-- DATABASE SCHEMA FOR CYBER-ITSM
-- Run this in the Supabase SQL Editor

-- 1. CLEANUP (Optional)
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user();
-- drop table if exists public.audit_logs;
-- drop table if exists public.comments;
-- drop table if exists public.tickets;
-- drop table if exists public.profiles;

-- 2. CREATE PROFILES TABLE
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null check (role in ('admin', 'analyst', 'requester')) default 'requester',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- 3. CREATE TICKETS TABLE
create table public.tickets (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('backlog', 'todo', 'in_progress', 'under_review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  framework text check (framework in ('nist', 'cis', 'iso', 'sabsa')),
  framework_category text,
  framework_subcategory text,
  requester_id uuid references public.profiles(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on tickets
alter table public.tickets enable row level security;

-- 4. CREATE COMMENTS TABLE
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on comments
alter table public.comments enable row level security;

-- 5. CREATE AUDIT LOGS TABLE
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on audit_logs
alter table public.audit_logs enable row level security;

-- 6. TICKET KEY SEQUENCE & GENERATOR TRIGGER
create sequence public.ticket_key_seq start 1000;

create or replace function public.set_ticket_key()
returns trigger as $$
begin
  if new.key is null or new.key = '' then
    new.key := 'SEC-' || nextval('public.ticket_key_seq');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_ticket_insert_before
  before insert on public.tickets
  for each row execute procedure public.set_ticket_key();

-- 7. NEW USER TRIGGER (auth.users -> public.profiles)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'requester')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. AUDIT LOGS TRIGGER
create or replace function public.log_ticket_changes()
returns trigger as $$
begin
  insert into public.audit_logs (ticket_id, user_id, action, old_values, new_values)
  values (
    coalesce(new.id, old.id),
    auth.uid(),
    TG_OP,
    case when TG_OP = 'UPDATE' or TG_OP = 'DELETE' then row_to_json(old)::jsonb else null end,
    case when TG_OP = 'UPDATE' or TG_OP = 'INSERT' then row_to_json(new)::jsonb else null end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_ticket_modified
  after insert or update or delete on public.tickets
  for each row execute procedure public.log_ticket_changes();

-- 9. RLS POLICIES

-- ====================
-- PROFILES POLICIES
-- ====================
create policy "Allow public read on profiles" 
  on public.profiles for select using (true);

create policy "Allow users to update own profile" 
  on public.profiles for update using (auth.uid() = id);

-- ====================
-- TICKETS POLICIES
-- ====================
create policy "Allow read access to tickets" 
  on public.tickets for select using (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and (public.profiles.role in ('admin', 'analyst') or auth.uid() = tickets.requester_id)
    )
  );

create policy "Allow inserts to tickets" 
  on public.tickets for insert with check (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and (public.profiles.role in ('admin', 'analyst') or auth.uid() = requester_id)
    )
  );

create policy "Allow updates to tickets" 
  on public.tickets for update using (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and (public.profiles.role in ('admin', 'analyst') or auth.uid() = tickets.requester_id)
    )
  ) with check (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and (public.profiles.role in ('admin', 'analyst') or auth.uid() = requester_id)
    )
  );

create policy "Allow deletion to tickets (admin only)" 
  on public.tickets for delete using (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and public.profiles.role = 'admin'
    )
  );

-- ====================
-- COMMENTS POLICIES
-- ====================
create policy "Allow read comments" 
  on public.comments for select using (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and (
        public.profiles.role in ('admin', 'analyst') 
        or exists (
          select 1 from public.tickets 
          where public.tickets.id = comments.ticket_id 
          and public.tickets.requester_id = auth.uid()
        )
      )
    )
  );

create policy "Allow create comments" 
  on public.comments for insert with check (
    auth.uid() = user_id and (
      exists (
        select 1 from public.profiles
        where public.profiles.id = auth.uid()
        and (
          public.profiles.role in ('admin', 'analyst')
          or exists (
            select 1 from public.tickets 
            where public.tickets.id = comments.ticket_id 
            and public.tickets.requester_id = auth.uid()
          )
        )
      )
    )
  );

create policy "Allow update/delete own comments" 
  on public.comments for all using (
    auth.uid() = user_id
  );

-- ====================
-- AUDIT LOGS POLICIES
-- ====================
create policy "Allow view audit logs" 
  on public.audit_logs for select using (
    exists (
      select 1 from public.profiles
      where public.profiles.id = auth.uid()
      and (
        public.profiles.role in ('admin', 'analyst')
        or exists (
          select 1 from public.tickets 
          where public.tickets.id = audit_logs.ticket_id 
          and public.tickets.requester_id = auth.uid()
        )
      )
    )
  );
