# Empty-state audit

Two canonical components (`EmptyState`, `InlineEmpty`) + 14 illustrations are in place and the legacy wrappers (`GioEmptyState`, `AnalyticsEmptyState`, `TalentIntelligenceEmptyState`, `TableEmpty`, `TableFilteredEmpty`) shim to them. This audit covers what still renders a bespoke empty UI.

## A. Public / candidate-facing — NOT migrated yet

These are the highest-priority gap from your message. Per spec they should use `SoftFlag` (candidate-facing) and **no app chrome** — keep `min-h-screen`, the page's hero/footer, and candidate copy; just swap the inner box.

| File | Empty/error state | Action |
| --- | --- | --- |
| `src/pages/PublicCareersPage.tsx` (L160, L196) | (1) `Page Not Found` card · (2) "No open positions" / "No roles match your filters" | (1) `EmptyState size="card"` + `SoftFlag` (candidate copy, no buttons). (2) split: empty list → `SoftFlag` "No open roles right now"; filtered → `SoftMagnifier` "No roles match your filters" + "Clear filters". |
| `src/pages/VirgilioCareersPage.tsx` (L160, L192) | Mirror of PublicCareersPage | Same two swaps. |
| `src/pages/PublicBookingPage.tsx` (L425 inactive link, L449 expired, L558 No availability) | Three bespoke white cards | Migrate all three to `EmptyState size="card"`: inactive → `SoftFlag`, expired → `SoftFlag`, No availability → `SoftCalendar`. Keep page chrome (`PublicBookingHeader`/`Footer`). |
| `src/pages/NotFound.tsx` | Bare 404 | Wrap in `EmptyState size="route"` + `SoftFlag` "Page not found" with a "Go home" button. |
| `src/components/careers/public/ApplicationSubmittedScreen.tsx` | Confirmation screen (not empty per se) | **Leave as-is** — it's a success state, not empty. |
| `src/pages/PublicJobPosting.tsx` | No empty states (it's a form) | None. Verify "job closed / no longer accepting" branch exists; if so, migrate. |

## B. Internal surfaces still rendering custom empties — finish the second pass

| File | What renders today | Migrate to |
| --- | --- | --- |
| `src/components/members/MembersTable.tsx` (L235) | Custom row | `TableEmpty` / `TableFilteredEmpty` (auto-shimmed) |
| `src/components/organizations/OrganizationDetailsDialog.tsx` (L220) | "No members found for this client" | `InlineEmpty` |
| `src/components/jobs/JobPostingsTab.tsx` (L402–L410) | Already uses legacy `EmptyState` props — works via shim | Verify it renders correctly; otherwise swap to canonical + `SoftPaper`. |
| `src/components/jobs/postings/ApplicationFormBuilder.tsx` (L255) | "No questions yet" | `InlineEmpty` (it's inside the builder rail) |
| `src/components/sourcing/SourcingSidebar.tsx` (L250) | "No projects yet" / "No matching projects" | `InlineEmpty` (sidebar rail) |
| `src/components/dashboard/WorldClockWidget.tsx` (L264) | "No cities found" in picker | Leave — it's inside a dropdown (`Command` empty), per spec dropdowns keep their tiny text |
| `src/components/dashboard/CurrencyConverterWidget.tsx` (L86) | `CommandEmpty` | Leave (dropdown rule) |
| `src/components/search/SearchResultsDialog.tsx` (L133) | "No results found for X" | `EmptyState size="card"` + `SoftMagnifier` inside the dialog body |
| `src/components/search/v2/GlobalSearchPanel.tsx` (L229, L385) | Two bespoke empties | Replace with `InlineEmpty` (panel-style — keep dense) |
| `src/components/candidates/bulk/ShareListModal.tsx` (L402, L433) | "No teammate found" | Leave the inline combobox one (dropdown rule); migrate L433 panel empty to `InlineEmpty` |
| `src/components/candidates/MoveToPipelineMenu.tsx` (L60) | "No stages available" inside dropdown | Leave (dropdown rule) |
| `src/components/members/MemberJobAssignmentsDialog.tsx` (L225) | "No jobs available in this organization." | `EmptyState size="card"` + `SoftFlag` |
| `src/components/deals/DealsKanbanBoard.tsx` (L136, L193) | Already uses canonical for "No stages"; per-column empty is a chip | Leave per-column chip (kanban convention); verify L136 illustration = `SoftDeal`. |

## C. Already migrated (no action) — confirm during QA

Routes/cards: `CandidateTable`, `JobsTable`, `SavedCandidatesTab`, `ArchivedCandidatesTab`, `MembersList` (saas), `IndependentCandidateTable`, `RecentSourcingProjects`, `DepartmentsManager`, `JobStagesTable`, `AutomationsTab`, `InvoiceHistoryTable`, `SaaSCustomersList`, `Pipeline`, `SourcingCandidateTable`, `CandidateInsightsTab`, `OrganizationsTable`.

Inline: `ActivityFeedList`, `CandidateAttachments`, `CandidateComments`, `CandidateOfferDetails`, `CandidateReminders`, `CandidateUrls`, `EmailHistoryList`, `DealInvoicesCard`, `DealPaymentsCard`, `StageScorecardsCard`, `CandidatesSearchesRail`.

Auto-shimmed via legacy wrappers (no edit needed): everything still calling `GioEmptyState`, `AnalyticsEmptyState`, `TalentIntelligenceEmptyState`, `TableEmpty`, `TableFilteredEmpty`.

## D. Explicitly OUT of scope (dropdown/popover micro-text — per spec)

`filter-chip-popover`, `filter-checkbox-group`, `searchable-select`, `currency-select`, `LocationSelector`, `TimezoneSelector`, `AddTagPopover`, `SearchDropdown`, `Command*` empties. These keep their existing micro-text per the spec's "no chrome inside dropdowns" rule.

---

## Build plan

**Phase 1 — Public/candidate surfaces (the gap you flagged)**
1. `PublicCareersPage.tsx` — migrate both empty/error branches (`SoftFlag` + `SoftMagnifier`).
2. `VirgilioCareersPage.tsx` — same two swaps.
3. `PublicBookingPage.tsx` — migrate inactive, expired, and "No availability" cards.
4. `NotFound.tsx` — wrap in canonical 404.
5. Verify `PublicJobPosting.tsx` job-closed branch (if present).

**Phase 2 — Remaining internal surfaces**
6. `OrganizationDetailsDialog`, `ApplicationFormBuilder`, `SourcingSidebar`, `SearchResultsDialog`, `GlobalSearchPanel`, `ShareListModal` (panel empty only), `MemberJobAssignmentsDialog`, `MembersTable`.
7. Sanity-check `JobPostingsTab` and `DealsKanbanBoard` render correctly via shim.

**Phase 3 — QA pass**
8. Visit: `/careers/[slug]` (real + bogus slug), `/virgilio-careers`, an inactive/expired booking link, `/dashboard` (Recent searches), `/pipeline`, `/candidates?search=zzzqqq`, Members, Organizations, a Job's Postings tab, Global Search with no matches, `/settings/billing`. Confirm: white card on cream, single soft illustration, Poppins title, black primary button only when relevant.

No new colors, fonts, icons, or assets — everything uses the existing `EmptyIllustrations.tsx` + tokens.
