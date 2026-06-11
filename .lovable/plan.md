# Product-led onboarding revamp

A complete UI/UX rewrite of `/onboarding`, wired to **existing** backend endpoints (no new functions). The flow runs immediately after `/account-setup` and replaces today's single "Set up your workspace" screen.

The current `Onboarding.tsx` handles a lot of edge cases that are dangerous to lose: auto-join via verified domain, auto-accept pending invitations, existing-membership redirect, booking config creation, trial-activation handoff, EMAIL_NOT_VERIFIED handling. **All of that survives unchanged** — it just happens inside Step 1 (org creation) and on initial mount.

## Routing & gating (unchanged)
`App.tsx` already routes `/onboarding` → `<RequireAuth><Onboarding /></RequireAuth>` and redirects users without an org there. Keep that. We're rewriting the page contents, not the gate.

## File plan
- **Rewrite** `src/pages/Onboarding.tsx` — becomes a thin controller: pre-flight checks (existing membership, pending invite reconciliation, verified-domain auto-join) → renders `<OnboardingFlow />`.
- **New** `src/components/onboarding/flow/` directory:
  - `OnboardingFlow.tsx` — step state machine, persists `{step, orgId, jobId, departmentId, orgName, jobTitle, jobLocation, demo}` to `sessionStorage` (`gio_ob_state`) for refresh resume.
  - `OnboardingShell.tsx` — left 520px column + right preview panel layout, lilac radial glow, "your workspace, assembling" caption.
  - `ProgressTracker.tsx` — 5 marks (18×7 pill for done, 9px noir dot current, 7px faint upcoming) + "{n} of 5" caption, 300ms `cubic-bezier(.2,.9,.3,1)` pill-morph transition.
  - `WorkspacePreview.tsx` — the cumulative right-side mirror. Renders careers card (browser chrome + URL pill with live slug + "We're hiring at {Org}.") + optional department chip + optional job row with green "Open" + optional Pipeline card (4 columns Review/Screen/Interview/Offer with ramp dots) + optional candidate match cards + optional avatar stack + optional final noir strip. Driven by `previewState` props.
  - Step components: `StepOrg.tsx`, `StepDepartment.tsx`, `StepJob.tsx`, `StepCandidates.tsx`, `StepTeam.tsx`, `StepReady.tsx`.
- **New** `src/components/onboarding/flow/onboarding.css` — the two exact keyframes (`ob-in`, `ob-pulse`) and the `prefers-reduced-motion` override. Imported once by `OnboardingShell`.
- **Delete** `src/pages/dev/OnboardingPreview.tsx` and its `/__preview/onboarding` route — the real flow is now the preview.
- **Untouched**: `WorkspaceProvisioningLoader.tsx`, `PendingInvitationAlert.tsx`, `provision-tenant`, `set-current-organization`, `create-booking-config`, `useDepartments`, `useJobs.createJob`, `useJobMatchingCandidates`, `useMembers.createMember`, `OrgContext`, `RequireAuth`.

## Backend wiring (existing endpoints only)
| Step | Action |
|------|--------|
| 1 Org | `supabase.functions.invoke('provision-tenant', { body: { workspaceName }})` → store `workspaceId`, then `set-current-organization`, then `refreshOrgContext()`, then `create-booking-config` (same as today). |
| 2 Dept | `useDepartments().createDepartment.mutateAsync({ name })`. Mandatory. |
| 3 Job | `useJobs().createJob({ title, location, department_id, organization_id, status: 'open' })`. Demo job = same call with `title: 'Customer Success Lead'`, `location: 'Remote · LATAM'`, plus a `description` marker `[demo]` (no schema change). |
| 4 Candidates | `useJobMatchingCandidates({ jobId })` — display top 3, show "18 strong matches" using `matchingResult.total_count` fallback to candidates.length. Pure read; no writes. |
| 5 Team | For each filled row: `useMembers().createMember({ email, organization_id, system_role })`. |
| 6 Ready | `navigate('/dashboard')`. |

