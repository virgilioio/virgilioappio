// The balance of a job's skills by tier, enforced on whatever the model returns
// (generate-job-skills): about 3-4 must-have, 5 nice-to-have and 3 extra-points
// skills, within 2-5, 4-6 and 2-4. Each unmet must-have caps a candidate's Gio Fit
// score, so overflow moves down a tier rather than tightening the ruler.
//
// A skill is a CV signal (Allan, 2026-10-20): the work the role does, its domain,
// tools, certifications. Traits, location, years and contract type are never
// skills: a CV can't prove a trait, and the others have their own Gio Fit
// dimensions. notASkill() catches what the model lets through; balance() moves it
// to leftOut so the preview can say what was left for the interview.

export const LIMITS = { must: [2, 5], nice: [4, 6], extra: [2, 4] } as const;
export type Tier = keyof typeof LIMITS;

export interface SkillSet {
  must: string[];
  nice: string[];
  extra: string[];
  leftOut: string[];
}

const SOFT = new Set([
  "communication", "communicator", "interpersonal", "teamwork", "team player", "collaboration",
  "collaborative", "self-starter", "self starter", "proactive", "proactivity", "autonomy",
  "autonomous", "independent", "independence", "charisma", "charismatic", "credibility",
  "ambition", "ambitious", "motivated", "motivation", "passion", "passionate", "problem solving",
  "problem-solving", "critical thinking", "attention to detail", "detail-oriented",
  "detail oriented", "adaptability", "adaptable", "flexibility", "resilience", "work ethic",
  "time management", "organization", "organisation", "organizational", "organisational",
  "empathy", "emotional intelligence", "positive attitude", "curiosity", "creativity",
  "leadership", "presence", "executive presence", "growth mindset", "ownership",
]);

const NOT_A_SKILL = [
  // traits and ways of working
  /\b(charisma|self[- ]start|proactiv|team player|work ethic|soft skills?|ambition|mindset)\b/i,
  /\b(remote work|work(s|ing)? (independently|remotely|alone))\b/i,
  // location, years, contract, availability: scored or set elsewhere
  // "Toronto based", never "Account-based Marketing"
  /(^|\s)(based|located|resident)(\s|$)|\brelocat\w*/i,
  /\b\d+\s*\+?\s*(?:(?:-|\u2013|to)\s*\d+\s*)?(years?|yrs)\b/i,
  /\b(freelance|contractor|full[- ]time|part[- ]time|work permit|right to work)\b/i,
];

/** A trait, a place, a number of years or a contract type rather than a CV skill. */
export function notASkill(skill: string): boolean {
  const k = skill.toLowerCase().replace(/\s+(skills?|abilit(y|ies))$/, "").trim();
  if (SOFT.has(k)) return true;
  return NOT_A_SKILL.some((re) => re.test(skill));
}

function clean(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").replace(/^(?:[-*]\s*|\d{1,2}[.)]\s+)/, "").trim();
  if (!t || t.length > 40) return null;
  return t;
}

/** Dedupe across tiers (the higher tier wins), set aside non-skills, cap each tier, push overflow down. */
export function balance(raw: Partial<Record<Tier | "left_out", unknown>>): SkillSet {
  const seen = new Set<string>();
  const leftOut: string[] = [];
  const take = (list: unknown): string[] => {
    const out: string[] = [];
    for (const item of Array.isArray(list) ? list : []) {
      const c = clean(item);
      if (!c) continue;
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      if (notASkill(c)) leftOut.push(c);
      else out.push(c);
    }
    return out;
  };
  const must = take(raw.must);
  const nice = take(raw.nice);
  const extra = take(raw.extra);
  for (const item of Array.isArray(raw.left_out) ? raw.left_out : []) {
    const c = typeof item === "string" ? item.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    if (c && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      leftOut.push(c);
    }
  }
  // Too many must-haves make scoring too strict: the overflow becomes nice-to-have.
  while (must.length > LIMITS.must[1]) nice.unshift(must.pop()!);
  while (nice.length > LIMITS.nice[1]) extra.unshift(nice.pop()!);
  extra.splice(LIMITS.extra[1]);
  return { must, nice, extra, leftOut: leftOut.slice(0, 8) };
}

/** Years of experience the model read from the documents, or null. */
export function yearsRange(min: unknown, max: unknown): { min: number | null; max: number | null } | null {
  const n = (v: unknown) => {
    const x = typeof v === "string" ? Number(v) : v;
    return typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 40 ? x : null;
  };
  let lo = n(min);
  let hi = n(max);
  if (lo != null && hi != null && hi < lo) [lo, hi] = [hi, lo];
  return lo == null && hi == null ? null : { min: lo, max: hi };
}
