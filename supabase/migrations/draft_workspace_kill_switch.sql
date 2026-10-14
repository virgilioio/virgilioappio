-- Workspace kill switch (Allan, 2026-10-13).
-- We no longer sell the ATS, so a platform admin can remove a SaaS customer's
-- workspace for good. Its candidates become Virgilio's; everything else goes.
--
--   select public.platform_remove_workspace(tenant, actor, false)  -- preview
--   select public.platform_remove_workspace(tenant, actor, true)   -- remove
--
-- The preview runs exactly the same steps and then rolls them back, so its
-- counts are what removing would do. Either way the result is a jsonb report.
-- Only the service role may call it (the admin-remove-workspace edge function,
-- which checks the caller is a platform admin and passes them as p_actor).
--
-- Rules:
--   * Never the Virgilio (platform) workspace.
--   * The workspace must be deactivated first (billing_status 'locked').
--   * A live Stripe subscription must be cancelled first.
--   * Candidates move to Virgilio (tenant and root organization). A candidate
--     Virgilio already has (same email and name, ignoring case, or the same
--     Apollo person) stays as Virgilio has it; the workspace's copy goes. So do
--     the workspace's own soft-deleted and merged-away records.
--   * Moved candidates keep their profile, files, work history, EEO answers
--     and privacy requests. Their pipelines, comments, reminders, tags, lists
--     and bookings in the removed workspace go with its jobs. Every privacy
--     suppression the workspace held is copied to Virgilio.
--   * The report lists the people who belonged only to this workspace
--     (users_to_remove) and the files of candidates that didn't move that
--     nothing else still uses (attachment_paths, in candidate-attachments);
--     the edge function removes those after commit.