## Skip & flow rules
- Org + Department: mandatory (Continue disabled until valid).
- Job/Candidates/Team: "Skip for now →" link top-right. Skipping job auto-skips candidates.
- `sessionStorage('gio_ob_state')` persists progress; cleared on Step 6 dashboard nav.
- Completing or skipping past Step 6 is the existing flow's "done" signal — onboarding gate in `App.tsx` won't bring them back because they now have a tenant.

## Visual spec (extracted verbatim from prompt)
Bg cream `#fffcf9`. Left fixed 520px, padding `26px 48px 32px`. Right margin 20 (0 left), radius 20, bg `#F6F5F1`, border `1px solid #ECEAE2`, max-w 420 stack 12px gaps. Lilac radial glow top-right: `radial-gradient(circle, rgba(215,197,251,0.35), transparent 70%)` ~220px overflowing corner. Caption Inter 10px `#B5B9C4` 0.04em — "your workspace, assembling" → "your workspace" on Step 6.

Titles: Poppins 34px/600, -0.04em, line-height 1.1, end with `<span style="color:#D7C5FB">.</span>`. Kicker: Inter 11px/600 uppercase 0.09em `#8B8F9E`. Sub: Inter 13.5px `#5A6072` lh 1.55 max-w 380. Input: h44 r10 border 1.5px `#E7E8EE` (focus `#6F3FF5`). Primary button: h44 r10 `#0d0d09` bg, `#fffcf9` text Inter 13.5px/600 + 14px arrow-right (noir, not purple). Skip link: Inter 12px/500 `#8B8F9E`.

Department chips: 2×3 grid, h46 r10. Selected: `#EDE4FF` bg, 1.5px `#6F3FF5`, `#3D1FA3` text/600. "+ Something else" dashed `#D2D4DC` full-width revealing input.

Pipeline mini-columns: 4 equal, 5px stage dot ramp `#ADB2BD → #C9B8FB → #A98BFA → #6F3FF5`, empty slot `#FAFAF7` 1px dashed `#E7E8EE` min-h34.

Match cards: 30px avatar, name 12.5px/600, role · company 10.5px `#8B8F9E`, match% Poppins 14px/600 purple, Shortlist button `#EDE4FF`/`#5B21B6`.

Proof box (Step 4 phase 2): `#EDE4FF` bg r10 pad 10×13, lucide `badge-check` 14px `#6F3FF5`, Inter 12.5px `#3D1FA3` with **600 lead-in**.

Final noir strip (Step 6): `#0d0d09` r12, our Dashboard glyph 16px (cream + lilac dot) + "Your queue is ready — 3 candidates to review." Inter 11.5px/500 cream.

## Animation
Exact keyframes (no library defaults):
```css
@keyframes ob-in {
  0%   { opacity: 0; transform: translateY(14px); filter: blur(2px); }
  100% { opacity: 1; transform: none;             filter: blur(0);   }
}
@keyframes ob-pulse {
  0%, 100% { transform: scale(1);   opacity: .5; }
  50%      { transform: scale(1.45); opacity: 1; }
}
```
All preview elements: `ob-in .55s cubic-bezier(.2,.9,.3,1) both`, staggered 0.1–0.15s. Lists: +0.1–0.12s per item. Loading dots (3 × 8px lilac): `ob-pulse 1.1s ease-in-out infinite`, delays 0/.18/.36s. `@media (prefers-reduced-motion: reduce)` disables both.

## Not in scope
No new edge functions, no schema changes, no changes to `RequireAuth`, `OrgContext`, `provision-tenant`, or post-onboarding routing (trial activation handoff stays). No mobile-only redesign — flow uses existing responsive collapse to single column under `lg`.

## Verification
1. `/onboarding` renders the new flow for a freshly-signed-up user.
2. Refresh mid-flow resumes at the same step with preview rebuilt.
3. Skipping Job auto-skips Candidates.
4. Final "Go to your dashboard" lands on `/dashboard` and onboarding never re-shows.
5. Existing auto-join / pending-invite reconciliation still triggers before the flow renders.
