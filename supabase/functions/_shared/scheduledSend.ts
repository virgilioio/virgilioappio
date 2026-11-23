// What send-scheduled-emails hands to send-user-email, and how it records a
// failure (2026-11-23). Pure, so the browser's tests import it.
//
// A scheduled email's row keeps empty columns as null (a rejection has no
// interview stage, a bulk email may have no job). send-user-email takes those
// fields as "a value or left out", so anything empty is left out here: a null
// jhs_id refused every scheduled rejection from January to November.

export type ScheduledEmailRow = {
  from_email: string;
  to_emails: string[];
  subject: string;
  body_html: string | null;
  candidate_id?: string | null;
  job_id?: string | null;
  jhs_id?: string | null;
  association_id?: string | null;
};

const present = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** The body for send-user-email: only fields with a value. */
export function scheduledSendBody(email: ScheduledEmailRow, fromEmail: string = email.from_email) {
  const html = email.body_html ?? "";
  const body: Record<string, unknown> = {
    from_email: fromEmail,
    to: email.to_emails,
    subject: email.subject,
    body_html: html,
    body_text: html.replace(/<[^>]*>/g, ""),
  };
  for (const key of ["candidate_id", "job_id", "jhs_id", "association_id"] as const) {
    if (present(email[key])) body[key] = email[key];
  }
  return body;
}

const MAX_REASON = 300;

/**
 * Why a send failed, in a line for scheduled_emails.error_message: the reason
 * send-user-email gave (its `error`, and for a refused request the field it
 * refused), never just "non-2xx status code".
 */
export async function sendFailureReason(error: unknown): Promise<string> {
  const fallback = error instanceof Error && error.message ? error.message : "Unknown error";
  // supabase-js puts the function's Response on FunctionsHttpError.context.
  const res = (error as { context?: unknown } | null)?.context;
  let reason = fallback;
  if (res && typeof (res as Response).text === "function") {
    try {
      const status = (res as Response).status;
      const text = await (res as Response).clone().text();
      let parsed: { error?: unknown; details?: unknown } | null = null;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      const said = parsed && typeof parsed.error === "string" ? parsed.error : text.trim();
      const fields = Array.isArray(parsed?.details)
        ? (parsed!.details as Array<{ path?: unknown[]; message?: string }>)
            .map((d) => `${(d.path ?? []).join(".") || "body"}: ${d.message ?? "invalid"}`)
            .join("; ")
        : "";
      const head = status ? `send-user-email ${status}` : "send-user-email";
      const main = said && !said.startsWith("ZodError") && !said.startsWith("[") ? said : "refused the request";
      reason = [head, main, fields].filter(Boolean).join(" · ");
    } catch {
      reason = fallback;
    }
  }
  return reason.length > MAX_REASON ? reason.slice(0, MAX_REASON - 1) + "…" : reason;
}
