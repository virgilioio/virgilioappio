-- Once (Allan, 2026-10-31): two hires from before Gio ATS and Gio Sales were
-- linked are linked now. Gio Sales' migration of the same name links its two
-- deals, makes their invoices the success fees they were and records the
-- commissions already paid on them.
--
--   Catalyst Campaign Manager (job 88eb7f72), REQ-1087: Claudio Echeverry
--     Rocha, hired May 5, 2026 (unchanged). Gio Sales deal 3097fd39, won
--     Jun 27, 2026. Success fee 15%.
--   Memberships Campaign Manager (job f0d5173a), REQ-1093: Erika Garcia
--     Padilla, hired May 18, 2026 (it read Sep 18, 2026, the day it was
--     recorded, not the day she was hired). Gio Sales deal f0355656, won
--     May 30, 2026. Success fee 15%.
--
-- Both hires credit Javier Rodriguez as Sourcer and Allan Bravo as Recruiter,
-- as the jobs' hiring teams already say.
--
-- Here: each job carries its deal (sales_deal_* and sales_team, as a job set
-- up from Gio Sales does) and its deal line (job_sales_lines, one hire at
-- 15%); each opening carries its hire credit, its deal, line and fee; Erika's
-- hire date moves to May 18 on the opening and her application. Each candidate
-- gets the line Change credit writes ("Hire credit recorded · REQ-…").
--
-- No message goes to Gio Sales from here: the credit and the date are written
-- while the openings have no deal yet (job_openings_sales_events sends nothing
-- then), and the deal is added afterwards with the hire and credit unchanged.
-- A migration runs outside the hire guard's reach (it stops signed-in people
-- only), as Change credit itself does.
--
-- Only while nothing has moved on: both openings filled with no credit and no
-- deal yet. Otherwise nothing changes.

do $fix$
declare
  v_tenant constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_javier constant uuid := 'd294b6a2-3736-43f6-b8c3-d85845fcbe89';
  v_allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  c_job constant uuid := '88eb7f72-3f91-4c7a-a89f-7e7a8850599d';
  m_job constant uuid := 'f0d5173a-0bd2-4759-a09a-e007a66cb7b0';
  c_open constant uuid := '523910d6-c52f-4e3e-b16c-87f3d9a357e2';
  m_open constant uuid := 'cf1e0cf4-73ad-48a6-9d61-6bfddc132abc';
  c_deal constant uuid := '3097fd39-872a-4c24-bde2-ede6b31d08d6';
  m_deal constant uuid := 'f0355656-fac6-4c13-9c70-838f5e91b925';
  c_line constant uuid := 'dca3988c-4838-44d5-aaf8-a9b85d61b3ab';
  m_line constant uuid := 'c5bdd642-ee52-4b07-8666-8d4c7fcdadd7';
  m_hired constant timestamptz := '2026-05-18 18:00:00+00';
  v_team constant jsonb := '{"es": [{"id": "b88210ef-7e4f-4288-9dfb-9feb42e672b5", "name": "Allan Bravo", "email": "allan@virgilio.tech"}], "sales": [{"id": "b88210ef-7e4f-4288-9dfb-9feb42e672b5", "name": "Allan Bravo", "email": "allan@virgilio.tech"}]}';
  o record;
begin
  if (select count(*) from public.job_openings
       where id in (c_open, m_open) and hired_association_id is not null
         and sourcer_user_id is null and recruiter_user_id is null and sales_deal_id is null) <> 2
     or exists (select 1 from public.jobs where id in (c_job, m_job) and sales_deal_id is not null) then
    raise notice 'Legacy hires already linked or changed; nothing to do.';
    return;
  end if;

  -- 1. The hire credit (and Erika's hire date), while the openings have no deal.
  update public.job_openings set sourcer_user_id = v_javier, recruiter_user_id = v_allan where id = c_open;
  update public.job_openings set sourcer_user_id = v_javier, recruiter_user_id = v_allan, filled_at = m_hired where id = m_open;
  update public.job_candidate_associations set hired_at = m_hired
   where id = (select hired_association_id from public.job_openings where id = m_open);

  -- 2. Each job carries its deal, as a job set up from Gio Sales does.
  update public.jobs
     set sales_deal_id = c_deal, sales_deal_title = 'Catalyst Campaign Manager',
         sales_deal_url = 'https://sales.gogio.io/deals?deal=' || c_deal, sales_deal_owner = 'Allan Bravo',
         sales_deal_won_at = '2026-06-27', sales_team = v_team
   where id = c_job;
  update public.jobs
     set sales_deal_id = m_deal, sales_deal_title = 'Memberships Campaign Manager',
         sales_deal_url = 'https://sales.gogio.io/deals?deal=' || m_deal, sales_deal_owner = 'Allan Bravo',
         sales_deal_won_at = '2026-05-30', sales_team = v_team
   where id = m_job;
  insert into public.job_sales_lines (tenant_id, job_id, deal_id, line_id, hires, fee_pct)
  values (v_tenant, c_job, c_deal, c_line, 1, 15),
         (v_tenant, m_job, m_deal, m_line, 1, 15);

  -- 3. Each opening carries its deal, line and fee (the hire and credit are unchanged here).
  update public.job_openings set sales_deal_id = c_deal, sales_line_id = c_line, fee_pct = 15 where id = c_open;
  update public.job_openings set sales_deal_id = m_deal, sales_line_id = m_line, fee_pct = 15 where id = m_open;

  -- 4. The candidates' history, as Change credit writes it.
  for o in
    select jo.id, jo.job_id, jo.req_id, jo.hired_association_id, j.organization_id, jca.candidate_id
      from public.job_openings jo
      join public.jobs j on j.id = jo.job_id
      join public.job_candidate_associations jca on jca.id = jo.hired_association_id
     where jo.id in (c_open, m_open)
  loop
    insert into public.activities (user_id, organization_id, activity_type, title, description, metadata, entity_type, entity_id)
    values (v_allan, o.organization_id, 'candidate_status_changed', 'Hire credit recorded · ' || o.req_id,
            'Sourcer: nobody → Javier Rodriguez. Recruiter: nobody → Allan Bravo.'
              || case when o.id = m_open then ' Hired on May 18, 2026 (it read Sep 18, 2026, the day it was recorded).' else '' end,
            jsonb_build_object('candidateId', o.candidate_id, 'jobId', o.job_id, 'associationId', o.hired_association_id,
                               'openingId', o.id, 'reqId', o.req_id,
                               'sourcerId', v_javier, 'recruiterId', v_allan,
                               'previousSourcerId', null, 'previousRecruiterId', null),
            'candidate', o.candidate_id);
  end loop;
end $fix$;
