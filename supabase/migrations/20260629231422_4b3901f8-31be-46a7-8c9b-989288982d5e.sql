
-- =========================================================================
-- Chat module foundation: tables, RLS, GRANTs, helper fns, partitions, flags
-- =========================================================================

-- ---------- 1. Helper: can current user access a chat thread? ----------
-- Owner or Admin in the tenant, OR recruiter assigned to the job.
CREATE OR REPLACE FUNCTION public.can_access_chat_thread(_tenant_id uuid, _job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = _tenant_id
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.system_role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.job_assignments ja
          WHERE ja.user_id = auth.uid()
            AND ja.job_id  = _job_id
            AND ja.role    = 'recruiter'
            AND ja.deleted_at IS NULL
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_chat_thread(uuid, uuid) TO authenticated, service_role;

-- Module-level access (used to gate sidebar / route)
CREATE OR REPLACE FUNCTION public.can_use_chat_module()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.system_role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.job_assignments ja
          WHERE ja.user_id = auth.uid()
            AND ja.role    = 'recruiter'
            AND ja.deleted_at IS NULL
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_use_chat_module() TO authenticated, service_role;

-- ---------- 2. chat_threads ----------
CREATE TABLE public.chat_threads (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL,
  job_id                   uuid NOT NULL,
  candidate_id             uuid NOT NULL,
  association_id           uuid,
  channel                  text NOT NULL DEFAULT 'in_app',  -- in_app | email | whatsapp
  mode                     text NOT NULL DEFAULT 'ai',      -- ai | recruiter
  status                   text NOT NULL DEFAULT 'active',  -- active | awaiting_human | closed
  assigned_recruiter_id    uuid,
  last_message_at          timestamptz,
  last_message_preview     text,
  last_candidate_read_at   timestamptz,
  last_recruiter_read_at   timestamptz,
  message_count            int  NOT NULL DEFAULT 0,
  context_summary          text,
  archived_at              timestamptz,
  deleted_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_threads_tenant         ON public.chat_threads(tenant_id);
CREATE INDEX idx_chat_threads_job            ON public.chat_threads(job_id);
CREATE INDEX idx_chat_threads_candidate      ON public.chat_threads(candidate_id);
CREATE INDEX idx_chat_threads_assigned       ON public.chat_threads(assigned_recruiter_id);
CREATE INDEX idx_chat_threads_last_msg       ON public.chat_threads(tenant_id, last_message_at DESC);
CREATE UNIQUE INDEX uq_chat_threads_assoc    ON public.chat_threads(association_id) WHERE association_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can view their chat threads"
  ON public.chat_threads FOR SELECT TO authenticated
  USING (public.can_access_chat_thread(tenant_id, job_id));

CREATE POLICY "Recruiters can update their chat threads"
  ON public.chat_threads FOR UPDATE TO authenticated
  USING (public.can_access_chat_thread(tenant_id, job_id))
  WITH CHECK (public.can_access_chat_thread(tenant_id, job_id));

-- Inserts happen via service_role (edge functions); no INSERT policy for authenticated.

-- ---------- 3. chat_messages (partitioned monthly) ----------
CREATE TABLE public.chat_messages (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id             uuid NOT NULL,
  tenant_id             uuid NOT NULL,
  direction             text NOT NULL,           -- in | out | note
  sender_type           text NOT NULL,           -- candidate | recruiter | ai | system
  sender_user_id        uuid,
  body                  text,
  parts                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_by_recipient_at  timestamptz,
  redacted_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_chat_messages_thread   ON public.chat_messages(thread_id, created_at DESC);
CREATE INDEX idx_chat_messages_tenant   ON public.chat_messages(tenant_id);

GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can view messages in their threads"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id
      AND public.can_access_chat_thread(t.tenant_id, t.job_id)
  ));

CREATE POLICY "Recruiters can post into their threads"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND direction IN ('out', 'note')
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.tenant_id = chat_messages.tenant_id
        AND public.can_access_chat_thread(t.tenant_id, t.job_id)
    )
  );

-- Initial partitions: previous, current, next two months.
DO $$
DECLARE
  m date := date_trunc('month', now())::date - interval '1 month';
  i int;
  start_d date;
  end_d   date;
  pname   text;
BEGIN
  FOR i IN 0..3 LOOP
    start_d := (m + (i || ' month')::interval)::date;
    end_d   := (start_d + interval '1 month')::date;
    pname   := format('chat_messages_%s', to_char(start_d, 'YYYY_MM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.chat_messages FOR VALUES FROM (%L) TO (%L);',
      pname, start_d, end_d
    );
  END LOOP;
END $$;

-- ---------- 4. chat_access_tokens (candidate magic-link bookkeeping) ----------
CREATE TABLE public.chat_access_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  thread_id       uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  candidate_id    uuid NOT NULL,
  jti_hash        text NOT NULL UNIQUE,        -- SHA-256 of JWT jti
  issued_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  use_count       int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_access_tokens_thread ON public.chat_access_tokens(thread_id);
CREATE INDEX idx_chat_access_tokens_jti    ON public.chat_access_tokens(jti_hash);

GRANT SELECT ON public.chat_access_tokens TO authenticated;
GRANT ALL    ON public.chat_access_tokens TO service_role;

ALTER TABLE public.chat_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can view tokens for their threads"
  ON public.chat_access_tokens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = chat_access_tokens.thread_id
      AND public.can_access_chat_thread(t.tenant_id, t.job_id)
  ));

-- ---------- 5. chat_rate_limits (sliding window counters, service_role only) ----------
CREATE TABLE public.chat_rate_limits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        text NOT NULL,        -- 'thread' | 'ip' | 'tenant_ai'
  scope_key    text NOT NULL,        -- thread_id, ip, tenant_id
  window_start timestamptz NOT NULL DEFAULT now(),
  count        int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_rate_limits_lookup ON public.chat_rate_limits(scope, scope_key, window_start DESC);

GRANT ALL ON public.chat_rate_limits TO service_role;
ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role (which bypasses RLS) can touch this.

-- ---------- 6. chat_audit_log ----------
CREATE TABLE public.chat_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  thread_id   uuid,
  actor_type  text NOT NULL,            -- candidate | recruiter | ai | system
  actor_id    uuid,
  event       text NOT NULL,            -- token_issued | token_used | token_revoked | handoff | message_redacted | thread_closed ...
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_audit_log_thread ON public.chat_audit_log(thread_id, created_at DESC);
CREATE INDEX idx_chat_audit_log_tenant ON public.chat_audit_log(tenant_id, created_at DESC);

GRANT SELECT ON public.chat_audit_log TO authenticated;
GRANT ALL    ON public.chat_audit_log TO service_role;

ALTER TABLE public.chat_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/owners can view chat audit log"
  ON public.chat_audit_log FOR SELECT TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = chat_audit_log.tenant_id
        AND m.user_status = 'active'
        AND (m.user_type = 'workspace_owner' OR m.system_role = 'admin')
    )
  );

-- ---------- 7. updated_at triggers ----------
CREATE TRIGGER trg_chat_threads_updated_at
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 8. Flag columns on existing tables ----------
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_mode    text    NOT NULL DEFAULT 'ai';

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS chat_retention_days_after_close int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS chat_hard_delete_days           int NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS chat_ai_daily_token_cap         int NOT NULL DEFAULT 100000;
