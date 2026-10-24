// "Your bank details were changed" (member profile step 5, 2026-10-23): the
// email a person gets when someone else changes where they're paid. The bell
// rang in the database already (os_save_bank_details), which also queued this
// in os_bank_alerts. Sent from Gio's no-reply address, never a teammate's
// mailbox. It shows the masked account only. The same queue carries tax ID
// changes and removals (kind tax_id_changed / tax_id_removed, 2026-10-24),
// which name the ID and never show any part of it. ASCII only in this file.

import { appBase } from "../_shared/referenceTokens.ts";
import { atsLayout, esc, firstName } from "../_shared/atsEmail.ts";

export interface BankAlert {
  alert_id: string;
  kind: "bank" | "tax_id_changed" | "tax_id_removed";
  label: string | null;
  to_email: string | null;
  person_name: string | null;
  changed_by_name: string | null;
  changed_at: string;
  bank_name: string | null;
  account_label: string | null;
  account_last4: string | null;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }) + " (Mexico City)";
}

export function bankAlertMessage(a: BankAlert) {
  const who = a.changed_by_name || "An admin";
  const account = [a.bank_name, a.account_label && a.account_last4 ? `${a.account_label} ending ${a.account_last4}` : null]
    .filter(Boolean).join(", ");
  const url = `${appBase()}/me/details`;
  const subject = "Your bank details were changed";
  const lead = `Hi <strong style="color:#1F2230;font-weight:600">${esc(firstName(a.person_name || ""))}</strong>, ${esc(who)} changed the bank account Virgilio pays your commissions into${account ? ` to <strong style="color:#1F2230;font-weight:600">${esc(account)}</strong>` : ""}, on ${esc(when(a.changed_at))}.`;
  const html = atsLayout({
    preheader: `${who} changed where you're paid.`,
    product: "Your profile",
    eyebrow: "Security",
    title: "Your bank details were changed",
    lead,
    cta: { label: "Check your bank details", url },
    note: "If you expected this, there's nothing to do. If you didn't, tell an admin or write to support right away, before the next payment goes out.",
    why: "You're getting this because someone other than you changed your bank details in Gio ATS.",
  });
  const text = `${who} changed the bank account Virgilio pays your commissions into${account ? ` to ${account}` : ""}, on ${when(a.changed_at)}.\n\nIf you expected this, there's nothing to do. If you didn't, tell an admin or write to support@virgilio.tech right away, before the next payment goes out.\n\nCheck your bank details: ${url}`;
  return { subject, html, text };
}

export function taxIdAlertMessage(a: BankAlert) {
  const who = a.changed_by_name || "An admin";
  const id = a.label || "tax ID";
  const removed = a.kind === "tax_id_removed";
  const url = `${appBase()}/me/details`;
  const subject = removed ? `Your ${id} was removed from your profile` : `Your ${id} was changed`;
  const did = removed ? `removed your ${id} from your profile` : `changed your ${id} on your profile`;
  const lead = `Hi <strong style="color:#1F2230;font-weight:600">${esc(firstName(a.person_name || ""))}</strong>, ${esc(who)} ${esc(did)} in Gio ATS, on ${esc(when(a.changed_at))}.`;
  const html = atsLayout({
    preheader: `${who} ${did}.`,
    product: "Your profile",
    eyebrow: "Security",
    title: removed ? `Your ${id} was removed` : `Your ${id} was changed`,
    lead,
    cta: { label: "Check your tax IDs", url },
    note: "If you expected this, there's nothing to do. If you didn't, tell an admin or write to support right away.",
    why: "You're getting this because someone other than you changed your tax IDs in Gio ATS.",
  });
  const text = `${who} ${did} in Gio ATS, on ${when(a.changed_at)}.\n\nIf you expected this, there's nothing to do. If you didn't, tell an admin or write to support@virgilio.tech right away.\n\nCheck your tax IDs: ${url}`;
  return { subject, html, text };
}
