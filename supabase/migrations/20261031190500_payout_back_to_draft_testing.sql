-- Once, for testing (Allan, 2026-10-31): Allan's October 2026 payout goes back
-- to draft in Gio Sales (VIR-2026-0001 withdrawn; Gio Sales migration
-- 20261031190000 there). Drafts never show in Gio ATS, so its copy here and
-- the "Your October 2026 payout is approved" bell are removed. The next
-- approval sends the payout again and rings the bell again.
--
-- Only the copy that is still approved and unpaid, and only that bell.

do $once$
declare
  v_sales_payout constant uuid := '75594f62-25d4-4133-82b2-9834ddb19fe6';
  v_copy uuid;
begin
  select p.id into v_copy from public.os_commission_payouts p
   where p.sales_payout_id = v_sales_payout and p.status = 'approved' and p.paid_on is null
     and p.invoice_number = 'VIR-2026-0001';
  if v_copy is not null then
    -- The bell names the copy in its link (its entity_id is empty).
    delete from public.notifications n
     where n.entity_kind = 'commission_payout'
       and n.action_url = '/me?tab=earnings&view=payouts&payout=' || v_copy;
    delete from public.os_commission_payouts where id = v_copy;
  end if;
end $once$;
