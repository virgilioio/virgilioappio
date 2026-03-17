

# Reorder Navigation: Move "Candidates" Next to "Jobs"

## Overview
Move the "Candidates" nav item from its current position (after Pipeline) to right after "Jobs", achieving the final order: Home | Find | Jobs | **Candidates** | Pipeline | Analytics | Intelligence.

## Change

### `src/components/layout/Header.tsx` (lines 148-165)
Swap the order of the Jobs, Candidates, and Pipeline entries in the `navigationItems` array:

```ts
// Current order: Jobs → Pipeline → Candidates
// New order:     Jobs → Candidates → Pipeline
{
  href: '/jobs',
  icon: Briefcase,
  label: 'Jobs',
  show: canViewJobs,
},
{
  href: '/candidates',
  icon: Users,
  label: 'Candidates',
  show: canSeeRecruiterTools && canViewCandidatesNavigation,
},
{
  href: '/pipeline',
  icon: TrendingUp,
  label: 'Pipeline',
  show: canViewJobs,
},
```

Single file, single reorder — no logic changes.

