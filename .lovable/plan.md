

# Mobile Optimization Plan - Part 2

This plan addresses three additional mobile UX improvements: the Pipeline Overview header layout, the Candidate Profile Sheet sidebar-to-dropdown conversion, and a simplified mobile view for candidate profiles.

---

## Summary of Changes

### 1. Pipeline Overview Header - Title Above Buttons (Mobile)
**Problem**: The "Pipeline Overview" title and action buttons compete for horizontal space on mobile, causing visual cramping.

**Solution**:
- Restructure the `CardHeader` to use `flex-col md:flex-row` layout
- On mobile, the title appears on its own line, with the full-width button row below
- This gives the buttons breathing room and improves touch targets

### 2. Job-Associated Candidate Profile Sheet - Sidebar Fix
**Problem**: The `CandidateJobSidebar` still renders on mobile in `CandidateProfileSheet.tsx`, stealing the entire view. The current implementation places the `MobileJobSelector` incorrectly outside the main flex container, causing layout issues.

**Solution**:
- Move the `MobileJobSelector` inside the main content area (after `SheetHeader`, before the grid)
- Ensure the desktop sidebar is properly hidden with `hidden lg:flex`
- Match the pattern already working in `IndependentCandidateProfileSheet`

### 3. Simplified Mobile Candidate Profile View
**Problem**: On mobile, the full candidate profile shows too much information (URLs, Attachments, Skills, Work Experience, Education, Feed, Notes, Emails, Reminders) when a recruiter often just needs quick access to contact info and summary.

**Solution**:
- On mobile, show only essential sections in the Overview tab:
  - Contact Information (emails, phones, LinkedIn)
  - Profile Summary
- Hide on mobile:
  - URLs
  - Attachments  
  - Skills
  - Work Experience
  - Education
- Hide the entire right column (Feed, Notes, Emails, Reminders) on mobile
- Add a "Show More" toggle or collapse the secondary sections into a single expandable area for users who need them

---

## Technical Implementation

### File: `src/pages/JobDetail.tsx` (Lines ~1014-1125)

**Current Structure (simplified)**:
```tsx
<CardHeader>
  <div className="flex items-start justify-between">
    <div>
      <h1>Pipeline Overview</h1>
      <p className="hidden md:block">Drag candidates...</p>
    </div>
    <div className="flex items-center gap-2">
      {/* All the buttons: Add Candidate, Select, View Toggle */}
    </div>
  </div>
</CardHeader>
```

**Updated Structure**:
```tsx
<CardHeader>
  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
    <div>
      <h1>Pipeline Overview</h1>
      <p className="hidden md:block">Drag candidates...</p>
    </div>
    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
      {/* All the buttons */}
    </div>
  </div>
</CardHeader>
```

Key changes:
- `flex-col` on mobile, `md:flex-row` on desktop
- `gap-4` for spacing between title and buttons on mobile
- Buttons row gets `w-full md:w-auto` and `justify-between md:justify-end` for better mobile distribution

---

### File: `src/components/candidates/CandidateProfileSheet.tsx`

**Issue 1: MobileJobSelector Placement (Lines ~709-718)**

Current (incorrect):
```tsx
<div className="flex h-full w-full">
  {/* Mobile Job Selector - OUTSIDE the main flex flow */}
  {candidateId && (
    <div className="lg:hidden p-4 border-b">
      <MobileJobSelector ... />
    </div>
  )}
  
  {/* Job Navigation Sidebar */}
  <CandidateJobSidebar className="hidden lg:flex" ... />
  
  {/* Main Profile Content */}
  <div className="flex-1 flex flex-col min-w-0">
```

The `MobileJobSelector` is placed as a sibling to the sidebar, but it's inside the `flex h-full w-full` container incorrectly, causing it to appear side-by-side.

**Fix**: Move `MobileJobSelector` inside the main content column:

```tsx
<div className="flex h-full w-full">
  {/* Job Navigation Sidebar - Desktop only */}
  {candidateId && (
    <CandidateJobSidebar className="hidden lg:flex" ... />
  )}

  {/* Main Profile Content */}
  <div className="flex-1 flex flex-col min-w-0">
    <SheetHeader>...</SheetHeader>
    
    <div className="flex-1 overflow-y-auto p-6">
      {/* Mobile Job Selector - at top of content area */}
      {candidateId && (
        <div className="lg:hidden mb-6">
          <MobileJobSelector ... />
        </div>
      )}
      
      {loading ? ... : (
        <Tabs>
          {/* Rest of content */}
        </Tabs>
      )}
    </div>
  </div>
</div>
```

**Issue 2: Simplified Mobile View**

Current accordion sections in Overview tab (lines ~1140-1420):
1. Contact Information
2. URLs  
3. Attachments
4. Skills
5. Profile Summary

And right column (lines ~1420-1650):
- Controls Card (Edit, Download, Add Note, Send Email)
- Tab Navigation (Feed, Notes, Emails, Reminders)
- Tab content cards

**Mobile Simplification Strategy**:

