// Per-skill verdicts: the job's list is authoritative, and what the model sends
// back is matched to it by name. Pure, so the browser tests can import it.
//
// 2026-11-17: the list used to be sent as `1. Skill [must-have]` and matched by
// exact name, so a verdict returned as "Skill [must-have]" (or one skill split
// into its alternatives) was thrown away and every skill read "not evidenced".

export type SkillPriority = "must" | "nice" | "bonus";
export type SkillStatus = "evidenced" | "partial" | "not_evidenced";

export interface SkillEntry {
  skill: string;
  status: SkillStatus;
  evidence: string | null;
  source: string | null;
  priority: SkillPriority;
  /** False when the model sent no verdict for this skill: unknown, not a miss. Absent when it did. */
  judged?: false;
}

/** What came back, as it came: for the log when verdicts go missing. Skill names only. */
export interface SkillRaw {
  kind: "array" | "string" | "object" | "missing";
  count: number;
  /** `name=status` (+q when it quoted evidence), as the model wrote the name. */
  sample: string[];
}

export interface SkillReconcile {
  entries: SkillEntry[];
  /** Names the model sent that matched nothing on the job's list. */
  unmatched: string[];
  /** Job skills no returned entry could be matched to. */
  missing: string[];
  /** Verdicts that claimed evidence without quoting any. */
  unquoted: number;
  raw: SkillRaw;
}

const PRIORITY_LABEL: Record<SkillPriority, string> = { must: "must-have", nice: "nice-to-have", bonus: "extra" };
const RANK: Record<SkillStatus, number> = { evidenced: 2, partial: 1, not_evidenced: 0 };
const VALID = new Set<string>(["evidenced", "partial", "not_evidenced"]);
const LABEL_WORDS = "must[- ]?have|nice[- ]?to[- ]?have|extra|bonus|required|optional|priority";

/** A skill name as it is compared: no number, quotes, priority tag, case or extra spaces. */
export function skillKey(name: unknown): string {
  let s = String(name ?? "").normalize("NFKC").toLowerCase().trim();
  s = s.replace(/^\s*(?:\d+\s*[.):-]|[-*•])\s*/, "");
  // Trailing tags: [must-have], (priority: must-have), — must-have, : nice-to-have
  for (let i = 0; i < 3; i++) {
    s = s
      .replace(new RegExp(`\\s*[\\[(][^\\])]*(?:${LABEL_WORDS})[^\\])]*[\\])]\\s*$`), "")
      .replace(new RegExp(`\\s*[—–:|-]\\s*(?:priority\\s*:?\\s*)?(?:${LABEL_WORDS})\\s*$`), "");
  }
  s = s.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "");
  return s.replace(/\s+/g, " ").trim();
}

/** The sides of a skill written as alternatives: "A or B", "A / B". */
export function skillAlternatives(key: string): string[] {
  const parts = key.split(/\s+or\s+|\s*\/\s*/).map((p) => p.trim()).filter((p) => p.length >= 2);
  return parts.length > 1 ? parts : [];
}

/** The lines the model reads. The name sits alone in quotes so it can be copied cleanly. */
export function skillListBlock(skills: string[], priorityOf: (skill: string) => SkillPriority): string {
  if (!skills.length) return "";
  const lines = skills.map((skill, index) => `${index + 1}. "${skill}" (priority: ${PRIORITY_LABEL[priorityOf(skill)]})`);
  return [
    `SKILLS TO CHECK: return exactly one skill_evidence entry for each numbered line, in this order. In "skill" copy only the name between the quotation marks, with no number and no priority. A name written as alternatives ("A or B") is ONE entry, evidenced when either side is shown.`,
    ...lines,
    `A must-have skill the candidate data explicitly shows they lack also goes in must_haves as not_met, with the evidence. A must-have skill that is simply not mentioned is not_evidenced here and nothing more. A nice-to-have skill is part of the skills match. An extra skill lifts the score when evidenced and is never a gap.`,
  ].join("\n");
}

interface Cleaned { key: string; raw: string; status: SkillStatus; evidence: string | null; source: string | null; used: boolean }

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * The list of verdicts, whatever shape it arrived in: an array, the same array
 * as a JSON string, an object wrapping the array, or an object keyed by skill.
 */
