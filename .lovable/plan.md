

# Fix Cross-Tenant Data Breach + Rebrand Cross-Tenant Candidates as "Gio" Sourced

## The Breach

The `sourcing-search` edge function (line 222-227) queries the `candidates` table by `apollo_id` with **zero tenant scoping**. Any candidate from any tenant that was previously collected via Apollo gets matched and returned with their full `candidate_id` — giving the requesting tenant direct access to another customer's candidate profile, job associations, and pipeline.

**Impact**: Full cross-tenant data leakage. A user in Tenant A can view Tenant B's candidate profiles, see their job pipelines, and navigate into their jobs.

## The Fix + Product Vision

Two-tier approach:

### Tier 1 — Same-tenant matches → "Internal" (unchanged)
Candidates that belong to the **same tenant** as the sourcing project remain labeled "Internal" and open as full profile sheets (existing behavior, correct).

### Tier 2 — Cross-tenant matches → "Gio" sourced candidates
Candidates that exist in the DB but belong to a **different tenant** get:
- A new `is_gio_sourced: true` flag (instead of `candidate_id` from another tenant)
- Their **non-PII data** surfaced (name, title, company, location) — data Apollo already provides
- **No `candidate_id`** leaked — they cannot open another tenant's profile
- A new "Gio" badge in the UI (purple/lilac, matching Gio branding)
- Treated as enriched external candidates — full data display but no cross-tenant profile access

### Changes

#### 1. `supabase/functions/sourcing-search/index.ts` — **Critical security fix**
- Get the requesting project's `tenant_id` (join `organizations` table on `project.organization_id`)
- In the collected-candidates query (line 222-227), split into two queries:
  - **Same-tenant**: `candidates` where `apollo_id IN (...)` AND `tenant_id = projectTenantId` → these get `candidate_id` (true Internal)
  - **Cross-tenant**: `candidates` where `apollo_id IN (...)` AND `tenant_id != projectTenantId` → these get `is_gio_sourced: true`, enriched display data, but **no `candidate_id`**
- Cross-tenant matches surface: name, title, company, location, LinkedIn URL — all data Apollo already provides anyway, just with higher quality from our enrichment

#### 2. `src/components/sourcing/SourcingCandidateTable.tsx` — UI updates
- Add a new helper: `isGioSourced(c)` → `c.is_gio_sourced === true`
- New badge: "Gio" with a distinct variant (e.g. `pastel-purple` or a new lilac variant matching Gio branding)
- Click handler for Gio candidates: open the Apollo-style preview sheet (not the DB profile sheet) — they're external to this tenant
- Update both desktop rows and mobile cards

#### 3. `src/components/sourcing/SourcingProjectView.tsx` — Filter logic
- Update the `candidateSource` filter to handle three types: `internal` (same-tenant DB), `gio` (cross-tenant enriched), `external` (Apollo/PDL previews)
- Or keep it simple: Gio candidates count as "external" since they're external to the tenant

#### 4. `src/types/sourcing.ts` — No change needed (candidateSource filter already handles it)

## Security Guarantees
- **No `candidate_id` from other tenants** ever reaches the client
- Cross-tenant candidates cannot open profile sheets (no DB ID to query)
- Cross-tenant candidates cannot navigate to other tenants' jobs
- Data surfaced for Gio candidates is equivalent to what Apollo already provides — no PII escalation

## Scope
- 1 edge function edit (security-critical)
- 1 component edit (badge + click logic)
- 1 view edit (filter compatibility)
- ~40 lines net

