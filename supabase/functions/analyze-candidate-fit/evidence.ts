// What a candidate wrote on this job's application form, as evidence for Gio
// Fit. Pure, so the browser tests can import it.

export interface ApplicationAnswerRow {
  field_name?: string | null;
  field_label?: string | null;
  field_value?: string | null;
  field_type?: string | null;
}

// Contact details, links, pay and place are read from the profile (pay and
// place with their own rules), and uploads have no text to read.
const SKIP_TYPES = new Set(["email", "url", "linkedin", "salary", "location", "audio", "video", "file", "phone"]);
const SKIP_NAME = /(^|_)(candidate_name|first_name|last_name|full_name|name|phone|email|linkedin|profile_summary)(_|$)|salary|compensation/i;
const SKIP_LABEL = /^(full name|first name|last name|phone( number)?|e-?mail|linkedin)\b|salary|compensation|what'?s your location/i;

const MAX_ANSWER = 1500;
const MAX_TOTAL = 6000;

const clean = (text: string) => text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** "Q: … → …" lines for the questions that say something about fit, or "" when there are none. */
export function applicationAnswersBlock(rows: ApplicationAnswerRow[] | null | undefined): string {
  const lines: string[] = [];
  let total = 0;
  for (const row of rows || []) {
    const type = String(row.field_type || "").toLowerCase();
    const label = clean(String(row.field_label || ""));
    let value = clean(String(row.field_value ?? ""));
    if (!label || !value || SKIP_TYPES.has(type)) continue;
    if (SKIP_NAME.test(String(row.field_name || "")) || SKIP_LABEL.test(label)) continue;
    if (value.startsWith("{") || value.startsWith("[{")) continue; // a stored object (place, upload), not prose
    if (type === "checkbox") value = value === "true" ? "Yes" : value === "false" ? "No" : value;
    value = value.slice(0, MAX_ANSWER);
    if (total + value.length > MAX_TOTAL) break;
    total += value.length;
    lines.push(`- Q: ${label.slice(0, 300)} → ${value}`);
  }
  return lines.length ? `APPLICATION ANSWERS (the candidate's own answers on this job's application form):\n${lines.join("\n")}` : "";
}
