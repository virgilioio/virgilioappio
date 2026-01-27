

# Fix: Scorecard Draft Loss Prevention with Cancel Confirmation

## Overview

Implement a robust draft preservation system that:
1. Saves drafts automatically when the sheet is dismissed (Esc, click outside, X button)
2. Shows a confirmation dialog when the Cancel button is clicked explicitly
3. Fixes the race condition between competing useEffects

---

## Changes Summary

### 1. Add State Refs for Reliable Close-Time Saving

Track current values in refs so we can access them reliably during sheet close:

```typescript
// After line 104 (draftTimeoutRef)
const overviewRef = useRef(overview);
const ratingRef = useRef(rating);
const responsesRef = useRef(responses);

// Sync refs with state
useEffect(() => { overviewRef.current = overview; }, [overview]);
useEffect(() => { ratingRef.current = rating; }, [rating]);
useEffect(() => { responsesRef.current = responses; }, [responses]);
```

---

### 2. Add Cancel Confirmation Dialog State

```typescript
// After line 100 (showDeleteDialog state)
const [showCancelDialog, setShowCancelDialog] = useState(false);
```

---

### 3. Create handleSheetDismiss Function

This handles accidental dismissal (Esc, click outside) - saves draft immediately:

```typescript
// New function after handleDiscardDraft
const handleSheetDismiss = useCallback((newOpen: boolean) => {
  if (!newOpen && !isReadOnly) {
    // Sheet is being dismissed - save draft immediately
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
      draftTimeoutRef.current = null;
    }
    
    // Force editor to sync its content
    const editorElement = document.querySelector('[contenteditable="true"]');
    if (editorElement instanceof HTMLElement) {
      editorElement.blur();
    }
    
    // Save current values to localStorage immediately
    try {
      const draft = {
        rating: ratingRef.current,
        overview: overviewRef.current,
        responses: responsesRef.current,
        lastUpdated: Date.now()
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setHasDraft(true);
    } catch (e) {
      console.debug('Failed to save draft on close:', e);
    }
  }
  
  onOpenChange(newOpen);
}, [draftKey, isReadOnly, onOpenChange]);
```

---

### 4. Create handleCancelClick Function

This handles explicit Cancel button click - shows confirmation:

```typescript
// New function
const handleCancelClick = useCallback(() => {
  // Check if there are unsaved changes
  const hasChanges = overview.trim() !== '' || 
    Object.keys(responses).length > 0 || 
    rating !== (existing?.rating || 'yes') ||
    overview !== (existing?.general_overview || '');
  
  if (hasChanges) {
    setShowCancelDialog(true);
  } else {
    // No changes, just close
    clearDraft();
    onOpenChange(false);
  }
}, [overview, responses, rating, existing, clearDraft, onOpenChange]);
```

---

### 5. Create handleConfirmCancel Function

Called when user confirms they want to discard:

```typescript
const handleConfirmCancel = useCallback(() => {
  clearDraft();
  setRating('yes');
  setOverview('');
  setResponses({});
  setShowCancelDialog(false);
  onOpenChange(false);
}, [clearDraft, onOpenChange]);
```

---

### 6. Remove Competing Reset Effect

**Delete lines 394-400** (the effect that overwrites restored drafts):

```typescript
// DELETE THIS ENTIRE BLOCK
useEffect(() => {
  if (open) {
    setRating(existing?.rating || "yes");
    setOverview(existing?.general_overview || "");
    setEditMode(!existing || isAuthor);
  }
}, [open, existing?.id, existing?.rating, existing?.general_overview, isAuthor]);
```

---

### 7. Expand Draft Restoration Effect

**Replace lines 131-174** with unified initialization:

```typescript
// Unified initialization effect when sheet opens
useEffect(() => {
  if (!open) return;
  
  // Base values from existing scorecard (or defaults)
  const baseRating = existing?.rating || "yes";
  const baseOverview = existing?.general_overview || "";
  
  // Always set edit mode
  setEditMode(!existing || isAuthor);
  
  // Check for local draft
  try {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      const draft = JSON.parse(savedDraft);
      // Check if draft is less than 7 days old
      if (Date.now() - draft.lastUpdated < 7 * 24 * 60 * 60 * 1000) {
        // For existing scorecards, only restore if draft is newer than last DB update
        if (existing?.updated_at) {
          const dbUpdateTime = new Date(existing.updated_at).getTime();
          if (draft.lastUpdated > dbUpdateTime) {
            // Draft is newer - restore it
            setRating(draft.rating || baseRating);
            setOverview(draft.overview || baseOverview);
            setResponses(draft.responses || {});
            setHasDraft(true);
            toast({ 
              title: 'Unsaved changes restored', 
              description: 'Your previous edits have been recovered.' 
            });
            return;
          }
        } else {
          // New scorecard - restore draft
          setRating(draft.rating || baseRating);
          setOverview(draft.overview || baseOverview);
          setResponses(draft.responses || {});
          setHasDraft(true);
          toast({ 
            title: 'Draft restored', 
            description: 'Your previous notes have been restored.' 
          });
          return;
        }
      } else {
        localStorage.removeItem(draftKey);
      }
    }
  } catch (e) {
    console.debug('Failed to load draft:', e);
  }
  
  // No valid draft - use base values
  setRating(baseRating);
  setOverview(baseOverview);
  setHasDraft(false);
  
}, [open, existing?.id, existing?.updated_at, existing?.rating, existing?.general_overview, draftKey, isAuthor]);
```

---

### 8. Update Sheet Component

**Line 705** - Use new dismiss handler:

| Before | After |
|--------|-------|
| `<Sheet open={open} onOpenChange={onOpenChange}>` | `<Sheet open={open} onOpenChange={handleSheetDismiss}>` |

---

### 9. Update Cancel Button

**Lines 959-962** - Use new cancel click handler:

| Before | After |
|--------|-------|
| `<Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>` | `<Button variant="outline" onClick={handleCancelClick} disabled={saving}>Cancel</Button>` |

---

### 10. Add Cancel Confirmation Dialog

Add after the Delete Confirmation Dialog (after line 1025):

```typescript
{/* Cancel Confirmation Dialog */}
<AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
      <AlertDialogDescription>
        You have unsaved notes in this scorecard. Are you sure you want to cancel? Your changes will be lost.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep Editing</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={handleConfirmCancel}
      >
        Discard Changes
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Behavior Summary

| Action | Behavior |
|--------|----------|
| Click outside sheet | Draft saved immediately, sheet closes |
| Press Esc | Draft saved immediately, sheet closes |
| Click X button | Draft saved immediately, sheet closes |
| Click Cancel (no changes) | Sheet closes, no dialog |
| Click Cancel (with changes) | Confirmation dialog appears |
| Confirm "Discard Changes" | Draft cleared, form reset, sheet closes |
| Click "Keep Editing" | Dialog closes, continue editing |
| Click "Discard Draft" header button | Draft cleared, form reset (existing behavior) |
| Submit Scorecard | Draft cleared after successful save |

---

## File Changes

| File | Changes |
|------|---------|
| `src/components/candidates/ScorecardSheet.tsx` | Add refs, new state, new handlers, unified initialization, confirmation dialog |

---

## Testing Checklist

1. Type notes, press Esc - Reopen - Notes preserved
2. Type notes, click outside - Reopen - Notes preserved  
3. Type notes, click Cancel - See confirmation dialog
4. Confirm discard - Notes gone on reopen
5. Click "Keep Editing" - Continue editing, notes preserved
6. Submit scorecard - Draft cleared, no restoration
7. Existing scorecard with newer local draft - Shows draft with toast

