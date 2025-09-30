-- Create the resolve_org_context RPC function
-- This returns the user's active organization context from the database
-- Makes org context DB-driven rather than JWT-driven
create or replace function public.resolve_org_context()
returns table(organization_id uuid, role text, user_type text)
language sql 
stable 
security definer 
set search_path = ''
as $$
  select 
    m.organization_id, 
    m.member_role::text as role,
    m.user_type::text as user_type
  from public.members m
  where m.user_id = auth.uid()
    and m.user_status = 'active'
  order by m.created_at desc
  limit 1
$$;