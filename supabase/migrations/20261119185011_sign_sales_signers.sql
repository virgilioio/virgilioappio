-- Gio Sign for Gio Sales: who has signed (Allan, 2026-11-19).
--
-- The snapshot every Gio Sales sign event carries (sign_sales_snapshot) now
-- also says which template the agreement came from and where each signer
-- stands, in signing order, so a deal can show the progress person by person
-- and a company's signed agreement can count for its next deal when it's the
-- pipeline's own template. Each signer: name, the role's label, signer or
-- approver, status (waiting: not their turn yet; sent; viewed; signed;
-- approved; declined) and when. Never an email, IP address or user agent.
-- Copies (cc) stay out, as in the counts.

create or replace function public.sign_sales_snapshot(_envelope_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'envelope_id', e.id,
    'public_id', e.public_id,
    'org_id', e.sales_org_id,
    'deal_id', e.source_id,
    'company_id', e.sales_company_id,
    'template_id', e.template_id,
    'title', e.title,
    'status', e.status,
    'sender_name', e.sender_name,
    'sender_email', e.sender_email,
    'sender_sales_user_id', e.sender_sales_user_id,
    'signers_total', (select count(*) from public.sign_recipients r where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc'),
    'signers_done', (select count(*) from public.sign_recipients r where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc' and r.status in ('signed', 'approved')),
    'next_signer_name', (select r.name from public.sign_recipients r where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc' and r.status in ('sent', 'viewed') order by r.position limit 1),
    'signers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'position', r.position,
               'name', r.name,
               'label', r.label,
               'role', r.role,
               'status', r.status,
               'viewed_at', r.viewed_at,
               'done_at', coalesce(r.signed_at, r.approved_at),
               'declined_at', r.declined_at)
             order by r.position, r.created_at)
        from public.sign_recipients r
       where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc'), '[]'::jsonb),
    'reason', coalesce(e.void_reason, (select r.decline_reason from public.sign_recipients r where r.envelope_id = e.id and r.status = 'declined' limit 1)),
    'sent_at', e.sent_at,
    'expires_at', e.expires_at,
    'completed_at', e.completed_at,
    'sealed', e.sealed_path is not null,
    'deleted', e.deleted_at is not null
  )
  from public.sign_envelopes e where e.id = _envelope_id;
$function$;
