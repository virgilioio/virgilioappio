# Duplicate candidate dialog — dossier + merge

Replaces `CandidateMergeDialog.tsx` (two-column field diff) with the approved two-pane dialog: the record on the left, only true conflicts on the right.

## One thing to confirm first

In this flow the incoming candidate **is not a saved row yet** — it is the payload from the add-candidate sheet. `checkForDuplicateCandidate` finds the existing candidate before anything is written. So parts of the merge spec that describe re-pointing child rows and soft-deleting a second record have nothing to act on here: there is only one record plus new data.

The function is therefore built to take both shapes:
- `incoming_payload` (the add-candidate flow — today's only caller)
- `merged_candidate_id` (optional, for a real record-to-record merge later; the re-point / soft-delete / `merged_into` branch runs only in this mode)

Everything else in the spec — one transaction, one audit row, secondary phone/email, skills union, resume as a new version, per-job application collapse — applies in both modes.

## Migration SQL (for review before applying)

```sql
-- 1 · Suppressed pairs, so "Not the same person" is permanent
CREATE TABLE public.candidate_duplicate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  match_email text,
  match_phone text,
  match_name text,
  other_candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'not_duplicate',
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX candidate_duplicate_decisions_pair_idx
  ON public.candidate_duplicate_decisions (candidate_id, coalesce(other_candidate_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(match_email,''), coalesce(match_phone,''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_duplicate_decisions TO authenticated;
GRANT ALL ON public.candidate_duplicate_decisions TO service_role;
ALTER TABLE public.candidate_duplicate_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read duplicate decisions"
  ON public.candidate_duplicate_decisions FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));
CREATE POLICY "tenant members write duplicate decisions"
  ON public.candidate_duplicate_decisions FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER trg_cdd_updated_at BEFORE UPDATE ON public.candidate_duplicate_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2 · Merge pointer so old candidate URLs still resolve (record-to-record mode)
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid;
CREATE INDEX IF NOT EXISTS candidates_merged_into_idx ON public.candidates (merged_into) WHERE merged_into IS NOT NULL;

-- 3 · One application per candidate per job, enforced in the database
CREATE UNIQUE INDEX IF NOT EXISTS jca_one_per_candidate_job_idx
  ON public.job_candidate_associations (candidate_id, job_id);

-- 4 · Resume versions: mark superseded files instead of overwriting
ALTER TABLE public.candidate_attachments
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.candidate_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
```

Index (3) is checked for existing violations first; if any candidate already has two applications to one job, I report them and stop rather than failing the migration.

Audit rows use the existing immutable `audit_logs` path via `log_audit_event` — no new audit table.

## Edge Function signatures

```
POST supabase/functions/get-duplicate-context
body: {
  existing_candidate_id: string,
  incoming: {                       // raw payload from the add-candidate sheet
    candidate_name?, email?, phone?, location_city?, location_state?, location_country?,
    role_current?, company_current?, linkedin_url?, salary_amount?, salary_currency?,
    salary_period?, years_experience?, skills?: string[], source?, resume_file_name?
  }
}
returns: {
  candidate, owner, source, created_at,
  counts: { applications, interviews, scorecards, notes, files, emails },
  applications: [{ association_id, job_title, department, location, req_id, stage_name,
                   status, last_moved_at, owner_initials, scheduled_interview, open_offer,
                   rejection_reason, rejected_by_name, rejected_at }],
  flags: [{ id, tone: 'warning'|'info', title, body }],
  activity: [{ kind, text, actor, at }],
  match: { reasons: string[], band: 'high'|'medium'|'low' },
  fields: [{ key, label, existing, incoming, classification: 'conflict'|'identical'|'gap' }],
  skills: { union: string[], new: string[], total: number },
  permissions: { can_merge: boolean, ask: string|null }
}
```

```
POST supabase/functions/merge-candidates
body: {
  surviving_candidate_id: string,
  incoming: { ...same payload },
  resolutions: Record<fieldKey, 'existing' | 'incoming'>,
  merged_candidate_id?: string,      // record-to-record mode only
  resume_attachment?: { file_name, file_url, file_size_bytes, file_type }
}
returns: { candidate_id, audit_log_id, applied: Record<fieldKey, 'existing'|'incoming'> }
```

```
POST supabase/functions/merge-candidates   (action: 'not_duplicate')
body: { existing_candidate_id, incoming, match: { email, phone, name } }
returns: { candidate_id }               // the new, separate candidate
```

Both functions verify the caller's session, resolve the caller's tenant and candidate-edit permission server-side, and refuse when the candidate is outside the caller's tenant. The whole merge runs inside a single `SECURITY DEFINER` SQL function (`public.merge_candidate_payload`) so it is one transaction; the Edge Function only validates and calls it.

## UI build (after the SQL above is approved)

- `src/components/candidates/duplicate/` — `DuplicateCandidateDialog.tsx` (shell, header, footer), `DossierPane.tsx` (identity, footprint, applications, flags, activity), `MergePane.tsx` (provenance, conflicts, ledger, kept-on-record), `StatusPill.tsx`, `useDuplicateContext.ts`.
- Geometry, typography and tones exactly as specified; every colour added to `tailwind.config.ts` as a token (`dup-*` / status pill tones) and referenced from components — no hex in JSX.
- Conflicts default to the on-file value; footer summary is one template literal, grammatical at 0/1/n.
- Three footer actions: Cancel · Not the same person · Merge into existing record, all three disabled with an "ask {owner}" line for read-only roles.
- Empty dossier, long values (`min-width:0` everywhere), three-way picker, live-offer flag, and the `not_duplicate` suppression path handled as specified.
- `CandidateFormSheet` swaps the old dialog for the new one; `CandidateMergeDialog.tsx` is deleted once nothing imports it.
