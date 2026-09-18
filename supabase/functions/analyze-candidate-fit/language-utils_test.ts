import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { invariantSnapshot, mergeTranslatedProse } from "./language-utils.ts";

Deno.test("language rewriting cannot alter Gio Fit scoring invariants", () => {
  const canonical = {
    overall_score: 78,
    confidence: "high",
    confidence_reason: "Evidence is consistent.",
    executive_summary: "Strong signal and a risk.",
    dimensions: [{ name: "Skills Alignment", score: 82, weight: 30, insight: "English", matches: ["Match"], gaps: ["Gap"] }],
    validation_points: [{ question: "Question?", reason: "Reason", suggested_stage: "Phone Screen", priority: "high" }],
    data_sources_used: ["resume"],
    data_sources_missing: ["salary"],
    detected_languages: { summary: "Spanish", confidence: "high", sources: [{ label: "Résumé", code: "es", name: "Spanish" }] },
  };
  const translatedAttempt = {
    overall_score: 12,
    confidence: "low",
    confidence_reason: "La evidencia es coherente.",
    executive_summary: "Señal fuerte y un riesgo.",
    dimensions: [{ name: "Alineación", score: 10, weight: 99, insight: "Español", matches: ["Coincidencia"], gaps: ["Brecha"] }],
    validation_points: [{ question: "¿Pregunta?", reason: "Razón", suggested_stage: "Entrevista", priority: "low" }],
    data_sources_used: [],
    data_sources_missing: [],
    detected_languages: { summary: "English", confidence: "low", sources: [] },
  };

  const rewritten = mergeTranslatedProse(canonical, translatedAttempt);
  assertEquals(invariantSnapshot(rewritten), invariantSnapshot(canonical));
  assertEquals(rewritten.executive_summary, translatedAttempt.executive_summary);
  assertEquals(rewritten.dimensions[0].insight, translatedAttempt.dimensions[0].insight);
  assertEquals(rewritten.validation_points[0].question, translatedAttempt.validation_points[0].question);
});