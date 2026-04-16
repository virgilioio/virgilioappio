
What’s going on is not a frontend “badge glitch.” The UI is only reflecting what the backend sends.

## What the app currently considers “Internal”

A candidate only becomes “Internal” in Find if all of this is true in `sourcing-search`:

1. The Apollo preview row has an exact `apollo_id`
2. A row exists in `candidates` with that same `apollo_id`
3. That candidate has `apollo_collected_at IS NOT NULL`
4. That candidate belongs to the same `tenant_id` as the sourcing project

Only then the function rewrites the Apollo result into:
- `candidate_id: <db id>`
- `is_preview: false`

And then the table shows the blue `Internal` badge.

## Why you are still seeing “Apollo” / external

There are multiple reasons, and they stack:

### 1. The live function is still returning only 1000 cached Apollo rows
Your live logs still show:

```text
✅ Apollo returned 1000 candidates (cached: true)
📊 Final: 1000 candidates
```

and the browser console shows:

```text
✅ Found 827 unique candidates ... (sources: PDL 0, Apollo 1000)
```

So the version actually serving your project is still behaving like the old capped path. That means the cross-reference step is only running against 1000 cached Apollo rows, not the full 2000.

So one reason is simple: the live runtime is still not serving the full cached result set.

### 2. “Already collected” and “show as Internal” use different definitions
This is the bigger logic bug.

In `enrich-apollo-profile`, when Apollo collect runs, it first checks for an existing candidate by:

- same `apollo_id`
- same `tenant_id`

If it finds one, it treats that person as “already collected.”

But in that existing-candidate path, it only updates:

- `sourcing_preview_candidates.collected_at`

It does **not** also set:

- `candidates.apollo_collected_at`

Later, `sourcing-search` tries to identify collected candidates using this filter:

```ts
.in('apollo_id', apolloIds)
.not('apollo_collected_at', 'is', null)
```

So here is the inconsistency:

```text
Collect flow says: same apollo_id in same tenant = already collected
Display flow says: only candidates with apollo_collected_at not null are collected
```

That means a candidate can be “already collected” from the collect flow’s point of view, but still fail the Find-page Internal classification and come back as raw Apollo.

That is exactly the kind of mismatch that produces what you are seeing.

### 3. Matching is exact by `apollo_id` only
The Internal upgrade is not based on:
- name
- LinkedIn URL
- email
- “looks like the same person”

It is only based on exact `apollo_id`.

So if the candidate exists in your DB but:
- was created manually,
- came from another ingestion path,
- has no `apollo_id`,
- has a different Apollo ID,
- or the stored Apollo ID is missing/wrong,

then Find will not recognize that person as Internal and will leave the result as Apollo.

### 4. Internal is same-tenant only
Even if the candidate exists and has the same `apollo_id`, it is only “Internal” if the `tenant_id` matches the sourcing project’s tenant.

If it’s another tenant, the code treats it as `Gio`, not `Internal`.

So technically the system is not asking “does this person exist anywhere?”
It is asking:

```text
Does this Apollo result map to a candidate
with the same apollo_id,
with apollo_collected_at set,
inside this same tenant?
```

If the answer is no, it stays Apollo.

## Why I’m confident this is backend classification, not UI

The table badge logic is very literal:

- `Internal` only if `source === 'apollo'`, `is_preview === false`, and `candidate_id` exists
- otherwise Apollo stays Apollo

So the UI is not inconsistently deciding. It is being fed candidates that were never upgraded to Internal by the backend.

## Short version

The reason you still see already collected people as Apollo is:

1. the live cached Apollo path is still serving only 1000 results, and
2. more importantly, the system has a broken definition of “collected”:
   - one function says “existing candidate with same `apollo_id` = already collected”
   - another function says “only `apollo_collected_at != null` counts as collected”

So some people are considered collected during collection, but are **not** considered collected during sourcing display.

That mismatch is the core issue.