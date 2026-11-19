// Employment type: one list for every screen and every server function
// (2026-11-18). A job, a job post, an offer, a scorecard question and an
// application question all offer these six, in this order, and show these
// labels. "Job type" was the same thing under another name and is gone.
//
// The stored values are the keys. `contract` reads "Contractor" (the value is
// kept so jobs and posts that hold it keep it), and `vendor` is new. Older
// spellings are read as the option they meant. Pure, so the browser imports it.

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contractor" },
  { value: "vendor", label: "External vendor" },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];

/** The options as a sentence, for hints and help text. */
export const EMPLOYMENT_TYPE_LIST = EMPLOYMENT_TYPES.map((t) => t.label).join(", ");

/** A short hint for pickers that describe the field. */
export const EMPLOYMENT_TYPE_HINT = "Full-time · part-time · contractor";

const KEYS = new Set<string>(EMPLOYMENT_TYPES.map((t) => t.value));

// How older rows and other systems spell them.
const ALIASES: Record<string, EmploymentType> = {
  fulltime: "full_time",
  parttime: "part_time",
  contractor: "contract",
  freelance: "contract",
  freelancer: "contract",
  independent_contractor: "contract",
  external_vendor: "vendor",
  temp: "temporary",
  intern: "internship",
};

/** The option a stored value means, or null when it is none of them. */
export function employmentTypeKey(value: unknown): EmploymentType | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return null;
  if (KEYS.has(key)) return key as EmploymentType;
  return ALIASES[key] ?? null;
}

/**
 * The words for a stored value: the option's label, or the value itself tidied
 * ("per_diem" → "Per diem") when it is none of the six. Null for nothing.
 */
export function employmentTypeLabel(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const key = employmentTypeKey(value);
  if (key) return EMPLOYMENT_TYPES.find((t) => t.value === key)!.label;
  const words = value.trim().replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Google's job data has no vendor type: a vendor engagement is a contractor's.
const GOOGLE: Record<EmploymentType, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  vendor: "CONTRACTOR",
  temporary: "TEMPORARY",
  internship: "INTERN",
};

/** schema.org employmentType for a stored value. */
export function googleEmploymentType(value: unknown): string | undefined {
  const key = employmentTypeKey(value);
  if (key) return GOOGLE[key];
  if (typeof value !== "string") return undefined;
  const other = value.trim().toLowerCase();
  if (other === "volunteer") return "VOLUNTEER";
  if (other === "other") return "OTHER";
  return undefined;
}

// Talent.com's <jobtype> and Juju's <type>.
const TALENT: Record<EmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  vendor: "Contract",
  temporary: "Temporary",
  internship: "Internship",
};
const JUJU: Record<EmploymentType, string> = {
  full_time: "fulltime",
  part_time: "parttime",
  contract: "contract",
  vendor: "contract",
  temporary: "contract",
  internship: "parttime",
};

export function talentJobType(value: unknown): string | null {
  const key = employmentTypeKey(value);
  return key ? TALENT[key] : null;
}

export function jujuJobType(value: unknown): string {
  const key = employmentTypeKey(value);
  return key ? JUJU[key] : "fulltime";
}
