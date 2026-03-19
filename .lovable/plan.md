

# Find Page: Tabs, Badges & Filter Standardization

## 1. Sidebar Status Tabs (Active | Archived | All)

**File: `src/components/sourcing/SourcingSidebar.tsx`** (lines 86-117)

The three status filter buttons are custom `<button>` elements with inline Tailwind. Replace with the standard `Tabs`/`TabsList`/`TabsTrigger` components from `@/components/ui/tabs`, which already implement the app's tab style guide (rounded-xl container, `bg-[#d7c5fb]` active state, poppins font).

- Import `Tabs, TabsList, TabsTrigger` from `@/components/ui/tabs`
- Replace the manual `<div className="flex gap-1.5 ...">` + 3 `<button>` elements with `<Tabs value={statusFilter} onValueChange={setStatusFilter}><TabsList><TabsTrigger value="active">Active</TabsTrigger>...`
- Remove the custom active/inactive styling logic

## 2. Search Criteria Badges (Read-Only View)

**File: `src/components/sourcing/SourcingFiltersPanel.tsx`** (lines 111-199)

All read-only badges use generic `variant="secondary"` or `variant="outline"`. Map each to a semantic Smart Field variant:

| Criteria | Current | New Variant |
|----------|---------|-------------|
| Job Titles | `secondary` | `pastel-purple` |
| Keywords | `outline` | `keyword-match` |
| Locations | `outline` | `pastel-blue` |
| Seniority | `outline` | `category` |
| Company Size | `outline` | `category` |
| Company Domains | `outline` | `category` |
| Target Companies | `outline` | `pastel-orange` |
| Experience | `outline` | `category` |

## 3. Search Criteria Badges (Editable/Removable)

**File: `src/components/sourcing/EditableSearchCriteria.tsx`**

Same mapping as above, applied to the removable badge pills:

| Field | Current | New Variant |
|-------|---------|-------------|
| Title Keywords (line 218) | `secondary` | `pastel-purple` |
| Keywords (line 291) | `secondary` | `keyword-match` |
| Seniority (line 336) | `outline` | `category` |
| Company Size (line 368) | `outline` | `category` |
| Industry (line 400) | `outline` | `pastel-blue` |
| Target Companies (line 473) | `outline` | `pastel-orange` |

## 4. Role Interpretation Drawer Badges

**File: `src/components/sourcing/RoleInterpretationDrawer.tsx`**

| Badge | Current | New Variant |
|-------|---------|-------------|
| Alt titles (line 142) | `outline` | `category` |
| Skills (line 252) | `secondary` | `pastel-purple` |
| Researched titles (line 307) | `outline` + inline class | `category` |
| Researched companies (line 324) | `secondary` | `pastel-orange` |
| Overflow "+N more" (line 329) | `outline` | `category` |
| Researched industries (line 346) | `outline` + inline color | `pastel-blue` |
| Researched keywords (line 363) | `outline` + inline class | `keyword-match` |

## 5. Project Status Badge Below Title

**File: `src/components/sourcing/SourcingProjectHeader.tsx`** (line 127)

Currently `variant={project.status === 'active' ? 'default' : 'secondary'}`. Change to:
- `active` → `variant="status-active"` 
- `archived` → `variant="status-inactive"` (slate tones)

Also capitalize the label text.

## Files Summary

| File | Changes |
|------|---------|
| `SourcingSidebar.tsx` | Replace custom tab buttons with `Tabs`/`TabsList`/`TabsTrigger` |
| `SourcingFiltersPanel.tsx` | Update ~8 badge variants to Smart Field style |
| `EditableSearchCriteria.tsx` | Update ~6 removable badge variants |
| `RoleInterpretationDrawer.tsx` | Update ~7 badge variants |
| `SourcingProjectHeader.tsx` | Update 1 status badge to semantic variant |

