

# Revert Non-Pipeline Tabs to Natural Layout

## Problem

Recent changes added `flex-1 min-h-0 overflow-y-auto` to all non-pipeline tabs (Job Dashboard, All Candidates, Job Setup). The `flex-1` causes these tabs to stretch to fill the parent flex column, pushing content down and creating phantom whitespace. These tabs don't need height-managed layouts — they just need to scroll naturally.

## Fix

**`src/pages/JobDetail.tsx`** — 5 lines to change:

### Mobile
- **Line 816** (Job Dashboard): `className="flex-1 min-h-0 overflow-y-auto"` → remove className entirely
- **Line 825** (Job Setup): `className="flex-1 min-h-0 overflow-y-auto"` → remove className entirely

### Desktop
- **Line 1287** (Job Dashboard): `className="flex-1 min-h-0 overflow-y-auto"` → remove className entirely
- **Line 1297** (All Candidates): `className="flex-1 min-h-0 overflow-y-auto"` → remove className entirely
- **Line 1680** (Job Setup): `className="flex-1 min-h-0 overflow-y-auto"` → remove className entirely

### Scrolling approach

The parent column (`div` at line 1286) already has `flex-1 min-h-0 min-w-0 flex flex-col`. By removing `flex-1` from non-pipeline TabsContent, only the Pipeline tab (line 1326, which keeps `flex-1 min-h-0 flex flex-col overflow-hidden`) will stretch. The non-pipeline tabs will render at natural height. To ensure they scroll, add `overflow-y-auto` to the parent column div (line 1286) so any tab whose content exceeds the viewport gets a scrollbar from the parent.

**Line 1286**: `className="flex-1 min-h-0 min-w-0 flex flex-col"` → `className="flex-1 min-h-0 min-w-0 flex flex-col overflow-y-auto"`

Same for the mobile equivalent parent.

### What stays untouched
- Pipeline tab wrapper (line 1326): keeps `flex-1 min-h-0 flex flex-col overflow-hidden`
- Pipeline's inner scroll div (line 1327): keeps `flex-1 min-h-0 overflow-auto`
- All component internals, business logic, permissions, tab behavior

### Summary
| Tab | Before | After |
|-----|--------|-------|
| Pipeline | `flex-1 min-h-0 flex flex-col overflow-hidden` | unchanged |
| Job Dashboard | `flex-1 min-h-0 overflow-y-auto` | no className |
| All Candidates | `flex-1 min-h-0 overflow-y-auto` | no className |
| Job Setup | `flex-1 min-h-0 overflow-y-auto` | no className |
| Parent column | `flex-1 min-h-0 min-w-0 flex flex-col` | + `overflow-y-auto` |

