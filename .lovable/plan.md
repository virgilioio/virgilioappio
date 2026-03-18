

# Redesign NotificationCenter — Reference-Inspired

## What Changes

### 1. Wider popover with more breathing room
- Increase from `w-96` (384px) to `w-[440px]`
- Increase row padding from `py-3` to `py-4`
- Increase max height from `max-h-80` to `max-h-[420px]`

### 2. Avatar initials instead of small icons
- Replace the tiny `Mail` / `ClipboardCheck` icons with a colored `Avatar` circle (h-9 w-9) showing candidate initials
- Use `AvatarFallback` with `bg-virgilio-purple text-white` for emails, a secondary color for offer approvals
- Extract initials from `candidateName` (first letter of first + last name)

### 3. Unread dot indicator
- Add a small purple dot (`h-2 w-2 rounded-full bg-virgilio-purple`) to the left of each notification row — all items in this list are unread by definition, so the dot shows on every item

### 4. Date grouping — "Today" / "Yesterday" / "Earlier"
- Group notifications by date bucket using `isToday()` and `isYesterday()` from `date-fns`
- Render a sticky section header label (`text-xs text-virgilio-muted font-semibold uppercase px-4 py-2`) before each group

### 5. "Mark all as read" moved to header
- Remove the bottom `Separator` + button footer
- Add a text-style link ("Mark all read") in the header row, right-aligned, replacing the `{count} new` badge
- Keep the count as a small badge next to "Notifications" title instead

### Technical Details

**File: `src/components/layout/NotificationCenter.tsx`** — single file edit:

- Import `Avatar, AvatarFallback` from `@/components/ui/avatar`
- Import `isToday, isYesterday` from `date-fns`
- Add helper: `getInitials(name: string)` → split by space, take first chars
- Add helper: `groupByDate(notifications)` → returns `{label, items}[]`
- Replace notification list rendering with grouped sections
- Replace icon area with Avatar
- Add unread dot
- Move "Mark all as read" to header
- Widen popover, increase padding

