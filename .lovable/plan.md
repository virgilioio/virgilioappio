
## Goal

When a resume is uploaded in the Create/Edit Candidate sheet, prefill the **First name** and **Last name** fields separately (instead of dumping the full name into First name). Handle LATAM-style names with 1–2 first names and 1–2 surnames. No DB schema change — `candidates.candidate_name` stays the single source of truth and is recomposed on save.

## Behavior

- Resume upload → AI returns `firstName` + `lastName` separately → both inputs prefill.
- If AI omits the split (rare), a heuristic fills them locally.
- Recruiter can edit either field freely (mononyms, "De La Cruz", hyphenations, etc.).
- On submit, the form composes `candidate_name = "${first} ${last}".trim()` (collapsing extra spaces). Edits on existing candidates whose first/last was derived from `candidate_name` round-trip cleanly.

## Splitting strategy

**AI-first (primary).** Update the `parse-resume` edge function prompt to return two new optional fields alongside `name`:

```
firstName: the candidate's given name(s). In Spanish/Portuguese names this is
  often two tokens (e.g. "María José"). In most other locales it is one token.
lastName: the candidate's family name(s). In Spanish/Portuguese names this is
  typically two surnames (paternal + maternal, e.g. "García López"). Particles
  like "de", "del", "la", "van", "von", "der" belong with the surname they
  precede. Single-name candidates: put the only token in firstName, leave
  lastName empty.
```

Keep returning `name` (full) for backward compatibility with all existing consumers (bulk upload, enrichment trigger, candidate updates).

**Heuristic fallback (only if AI omits the split).** Pure client-side in a new helper `src/utils/nameSplit.ts`:

1. Trim, collapse whitespace, tokenize on spaces.
2. 0 tokens → both empty. 1 token → first = token, last = "".
3. 2 tokens → first = t[0], last = t[1].
4. 3 tokens → if any token is a Spanish/Portuguese particle (`de`, `del`, `la`, `las`, `los`, `da`, `do`, `dos`, `das`, `van`, `von`, `der`, `di`, `du`, `le`) → first = t[0], last = t[1..2]; else → first = t[0..1], last = t[2].
5. 4+ tokens → first = first half (rounded down, min 1), last = the rest, with particles always glued forward to the next token.

This is a fallback only; the LLM's split wins whenever present.

## Files to change

1. **`supabase/functions/parse-resume/index.ts`**
   - Extend both AI prompts (core + full) and the JSON schema to also request `firstName` / `lastName`.
   - Add `firstName?: string; lastName?: string` to the `ParsedResume` type returned by the function.
   - Trim values in the post-process step alongside `parsed.name`.

2. **`src/hooks/useResumeParsing.ts`**
   - Add `firstName?` / `lastName?` to the `ParsedResume`/result types so the values reach the form.
   - No other behavior change (existing callers keep using `parsed.name`).

3. **`src/utils/nameSplit.ts`** (new)
   - `splitFullName(full: string): { first: string; last: string }` implementing the heuristic above.
   - `composeFullName(first: string, last: string): string` that trims/collapses to one space.

4. **`src/components/candidates/CandidateFormSheet.tsx`**
   - Form state: rename the registered field from `candidate_name` to `first_name` and register a new `last_name` field. Wire the existing "Last name" input (currently a dead placeholder at line ~772) to `form.register('last_name')`. Update the form's default-values shape, the `useForm` generic, and the `candidate?.candidate_name` initializer to call `splitFullName(candidate.candidate_name)`.
   - Resume-parse handler (around lines 559–564): prefer `parsed.firstName`/`parsed.lastName` when present; otherwise call `splitFullName(parsed.name)`. Set both `first_name` and `last_name`.
   - On submit (the existing create/update path): build `candidate_name = composeFullName(first_name, last_name)` and send that to the existing mutation; everything downstream (insert/update, enrichment trigger that reads `form.getValues('candidate_name')` at line 441) keeps working unchanged — replace that read with `composeFullName(...)` too.
   - Validation: require `first_name`; `last_name` optional (matches the current "Name is required" rule and supports mononyms).
   - Sheet title fallback (line ~665): use `composeFullName(...)` instead of `candidate.candidate_name` when previewing.

5. **No change** to bulk CSV import, enrichment, or any list/table view — they continue to read/write `candidate_name`.

## Out of scope

- Adding `first_name` / `last_name` columns to `candidates` (explicitly chosen: keep single column).
- Changing how names render in lists, kanban, profile headers, emails — they keep using `candidate_name`.
- Auto re-splitting names that were saved before this change; they'll split on next open via the heuristic, which the recruiter can correct inline.

## Validation

- Upload a LATAM resume ("María José García López") → First: "María José", Last: "García López".
- Upload a single-given-name resume ("Allan Bravo") → First: "Allan", Last: "Bravo".
- Upload a mononym ("Madonna") → First: "Madonna", Last: empty, submit succeeds.
- Particle case ("Juan de la Cruz") → First: "Juan", Last: "de la Cruz".
- Edit an existing candidate whose `candidate_name` is "Ana Rodríguez Pérez" → fields prefilled "Ana" / "Rodríguez Pérez", save round-trips identically.
