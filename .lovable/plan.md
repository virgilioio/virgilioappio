

# Filter Out Pipeline Candidates from Sourcing Results

## What
When a sourcing project is linked to a job, exclude Internal (same-tenant) candidates who are already in that job's pipeline from the results. This avoids showing candidates the recruiter has already actioned.

## Change — 1 file

### `supabase/functions/sourcing-search/index.ts`

1. **Add `job_id` to the project query** (line 42):
   ```
   .select('id, organization_id, job_id, search_criteria, ...')
   ```

2. **After building `sameTenantMap`** (~line 244), if `project.job_id` exists, query `job_candidate_associations` for all `candidate_id`s in that job:
   ```ts
   let pipelineCandidateIds = new Set<string>();
   if (project.job_id) {
     const { data: assocs } = await supabase
       .from('job_candidate_associations')
       .select('candidate_id')
       .eq('job_id', project.job_id);
     pipelineCandidateIds = new Set((assocs || []).map(a => a.candidate_id));
   }
   ```

3. **In the enrichment mapping** (line 290-338), when a same-tenant match is found and its `candidate_id` is in `pipelineCandidateIds`, return `null` (filter it out):
   ```ts
   if (sameMatch && pipelineCandidateIds.has(sameMatch.id)) {
     return null; // Already in pipeline — exclude
   }
   ```
   Then filter nulls: `enrichedApollo.filter(Boolean)`

4. **Also filter local/PDL candidates** that have a `candidate_id` in the pipeline set (if applicable from `pdlCandidates`).

## What stays visible
- **Gio candidates** — always shown (cross-tenant, no `candidate_id` to match)
- **Apollo previews** — always shown (not yet collected)
- **PDL candidates** — always shown (external data)
- **Internal candidates NOT in the linked job** — still shown

## Scope
- 1 edge function edit (~15 lines)
- Server-side only, no UI changes needed

