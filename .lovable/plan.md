

# Replace Template List with SearchableSelect Dropdown

Replace the button list in `GenerateOfferDialog.tsx` with the existing `SearchableSelect` component, which already supports typing/searching via `CommandInput`.

## Changes

### `src/components/candidates/GenerateOfferDialog.tsx`
- Import `SearchableSelect` and `SearchableSelectOption`
- Change state from `selectedTemplate: OfferTemplate | null` to `selectedTemplateId: string` (empty string default)
- Map `templates` to `SearchableSelectOption[]`: `{ value: template.id, label: template.name, badge: template.source === 'platform' ? 'Default' : undefined, badgeVariant: 'secondary' }`
- Replace the scrollable button list (lines 96-136) with a single `<SearchableSelect>` using `placeholder="Select a template..."`, `searchPlaceholder="Search templates..."`
- In `handleGenerate`, look up the template: `templates.find(t => t.id === selectedTemplateId)`
- Update the disabled check on Generate button: `!selectedTemplateId`

Single file change, reuses the existing `SearchableSelect` component which already has built-in search/type functionality.

