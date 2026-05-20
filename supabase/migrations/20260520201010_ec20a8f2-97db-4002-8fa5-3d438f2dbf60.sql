-- ============================================================
-- Share list with teammates — schema, RLS, slug trigger, RPC
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.candidate_list_access AS ENUM ('view', 'comment', 'comment_score');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.candidate_list_reviewer_status AS ENUM ('pending', 'active', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- candidate_lists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidate_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  block_screenshots BOOLEAN NOT NULL DEFAULT false,
  share_link_active BOOLEAN NOT NULL DEFAULT true,
  notify_on_activity BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_lists_tenant ON public.candidate_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_lists_owner ON public.candidate_lists(owner_user_id);

ALTER TABLE public.candidate_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view candidate lists"
  ON public.candidate_lists FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can create candidate lists"
  ON public.candidate_lists FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id) AND owner_user_id = auth.uid());

CREATE POLICY "Owners can update their candidate lists"
  ON public.candidate_lists FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners can delete their candidate lists"
  ON public.candidate_lists FOR DELETE
  USING (owner_user_id = auth.uid());

-- ============================================================
-- candidate_list_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidate_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.candidate_lists(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL,
  added_by UUID NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_candidate_list_items_list ON public.candidate_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_candidate_list_items_candidate ON public.candidate_list_items(candidate_id);

ALTER TABLE public.candidate_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view list items"
  ON public.candidate_list_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_items.list_id
      AND public.user_has_tenant_access(l.tenant_id)
  ));

CREATE POLICY "Tenant members can add list items"
  ON public.candidate_list_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_items.list_id
      AND public.user_has_tenant_access(l.tenant_id)
  ) AND added_by = auth.uid());

CREATE POLICY "Tenant members can remove list items"
  ON public.candidate_list_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_items.list_id
      AND public.user_has_tenant_access(l.tenant_id)
  ));

-- ============================================================
-- candidate_list_reviewers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidate_list_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.candidate_lists(id) ON DELETE CASCADE,
  user_id UUID,
  invited_email TEXT,
  access public.candidate_list_access NOT NULL DEFAULT 'comment_score',
  notify_enabled BOOLEAN NOT NULL DEFAULT true,
  status public.candidate_list_reviewer_status NOT NULL DEFAULT 'active',
  invited_by UUID NOT NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_list_reviewers_list ON public.candidate_list_reviewers(list_id);
CREATE INDEX IF NOT EXISTS idx_candidate_list_reviewers_user ON public.candidate_list_reviewers(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_list_reviewers_list_user
  ON public.candidate_list_reviewers(list_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_list_reviewers_list_email
  ON public.candidate_list_reviewers(list_id, invited_email)
  WHERE invited_email IS NOT NULL;

ALTER TABLE public.candidate_list_reviewers ENABLE ROW LEVEL SECURITY;

-- Validation via trigger (avoid CHECK constraints per project convention)
CREATE OR REPLACE FUNCTION public.validate_candidate_list_reviewer()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.invited_email IS NULL THEN
    RAISE EXCEPTION 'Either user_id or invited_email must be set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_candidate_list_reviewer ON public.candidate_list_reviewers;
CREATE TRIGGER trg_validate_candidate_list_reviewer
  BEFORE INSERT OR UPDATE ON public.candidate_list_reviewers
  FOR EACH ROW EXECUTE FUNCTION public.validate_candidate_list_reviewer();

CREATE POLICY "Tenant members can view list reviewers"
  ON public.candidate_list_reviewers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_reviewers.list_id
      AND public.user_has_tenant_access(l.tenant_id)
  ));

CREATE POLICY "Tenant members can add list reviewers"
  ON public.candidate_list_reviewers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_reviewers.list_id
      AND public.user_has_tenant_access(l.tenant_id)
  ) AND invited_by = auth.uid());

CREATE POLICY "List owners can update reviewers"
  ON public.candidate_list_reviewers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_reviewers.list_id
      AND l.owner_user_id = auth.uid()
  ));

