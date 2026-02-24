

# Fix: Email History Feed Horizontal Scroll Issue

## The Problem

The email history feed inside the candidate profile sheet generates a horizontal scrollbar when the panel gets narrow. The `ScrollArea` component (from Radix) applies `min-width: fit-content` to its viewport, which prevents the email cards from shrinking to fit the available width. Instead, they maintain their natural width and force horizontal scrolling.

## The Fix

**Files to change:**

### 1. `src/components/candidates/CandidateProfileSheet.tsx` (line ~1588)

Replace the `ScrollArea` wrapper with a simple `div` that has `overflow-y: auto` and constrained width. The email history only needs vertical scrolling -- horizontal scrolling is never desired here.

```
Before:  <ScrollArea className="h-[500px]">
           <div className="p-6">
             <EmailHistoryList ... />
           </div>
         </ScrollArea>

After:   <div className="h-[500px] overflow-y-auto">
           <div className="p-6">
             <EmailHistoryList ... />
           </div>
         </div>
```

### 2. `src/components/candidates/IndependentCandidateProfileSheet.tsx` (line ~810)

Same change -- replace `ScrollArea` with a plain scrollable div for the email history section.

### 3. `src/components/candidates/EmailHistoryCard.tsx`

Add `overflow-hidden` and `min-w-0` to the root `Card` element to ensure email content (long addresses, URLs, HTML bodies) never forces the card wider than its container. The `SafeHtml` prose container already has overflow constraints, but the card itself needs the same.

These are small, surgical CSS changes -- no logic changes needed.

