

# AI Candidate-Job Fit Insights

## Overview

Deep, evolving AI analysis that compares a candidate's full profile against job requirements. Produces structured, non-generic scoring with actionable validation points. Uses the existing OpenAI integration (`OPENAI_API_KEY` + `gpt-4o-mini`) -- consistent with all other AI features in the platform.

---

## Architecture

```text
Candidate Profile                    Job Details
(resume, skills, experience,         (description, title, skills,
 salary, location, work history)      salary range, location, department)
              \                          /
               v                        v
        [Edge Function: analyze-candidate-fit]
               |
               v
        OpenAI gpt-4o-mini (tool calling for structured output)
               |
               v
        Stored in job_candidate_associations (JSONB)
               |
               v
        "Insights" tab in CandidateProfileSheet (right column)
```

---

## Phase 1: Database Schema

Add columns to `job_candidate_associations`:

| Column | Type | Purpose |
|--------|------|---------|
| `ai_fit_score` | `integer` | Overall score 0-100 |
| `ai_fit_analysis` | `jsonb` | Full structured analysis |
| `ai_fit_confidence` | `text` | low / medium / high |
| `ai_fit_generated_at` | `timestamptz` | When last computed |
| `ai_fit_version` | `integer` | Tracks re-computations |

---

## Phase 2: Edge Function -- `analyze-candidate-fit`

Uses the existing `OPENAI_API_KEY` and `gpt-4o-mini` (same as parse-resume, generate-scorecard, etc.).

**Server-side data fetching** (single function, no client-side prompt logic):
- Candidate: name, role, company, skills, profile_summary, salary, location, work experience, education, resume text (from attachments)
- Job: title, description, skills, salary range, location, department
- Scorecards: any submitted scorecards for this candidate+job pair

**Structured output via tool calling** -- the AI returns:

```text
{
  overall_score: 72,
  confidence: "medium",
  confidence_reason: "Missing salary data and no work history details",
  executive_summary: "Strong frontend candidate with relevant LATAM experience...",
  dimensions: [
    { name: "Skills Alignment", score: 85, weight: 30,
      matches: ["React", "TypeScript"], gaps: ["Kubernetes"],
      insight: "Strong frontend skills match. Missing infrastructure requirements." },
    { name: "Experience Level", score: 70, weight: 20,
      insight: "5 years aligns with the 4-7 year requirement." },
    { name: "Role & Title Fit", score: 60, weight: 15, ... },
    { name: "Location Compatibility", score: 100, weight: 10, ... },
    { name: "Salary Alignment", score: null, weight: 10, insight: null },
    { name: "Company Pedigree", score: 75, weight: 10, ... },
    { name: "Language & Communication", score: 90, weight: 5, ... }
  ],
  validation_points: [
    { question: "Does the candidate have Kubernetes experience?",
      reason: "JD lists it as required but not in resume",
      priority: "high", suggested_stage: "Technical Interview" },
    { question: "What are their salary expectations?",
      reason: "No salary information available",
      priority: "high", suggested_stage: "Phone Screen" }
  ],
  data_sources_used: ["resume", "skills", "work_experience"],
  data_sources_missing: ["salary", "education"]
}
```

Key AI prompt rules:
- Never produce generic statements -- always reference specific data points
- Return `null` for dimensions where data is insufficient
- Flag unknowns explicitly as validation points
- Understand company pedigree, tools, seniority, languages, etc.

---

## Phase 3: Automatic Re-triggering

The insights refresh automatically when meaningful data changes. No manual refresh needed (though a manual button will exist as fallback).

**Trigger points (frontend-driven):**

| Event | Where it happens | How it triggers |
|-------|-----------------|-----------------|
| Candidate associated to job | Pipeline actions | Call edge function after association created |
| Candidate profile edited | CandidateFormSheet `onSave` | Call edge function after save completes |
| Resume uploaded/replaced | CandidateAttachments | Call edge function after upload + parse completes |
| Scorecard submitted | ScorecardSheet `onSave` | Call edge function after scorecard saved |
| Skills regenerated | Skills generation flow | Call edge function after skills updated |

