# Fix: Cmd+K opens both search and the new-candidate sheet

## What's happening

Two separate keyboard listeners react to Cmd+K: the top-bar search field and the "add candidate" action. Pressing Cmd+K fires both, so the search results dropdown opens on top of the candidate sheet and you have to dismiss it first.

## The fix

Cmd+K becomes the single shortcut for adding a candidate.

- The search field stops responding to Cmd+K and keeps Cmd+/ as its shortcut.
- The hint shown inside the search field is updated so it no longer advertises Cmd+K.
- The candidate sheet keeps Cmd+K exactly as today; Cmd+J (new job) and Cmd+O are untouched.

## Technical detail

- `src/components/search/GlobalSearchBar.tsx`: remove `'k'` from the shortcut condition (keep `'/'`), and change the inline `⌘ K` keycap hint to `⌘ /`.
- `src/components/layout/GlobalCreateButton.tsx`: unchanged behaviour for Cmd+K.
- Check other places that display a `⌘K` hint for search (e.g. the candidate search bar's keycap) and align them to `⌘ /`.

No data, permissions, or logic changes.
