
## Validation

Your read is correct. In `supabase/functions/search-apollo-candidates/index.ts` L204–208 the function builds one Apollo request for all target companies by literally joining them with `" OR "`:

```ts
const companyNamesString = criteria.company_names.slice(0, 10).join(' OR ');
params.append('q_organization_name', companyNamesString);
```

Apollo's `q_organization_name` is **not** a boolean expression — it's a single fuzzy string. So:

- 1 company → the string is just `"Deel"` → fuzzy match works → results come back.
- 2+ companies → the string becomes `"Deel OR HubSpot"`, which Apollo fuzzy-matches as one blob against a single org name. Almost no org name contains all those tokens, so it collapses to ~0 hits — the "AND-like" narrowing you're seeing.

PDL is fine on this specifically: `companyClauses` already uses a `should` (OR) across companies. Its own issues are unrelated to the multi-company AND behavior.

## Fix — Apollo only

In `supabase/functions/search-apollo-candidates/index.ts`:

1. Keep `buildApolloSearchUrl` responsible for all filters **except** `company_names`.
2. In the top-level search runner (where `buildApolloSearchUrl` is called and paginated):
   - If `criteria.company_names` has 0 or 1 entries → behave exactly as today (append `q_organization_name` for the single name; no companies → no param).
   - If it has 2+ entries → fan out: for each of up to 10 company names, build the same URL and append `q_organization_name=<one company>`. Run these Apollo searches in parallel with a bounded concurrency (e.g. `Promise.all` on the 10-ish calls), each still paginating up to the current cap.
   - Merge results, dedupe by Apollo `person.id`, and pass the merged pool into the existing keyword/local-scoring, title-match, and per-page slicing that already runs downstream. Do not change the scoring, dedupe-vs-DB, or storage code.
3. Move the log line inside the single-company branch so it still prints the actual value sent; add a `🏢 Fan-out companies: N` log for the multi-company branch.
4. Leave `company_domains` (`q_organization_domains_list[]`) and the `keywords`-vs-`company_names` mutual-exclusion untouched — those already work as OR.

No frontend changes. No PDL changes in this pass. No schema, no permissions, no data-shape changes.

## Verification

- Add two Target Companies (e.g. "Deel", "HubSpot") to an existing Find search and confirm Apollo edge logs show two separate `q_organization_name=Deel` and `q_organization_name=HubSpot` request URLs (not `Deel OR HubSpot`).
- Result count is roughly the sum of both single-company searches minus duplicates, and returned candidates' current org names include one of the requested companies.
- Removing all but one company still produces the current single-company result set (no regression).
