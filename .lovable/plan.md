

# Remove Comments Tab from Independent Candidate Profile

## Change

In `src/components/candidates/IndependentCandidateProfileSheet.tsx`:

1. **Remove `'comments'` from the tab type** — change `activeTab` state type from `'overview' | 'resume' | 'comments'` to `'overview' | 'resume'`
2. **Remove the Comments tab trigger** — remove the `{ value: 'comments', label: 'Comments', Icon: User }` entry from the tabs array
3. **Remove the Comments tab content** — delete the `{activeTab === 'comments' && (...)}` block (~lines 435–452)
4. **Remove the `CandidateComments` import** if no longer used elsewhere in the file (check the right-column usage around line 837 — if that's also being replaced per the approved plan, remove the import entirely)

One file modified, purely removing code.

