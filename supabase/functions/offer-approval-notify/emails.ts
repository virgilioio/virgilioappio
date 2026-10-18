// The offer approval emails (2026-10-18): your turn, the automatic reminder a
// day later, and a reminder someone sent with Remind. Gio ATS design
// (_shared/atsEmail.ts). ASCII only.

import { appBase } from "../_shared/referenceTokens.ts";
import { atsLayout, esc, firstName, personCard, type Pill } from "../_shared/atsEmail.ts";

export interface Notice {
  notice_id: string;
  kind: "turn" | "reminder";
  approver_email: string;
  approver_name: string;
  wants_email: boolean;
  candidate_name: string;
  job_title: string | null;
  job_id: string;
  candidate_id: string;
  requested_by_name: string;
  company: string | null;
  /** Who pressed Remind; null for the turn email and the automatic reminder. */
  nudged_by_name: string | null;
}

/** One email per notice, in the Gio ATS design (_shared/atsEmail.ts). */
export function message(n: Notice) {
  const url = `${appBase()}/jobs/${n.job_id}?candidate=${n.candidate_id}&tab=offer`;
  const role = [n.job_title, n.company].filter(Boolean).join(" at ") || "Offer";
  // The card shows the role; the plain-text email says it in brackets.
  const forRole = n.job_title ? ` (${n.job_title})` : "";
  const hi = `Hi <strong style="color:#1F2230;font-weight:600">${esc(firstName(n.approver_name))}</strong>`;
  const cand = `<strong style="color:#1F2230;font-weight:600">${esc(n.candidate_name)}</strong>`;
  const why = "You're getting this because you're an approver on this job's offer approval chain.";
  const note = "Nothing goes to the candidate until every approver has approved. You can decline with a note instead.";
  const tiles = [
    { label: "Sent for approval by", value: n.requested_by_name || "Your team" },
    { label: "What's needed", value: "Approve or decline" },
  ];
  const cta = { label: "Review the offer", url };
  let v: { subject: string; preheader: string; eyebrow: string; title: string; lead: string; pill: Pill; text: string };
  if (n.kind === "reminder" && n.nudged_by_name) {
    v = {
      subject: `${n.nudged_by_name} sent a reminder: the offer for ${n.candidate_name} is waiting for your approval`,
      preheader: `${n.nudged_by_name} is waiting on your approval of the offer for ${n.candidate_name}.`,
      eyebrow: `A reminder from ${firstName(n.nudged_by_name)}`,
      title: `${n.nudged_by_name} is waiting on your approval`,
      lead: `${hi}, ${esc(n.nudged_by_name)} sent you a reminder: the offer for ${cand} is waiting for you. It can't be sent for signature until you approve or decline it.`,
      pill: { text: "Waiting for you", tone: "amber" },
      text: `${n.nudged_by_name} sent you a reminder: the offer for ${n.candidate_name}${forRole} is waiting for your approval. It can't be sent for signature until you approve or decline it.`,
    };
  } else if (n.kind === "reminder") {
    v = {
      subject: `Reminder: the offer for ${n.candidate_name} is waiting for your approval`,
      preheader: `The offer for ${n.candidate_name} is still waiting for you.`,
      eyebrow: "Reminder",
      title: `The offer for ${n.candidate_name} is still waiting`,
      lead: `${hi}, the offer for ${cand} has been waiting for your approval for a day. It can't be sent for signature until you approve or decline it.`,
      pill: { text: "Waiting a day", tone: "amber" },
      text: `The offer for ${n.candidate_name}${forRole} has been waiting for your approval for a day. It can't be sent for signature until you approve or decline it.`,
    };
  } else {
    v = {
      subject: `Approve the offer for ${n.candidate_name}${n.job_title ? ` (${n.job_title})` : ""}`,
      preheader: `${n.requested_by_name} sent the offer for ${n.candidate_name} for approval.`,
      eyebrow: "Offer approval",
      title: "An offer needs your approval",
      lead: `${hi}, ${esc(n.requested_by_name)} sent the offer for ${cand} for approval, and it's your turn to review it.`,
      pill: { text: "Your turn", tone: "purple" },
      text: `${n.requested_by_name} sent the offer for ${n.candidate_name}${forRole} for approval, and it's your turn to review it.`,
    };
  }
  const html = atsLayout({
    preheader: v.preheader,
    product: "Offer approvals",
    eyebrow: v.eyebrow,
    title: v.title,
    lead: v.lead,
    card: personCard({ name: n.candidate_name, sub: role, pill: v.pill, tiles }),
    cta,
    note: esc(note),
    why,
  });
  const text = `Hi ${firstName(n.approver_name)},\n\n${v.text}\n\n${note}\n\nReview the offer: ${url}\n\n${why}\nGio ATS - support@virgilio.tech\n`;
  return { subject: v.subject, html, text };
}

