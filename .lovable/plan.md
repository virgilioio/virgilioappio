

# Add "View Full Profile" Icon to Job-Associated Candidate Sheet Header

## Change

In `src/components/candidates/CandidateProfileSheet.tsx`, add a **User icon button** between the candidate name and the LinkedIn icon that navigates to the candidate's independent profile.

**Current header structure (line ~911-925):**
```
Candidate Name. [LinkedIn icon]
```

**New header structure:**
```
Candidate Name. [User icon] [LinkedIn icon]
```

The User icon button (`lucide-react` `User` or `UserRound`) will:
- Navigate to `/candidates?openCandidate={candidateId}` using `useNavigate`
- Close the current sheet via `onOpenChange(false)`
- Have a tooltip: "View full candidate profile"
- Use the same `variant="outline" className="h-8 w-8 p-0"` styling as the LinkedIn button

## File

| File | Change |
|---|---|
| `src/components/candidates/CandidateProfileSheet.tsx` | Add `UserRound` import from lucide-react, add `useNavigate` import, insert a new icon button before the LinkedIn button at ~line 916 |

