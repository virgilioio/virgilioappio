-- The workspace kill switch removes a workspace's CRM stages along with
-- everything else, but protect_terminal_deal_stages refused to let the last
-- "won" or "lost" stage go (found previewing Motive, 2026-10-14). The guard
-- still protects every CRM day to day; it only stands aside while
-- platform_remove_workspace() is removing the whole workspace, which marks its
-- own transaction with gio.write_source = 'workspace_removal'. That setting is
-- transaction-local and clients can't set it.
--
-- Same body as before otherwise. The trigger fires only on removal or update,
-- so "not an update" is the removal branch.

create or replace function public.protect_terminal_deal_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_count integer;
BEGIN
  IF current_setting('gio.write_source', true) = 'workspace_removal' THEN
    IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
    RETURN OLD;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    IF OLD.stage_type IN ('won','lost') THEN
      SELECT count(*) INTO v_count
      FROM public.deal_stages
      WHERE tenant_id = OLD.tenant_id
        AND stage_type = OLD.stage_type
        AND id <> OLD.id;
      IF v_count = 0 THEN
        RAISE EXCEPTION 'Cannot remove the % stage — every CRM must keep at least one % stage.', OLD.stage_type, OLD.stage_type
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF OLD.stage_type IN ('won','lost') AND NEW.stage_type <> OLD.stage_type THEN
      SELECT count(*) INTO v_count
      FROM public.deal_stages
      WHERE tenant_id = OLD.tenant_id
        AND stage_type = OLD.stage_type
        AND id <> OLD.id;
      IF v_count = 0 THEN
        RAISE EXCEPTION 'Cannot change the type of the only % stage — every CRM must keep at least one % stage.', OLD.stage_type, OLD.stage_type
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
