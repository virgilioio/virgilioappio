Standardize primary row identifier font weight to 500 across all tables, fixing the MembersTable outlier.

## Scope

The user confirmed that **500 (medium)** is the target for primary row identifiers across all tables. The Deal stages and Customers tables already use 500. The MembersTable uses 600 (semibold) for member names — the known outlier.

## Changes

1. **MembersTable.tsx**
   - Line 180: Change member name from `font-semibold` to `font-medium` (weight 500).
   - Line 175: Change avatar initials from `font-semibold` to `font-medium` (500), consistent with other avatar stacks.

2. **Audit other table primary identifiers**
   - JobsTable.tsx line 489: job title uses `font-semibold` — verify if it should align to 500.
   - Any other table components found during audit with primary data at 600 instead of 500.

## Verification

- Preview the Members settings page to confirm member names render at weight 500.
- Confirm no visual regressions in row readability or layout.