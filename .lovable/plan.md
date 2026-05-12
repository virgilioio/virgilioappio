
## 1. Quick actions → Controls Card (mirror candidate's)

In `DealProfileSheet.tsx`, remove the inline `Mark won` / `Mark lost` row (lines 178–200) and replace with the **same Controls Card pattern** used in `CandidateProfileSheet.tsx` (lines 1210–1291):

- `<Card className="bg-surface-primary border-border">` → `CardContent p-4` → horizontal scroll row of buttons.
- Buttons use the **same variants** as the candidate sheet:
  - `Mark won` → `variant="success"` with `Trophy` icon (mirrors "Mark as Hired").
  - `Mark lost` → `variant="destructive"` with `XCircle` icon (mirrors "Reject").
  - `Move to next stage` → `variant="outline"` with `MoveRight` icon (mirrors "Move to Offer"), shown when there is a next open stage.
- Place this card **inside the Deal Overview tab body**, above `DealDetailsCollapsible`, exactly where the candidate sheet places it.

## 2. Notes tab → exact `CandidateComments` UX

Rewrite the Notes `CardContent` in `DealProfileSheet.tsx` to match `CandidateComments.tsx` (lines 79–155):

- `<form>` with `Textarea` (`placeholder="Add a note..."`, `rows={3}`, `resize-none`).
- Wire `useSubmitShortcut` to submit on `⌘/Ctrl + Enter`.
- Footer row: left side `<span className="text-xs text-muted-foreground">⌘↵ to submit</span>`, right side primary `Button` with `Send` icon — label `Add Note` / `Adding...`.
- `<Separator />` between form and list.
- Card title: `<MessageSquare /> Notes (count)`.
- Each note rendered in `bg-muted/20 rounded-lg p-4` with author + relative time header and trash icon when author or platform admin.
- Empty state: same `gioFaceEmpty` block as `CandidateComments`.

`useDealNotes` already supports add; add a `delete` button that uses the existing `deleteNote` mutation, gated by `author_id === user.id || isPlatformAdmin`.

## 3. Billing & Invoices tab → documents + payments

Replace the empty placeholder with a real billing module that lives entirely inside the Billing tab.

### UI (new components in `src/components/deals/billing/`)

- `DealBillingSummary.tsx` — three KPI tiles in a grid: **Total deal**, **Collected**, **Outstanding**. Outstanding turns `text-virgilio-success` when 0, `text-virgilio-warning` otherwise. Mirrors the visual language of existing `Card` summary tiles.
- `DealInvoicesCard.tsx` — `Card` with header "Invoices & Documents" and an "Upload" button. Drag-and-drop dropzone reusing the styling pattern of `EnhancedResumeDropzone`. Lists uploaded files with name, size, uploaded-by, date, download and delete actions.
- `DealPaymentsCard.tsx` — `Card` with header "Payments" and "Register payment" button. Opens an inline form / small dialog with: amount (number, currency from deal), payment date, method (free text or select: bank transfer, card, cash, other), optional note, optional link to one of the uploaded invoice documents. Lists registered payments with edit/delete.
- `DealPaymentFormDialog.tsx` — register/edit form.

The Billing tab in `DealProfileSheet.tsx` renders `DealBillingSummary` on top, then `DealInvoicesCard`, then `DealPaymentsCard`.

### Data hooks (new in `src/hooks/`)

- `useDealInvoices(dealId)` — list/upload/delete using new `deal_invoices` table + `deal-invoices` storage bucket.
- `useDealPayments(dealId)` — list/create/update/delete using new `deal_payments` table.
- `useDealBillingSummary(dealId)` — derives `{ total, collected, outstanding }` from `deal.amount` and payments sum (computed client-side from the payments query).

### Database (migration)

Tables (tenant-scoped, RLS via existing tenant access pattern):

```text
deal_invoices
  id uuid pk default gen_random_uuid()
  deal_id uuid fk deals(id) on delete cascade not null
  tenant_id uuid not null
  uploaded_by uuid (auth user id)
  file_name text not null
  file_path text not null         -- storage object path in deal-invoices bucket
  file_size bigint
  mime_type text
  created_at timestamptz default now()

deal_payments
  id uuid pk
  deal_id uuid fk deals(id) on delete cascade not null
  tenant_id uuid not null
  amount numeric(14,2) not null check (amount > 0)
  currency text not null default 'USD'
  paid_at date not null default current_date
  method text                     -- bank_transfer | card | cash | other (free text allowed)
  note text
  invoice_id uuid fk deal_invoices(id) on delete set null
  created_by uuid
  created_at timestamptz default now()
  updated_at timestamptz default now()
```

RLS: SELECT/INSERT/UPDATE/DELETE limited to members of the row's `tenant_id` (use the existing `user_has_tenant_access` helper, matching `deal_notes`). Auto-set `tenant_id` from a SECURITY DEFINER trigger that resolves it from `deals.tenant_id` (so the client doesn't have to send it).

Storage: new private bucket `deal-invoices` with RLS policies allowing tenant members to read/write objects under `{tenant_id}/{deal_id}/...`.

## Out of scope

- No changes to deal pricing logic outside payments aggregation.
- No multi-currency conversion — payments inherit `deal.currency`; if a payment uses a different currency we display it as-is without converting (v1).
- No PDF generation of invoices — only upload of user-provided files.

## Files

- Edit: `src/components/deals/DealProfileSheet.tsx`
- New: `src/components/deals/billing/DealBillingSummary.tsx`, `DealInvoicesCard.tsx`, `DealPaymentsCard.tsx`, `DealPaymentFormDialog.tsx`
- New: `src/hooks/useDealInvoices.ts`, `src/hooks/useDealPayments.ts`
- Edit: `src/hooks/useDealNotes.ts` (already has delete; just expose if needed)
- DB migration: create `deal_invoices`, `deal_payments`, RLS, triggers, `deal-invoices` storage bucket + policies