1. Add `hidden md:block` to accordion items we want to hide on mobile:
   - URLs (`value="urls"`)
   - Attachments (`value="attachments"`)
   - Skills (`value="skills"`)

2. For the right column, hide it entirely on mobile:
   ```tsx
   <div className="space-y-6 hidden lg:block">
     {/* Right column content */}
   </div>
   ```

3. On mobile, merge essential actions into a floating action bar or keep the Controls Card visible but simplified.

4. Keep visible on mobile:
   - Contact Information (essential for calling/emailing)
   - Profile Summary (quick context)
   - Controls Card (for Edit, actions)

---

### File: `src/components/candidates/IndependentCandidateProfileSheet.tsx`

Apply the same mobile simplification pattern:

**Lines ~432-657 (Overview accordion)**:
- Keep: Contact Information, Profile Summary
- Hide on mobile: URLs, Attachments, Skills, Work Experience, Education

**Lines ~661-801 (Right column)**:
- Hide the entire right column on mobile with `hidden lg:block`
- The Controls Card from the left column still provides Edit/Download
- Users can still access the right column features via the tabs on desktop

---

## Detailed Changes

### `src/pages/JobDetail.tsx`

| Line Range | Change |
|------------|--------|
| 1015 | Update outer div: `flex items-start justify-between` → `flex flex-col md:flex-row md:items-start md:justify-between gap-4` |
| 1020 | Update buttons container: add `w-full md:w-auto justify-between md:justify-end flex-wrap` |

### `src/components/candidates/CandidateProfileSheet.tsx`

| Line Range | Change |
|------------|--------|
| 709-718 | Remove MobileJobSelector from current position |
| 784-789 | Add MobileJobSelector inside content area, before loading check |
| 1307-1323 | Add `hidden md:block` wrapper around URLs AccordionItem |
| 1325-1341 | Add `hidden md:block` wrapper around Attachments AccordionItem |
| 1343-1387 | Add `hidden md:block` wrapper around Skills AccordionItem |
| 1420 | Update right column div: add `hidden lg:block` class |

### `src/components/candidates/IndependentCandidateProfileSheet.tsx`

| Line Range | Change |
|------------|--------|
| 544-560 | Add `hidden md:block` wrapper around URLs AccordionItem |
| 562-578 | Add `hidden md:block` wrapper around Attachments AccordionItem |  
| 580-620 | Add `hidden md:block` wrapper around Skills AccordionItem |
| 648-656 | Add `hidden md:block` wrapper around Work Experience and Education |
| 661 | Update right column div: add `hidden lg:block` class |

---

## Mobile View After Changes

### Pipeline Overview (Mobile)
```text
┌─────────────────────────────────────────┐
│ Pipeline Overview                       │
│ (No subtitle on mobile)                 │
├─────────────────────────────────────────┤
│ [Add Candidate] [Select] [🎯] [📋]      │
│ (full width, spaced nicely)             │
└─────────────────────────────────────────┘
```

### Candidate Profile Sheet (Mobile)
```text
┌─────────────────────────────────────────┐
│ [←] Candidate Name                [→]   │
│ Job Title Badge                         │
├─────────────────────────────────────────┤
│ [Select Job Association ▼]              │
├─────────────────────────────────────────┤
│ [Edit] [Download]                       │
├─────────────────────────────────────────┤
│ [Overview] [Job] [Resume] [Application] │
├─────────────────────────────────────────┤
│ ▼ Contact Information                   │
│   📧 email@example.com                  │
│   📞 +1 234 567 8900                   │
│   🔗 LinkedIn Profile                   │
├─────────────────────────────────────────┤
│ ▼ Profile Summary                       │
│   AI-generated summary text...          │
└─────────────────────────────────────────┘
```

**What's hidden on mobile**:
- URLs section
- Attachments section
- Skills section
- Work Experience section
- Education section
- Entire right column (Feed, Notes, Emails, Reminders)

**What remains accessible**:
- Contact Information (essential for outreach)
- Profile Summary (quick context)
- Tab navigation to Resume, Job details, Application responses
- Edit and Download actions

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/JobDetail.tsx` | Restructure Pipeline Overview header for mobile stacking |
| `src/components/candidates/CandidateProfileSheet.tsx` | Fix MobileJobSelector placement, hide non-essential sections on mobile |
| `src/components/candidates/IndependentCandidateProfileSheet.tsx` | Hide non-essential sections on mobile |

---

## Testing Checklist

1. Pipeline Overview header shows title above buttons on mobile
2. Buttons have proper spacing and touch targets on mobile
3. CandidateProfileSheet shows job dropdown at top on mobile
4. CandidateProfileSheet hides URLs, Attachments, Skills, Experience, Education on mobile
5. CandidateProfileSheet hides right column (Feed/Notes/Emails/Reminders) on mobile
6. IndependentCandidateProfileSheet applies same mobile simplifications
7. All features remain accessible and functional on desktop
8. Tab navigation still works on all screen sizes
9. Edit and Download buttons remain visible on mobile