Implementation: A shared `triggerFitAnalysis(candidateId, jobId)` utility function that calls the edge function. Each trigger point calls this after its own operation succeeds. The hook `useCandidateFitInsights` will use React Query with a `queryKey` that gets invalidated after each re-analysis.

---

## Phase 4: "No Job Description" Guardrail

If the job has no description (or a very short one), the Insights tab shows an **informational card** instead of incomplete results:

```text
+------------------------------------------+
|  Sparkles icon                           |
|  "Add a Job Description for AI Insights" |
|                                          |
|  For accurate candidate matching, add a  |
|  job description in Job Setup with       |
|  requirements, skills, and expectations. |
|                                          |
|  [Go to Job Setup]                       |
+------------------------------------------+
```

The button links to the job's setup/edit page. This avoids generating misleading scores from insufficient job data.

---

## Phase 5: UI -- "Insights" Tab

Add to the right-column tab navigation in `CandidateProfileSheet`:

**Current:** Feed | Notes | Emails | Reminders
**New:** Feed | Notes | Emails | Reminders | **Insights**

Icon: `Sparkles` (already imported in the file)

### Tab Content Layout

**1. Score Header**
- Large circular/radial score (0-100) with color coding
- Confidence badge (low/medium/high) with tooltip explaining why
- "Last updated X minutes ago" timestamp
- Manual "Refresh" button (re-triggers edge function)

**2. Executive Summary**
- 1-2 sentence AI-generated summary -- specific to THIS candidate + THIS job
- Not generic. References actual data points.

**3. Dimension Cards** (collapsible)
- Each dimension: score bar, matches (green badges), gaps (orange badges), insight text
- Dimensions with `null` scores show "Data needed" with what's missing
- 7 dimensions: Skills, Experience, Role/Title, Location, Salary, Company Pedigree, Languages

**4. Validation Checklist**
- Actionable questions for recruiters to investigate
- Each shows: question, reason, priority (high/medium/low), suggested interview stage
- Recruiters can mark items as "Validated" or "Flagged" (persisted in the JSONB)

**5. Data Completeness**
- Shows which data sources were used vs. missing
- Encourages team to gather more info for better accuracy

---

## Files

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/analyze-candidate-fit/index.ts` | Edge function (OpenAI, tool calling, structured output) |
| `src/hooks/useCandidateFitInsights.ts` | React Query hook for fetching + refreshing insights |
| `src/utils/triggerFitAnalysis.ts` | Shared utility to call the edge function |
| `src/components/candidates/insights/CandidateInsightsTab.tsx` | Main Insights tab container |
| `src/components/candidates/insights/FitScoreRadial.tsx` | Circular score display |
| `src/components/candidates/insights/FitDimensionCard.tsx` | Individual dimension card |
| `src/components/candidates/insights/ValidationChecklist.tsx` | Validation points checklist |
| `src/components/candidates/insights/NoJobDescriptionCard.tsx` | "Add JD" prompt card |
| Migration SQL | Add columns to `job_candidate_associations` |

### Modified Files

| File | Change |
|------|--------|
| `src/components/candidates/CandidateProfileSheet.tsx` | Add "Insights" tab to right column, render `CandidateInsightsTab`, wire auto-triggers after edits/uploads/scorecards |
| `src/components/candidates/CandidateFormSheet.tsx` (or equivalent) | Call `triggerFitAnalysis` after candidate profile save |
| `src/hooks/useCandidateAttachments.ts` | Call `triggerFitAnalysis` after resume upload completes |
| `src/components/candidates/ScorecardSheet.tsx` | Call `triggerFitAnalysis` after scorecard save |
| `supabase/config.toml` | Register new edge function |

---

## What This Replaces

The existing `candidateFitScoring.ts` (client-side heuristic scoring used in Apollo sourcing previews) remains unchanged -- it serves a different purpose (quick pre-enrichment signals during sourcing). This new system is the deep, post-association analysis with real AI understanding.
