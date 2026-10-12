/**
 * Apollo calls this with mobile numbers it found after a "Collect with
 * phone" or "Get phone" (Find, Phase 0 — 2026-10-11).
 *
 * The URL carries the workspace and a signature (phoneWebhookUrl in
 * _shared/apolloCredits.ts), so:
 * - a call without a valid signature is refused;
 * - a phone only fills the candidate with that Apollo id in that workspace,
 *   and only when they have no phone yet;
 * - each phone delivered is written to the credit ledger (8, estimated —
 *   Apollo charges for a mobile when it returns one).
 * Payloads aren't logged in full: they hold personal data.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { applyCandidateUpdate } from "../_shared/candidateUpdate.ts";
import { verifyPhoneWebhook, recordCredits, PHONE_CREDITS } from "../_shared/apolloCredits.ts";

const headers = { 'Content-Type': 'application/json' };

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const signed = await verifyPhoneWebhook(new URL(req.url));
  if (!signed) {
    console.warn('Apollo phone webhook: missing or bad signature');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const payload = await req.json();
    const people = payload.people || (payload.person ? [payload.person] : (payload.id ? [payload] : []));
    if (!Array.isArray(people) || people.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing people data' }), { status: 400, headers });
    }

    const results: { apolloId: string; status: string }[] = [];
    let delivered = 0;

    for (const person of people) {
      if (!person?.id) continue;
      const apolloId = String(person.id);

      // deno-lint-ignore no-explicit-any
      let contactPhones: { type: string; number: string; raw_number: string | null }[] = (person.phone_numbers || []).map((p: any) => ({
        type: p.type || 'other',
        number: p.sanitized_number || p.raw_number || '',
        raw_number: p.raw_number || null,
      })).filter((p: { number: string }) => p.number);
      if (contactPhones.length === 0 && (person.sanitized_phone || person.phone)) {
        contactPhones = [{ type: 'other', number: person.sanitized_phone || person.phone, raw_number: null }];
      }
      const phone = contactPhones[0]?.number ?? null;
      if (!phone) { results.push({ apolloId, status: 'no_phone' }); continue; }
      delivered++;

      const { data: candidate } = await supabase
        .from('candidates')
        .select('id, phone')
        .eq('tenant_id', signed.tenantId)
        .eq('apollo_id', apolloId)
        .is('deleted_at', null)
        .is('merged_into', null)
        .maybeSingle();
      if (!candidate) { results.push({ apolloId, status: 'not_found' }); continue; }

      // Through the one path for outside data (Find Phase 3): the phone fills
      // an empty one; otherwise it joins the contact list, never replacing.
      const applied = await applyCandidateUpdate(supabase, candidate.id, 'apollo', {
        phone, contact_phones: contactPhones,
      }, { mode: 'fill', actor: signed.userId });
      results.push({ apolloId, status: !applied ? 'update_error' : candidate.phone ? 'added_to_contacts' : 'updated' });
    }

    if (delivered > 0) {
      await recordCredits(supabase, {
        tenantId: signed.tenantId,
        kind: 'phone',
        people: delivered,
        credits: delivered * PHONE_CREDITS,
        estimated: true,
        userId: signed.userId,
        projectId: signed.projectId,
        note: 'Phones delivered by Apollo webhook',
      });
    }

    const updated = results.filter((r) => r.status === 'updated').length;
    console.log(`Apollo phone webhook: ${updated}/${people.length} phones filled, ${delivered} delivered`);
    return new Response(JSON.stringify({ success: true, processed: people.length, updated }), { status: 200, headers });
  } catch (error) {
    console.error('Apollo phone webhook error:', (error as Error).message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers });
  }
});
