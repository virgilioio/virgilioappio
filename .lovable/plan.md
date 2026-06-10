# Final Empty-State Audit & Migration

Comprehensive scan of ATS, CRM, and every settings sub-section (workspace + platform) surfaced ~35 surfaces still rendering hand-rolled empty copy. The two canonical components (`<EmptyState size="card|route">` and `<InlineEmpty>`) plus the 14 SVG illustrations are already in place — this pass only swaps remaining call sites.

## Scope

### Settings — Workspace
- **VerifiedDomainsManager** — "No domains configured yet" → `InlineEmpty` (settings card)
- **DepartmentsManager** — already done (verify)
- **JobStagesTable** — already done (verify)
- **DealStagesManager** — "No stages in the pipeline" → `InlineEmpty`
- **OfferFormsManager** — "No offer forms found" → `InlineEmpty` + "New form" action
- **OfferTemplatesManager** — 3 sites (offer / email / contract templates) → `InlineEmpty` each
- **OfferTemplateFieldsManager** — "No dynamic fields found" → `InlineEmpty`
- **OfferFormFieldsManager** — "No form fields yet" → `InlineEmpty`
- **RejectionEmailTemplatesManager** — "No rejection email templates found" → `InlineEmpty`
- **ApplicationFieldsManager** — "No custom application fields yet." → `InlineEmpty`
- **ApplicationFieldForm** — 2 micro empties (options, validation rules) → `InlineEmpty` (tiny)
- **AutomationsTab** — already done (verify)
- **Billing.tsx** — "No payment method" card → keep as native card (NOT a list empty — it's an action prompt), leave as-is
- **JobBoardsTab** — verify no custom empty

### Settings — Platform
- **FeatureFlagsManager** — "No feature flags found" → `InlineEmpty`
- **PlatformOfferTemplatesManager / PlatformJobStagesManager / PlatformJobSettingsManager / PlatformApplicationFieldsManager / PlatformSettingsManager** — scan & swap any remaining bespoke empties to `InlineEmpty`
- **PlatformAssetUploader** — leave untouched (it's an internal asset-management screen, not real empty states)
- **SaaSCustomerDetail / SaaSSubscription** — scan & swap
- **CustomerManagementTab** — scan & swap

### CRM / Deals
- **DealsKanbanBoard** — board-level "No stages yet" already uses `EmptyState`; per-column "No deals in this stage" stays as micro-text (intentional column placeholder, too small for `InlineEmpty`)
- **DealProfileSheet** — "No deal stages configured." inline string → `InlineEmpty`
- **DealCard** — "No company" micro-label stays (inline metadata, not an empty state)

### ATS — remaining
- **JobAssignmentsPanel** — "No users are currently assigned to this job." → `InlineEmpty`
- **OfferApprovalChainConfig** — "No approvers configured yet." → `InlineEmpty`
- **TeamTab** (stage-config) — "No interviewers assigned yet" → `InlineEmpty`
- **JobSetupLayout** — "No team members yet." → `InlineEmpty`
- **HiringPlanTab** — "No stages in the hiring plan" + "No candidates are currently in this stage." → `InlineEmpty`
- **SummaryStep** (wizard) — "No stages configured yet." / "No team members assigned." → `InlineEmpty`
- **MemberDetailSheet** — "No job assignments" → `InlineEmpty`
- **CandidateOfferDetails** — "No field values recorded." → `InlineEmpty`
- **CreateOfferLetterDialog / OfferComposerBody** — "No offer forms available" → `InlineEmpty`
- **CandidateApplicationResponses** — "No additional application details available." → `InlineEmpty`
- **ApplicationReviewSheet** — "No fit analysis available." → `InlineEmpty`
- **CandidateEducation/WorkExperience/Certifications** — "No … data available" → `InlineEmpty` (these are profile-tab sub-sections; small inline form)
- **CandidateProfileSheet / IndependentCandidateProfileSheet** — multiple "No summary / No skills / No scorecard-enabled stages." inline strings → `InlineEmpty`
- **SharedList** — "No candidates in this list." → `EmptyState size="card"` + `SoftPlane` (it's a route)
- **ShareListModal** — "No candidates left." panel empty → `InlineEmpty`
- **ActivityTimeline** (saas) — "No recent activity to display" → `InlineEmpty`

### Intentionally out of scope (micro-text, not empties)
- `CommandEmpty` / `emptyMessage` on combobox/select dropdowns (currency-select, searchable-select, LocationSelector, TimezoneSelector, AddToJobPopover, MoveToPipelineMenu, AddTagPopover, CandidatesSearchesRail single-line)
- DealCard "No company", SaaSCustomersList "No owner assigned" (inline metadata)
- Loading/Select placeholders ("Loading stages…", "Select a stage")

## Technical notes
- All swaps use `<InlineEmpty text="..." />` (sometimes with `action`/`onAction`) or `<EmptyState size="card" illustration={<Soft*/>} ...>` for route-level surfaces. No new imports beyond `@/components/ui/empty-state` and `@/components/ui/EmptyIllustrations`.
- Illustration choices: people → `SoftPeople`, search/filtered → `SoftMagnifier`, jobs/flags/postings → `SoftFlag`, lists/docs/templates → `SoftPaper`, deals/CRM → `SoftDeal`, calendar/scheduling → `SoftCalendar`, sourcing → `SoftFind`, insights/scorecards → `SoftRosette`, generic data → `SoftPlane`, building/clients/departments → `SoftBuilding`.
- No new colors, fonts, or icons. No business-logic changes.

## Validation
After migration: spot-check `/settings` workspace tabs (Departments, Job stages, Offer templates, Offer forms, Rejection templates, Application fields, Verified domains, Deal stages, Automations), `/settings` platform tabs (Feature flags, Platform templates, SaaS customers), `/crm` deal sheet → notes/payments/invoices/stages, ATS job setup (team, hiring plan, offer approval), candidate profile tabs (offer, application, scorecards, fit), `/shared/[token]` empty list.
