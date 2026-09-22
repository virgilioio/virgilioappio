# Salary expectations — capture, conversion and fair judgement

## What I found

Three separate problems, all confirmed against the live data and code.

**1. The scorecard does write salary to the profile — but silently, and it sometimes fails.**
Of 180 scorecard salary answers, 171 landed on the candidate's profile. 9 did not: 5 candidates have no salary at all (Scott Barclay, Shantal Pulido, Jorge Fernandez Andraca, Xochitl Ramirez, Alan Yañez) and 4 hold a stale figure from an earlier answer. The write happens after the scorecard is saved with no error check at all, so when it fails nobody hears about it. It also only runs on the interview-scorecard save path.

**2. Currency and period are never reconciled.** The scorecard stores the answer with whatever currency and period the question was configured for — many are Mexican pesos per month — and the fit analysis hands that to the model verbatim next to a job band in US dollars per year. Comparing 100,000 MXN/month against 100,000–120,000 USD/year is meaningless, and that alone can sink or inflate the Salary alignment dimension.

**3. The rule itself only looks upward.** Today's instruction: no penalty if the expectation is inside the band or within 25% above the top; flag only when it exceeds the top by more than 25%. Nothing describes a candidate asking *below* the band, so the model improvises — which is why an 80,000 ask on a 100,000–120,000 band reads as a concern instead of good news.

## What I'll change

**Capture, made reliable**
- The profile write becomes a checked step: on failure the person saving sees a clear message ("Salary expectation saved on the scorecard but not on the profile") rather than silence, and it is retried once.
- It runs wherever a salary smart field is answered, including scorecards created from a transcript and later edits, and it only overwrites the profile when the answer actually differs.
- The value is stored with its own currency and period, exactly as answered — no conversion at capture time.
- Backfill: all nine records are updated to match their most recent scorecard answer (your choice), including the four that currently hold a different figure. I'll list what changed.

**Comparison, normalised**
- Before the fit analysis runs, the candidate's expectation is converted into the job's currency and period using the existing exchange-rate table, and the model receives both figures on the same basis plus a note of the original ("candidate asked 1,800,000 MXN/year, equal to about 92,000 USD/year at today's rate").
- Where no rate exists for the pair, the Salary alignment dimension is left blank instead of scored — the same treatment already used when salary is missing entirely.

**Judgement, symmetrical**
Written into the analysis instructions, on the normalised figures, for a band of *min* to *max*:

| Where the ask sits | How it reads |
| --- | --- |
| Inside the band | Aligned |
| Up to 25% above max | Negotiable, no penalty |
| More than 25% above max | Mismatch — above budget |
| Up to 25% below min | **Positive** — comes in under budget, headroom on the offer |
| More than 25% below min | Negative signal — worth understanding why; may point to a different market or industry, or to someone who doesn't yet know what the role pays |

On your 100,000–120,000 example: 90,000 and 80,000 both read as good, 75,000 sits at the edge, 70,000 and 60,000 raise the flag — and the flag is phrased as something to ask about, never as a disqualification.

**Existing dossiers** keep their current Salary alignment reading until they are re-scored; scores are not recalculated automatically (your standing rule). Anyone re-scoring picks up the new logic immediately.

## Technical notes

- `ScorecardSheet.handleSave` — salary/phone/linkedin/location sync moves into one awaited, error-handled helper with a toast on failure; skip the write when the parsed amount and currency/period already match the profile.
- New `supabase/functions/_shared/salary.ts` holding `loadCurrencyRates`, `convertCurrency` and `toPeriod`, extracted from `_shared/jobBriefing/snapshot.ts` (which keeps working through the shared module — no behaviour change there).
- `analyze-candidate-fit/index.ts`: build the salary block from the normalised figure, add the original as provenance, extend `dataMissing` with a `salary_uncomparable` case that nulls the dimension, and replace the two salary paragraphs (anti-hallucination rule 6 and the Salary Alignment dimension line) with the table above.
- Backfill via a one-off data update (not a migration): set `candidates.salary_amount/currency/period` from the latest `scorecard_question_responses` row joined through `scorecard_interview_questions.answer_type = 'salary_expectations'` for those nine candidates.
- No schema changes, no new tables, no dossier schema migrations.
