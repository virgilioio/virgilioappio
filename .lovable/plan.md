

# Merge Offer Form Fields into the Offer Form Sheet

## Problem
Currently, managing form fields requires opening a separate Dialog from the forms table. The experience should be unified — creating/editing an offer form and managing its fields should all happen inside the same sliding sheet.

## Approach

### Flow change
- **Create mode**: User fills in name + description, clicks "Create". After creation, the sheet stays open, switches to edit mode, and reveals the fields section below the form details.
- **Edit mode**: The sheet shows the form details at the top and the full fields manager below, all in one scrollable panel.
- The separate "Manage Fields" Dialog in `OfferFormsManager.tsx` is removed entirely.

### Changes

#### 1. `src/components/settings/templates/OfferFormSheet.tsx`
- Widen the sheet: `sm:max-w-2xl` (fields table needs horizontal space)
- Make content scrollable with `overflow-y-auto`
- After saving a new form, capture the returned `id` and stay open in edit mode (set local `activeFormId` state)
- When `isEditing` (either via prop or after creation), render `<OfferFormFieldsManager formId={...} />` below the form details, separated by a divider
- Import `useOfferFormFields` is not needed here — just render the existing `OfferFormFieldsManager` component which handles its own state
- The field add/edit sub-dialogs from `OfferFormFieldsManager` will naturally layer on top of the sheet (they're portaled Dialogs)

#### 2. `src/components/settings/OfferFormsManager.tsx`
- Remove the `fieldsDialog` state and the `<Dialog>` wrapping `OfferFormFieldsManager`
- Remove the "Manage Fields" button (`<List>` icon) from each table row's actions
- Remove the `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` imports (no longer needed)

#### 3. `src/components/settings/OfferFormFieldsManager.tsx`
- Remove the outer `<Card>` + `<CardHeader>` wrapper so it sits cleanly inside the sheet (just render the content directly)
- Keep all field CRUD logic, table, and inline dialogs as-is

Two components edited, one simplified. No new dependencies.

