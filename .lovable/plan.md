

# Enriched Table Row for Internal (Collected Apollo) Candidates

## Inspiration
The reference image shows a card structure with: category badge at top-left, bold name, description line, then a bottom row of icon+text metadata chips (type, location, salary), with a "View →" action on the right.

## Approach
For rows where `isCollectedApollo(candidate)` is true, render a special enriched layout that spans the full row using `colSpan`. This gives us vertical freedom within the table without breaking the table structure for other candidate types.

### Layout inside the enriched row

```text
┌─────────────────────────────────────────────────────────────────┐
│ [☐]  Internal (badge)                                          │
│      **Jane Smith**                                             │
│      Senior Product Designer at Acme Corp                      │
│      🏢 Current Role  ·  📍 City, State  ·  ✉ email  · 📞 phone │
│                                              View Profile →    │
└─────────────────────────────────────────────────────────────────┘
```

### Changes — 1 file

**`src/components/sourcing/SourcingCandidateTable.tsx`**

1. **Add a conditional branch** inside the `.map()` loop (~line 694): when `isCollectedApollo(candidate)` is true, render a distinct `<TableRow>` with a single `<TableCell colSpan={5}>` containing the enriched card layout.

2. **Enriched layout contents:**
   - Top line: Checkbox (left) + "Internal" pastel-blue badge
   - Name: bold, slightly larger (`text-sm font-semibold`)
   - Subtitle: `current_role` at `current_company` (muted text)
   - Bottom metadata row: icon chips for location (`MapPin`), email (`Mail`), phone (`Phone`), LinkedIn icon — using the same `text-[10px]` chip style but with subtle background pills
   - Right-aligned: "View Profile →" text link (uses `ChevronRight` icon), triggers the existing click handler to open the profile sheet

3. **Styling:** Subtle `bg-muted/20` background, no left border accent, rounded inner container with `p-3` padding. Keeps the restrained, premium feel.

4. **Mobile card view** (~line 1066): Apply similar enriched layout for `isCollectedApollo` cards — show the metadata chips row at bottom.

## Scope
- 1 frontend file edit (~40 lines changed)
- 0 backend changes

