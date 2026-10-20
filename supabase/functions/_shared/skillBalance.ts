// The balance of a job's skills by tier, enforced on whatever the model returns
// (generate-job-skills): about 5 must-have, 5 nice-to-have and 3 extra-points
// skills, within 4-6, 4-6 and 2-4. Each unmet must-have caps a candidate's Gio Fit
// score, so overflow moves down a tier rather than tightening the ruler.

export const LIMITS = { must: [4, 6], nice: [4, 6], extra: [2, 4] } as const;
export type Tier = keyof typeof LIMITS;

export interface SkillSet {
  must: string[];
  nice: string[];
  extra: string[];
}

function clean(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").replace(/^[-*\d.)\s]+/, "").trim();
  if (!t || t.length > 40) return null;
  return t;
}

/** Dedupe across tiers (the higher tier wins), cap each tier, and push overflow down. */
export function balance(raw: Partial<Record<Tier, unknown>>): SkillSet {
  const seen = new Set<string>();
  const take = (list: unknown): string[] => {
    const out: string[] = [];
    for (const item of Array.isArray(list) ? list : []) {
      const c = clean(item);
      if (!c) continue;
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  };
  const must = take(raw.must);
  const nice = take(raw.nice);
  const extra = take(raw.extra);
  // Too many must-haves make scoring too strict: the overflow becomes nice-to-have.
  while (must.length > LIMITS.must[1]) nice.unshift(must.pop()!);
  while (nice.length > LIMITS.nice[1]) extra.unshift(nice.pop()!);
  extra.splice(LIMITS.extra[1]);
  return { must, nice, extra };
}