export function verdictList(returned: unknown): { list: any[]; kind: SkillRaw["kind"] } {
  if (Array.isArray(returned)) return { list: returned, kind: "array" };
  if (typeof returned === "string" && returned.trim()) {
    try {
      const inner = verdictList(JSON.parse(returned));
      return { list: inner.list, kind: "string" };
    } catch { return { list: [], kind: "string" }; }
  }
  if (returned && typeof returned === "object") {
    const record = returned as Record<string, unknown>;
    for (const key of ["skill_evidence", "skills", "items", "entries"]) {
      if (Array.isArray(record[key])) return { list: record[key] as any[], kind: "object" };
    }
    const list = Object.entries(record)
      .filter(([, value]) => value && typeof value === "object")
      .map(([skill, value]) => ({ skill, ...(value as object) }));
    return { list, kind: "object" };
  }
  return { list: [], kind: "missing" };
}

/** The skill's name, under whichever key the model used for it. */
const nameOf = (entry: any): string => text(entry?.skill) || text(entry?.name) || text(entry?.skill_name) || text(entry?.requirement);

/**
 * Exactly one entry per job skill, in the job's order and spelling. A returned
 * entry is matched by its cleaned name, then as one side of an alternative,
 * then by position when the model kept the list's length. Evidence is
 * mandatory: a verdict that quotes nothing is not_evidenced.
 */
export function reconcileSkillEvidence(
  skills: string[],
  returned: unknown,
  priorityOf: (skill: string) => SkillPriority,
): SkillReconcile {
  let unquoted = 0;
  const { list, kind } = verdictList(returned);
  const raw: SkillRaw = {
    kind,
    count: list.length,
    sample: list.slice(0, 20).map((entry: any) => `${nameOf(entry).slice(0, 60) || "(no name)"}=${text(entry?.status) || "(no status)"}${text(entry?.evidence) || text(entry?.quote) ? "+q" : ""}`),
  };
  const cleaned: Cleaned[] = list
    .map((entry: any) => {
      const raw = nameOf(entry);
      const evidence = text(entry?.evidence) || text(entry?.quote) || null;
      const source = text(entry?.source) || null;
      let status: SkillStatus = VALID.has(entry?.status) ? entry.status : "not_evidenced";
      if (status !== "not_evidenced" && !evidence) { status = "not_evidenced"; unquoted++; }
      return { key: skillKey(raw), raw, status, evidence: status === "not_evidenced" ? null : evidence, source: status === "not_evidenced" ? null : source, used: false };
    })
    .filter((entry) => entry.key.length > 0);

  const best = (hits: Cleaned[]): Cleaned | null => {
    let top: Cleaned | null = null;
    for (const hit of hits) if (!top || RANK[hit.status] > RANK[top.status]) top = hit;
    return top;
  };
  const take = (hits: Cleaned[]): Cleaned | null => {
    for (const hit of hits) hit.used = true;
    return best(hits);
  };

  const keys = skills.map(skillKey);
  const found: (Cleaned | null)[] = keys.map(() => null);

  // 1. The same name.
  keys.forEach((key, index) => {
    const hits = cleaned.filter((entry) => !entry.used && entry.key === key);
    if (hits.length) found[index] = take(hits);
  });
  // 2. One side of "A or B", or the model's name wrapped around the job's.
  keys.forEach((key, index) => {
    if (found[index]) return;
    const sides = skillAlternatives(key);
    const hits = cleaned.filter((entry) => !entry.used && (
      sides.includes(entry.key) ||
      (key.length >= 4 && entry.key.includes(key)) ||
      (entry.key.length >= 4 && key.includes(entry.key) && sides.length > 0)
    ));
    if (hits.length) found[index] = take(hits);
  });
  // 3. Same length, same order: what is left over at its own position.
  if (cleaned.length === skills.length) {
    keys.forEach((_, index) => {
      if (!found[index] && !cleaned[index].used) found[index] = take([cleaned[index]]);
    });
  }

  const entries: SkillEntry[] = skills.map((skill, index) => {
    const hit = found[index];
    const priority = priorityOf(skill);
    // No verdict at all is not a verdict of "not evidenced": it must never cost points.
    if (!hit) return { skill, status: "not_evidenced", evidence: null, source: null, priority, judged: false };
    if (hit.status === "not_evidenced") return { skill, status: "not_evidenced", evidence: null, source: null, priority };
    return { skill, status: hit.status, evidence: hit.evidence, source: hit.source, priority };
  });

  return {
    entries,
    unmatched: cleaned.filter((entry) => !entry.used).map((entry) => entry.raw),
    missing: skills.filter((_, index) => !found[index]),
    unquoted,
    raw,
  };
}
