// Shared loaders + senders for reference-check emails. Used by
// send-reference-request, reference-public and reference-reminders so all three
// resolve wording from the exact same place: the request's template_snapshot.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  estimatedMinutes,
  sendReferenceEmail,
  type AgencyBrand,
  type RefEmailTemplate,
} from "./referenceEmail.ts";
import {
  issueReferenceToken,
  logReferenceActivity,
} from "./referenceTokens.ts";
import { renderCandidateReferenceEmail } from "./candidateReferenceEmail.ts";
import { renderRefereeReferenceEmail } from "./refereeReferenceEmail.ts";

export interface RequestContext {
  request: Record<string, any>;
  snapshot: Record<string, any>;
  brand: AgencyBrand;
  candidateName: string;
  candidateFirstName: string;
  candidateEmail: string | null;
  jobTitle: string;
  clientName: string;
  recruiterName: string;
  recruiterTitle: string | null;
  recruiterEmail: string | null;
  refereeCount: number;
}

export async function loadRequestContext(
  supabase: SupabaseClient,
  requestId: string,
): Promise<RequestContext | null> {
  const { data: request } = await supabase
    .from("reference_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return null;

  const snapshot = (request.template_snapshot ?? {}) as Record<string, any>;

  const [{ data: candidate }, { data: tenant }, { data: careers }] = await Promise.all([
    supabase
      .from("candidates")
      .select("candidate_name, email")
      .eq("id", request.candidate_id)
      .maybeSingle(),
    supabase.from("tenants").select("name").eq("id", request.tenant_id).maybeSingle(),
    supabase
      .from("careers_page_settings")
      .select("logo_url")
      .eq("tenant_id", request.tenant_id)
      .maybeSingle(),
  ]);

  let jobTitle = "";
  if (request.job_id) {
    const { data: job } = await supabase
      .from("jobs")
      .select("title")
      .eq("id", request.job_id)
      .maybeSingle();
    jobTitle = job?.title ?? "";
  }

  let clientName = "";
  if (request.client_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", request.client_id)
      .maybeSingle();
    clientName = org?.name ?? "";
  }

  let recruiterName = tenant?.name ?? "";
  let recruiterTitle: string | null = null;
  let recruiterEmail: string | null = null;
  if (request.requested_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, title")
      .eq("id", request.requested_by)
      .maybeSingle();
    const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    if (full) recruiterName = full;
    recruiterEmail = profile?.email ?? null;
    recruiterTitle = profile?.title ?? null;
  }

  const candidateName = candidate?.candidate_name ?? "";
  const agencyName = tenant?.name || "References";

  return {
    request,
    snapshot,
    brand: { name: agencyName, logoUrl: careers?.logo_url ?? null },
    candidateName,
    candidateFirstName: candidateName.split(" ")[0] || candidateName,
    candidateEmail: candidate?.email ?? null,
    jobTitle,
    clientName: clientName || agencyName,
    recruiterName,
    recruiterTitle,
    recruiterEmail,
    refereeCount: request.min_referees_override ?? snapshot.min_referees ?? 2,
  };
}

function candidateTemplate(snapshot: Record<string, any>): RefEmailTemplate | null {
  const t = snapshot.candidate_email;
  return t?.subject && t?.body ? t : null;
}

function refereeTemplate(snapshot: Record<string, any>): RefEmailTemplate | null {
  const t = snapshot.referee_email;
  return t?.subject && t?.body ? t : null;
}

/** Mint (or re-use) the candidate link and email it. Returns the expiry ISO. */
export async function sendCandidateEmail(
  supabase: SupabaseClient,
  ctx: RequestContext,
  opts: { rotate?: boolean; isReminder?: boolean } = {},
): Promise<{ expiresAt: string; link: string }> {
  const tpl = candidateTemplate(ctx.snapshot);
  if (!tpl) throw new Error("This template has no candidate email");
  if (!ctx.candidateEmail) throw new Error("This candidate has no email address");

  const days = Number(ctx.snapshot.candidate_link_days) || 7;
  let expiresAt = ctx.request.candidate_link_expires_at as string | null;
  let link: string;

  if (opts.rotate || !ctx.request.candidate_token_hash || !expiresAt) {
    const issued = await issueReferenceToken({
      kind: "candidate",
      tenantId: ctx.request.tenant_id,
      requestId: ctx.request.id,
      subjectId: ctx.request.candidate_id,
      expiresInDays: days,
    });
    await supabase
      .from("reference_requests")
      .update({
        candidate_token_hash: issued.tokenHash,
        candidate_link_expires_at: issued.expiresAt,
      })
      .eq("id", ctx.request.id);
    expiresAt = issued.expiresAt;
    link = issued.url;
    ctx.request.candidate_token_hash = issued.tokenHash;
    ctx.request.candidate_link_expires_at = issued.expiresAt;
  } else {
    // We only ever stored the hash, so a resend always needs a fresh token.
    const issued = await issueReferenceToken({
      kind: "candidate",
      tenantId: ctx.request.tenant_id,
      requestId: ctx.request.id,
      subjectId: ctx.request.candidate_id,
      expiresInDays: days,
    });
    await supabase
      .from("reference_requests")
      .update({
        candidate_token_hash: issued.tokenHash,
        candidate_link_expires_at: issued.expiresAt,
      })
      .eq("id", ctx.request.id);
    expiresAt = issued.expiresAt;
    link = issued.url;
  }

  // Email 04 — a fully engineered transactional template. Only the subject (and
  // the copy tokens inside it) come from the snapshot; the layout is fixed.
  const daysRemaining = Math.max(
    0,
    Math.round((Date.parse(expiresAt!) - Date.now()) / 86_400_000),
  );
  const rendered = renderCandidateReferenceEmail({
    brand: ctx.brand,
    subjectTemplate: tpl.subject,
    bodyTemplate: tpl.body,
    secureLink: link,
    candidateFirstName: ctx.candidateFirstName,
    jobTitle: ctx.jobTitle,
    clientName: ctx.request.client_id ? ctx.clientName : null,
    refereeCount: ctx.refereeCount,
    recruiterName: ctx.recruiterName,
    recruiterTitle: ctx.recruiterTitle,
    agencyName: ctx.brand.name,
    expiryIso: expiresAt!,
    expiryDays: days,
    relationshipRules: Array.isArray(ctx.snapshot.relationship_rules)
      ? ctx.snapshot.relationship_rules
      : [],
    isReminder: !!opts.isReminder,
    daysRemaining,
  });

  await sendReferenceEmail({
    brandName: ctx.brand.name,
    to: ctx.candidateEmail,
    replyTo: ctx.recruiterEmail,
    rendered,
  });

  await logReferenceActivity(
    supabase,
    ctx.request.id,
    opts.isReminder ? "candidate_reminder_sent" : "candidate_email_sent",
    opts.isReminder ? "Candidate reminder sent" : "Candidate email sent",
    ctx.request.requested_by ?? null,
  );

  return { expiresAt: expiresAt!, link };
}

/** Mint a referee link and email it. Held referees must never reach here. */
export async function sendRefereeEmail(
  supabase: SupabaseClient,
  ctx: RequestContext,
  referee: { id: string; name: string; email: string | null; on_hold?: boolean | null },
  opts: { isReminder?: boolean } = {},
): Promise<void> {
  const tpl = refereeTemplate(ctx.snapshot);
  if (!tpl) throw new Error("This template has no referee email");

  // Re-read the row so the email always carries the candidate-entered
  // relationship/period, and so the on_hold gate is enforced here too — a held
  // referee is usually the current employer and must never be contacted.
  const { data: row } = await supabase
    .from("reference_referees")
    .select("name, email, relationship, period, on_hold")
    .eq("id", referee.id)
    .maybeSingle();

  const name = row?.name ?? referee.name;
  const email = row?.email ?? referee.email;
  if (row?.on_hold === true || referee.on_hold === true) {
    throw new Error(`${name} is on hold and must not be contacted`);
  }
  if (!email) throw new Error(`Referee ${name} has no email address`);

  const days = Number(ctx.snapshot.referee_link_days) || 21;
  const issued = await issueReferenceToken({
    kind: "referee",
    tenantId: ctx.request.tenant_id,
    requestId: ctx.request.id,
    subjectId: referee.id,
    expiresInDays: days,
  });

  // Email 05 — fixed transactional layout; only the subject copy comes from the
  // snapshot, so a template edit can't reword an in-flight request.
  const rendered = renderRefereeReferenceEmail({
    brand: ctx.brand,
    subjectTemplate: tpl.subject,
    secureLink: issued.url,
    declineLink: `${issued.url}?decline=1`,
    refereeName: name,
    candidateName: ctx.candidateName,
    candidateFirstName: ctx.candidateFirstName,
    jobTitle: ctx.jobTitle,
    clientName: ctx.request.client_id ? ctx.clientName : null,
    recruiterName: ctx.recruiterName,
    agencyName: ctx.brand.name,
    refereeRelationship: row?.relationship ?? null,
    refereePeriod: row?.period ?? null,
    estimatedMinutes: estimatedMinutes(ctx.snapshot.questions ?? []),
    expiryDays: days,
    retentionMonths: Number(ctx.snapshot.retention_months) || null,
    isReminder: !!opts.isReminder,
  });

  await sendReferenceEmail({
    brandName: ctx.brand.name,
    to: email,
    replyTo: ctx.recruiterEmail,
    rendered,
  });

  await supabase
    .from("reference_referees")
    .update({
      token_hash: issued.tokenHash,
      link_expires_at: issued.expiresAt,
      invited_at: new Date().toISOString(),
      status: "invited",
    })
    .eq("id", referee.id);

  await logReferenceActivity(
    supabase,
    ctx.request.id,
    opts.isReminder ? "referee_reminder_sent" : "referee_email_sent",
    `${opts.isReminder ? "Reminder sent to" : "Questionnaire sent to"} ${name}`,
    null,
  );
}

