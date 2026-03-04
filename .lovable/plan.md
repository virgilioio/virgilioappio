

# Fix Three Job Settings Issues

## Issue 1: Stages Library — Dialog to Sheet

Currently `JobStagesManager.tsx` uses `Dialog` for create/edit stage forms. This needs to become a `Sheet` to match the pattern used everywhere else (offer letters, email templates, contracts, offer forms all use sheets).

**Changes:**
- `src/components/settings/JobStagesManager.tsx`: Replace both `Dialog` instances (create + edit) with `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetDescription`. Keep `JobStageForm` inside.
- `src/components/settings/PlatformJobStagesManager.tsx`: Same — replace both `Dialog` instances with `Sheet`.

## Issue 2: Rejection Templates — Missing Create Button

`RejectionEmailTemplatesManager.tsx` only shows a "Create" button in the empty state (line 40). When templates exist, there's NO create button anywhere — the table renders directly with no header/toolbar.

**Fix:** Add a header row above the table (matching the pattern in other sub-tabs) with a title and "Create Rejection Email" button that calls `openCreateSheet()`.

**Change in `RejectionEmailTemplatesManager.tsx`:**
- Add a `div` with `flex items-center justify-between mb-4` above the `<Table>` containing a title `<h3>` and a `<Button>` with `<Plus>` icon calling `openCreateSheet`.

## Issue 3: Visual Consistency Across All Tables

Currently the sub-tabs under Job Settings have wildly inconsistent layouts:

| Component | Wrapper | Header Style | Table Border |
|---|---|---|---|
| JobStagesManager | `Card` with `CardHeader` + `CardContent` | CardTitle + CardDescription + Button in header | `rounded-brand border` (via JobStagesTable) |
| ApplicationFieldsManager | `Card` with `CardHeader` + `CardContent` | CardTitle + CardDescription + Button in header | None (bare `<Table>`) |
| OfferFormsManager | `Card` with `CardContent pt-6` | Inline `<h3>` + Button | None |
| Offer Letters/Email/Contract (in OfferTemplatesManager) | `Card` with `CardContent pt-6` | Inline `<h3>` + Button | None |
| RejectionReasonsManager | No Card wrapper | Inline `<h3>` titles | None |
| RejectionEmailTemplatesManager | No Card wrapper | None (just table) | None |

**Target pattern** — Use the `Card` + `CardHeader` (title + description + button) + `CardContent` pattern consistently, matching `JobStagesManager` and `ApplicationFieldsManager` which look cleanest. All tables wrapped in `rounded-brand border`.

**Files to standardize:**

1. **`OfferFormsManager.tsx`**: Change from `CardContent pt-6` with inline `<h3>` to proper `CardHeader` with `CardTitle`/`CardDescription` + Button. Wrap `<Table>` in `div.rounded-brand.border`.

2. **`OfferTemplatesManager.tsx`** (offer letters, email templates, contracts sub-tabs): Each sub-tab's `Card` should use `CardHeader` with `CardTitle`/`CardDescription` + create button, instead of inline `<h3>` inside `CardContent`. Wrap each `<Table>` in `div.rounded-brand.border`.

3. **`RejectionReasonsManager.tsx`**: Wrap in a `Card` with `CardHeader` (title + description + add button) and `CardContent`. Wrap `<Table>` in `div.rounded-brand.border`.

4. **`RejectionEmailTemplatesManager.tsx`**: Wrap in a `Card` with `CardHeader` (title + description + create button) and `CardContent`. Wrap `<Table>` in `div.rounded-brand.border`.

5. **`ApplicationFieldsManager.tsx`**: Wrap `<Table>` instances in `div.rounded-brand.border`. Change edit/delete button styles from `variant="outline"` with text labels to `variant="ghost"` icon-only (matching other tables).

This standardizes every sub-tab to: `Card` → `CardHeader` (title left, button right) → `CardContent` → `div.rounded-brand.border` → `Table`.

