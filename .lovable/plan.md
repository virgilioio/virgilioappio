

# Remove Skills Column from CandidateTable

## Change

**`src/components/candidates/CandidateTable.tsx`** — Add a `hideSkills?: boolean` prop (default `false`). Conditionally hide:
1. The `<TableHead>Skills</TableHead>` column header (~line 302)
2. The `<TableCell>` with skills badges in the desktop table (~lines 387–418)
3. The skills section in the mobile card view (~lines 500–528)

**`src/pages/JobDetail.tsx`** — Pass `hideSkills={true}` to every `<CandidateTable>` usage within the job detail page (pipeline candidates, application review, offers, hired, rejected tabs). This covers all the tabs requested.

The independent candidates table on `/candidates` and sourcing tables are separate components and won't be affected.

