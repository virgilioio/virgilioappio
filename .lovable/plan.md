

# Exact Pipeline Tabs for Find Page

## Problem

The Find page tabs use custom `<button>` elements with a `tabConfig` array, icons, and custom color classes. The JobDetail pipeline tabs use `TabsList` + `TabsTrigger` in a `grid w-full` layout with specific pastel design-system colors, no icons (except Sparkles on "Suggested"), and `Badge` variants from the design system.

## Exact reference (JobDetail lines 926-964)

```
TabsList: "hidden md:grid w-full h-14 p-2 gap-1 grid-cols-6"
```

Each trigger: `"h-10 md:h-12 text-xs md:text-sm bg-{color}/20 text-text-primary data-[state=active]:bg-{color}"`

With design-system Badge variants (`pastel-purple`, `pastel-yellow`, `pastel-blue`, `secondary`).

## Changes

### `src/components/sourcing/SourcingProjectView.tsx`

1. **Remove** the `tabConfig` array (lines 31-63)
2. **Remove** `Users, UserCheck, Archive` from imports (no longer needed)
3. **Add** `TabsList, TabsTrigger` to the `@/components/ui/tabs` import
4. **Replace** the custom button rendering (lines 362-396) with exact JobDetail pattern:

```tsx
<TabsList className="grid w-full h-14 p-2 gap-1 grid-cols-4">
  <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-text-primary data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white border border-blue-500/20 data-[state=active]:border-blue-500 data-[state=active]:shadow-[0_0_20px_rgba(59,130,246,0.5),0_0_40px_rgba(147,51,234,0.3)] data-[state=active]:animate-pulse" value="conversation">
    <span className="flex items-center gap-1 truncate">
      <Sparkles className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
      <span className="truncate">Chat with Gio</span>
    </span>
  </TabsTrigger>
  <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-purple/20 text-text-primary data-[state=active]:bg-pastel-purple" value="candidates">
    <span className="flex items-center gap-1 truncate">
      <span className="truncate">Candidates</span>
      <Badge variant="pastel-purple" className="text-xs flex-shrink-0">{candidateCount}</Badge>
    </span>
  </TabsTrigger>
  <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-yellow/20 text-text-primary data-[state=active]:bg-pastel-yellow" value="saved">
    <span className="flex items-center gap-1 truncate">
      <span className="truncate">Saved</span>
      <Badge variant="pastel-yellow" className="text-xs flex-shrink-0">{savedCount}</Badge>
    </span>
  </TabsTrigger>
  <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-blue/20 text-text-primary data-[state=active]:bg-pastel-blue" value="archived">
    <span className="flex items-center gap-1 truncate">
      <span className="truncate">Archived</span>
      <Badge variant="pastel-blue" className="text-xs flex-shrink-0">{archivedCount}</Badge>
    </span>
  </TabsTrigger>
</TabsList>
```

Key differences from current implementation:
- Uses `TabsList` + `TabsTrigger` (not raw buttons)
- `grid w-full grid-cols-4` stretches tabs across full width
- No icons except Sparkles on "Chat with Gio"
- Design system pastel colors with `/20` inactive backgrounds
- `data-[state=active]` for active styling (Radix handles state)
- Design system `Badge` variants instead of custom badge styling

## Files

| File | Change |
|------|--------|
| `src/components/sourcing/SourcingProjectView.tsx` | Remove `tabConfig`; replace custom buttons with exact `TabsList`/`TabsTrigger` grid pattern from JobDetail; remove unused icon imports |

