

# Analysis: Sourcing Project Dependency + Recommended Approach

## Current Architecture Dependencies

The sourcing project (`sourcing_projects` row) is deeply wired into the entire pipeline:

1. **Apollo search cache** (`sourcing_preview_candidates` table) — keyed by `sourcing_project_id`. Every Apollo search result is cached against a project. No project = nowhere to store results.
2. **`search-apollo-candidates` edge function** — requires `project_id` to read/write the cache.
3. **`get-job-matching-candidates` edge function** — requires `sourcing_project_id` OR `job_id`. Line 468: `throw new Error('Either job_id or sourcing_project_id must be provided')`.
4. **Enrichment tracking** (`enrich-apollo-profile`) — marks candidates as collected per `sourcing_project_id`.
5. **Link to Job** — updates `sourcing_projects.job_id` to associate a search with a job posting.
6. **AI conversation history** — stored per `sourcing_project_id`.

**Verdict**: Removing the sourcing project requirement would mean rewriting the entire backend pipeline — cache layer, enrichment tracking, and job linking all depend on it.

## Recommended Approach: Invisible Auto-Creation

Make the project creation invisible. The user experience becomes Apollo-like (change filters → see results) while the backend still has its project anchor.

### How It Works

1. User is on `/find` (new mode), starts adding filters in the sidebar
2. Once they add at least one `title_keyword`, after an 800ms debounce, a sourcing project is **silently auto-created** in the background with status `'draft'`
3. The URL updates to `/find/{newProjectId}` — the existing search pipeline kicks in and results appear
4. The project name auto-generates from the first title keyword (e.g., "Account Executive")
5. The user never sees a "create project" step — it just works

The existing **SavedSearchSelector** dropdown already shows all projects — these become the user's "saved searches." The "save" concept is already implicit (every search is saved).

### Changes

**`src/pages/Find.tsx`**:
- Add a `useEffect` watching `editableCriteria` when `mode === 'new'`
- Guard: only trigger when `title_keywords` has at least one entry
- Debounce 1200ms, then call `create-sourcing-project` with criteria as initial search params
- On success: `navigate(/find/${newProjectId})` — existing pipeline takes over
- Show the `GioThinkingHeader` during creation so the user sees "searching..." feedback
- The AI assistant panel remains as an alternative entry point (natural language → structured criteria)

**`supabase/functions/create-sourcing-project/index.ts`**:
- No changes needed — already accepts `search_criteria` directly and creates the project

**No backend changes required** — the existing pipeline handles everything once a project ID exists.

### UX Flow Comparison

```text
TODAY:
  /find → type in AI assistant → AI creates project → /find/:id → results

PROPOSED:
  /find → add title keyword in sidebar → auto-create project → /find/:id → results
  /find → type in AI assistant → AI creates project → /find/:id → results  (still works)
```

Both paths converge at the same point: a sourcing project exists, the search pipeline runs.

## Files

| File | Change |
|------|--------|
| `src/pages/Find.tsx` | Add auto-create effect when title_keywords populated in new mode; show loading state during creation |

