

# Billing Transparency Improvements

Three targeted enhancements to communicate seat billing impact clearly across the platform.

## 1. Add Seat Breakdown to Billing Page

**File: `src/pages/settings/Billing.tsx`**

Replace the static `Progress value={100}` and generic "Team seats: X active" in the "Your Plan" card (lines 314-328) with a detailed seat breakdown showing who occupies paid vs free seats.

- Show paid count and free count separately (e.g., "2 Paid · 3 Free")
- List the role types under each (Admins & Recruiters = paid, HMs & Interviewers = free)
- Use a segmented progress bar showing paid vs free proportions
- Pull counts from `useRecruiterUserIds` + `useCustomerMembers` or reuse the same logic from `MembersTab`

To keep it clean, create a small `BillingSeatBreakdown` component in `src/components/billing/BillingSeatBreakdown.tsx` that:
- Fetches members via existing hooks
- Computes paid/free counts using the same `isBillableMember` logic from MembersTab
- Renders a compact breakdown with colored dots (purple for paid, green for free)
- Includes a "View team" link to navigate to the members tab

## 2. Improve Billing Communication in Invite Flow

**File: `src/components/members/MemberInviteSheet.tsx`**

The existing billing impact alert (lines 317-341) has issues:
- `useSeatsPreview` only considers `admin` as billable, but recruiters are also paid seats
- The price formatting divides by 100 twice (formatPrice already divides by 100, but the hook returns cents)
- The "Free role" alert for members is misleading — members become paid when assigned as recruiters

Fix the billing alert:
- Keep the admin billing warning as-is (admins are immediately billable)
- Change the "Free role" member alert to be more accurate: "Members are free until assigned as a Recruiter on a job, which converts them to a paid seat"
- Fix the price calculation: `seatsPreview.monthlyCostIncrease` is already in cents, so pass it directly to `formatPrice` without dividing by 100 again

## 3. Add Seat Summary to Members Page Header

**File: `src/components/settings/MembersTab.tsx`**

The stat cards already show Paid Seats and Free Collaborators counts (lines 135-164). Enhance the `PageHeader` (line 133) to include an inline summary:

- Add a subtitle to PageHeader: "X paid seats · Y free collaborators"
- This gives immediate context without needing to scan the stat cards

## Files Changed

| File | Change |
|------|--------|
| `src/components/billing/BillingSeatBreakdown.tsx` | New component — compact paid/free seat breakdown for billing page |
| `src/pages/settings/Billing.tsx` | Replace static progress bar with `BillingSeatBreakdown` in "Your Plan" card |
| `src/components/members/MemberInviteSheet.tsx` | Fix member role billing alert text; fix price double-division bug |
| `src/components/settings/MembersTab.tsx` | Add seat summary subtitle to PageHeader |

## What stays untouched
- All hooks (useBillingStatus, useSeatsPreview, useRecruiterUserIds)
- SeatUpgradeConfirmDialog (job assignment flow)
- SeatUsageCard component
- Database, edge functions, permissions
- Billing page layout structure (metric cards, two-column grid, invoice history)

