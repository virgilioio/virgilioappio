
# Emergency Fix: Stage Booking Link Data Integrity Bug

This is a **critical data integrity bug** where booking links display the wrong candidate name. The root cause has been identified through database forensics and code analysis.

---

## Summary of the Problem

When a recruiter clicks "Generate Booking Link" for a candidate, the system is storing **incorrect candidate information** in the token. The database shows:

- **Token**: `JXEmd84S`  
- **Stored candidate_name**: "Andrea Rivera"
- **Stored candidate_email**: andrea.rivera@yellowbrick.com
- **Actual candidate for this ID**: "Said Abel Osorio" (saidabel.osorio@runahr.com)

This means candidates receive booking links with **someone else's name** on them!

---

## Root Cause Analysis

### Primary Issue: Frontend State Race Condition

In `CandidateProfileSheet.tsx`, when navigating between candidates:

1. User views Candidate A (Andrea Rivera)
2. User navigates to Candidate B (Said Abel Osorio) 
3. The `candidateId` prop changes, triggering a new fetch
4. **But the old `candidate` state (Andrea) is NOT cleared**
5. During the async fetch, user clicks "Generate Booking Link"
6. The stale Andrea data gets encoded into the token for Said's association

The problematic code (lines 214-231):
```typescript
useEffect(() => {
  if (open) setActiveTab('job')
  const load = async () => {
    if (!open || !candidateId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single()
      setCandidate(data || null)  // OLD DATA PERSISTS DURING FETCH!
    } finally {
      setLoading(false)
    }
  }
  load()
}, [open, candidateId])
```

### Secondary Issue: Backend Trusts Frontend Data

The `create-booking-token` edge function blindly trusts the `candidate_name` and `candidate_email` sent from the frontend without verifying against the database. This provides no safety net.

---

## The Fix

### 1. Frontend Fix: Clear State Immediately on Navigation

**File**: `src/components/candidates/CandidateProfileSheet.tsx`

- Clear `candidate` state immediately when `candidateId` changes (before fetch)
- Clear all related states that depend on candidate data
- Disable actions while data is loading

```typescript
useEffect(() => {
  if (open) setActiveTab('job')
  
  // CRITICAL: Clear stale data immediately when candidateId changes
  setCandidate(null)
  setAssociationId(null)
  setAssociationStatus(null)
  // ... clear other dependent states
  
  const load = async () => {
    if (!open || !candidateId) return
    setLoading(true)
    // ... rest of fetch logic
  }
  load()
}, [open, candidateId])
```

### 2. Frontend Fix: Guard the Booking Link Button

**File**: `src/components/candidates/CandidateProfileSheet.tsx`

Only render the booking link button when we have confirmed matching data:

```typescript
{/* Only show if candidate is loaded AND matches the candidateId */}
{(opt.stage.stage_type === 'screening' || opt.stage.stage_type === 'interview') 
  && associationId 
  && candidateId 
  && candidate?.id === candidateId  // ADD THIS CHECK
  && !loading && (
  <GenerateBookingLinkButton
    // ...props
  />
)}
```

### 3. Backend Fix: Verify Candidate Data from Database

**File**: `supabase/functions/create-booking-token/index.ts`

Fetch the actual candidate name/email from the database instead of trusting frontend input:

```typescript
// Fetch actual candidate data to ensure integrity
const { data: candidateData, error: candidateError } = await supabase
  .from('candidates')
  .select('candidate_name, email')
  .eq('id', candidate_id)
  .single();

if (candidateError || !candidateData) {
  return new Response(
    JSON.stringify({ error: 'Candidate not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Use verified data from database, not frontend input
const verifiedCandidateName = candidateData.candidate_name;
const verifiedCandidateEmail = candidateData.email;
```

### 4. Apply Same Fix to IndependentCandidateProfileSheet

**File**: `src/components/candidates/IndependentCandidateProfileSheet.tsx`

Apply identical state clearing and guard logic to ensure consistency.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/candidates/CandidateProfileSheet.tsx` | Clear state on candidateId change, add loading/match guards |
| `src/components/candidates/IndependentCandidateProfileSheet.tsx` | Same state clearing pattern |
| `supabase/functions/create-booking-token/index.ts` | Verify candidate data from database |

---

## Data Cleanup Required

After deploying the fix, you may want to run a cleanup query to identify and invalidate any corrupted tokens:

```sql
-- Find tokens where stored name doesn't match actual candidate
SELECT t.token, t.candidate_name as stored_name, c.candidate_name as actual_name, t.created_at
FROM booking_link_tokens t
JOIN candidates c ON c.id = t.candidate_id
WHERE t.candidate_name != c.candidate_name
  AND t.expires_at > NOW();
```

These tokens should be invalidated or updated to prevent further confusion.

---

## Testing Checklist

1. Open candidate A's profile, quickly navigate to candidate B, immediately click booking link button - should be disabled during loading
2. Generate a booking link, verify the token contains the correct candidate name
3. Open the booking link in incognito, verify correct candidate greeting is shown
4. Navigate rapidly between multiple candidates, verify no stale data issues
5. Test on mobile where network may be slower
