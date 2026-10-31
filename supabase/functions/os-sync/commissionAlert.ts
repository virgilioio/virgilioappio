// Commission emails (commissions phase 3, 2026-10-31): "Your October 2026
// payout is paid" and "A bonus was added to your pay". The bell rang in the
// database already (os_commission_payouts_z_notify /
// os_commission_adjustments_z_notify), which also queued these in
// os_commission_alerts. Sent from Gio's no-reply address. Amounts arrive
// already written ("USD 1,800.00"). ASCII only in this file.

import { appBase } from "../_shared/referenceTokens.ts";
import { atsLayout, esc, firstName } from "../_shared/atsEmail.ts";

export interface CommissionAlert {
  alert_id: string;
  kind: "payout_paid" | "adjustment_added";
  to_email: string | null;
  person_name: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

function day(iso: string) {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

const strong = (t: string) => `<strong style="color:#1F2230;font-weight:600">${esc(t)}</strong>`;

export function commissionAlertMessage(a: CommissionAlert) {
  const d = a.detail ?? {};
  const name = firstName(a.person_name || "");
  if (a.kind === "payout_paid") {
    const month = s(d.month);
    const amount = s(d.amount);
    const paid = day(s(d.paid_on));
    const invoice = s(d.invoice_number);
    const url = `${appBase()}/me?tab=earnings&view=payouts&payout=${encodeURIComponent(s(d.payout_id))}`;
    const subject = `Your ${month} payout is paid`;
    const lead = `Hi ${strong(name)}, Virgilio paid your ${esc(month)} commissions: ${strong(amount)}${paid ? `, on ${esc(paid)}` : ""}${invoice ? `, against invoice ${esc(invoice)}` : ""}.`;
    const html = atsLayout({
      preheader: `${amount} for ${month}.`,
      product: "Your profile",
      eyebrow: "Commissions",
      title: subject,
      lead,
      cta: { label: "See the payout", url },
      note: "It can take a day or two to reach your account, depending on your bank. The payout's lines and its invoice are on My profile, under Earnings.",
      why: "You're getting this because Virgilio paid you commissions.",
    });
    const text = `Virgilio paid your ${month} commissions: ${amount}${paid ? `, on ${paid}` : ""}${invoice ? `, against invoice ${invoice}` : ""}.\n\nIt can take a day or two to reach your account, depending on your bank.\n\nSee the payout: ${url}`;
    return { subject, html, text };
  }
  const kind = s(d.kind) || "An adjustment";
  const amount = s(d.amount);
  const reason = s(d.reason);
  const month = s(d.month);
  const url = `${appBase()}/me?tab=earnings&view=adjustments`;
  const deducts = amount.startsWith("-");
  const subject = deducts ? `A ${kind.toLowerCase()} was taken from your pay` : `A ${kind.toLowerCase()} was added to your pay`;
  const lead = `Hi ${strong(name)}, a ${esc(kind.toLowerCase())} of ${strong(amount)} is on your ${esc(month)} pay. The reason Billing gave: ${esc(reason)}`;
  const html = atsLayout({
    preheader: `${kind} of ${amount}: ${reason}`.slice(0, 140),
    product: "Your profile",
    eyebrow: "Commissions",
    title: subject,
    lead,
    cta: { label: "See your adjustments", url },
    note: "It's paid with that month's payout. If something looks wrong, reply to Billing or tell an admin.",
    why: "You're getting this because an adjustment was added to your commissions.",
  });
  const text = `A ${kind.toLowerCase()} of ${amount} is on your ${month} pay. The reason Billing gave: ${reason}\n\nIt's paid with that month's payout.\n\nSee your adjustments: ${url}`;
  return { subject, html, text };
}
