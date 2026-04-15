

# Unify All Candidate Rows to Enriched Card Layout

## What changes
Make **every** candidate row (Apollo preview, PDL, and Internal) use the same enriched colSpan layout that Internal candidates already have. The only differences between row types will be:

1. **Badge**: "Internal" (pastel-blue), "PDL" (pastel-green), or "Apollo" (secondary)
2. **Metadata chips**: 
   - **Internal/PDL**: Show actual values (email address, phone number, city name)
   - **Apollo preview**: Show placeholder labels ("Email", "Phone", "Location") in the same pill style — indicating availability without revealing data
3. **Name**: Internal/PDL show real name; Apollo shows obfuscated name
4. **Checkbox**: Only shown for uncollected Apollo candidates (existing logic)
5. **Right actions**: Apollo gets "Collect" button, Internal/PDL get "Add to Pipeline"

## Implementation — 1 file

**`src/components/sourcing/SourcingCandidateTable.tsx`**

Remove the `if (isCollectedApollo)` early-return block and the standard `<TableRow>` block. Replace both with a **single unified enriched row renderer** used for all candidates:

- Delete the separate code paths (~lines 694-814 for Internal, ~lines 816-1050 for standard)
- Replace with one enriched `<TableRow>` + `<TableCell colSpan={5}>` block that handles all three source types via conditionals for badge, name display, metadata content, and actions
- Remove the emerald left-border for PDL rows (no longer needed — badge handles identification)
- Apollo preview rows: metadata chips show `"Email"`, `"Phone"`, `"Location"` as placeholder text (same rounded pill style) based on `has_email`, `has_phone`, `has_location` flags
- PDL rows: metadata chips show actual `candidate.email`, `candidate.phone`, and location string
- Keep existing click handlers per source type (PDL opens PDL sheet, Apollo opens Apollo preview sheet, Internal opens candidate profile)

The mobile card view (~line 1066+) will also be updated to match the same unified structure.

## Scope
- 1 frontend file (~80 lines net change, mostly consolidation)
- 0 backend changes