create function public.platform_remove_workspace(
  p_tenant_id uuid,
  p_actor uuid,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_platform uuid;
  v_name text;
  v_orgs uuid[];
  v_jobs uuid[];
  v_all uuid[];
  v_movers uuid[];
  v_known uuid[];
  v_users uuid[];
  v_bookings uuid[];
  v_paths text[];
  v_n bigint;
  v_counts jsonb := '{}'::jsonb;
  v_applied boolean := false;
begin
  -- Who and what ----------------------------------------------------------
  if not exists (
    select 1 from public.members m
    where m.user_id = p_actor and m.user_type = 'platform_admin' and m.user_status = 'active'
  ) then
    raise exception 'Only a platform admin can remove a workspace.' using errcode = 'GW002';
  end if;

  select o.id into strict v_platform
  from public.organizations o
  where o.organization_type = 'platform';

  if p_tenant_id = v_platform then
    raise exception 'The Virgilio workspace can''t be removed.' using errcode = 'GW002';
  end if;

  select t.name into v_name from public.tenants t where t.id = p_tenant_id;
  if not found then
    raise exception 'That workspace doesn''t exist.' using errcode = 'GW002';
  end if;

  if not exists (
    select 1 from public.tenant_subscriptions s
    where s.tenant_id = p_tenant_id and s.billing_status = 'locked'
  ) then
    raise exception 'Deactivate % first. Only a deactivated workspace can be removed.', v_name
      using errcode = 'GW003';
  end if;

  if exists (
    select 1 from public.tenant_subscriptions s
    where s.tenant_id = p_tenant_id
      and s.stripe_subscription_id is not null
      and coalesce(s.subscription_status, '') not in ('canceled', 'cancelled', 'incomplete_expired')
  ) then
    raise exception '% still has a Stripe subscription. Cancel it first.', v_name
      using errcode = 'GW003';
  end if;

  v_orgs := array(
    select o.id from public.organizations o
    where o.id = p_tenant_id or o.tenant_id = p_tenant_id
  );
  v_jobs := array(
    select j.id from public.jobs j
    where j.tenant_id = p_tenant_id or j.organization_id = any (v_orgs)
  );
  v_all := array(
    select c.id from public.candidates c
    where c.tenant_id = p_tenant_id or c.organization_id = any (v_orgs)
  );
  -- Already Virgilio's: the same person by email and name (any case), the
  -- same Apollo person, or a row that would collide with the unique key.
  v_known := array(
    select c.id from public.candidates c
    where c.id = any (v_all)
      and (
        exists (
          select 1 from public.candidates v
          where v.tenant_id = v_platform
            and v.email = c.email and v.candidate_name = c.candidate_name
        )
        or (c.email is not null and exists (
          select 1 from public.candidates v
          where v.tenant_id = v_platform and v.deleted_at is null and v.merged_into is null
            and lower(btrim(v.email)) = lower(btrim(c.email))
            and lower(btrim(v.candidate_name)) = lower(btrim(c.candidate_name))
        ))
        or (c.apollo_id is not null and exists (
          select 1 from public.candidates v
          where v.tenant_id = v_platform and v.deleted_at is null and v.merged_into is null
            and v.apollo_id = c.apollo_id
        ))
      )
  );
  v_movers := array(
    select c.id from public.candidates c
    where c.id = any (v_all)
      and not (c.id = any (v_known))
      and c.deleted_at is null
      and c.merged_into is null
  );
  -- People whose only membership is in this workspace (platform admins stay).
  v_users := array(
    select distinct m.user_id from public.members m
    where (m.tenant_id = p_tenant_id or m.organization_id = any (v_orgs))
      and m.user_id is not null
      and not exists (
        select 1 from public.members o
        where o.user_id = m.user_id
          and o.tenant_id <> p_tenant_id
          and not (o.organization_id = any (v_orgs))
      )
      and not exists (
        select 1 from public.members a
        where a.user_id = m.user_id and a.user_type = 'platform_admin'
      )
  );
  v_paths := array(
    select p from (
      select a.file_url as p from public.candidate_attachments a
      where a.candidate_id = any (v_all) and not (a.candidate_id = any (v_movers))
      union
      select a.converted_pdf_url from public.candidate_attachments a
      where a.candidate_id = any (v_all) and not (a.candidate_id = any (v_movers))
    ) x
    where p is not null and p <> '' and p !~* '^https?://'
  );

  v_counts := jsonb_build_object(
    'organizations', coalesce(array_length(v_orgs, 1), 0),
    'jobs', coalesce(array_length(v_jobs, 1), 0),
    'candidates', coalesce(array_length(v_all, 1), 0),
    'candidates_moved', coalesce(array_length(v_movers, 1), 0),
    'candidates_already_in_virgilio', coalesce(array_length(v_known, 1), 0),
    'candidates_discarded',
      coalesce(array_length(v_all, 1), 0) - coalesce(array_length(v_movers, 1), 0)
      - coalesce(array_length(v_known, 1), 0),
    'members', (select count(*) from public.members m
                where m.tenant_id = p_tenant_id or m.organization_id = any (v_orgs)),
    'activities', (select count(*) from public.activities a
                   where a.tenant_id = p_tenant_id or a.organization_id = any (v_orgs))
  );

  -- The work. A preview raises GW001 at the end, which undoes all of it but
  -- keeps the variables above, so the report is the same either way.
  begin
    perform set_config('gio.write_source', 'workspace_removal', true);

    -- 1. Candidates become Virgilio's. Their identity keys are re-created
    --    under Virgilio by candidates_identities_sync.
    update public.candidates c
       set tenant_id = v_platform, organization_id = v_platform
     where c.id = any (v_movers);

    update public.candidate_eeo_responses e
       set tenant_id = v_platform, job_posting_id = null
     where e.candidate_id = any (v_movers);

    update public.privacy_requests r
       set tenant_id = v_platform
     where r.tenant_id = p_tenant_id and r.candidate_id = any (v_movers);

    insert into public.privacy_suppressions (tenant_id, kind, value_hash, reason, created_at)
    select v_platform, s.kind, s.value_hash, s.reason, s.created_at
    from public.privacy_suppressions s
    where s.tenant_id = p_tenant_id
    on conflict (tenant_id, kind, value_hash) do nothing;

    -- 2. Rows with no cascade that would stop jobs, organizations or the
    --    tenant from going, children first.
    v_bookings := array(
      select b.id from public.scheduled_bookings b
      where b.tenant_id = p_tenant_id
         or b.organization_id = any (v_orgs)
         or b.job_id = any (v_jobs)
         or b.job_hiring_stage_id in (select h.id from public.job_hiring_stages h where h.job_id = any (v_jobs))
         or b.job_candidate_association_id in (
              select a.id from public.job_candidate_associations a where a.job_id = any (v_jobs))
    );
    v_counts := v_counts || jsonb_build_object('bookings', coalesce(array_length(v_bookings, 1), 0));

    delete from public.job_stage_scorecards s
     where s.job_id = any (v_jobs) or s.source_booking_id = any (v_bookings);
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('scorecards', v_n);

    delete from public.scheduled_bookings b where b.id = any (v_bookings);

    delete from public.failed_job_board_applications f
     where f.posting_id in (
       select p.id from public.job_postings p
       where p.job_id = any (v_jobs) or p.tenant_id = p_tenant_id);

    delete from public.offer_letters l
     where l.organization_id = any (v_orgs)
        or l.job_id = any (v_jobs)
        or l.form_id in (select f.id from public.offer_forms f
                         where f.tenant_id = p_tenant_id or f.organization_id = any (v_orgs))
        or l.template_id in (select t.id from public.offer_templates t where t.tenant_id = p_tenant_id);

    delete from public.offer_approval_chains c
     where c.organization_id = any (v_orgs) or c.job_id = any (v_jobs);

    delete from public.offer_form_fields f where f.organization_id = any (v_orgs);

    delete from public.stage_automation_emails e
     where e.email_template_id in (
       select t.id from public.email_templates t where t.organization_id = any (v_orgs));

    update public.job_candidate_associations a
       set rejection_reason_id = null
     where a.rejection_reason_id in (
             select r.id from public.rejection_reasons r where r.tenant_id = p_tenant_id)
       and not (a.job_id = any (v_jobs));

    -- 3. Jobs, and with them pipelines, stages, openings, postings, comments.
    delete from public.jobs j where j.id = any (v_jobs);

    delete from public.job_stages s where s.tenant_id = p_tenant_id;

    -- 4. Everything else the workspace owns.
    delete from public.activities a
     where a.tenant_id = p_tenant_id or a.organization_id = any (v_orgs);
    delete from public.apollo_credit_ledger x where x.tenant_id = p_tenant_id;
    delete from public.apollo_credit_plans x where x.tenant_id = p_tenant_id;
    delete from public.application_fields x where x.tenant_id = p_tenant_id;
    delete from public.candidate_application_limits x
     where x.tenant_id = p_tenant_id or x.organization_id = any (v_orgs);
    delete from public.contract_templates x where x.tenant_id = p_tenant_id;
    delete from public.email_logs x
     where x.tenant_id = p_tenant_id or x.organization_id = any (v_orgs);
    delete from public.offer_templates x where x.tenant_id = p_tenant_id;
    delete from public.privacy_requests x where x.tenant_id = p_tenant_id;
    delete from public.privacy_suppressions x where x.tenant_id = p_tenant_id;
    delete from public.talent_pool_runs x where x.tenant_id = p_tenant_id;
    delete from public.sourcing_credits_usage x where x.tenant_id = any (v_orgs);
    delete from audit.download_logs x where x.tenant_id = any (v_orgs);

    -- Tables keyed by tenant with no foreign key.
    delete from public.candidate_duplicate_decisions x where x.tenant_id = p_tenant_id;
    delete from public.candidate_eeo_responses x where x.tenant_id = p_tenant_id;
    delete from public.candidate_tags x where x.tenant_id = p_tenant_id;
    delete from public.tags x where x.tenant_id = p_tenant_id;
    delete from public.candidate_lists x where x.tenant_id = p_tenant_id;
    delete from public.candidate_transfers x where x.target_tenant_id = p_tenant_id;
    delete from public.chat_messages x where x.tenant_id = p_tenant_id;
    delete from public.chat_audit_log x where x.tenant_id = p_tenant_id;
    delete from public.chat_ai_token_usage x where x.tenant_id = p_tenant_id;
    delete from public.chat_notification_queue x where x.tenant_id = p_tenant_id;
    delete from public.chat_thread_reads x where x.tenant_id = p_tenant_id;
    delete from public.chat_access_tokens x where x.tenant_id = p_tenant_id;
    delete from public.chat_threads x where x.tenant_id = p_tenant_id;
    delete from public.company_contacts x where x.tenant_id = p_tenant_id;
    delete from public.currency_rate_overrides x where x.tenant_id = p_tenant_id;
    delete from public.currency_rates x where x.tenant_id = p_tenant_id;
    delete from public.dashboard_queue_dismissals x where x.tenant_id = p_tenant_id;
    delete from public.deal_invoices x where x.tenant_id = p_tenant_id;
    delete from public.deal_notes x where x.tenant_id = p_tenant_id;
    delete from public.deal_payments x where x.tenant_id = p_tenant_id;
    delete from public.deals x where x.tenant_id = p_tenant_id;
    delete from public.deal_stages x where x.tenant_id = p_tenant_id;
    delete from public.integration_outbox x where x.tenant_id = p_tenant_id;
    delete from public.job_sales_lines x where x.tenant_id = p_tenant_id;
    delete from public.job_postings x where x.tenant_id = p_tenant_id;
    delete from public.job_openings x where x.tenant_id = p_tenant_id;
    delete from public.notifications x where x.tenant_id = p_tenant_id;
    delete from public.person_identities x where x.tenant_id = p_tenant_id;
    delete from public.req_id_counters x where x.tenant_id = p_tenant_id;
    delete from public.sourcing_project_candidates x where x.tenant_id = p_tenant_id;
    delete from public.stripe_webhook_events x where x.tenant_id = p_tenant_id;
    delete from public.tenant_access_grants x where x.tenant_id = p_tenant_id;
    delete from public.tenant_subscriptions x where x.tenant_id = p_tenant_id;

    -- Tables keyed by organization with no foreign key.
    delete from public._archived_external_candidate_matches x where x.organization_id = any (v_orgs);
    delete from public._archived_org_credit_usage x where x.organization_id = any (v_orgs);
    delete from public._archived_sourcing_events x where x.organization_id = any (v_orgs);
    delete from public.job_assignments x where x.organization_id = any (v_orgs);
    update public.profiles p set organization_id = null where p.organization_id = any (v_orgs);

    -- 5. People, the candidates that didn't move, then the workspace itself.
    delete from public.members m
     where m.tenant_id = p_tenant_id or m.organization_id = any (v_orgs);

    delete from public.candidates c
     where c.tenant_id = p_tenant_id or c.organization_id = any (v_orgs);
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('candidates_removed', v_n);

    delete from public.organizations o where o.id = any (v_orgs) and o.id <> p_tenant_id;
    delete from public.organizations o where o.id = p_tenant_id;
    delete from public.tenants t where t.id = p_tenant_id;

    -- Files go only when nothing that stays still uses them: a candidate
    -- copied into Virgilio by a transfer shares the workspace copy's files.
    v_paths := array(
      select p from unnest(v_paths) p
      where not exists (
        select 1 from public.candidate_attachments b
        where b.file_url = p or b.converted_pdf_url = p
      )
    );

    if not p_apply then
      raise exception using errcode = 'GW001', message = 'preview';
    end if;
    v_applied := true;
  exception
    when sqlstate 'GW001' then
      v_applied := false;
  end;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'name', v_name,
    'applied', v_applied,
    'counts', v_counts,
    'users_to_remove', to_jsonb(coalesce(v_users, '{}'::uuid[])),
    'attachment_paths', to_jsonb(coalesce(v_paths, '{}'::text[]))
  );
end;
$$;

revoke all on function public.platform_remove_workspace(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.platform_remove_workspace(uuid, uuid, boolean) to service_role;
