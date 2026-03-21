

# Fix Auto-Create Infinite Loop + Enable Manual Sidebar Searches

## Two fixes needed

### 1. Backend: Relax `skills` validation in `create-sourcing-project`

**`supabase/functions/create-sourcing-project/index.ts`** (line 107-112)

Replace the strict `skills` requirement with a check for **any** meaningful criterion:

```ts
// Accept if ANY of these have data
const hasCriteria = 
  search_criteria?.skills?.length > 0 ||
  search_criteria?.title_keywords?.length > 0 ||
  search_criteria?.locations?.length > 0;

if (!hasCriteria) {
  return 400 "At least one search criterion required (skills, title_keywords, or locations)"
}
```

This allows manual sidebar searches (which typically start with title keywords, not skills) while still preventing empty projects.

### 2. Frontend: Stop infinite retry loop

**`src/pages/Find.tsx`** (lines 93-141)

The catch block resets `autoCreateTriggeredRef.current = false` (line 134), which allows the same failing effect to re-trigger endlessly. Fix:

- **Don't reset the flag on failure** — once triggered, stay triggered until the user navigates to `/find` fresh (the reset at line 98 handles that)
- Add a **last-attempted fingerprint** ref: store a hash of the criteria that was last attempted. Skip if criteria hasn't changed since the last attempt.
- This way, if the backend returns an error, the effect won't retry the same payload. The user must change criteria to trigger a new attempt.

### What stays unchanged

- The AI assistant / prompting space remains fully functional in `new` mode
- The `AIJobAssistant` component continues to render when no project is selected
- Both paths (AI prompt OR manual sidebar filters) converge on auto-creating a project and navigating to `/find/:id`

## Files

| File | Change |
|------|--------|
| `supabase/functions/create-sourcing-project/index.ts` | Replace skills-only validation with any-criterion validation |
| `src/pages/Find.tsx` | Remove flag reset on failure; add criteria fingerprint to prevent retry loops |