CREATE POLICY "List owners can delete reviewers"
  ON public.candidate_list_reviewers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_reviewers.list_id
      AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- candidate_list_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidate_list_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.candidate_lists(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_list_messages_list ON public.candidate_list_messages(list_id);

ALTER TABLE public.candidate_list_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view list messages"
  ON public.candidate_list_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_messages.list_id
      AND public.user_has_tenant_access(l.tenant_id)
  ));

CREATE POLICY "Tenant members can add list messages"
  ON public.candidate_list_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.candidate_lists l
    WHERE l.id = candidate_list_messages.list_id
      AND public.user_has_tenant_access(l.tenant_id)
  ) AND author_user_id = auth.uid());

-- ============================================================
-- Slug generation trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_candidate_list_slug()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  suffix INT := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;
  base := lower(regexp_replace(coalesce(NEW.name, 'list'), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  IF base = '' THEN base := 'list'; END IF;
  IF length(base) > 60 THEN base := substr(base, 1, 60); END IF;
  candidate := base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_candidate_list_slug ON public.candidate_lists;
CREATE TRIGGER trg_generate_candidate_list_slug
  BEFORE INSERT ON public.candidate_lists
  FOR EACH ROW EXECUTE FUNCTION public.generate_candidate_list_slug();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_candidate_lists_updated_at ON public.candidate_lists;
CREATE TRIGGER trg_candidate_lists_updated_at
  BEFORE UPDATE ON public.candidate_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Atomic create RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_candidate_list_with_reviewers(
  p_tenant_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_expires_at TIMESTAMPTZ,
  p_block_screenshots BOOLEAN,
  p_notify_on_activity BOOLEAN,
  p_candidate_ids UUID[],
  p_reviewers JSONB,
  p_message TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_list_id UUID;
  v_cand UUID;
  v_rev JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Forbidden: tenant access denied';
  END IF;

  INSERT INTO public.candidate_lists(
    tenant_id, owner_user_id, name, description, expires_at,
    block_screenshots, notify_on_activity
  ) VALUES (
    p_tenant_id, v_user, p_name, NULLIF(p_description, ''), p_expires_at,
    coalesce(p_block_screenshots, false), coalesce(p_notify_on_activity, true)
  ) RETURNING id INTO v_list_id;

  IF p_candidate_ids IS NOT NULL THEN
    FOREACH v_cand IN ARRAY p_candidate_ids LOOP
      INSERT INTO public.candidate_list_items(list_id, candidate_id, added_by)
      VALUES (v_list_id, v_cand, v_user)
      ON CONFLICT (list_id, candidate_id) DO NOTHING;
    END LOOP;
  END IF;

  IF p_reviewers IS NOT NULL THEN
    FOR v_rev IN SELECT * FROM jsonb_array_elements(p_reviewers) LOOP
      INSERT INTO public.candidate_list_reviewers(
        list_id, user_id, invited_email, access, notify_enabled, status, invited_by
      ) VALUES (
        v_list_id,
        NULLIF(v_rev->>'user_id', '')::uuid,
        NULLIF(v_rev->>'invited_email', ''),
        coalesce((v_rev->>'access')::public.candidate_list_access, 'comment_score'),
        coalesce((v_rev->>'notify_enabled')::boolean, true),
        CASE WHEN v_rev->>'user_id' IS NOT NULL AND v_rev->>'user_id' <> '' THEN 'active' ELSE 'pending' END::public.candidate_list_reviewer_status,
        v_user
      );
    END LOOP;
  END IF;

  IF p_message IS NOT NULL AND length(trim(p_message)) > 0 THEN
    INSERT INTO public.candidate_list_messages(list_id, author_user_id, body)
    VALUES (v_list_id, v_user, p_message);
  END IF;

  RETURN v_list_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_candidate_list_with_reviewers(UUID, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, UUID[], JSONB, TEXT) TO authenticated;
