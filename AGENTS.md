
- Client pipeline links live at /cp/:token (not /p/, which serves legacy job-post links); the pipeline-public function delegates dossier rendering to dossier-public via an internal service-key call so there is one client-ready serializer.
- Gio Fit auto-generation is scoped to jobs with a live client pipeline view via fit_analysis_queue + process-fit-queue (wake-on-enqueue, bounded hops, no cron) — keeps AI cost limited to candidates clients will open.
- Public pipeline section payloads are allowlisted and serialized only by `pipeline-public`; anonymous users never read candidate, offer, or rejection tables directly — prevents PII and internal workflow leakage.
- Analytics dates hires/offers/rejections by hired_at/offered_at/rejected_at via `eventAt()` in src/lib/analyticsEventDates.ts, never updated_at — updated_at moves on any edit.
- Pipeline hygiene metrics are current snapshots from usePipelineAgingMetrics (stage entry = latest of entered_stage_at / last stage-history move, else date added, flagged estimated) and ignore the date range — keeps 'time in stage' honest.
- Analytics reads of potentially large tables go through fetchAll/fetchAllIn in src/lib/fetchAllRows.ts — the API caps responses at 1,000 rows, which silently undercounted widgets.
