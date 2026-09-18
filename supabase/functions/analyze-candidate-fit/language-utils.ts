export type FitAnalysisRecord = Record<string, any>

export function mergeTranslatedProse(canonical: FitAnalysisRecord, translated: FitAnalysisRecord) {
  return {
    ...canonical,
    confidence_reason: translated.confidence_reason ?? canonical.confidence_reason,
    profile_summary: translated.profile_summary ?? canonical.profile_summary,
    executive_summary: translated.executive_summary ?? canonical.executive_summary,
    dimensions: (canonical.dimensions || []).map((dimension: FitAnalysisRecord, index: number) => ({
      ...dimension,
      verdict: translated.dimensions?.[index]?.verdict ?? dimension.verdict,
      insight: translated.dimensions?.[index]?.insight ?? dimension.insight,
      matches: translated.dimensions?.[index]?.matches ?? dimension.matches,
      gaps: translated.dimensions?.[index]?.gaps ?? dimension.gaps,
    })),
    validation_points: (canonical.validation_points || []).map((point: FitAnalysisRecord, index: number) => ({
      ...point,
      question: translated.validation_points?.[index]?.question ?? point.question,
      reason: translated.validation_points?.[index]?.reason ?? point.reason,
      suggested_stage: translated.validation_points?.[index]?.suggested_stage ?? point.suggested_stage,
    })),
    // Only the quoted evidence is prose. `skill` keeps the job's spelling and
    // `status` / `source` are machine values, so they are never translated.
    skill_evidence: (canonical.skill_evidence || []).map((entry: FitAnalysisRecord, index: number) => ({
      ...entry,
      evidence: translated.skill_evidence?.[index]?.evidence ?? entry.evidence,
    })),
  }
}

export function invariantSnapshot(analysis: FitAnalysisRecord) {
  return JSON.stringify({
    overall_score: analysis.overall_score,
    confidence: analysis.confidence,
    dimensions: (analysis.dimensions || []).map((dimension: FitAnalysisRecord) => ({
      name: dimension.name,
      score: dimension.score,
      weight: dimension.weight,
    })),
    data_sources_used: analysis.data_sources_used,
    data_sources_missing: analysis.data_sources_missing,
    detected_languages: analysis.detected_languages,
    priorities: (analysis.validation_points || []).map((point: FitAnalysisRecord) => point.priority),
    skill_evidence: (analysis.skill_evidence || []).map((entry: FitAnalysisRecord) => ({
      skill: entry.skill,
      status: entry.status,
      source: entry.source,
    })),
  })
}