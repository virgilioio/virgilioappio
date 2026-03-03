

# Redesign Offer Creation: Separate Offer Forms from Document Templates

## Concept

Two independent entities:
- **Offer Forms** — configurable forms with dynamic fields (what the recruiter fills out when creating an offer)
- **Offer Letter Templates** — rich text document templates (used later to generate the actual offer document)

The creation flow becomes: Click "Create Offer" → Sheet opens → Select an Offer Form → Fill out the dynamic fields → Save. Document generation from a letter template happens separately afterward.

## Database Changes

### New table: `offer_forms`
Standalone form definitions, independent of document templates.

```sql
create table public.offer_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  organization_id uuid references public.organizations(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  source text not null default 'tenant',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.offer_forms enable row level security;
-- RLS policies matching existing offer_templates pattern
```

### New table: `offer_form_fields`
Same structure as `offer_template_fields` but referencing `offer_forms` instead of `offer_templates`.

```sql
create table public.offer_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.offer_forms(id) on delete cascade,
  field_name text not null,
  field_label text not null,
  field_type public.field_type not null default 'text',
  is_required boolean not null default false,
  display_order integer not null default 0,
  placeholder_text text,
  help_text text,
  accepted_file_types text,
  max_file_size_mb integer,
  organization_id uuid references public.organizations(id),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.offer_form_fields enable row level security;
```

### Update `offer_letters` table
- Make `template_id` nullable (document template is selected later, not at form submission)
- Add `form_id uuid references offer_forms(id)` — links to the form used
- Add `content` can remain as-is (populated later during doc generation)

```sql
alter table public.offer_letters
  alter column template_id drop not null,
  alter column content drop not null,
  add column form_id uuid references public.offer_forms(id);
```

## New Hooks

### `useOfferForms(context)`
CRUD for `offer_forms` table. Similar pattern to `useOfferTemplates`.

### `useOfferFormFields(formId)`
CRUD for `offer_form_fields` table. Mirrors `useOfferTemplateFields` but targets the new table.

## Settings UI Changes

### `OfferTemplatesManager.tsx` — Add "Offer Forms" sub-tab
Add a new tab alongside "Offer Letters", "Email Templates", etc.:

```
Offer Forms | Offer Letters | Email Templates | Contracts | ...
```

The **Offer Forms** tab contains:
- Table listing all offer forms (name, description, field count, created date)
- "Create Form" button → opens a sheet to name/describe the form
- Each row has Edit (opens sheet), Fields (opens `OfferFormFieldsManager`), Delete actions

### New: `OfferFormSheet.tsx`
Sheet for creating/editing an offer form's name and description. Simple — just name + description fields.

### New: `OfferFormFieldsManager.tsx`
Reuses the same UI pattern as `OfferTemplateFieldsManager` but targets `offer_form_fields`. Can be mostly a copy with the reference changed from `template_id` to `form_id`.

## Offer Creation Flow Changes

### `CreateOfferLetterSheet` → `CreateOfferSheet`
Complete rewrite of the creation experience:

1. **Sheet opens** with a clean form layout (no wizard steps, no step indicator)
2. **First field**: "Select Offer Form" dropdown — lists active `offer_forms`
3. **On selection**: Dynamic fields from `offer_form_fields` render below
4. **User fills fields** and clicks **Save**
5. Saves to `offer_letters` with `form_id`, `field_values`, status `'draft'`, `template_id` as null, `content` as empty

No document generation, no preview, no PDF at this stage. Those come later as separate actions on the saved offer.

The existing `template_id`, `content`, PDF generation, and preview logic will be repurposed later when the user chooses to "Generate Offer Document" from a saved offer — but that's a future step as the user indicated.

## Files Summary

| File | Action |
|------|--------|
| **Migration** | Create `offer_forms`, `offer_form_fields` tables; alter `offer_letters` |
| `src/hooks/useOfferForms.ts` | **Create** — CRUD hook for offer forms |
| `src/hooks/useOfferFormFields.ts` | **Create** — CRUD hook for offer form fields |
| `src/components/settings/OfferFormsManager.tsx` | **Create** — Settings table for managing offer forms |
| `src/components/settings/OfferFormFieldsManager.tsx` | **Create** — Field builder for offer forms |
| `src/components/settings/templates/OfferFormSheet.tsx` | **Create** — Create/edit offer form sheet |
| `src/components/settings/OfferTemplatesManager.tsx` | **Edit** — Add "Offer Forms" as first sub-tab |
| `src/components/candidates/CreateOfferLetterDialog.tsx` | **Rewrite** — Form-first sheet: select form → fill fields → save |
| `src/hooks/useOfferLetters.ts` | **Edit** — Update types for nullable template_id/content, add form_id |

