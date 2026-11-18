// How Gio Fit's overall score is settled from the model's judgement. Pure, so
// the browser tests can import it.
//
// v5 (2026-11-17): a missing must-have is a deduction, not a ceiling. The old
// rule cut every candidate with two misses to exactly 70, so a 72 and an 85
// read the same. A must-have skill the résumé simply doesn't mention ("not
// shown yet") costs less than one the candidate clearly lacks, and comes back
// when an interview shows it.

import type { SkillEntry } from "./skills.ts";

export type MustStatus = "met" | "partial" | "not_met" | "unknown";

export interface MustHave {
  requirement: string;
  status: MustStatus;
  evidence: string | null;
  /** Set on a must-have that is one of the job's must-have skills. */
  from_skill?: boolean;
}

export const NOT_MET_POINTS = 8;
export const NOT_MET_MAX = 24;
export const NOT_SHOWN_POINTS = 3;
export const NOT_SHOWN_MAX = 9;

const MUST_STATUS = new Set<string>(["met", "partial", "not_met", "unknown"]);
const SKILL_TO_MUST: Record<SkillEntry["status"], MustStatus> = { evidenced: "met", partial: "partial", not_evidenced: "unknown" };

/**
 * The must-haves list: what the model read as mandatory in the description
 * (well-formed entries only, at most 8), then the job's must-have skills with
 * their skill verdict. A must-have skill nothing mentions is `unknown` ("not
 * shown yet"), never not_met: only explicit evidence makes a miss.
 */
export function buildMustHaves(returned: unknown, skills: SkillEntry[]): MustHave[] {
  const list: MustHave[] = (Array.isArray(returned) ? returned : [])
    .filter((m: any) => typeof m?.requirement === "string" && m.requirement.trim())
    .slice(0, 8)
    .map((m: any) => ({
      requirement: m.requirement.trim(),
      status: (MUST_STATUS.has(m.status) ? m.status : "unknown") as MustStatus,
      evidence: typeof m.evidence === "string" && m.evidence.trim() ? m.evidence.trim() : null,
    }));

  for (const entry of skills) {
    if (entry.priority !== "must") continue;
    const needle = entry.skill.toLowerCase();
    const covering = list.find((m) => m.requirement.toLowerCase().includes(needle));
    if (covering) {
      covering.from_skill = true;
      // The skill verdict quotes the candidate, so it settles an open must-have.
      if (covering.status === "unknown" && entry.status !== "not_evidenced") {
        covering.status = SKILL_TO_MUST[entry.status];
        covering.evidence = covering.evidence ?? entry.evidence;
      }
      continue;
    }
    if (list.length >= 12) continue;
    list.push({ requirement: `Skill: ${entry.skill}`, status: SKILL_TO_MUST[entry.status], evidence: entry.evidence, from_skill: true });
  }
  return list;
}

export interface SettleInput {
  modelScore: number;
  dimensions: { name?: string; score?: number | null; weight?: number }[];
  mustHaves: MustHave[];
  skills: SkillEntry[];
  tenureFlag: string;
}

export interface Settled {
  overall: number;
  modelScore: number;
  weightedMean: number | null;
  rules: string[];
  notMet: number;
  notShown: number;
  deduction: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function settleScore(input: SettleInput): Settled {
  const dims = input.dimensions || [];
  let totalWeight = 0, weightedSum = 0;
  for (const dim of dims) {
    if (typeof dim.score === "number") { totalWeight += dim.weight || 0; weightedSum += dim.score * (dim.weight || 0); }
  }
  const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : null;
  const modelScore = Math.max(0, Math.min(100, Math.round(Number(input.modelScore) || 0)));

  const rules: string[] = [];
  let overall = modelScore;
  const cap = (limit: number, why: string) => { if (overall > limit) { overall = limit; rules.push(why); } };

  // Ceilings first.
  if (weightedMean != null) cap(Math.round(weightedMean + 10), `Held within 10 points of the dimension mean (${weightedMean.toFixed(0)}).`);
  for (const dim of dims) {
    if (/location|salary|language/i.test(dim.name || "") && typeof dim.score === "number" && dim.score <= 30) {
      cap(55, `${dim.name} is a dealbreaker at ${dim.score}; capped at 55.`);
    }
  }
  const met = input.mustHaves.filter((m) => m.status === "met").length;
  const evidenced = input.skills.filter((s) => s.status === "evidenced").length;
  // A must-have skill that is met is one match, not two.
  const metSkills = input.mustHaves.filter((m) => m.status === "met" && m.from_skill).length;
  const strongMatches = met + evidenced - Math.min(metSkills, evidenced);
  if (strongMatches < 3) cap(80, `Above 80 needs three strong matches: must-haves met plus skills evidenced (${strongMatches} found).`);
  if (input.tenureFlag === "red") cap(69, `Job-hopping pattern; capped at 69.`);

  // Then what the must-haves cost.
  const notMet = input.mustHaves.filter((m) => m.status === "not_met").length;
  const notShown = input.mustHaves.filter((m) => m.status === "unknown" && m.from_skill).length;
  const notMetCost = Math.min(NOT_MET_MAX, notMet * NOT_MET_POINTS);
  const notShownCost = Math.min(NOT_SHOWN_MAX, notShown * NOT_SHOWN_POINTS);
  if (notMetCost) rules.push(`${plural(notMet, "must-have", "must-haves")} not met: ${notMetCost} points off.`);
  if (notShownCost) rules.push(`${plural(notShown, "must-have skill", "must-have skills")} not shown yet: ${notShownCost} points off.`);
  const deduction = notMetCost + notShownCost;
  overall = Math.max(0, overall - deduction);

  return { overall, modelScore, weightedMean, rules, notMet, notShown, deduction };
}

// ── What a re-score was caused by ─────────────────────────────────────────────

export type FitCause = "first" | "scorecard" | "application" | "profile" | "job" | "recipe" | "refresh" | "recheck";

/** Fingerprints of what an assessment read, kept with it so the next one can say what moved. */
export interface FitInputs { job: string; profile: string; scorecards: string; answers: string }

/**
 * Why this assessment ran, from what changed since the stored one. Interview
 * evidence is named first: it is what a recruiter is watching for.
 */
export function causeOf(
  previous: { inputs?: Partial<FitInputs> | null; version?: number | null } | null,
  current: FitInputs,
  version: number,
  forced: boolean,
): FitCause {
  if (!previous) return "first";
  if (previous.version !== version || !previous.inputs) return "recipe";
  const was = previous.inputs;
  if (was.scorecards !== current.scorecards) return "scorecard";
  if (was.answers !== current.answers) return "application";
  if (was.profile !== current.profile) return "profile";
  if (was.job !== current.job) return "job";
  return forced ? "refresh" : "recheck";
}
