import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { scheduledSendBody, sendFailureReason } from '../../../supabase/functions/_shared/scheduledSend.ts';

const row = {
  from_email: 'sender@example.com',
  to_emails: ['candidate@example.com'],
  subject: 'About your application',
  body_html: '<p>Thank you for applying.</p>',
  candidate_id: '11111111-1111-4111-8111-111111111111',
  job_id: '22222222-2222-4222-8222-222222222222',
  jhs_id: null,
  association_id: '33333333-3333-4333-8333-333333333333',
};

// send-user-email's own rule for these ids: a value or left out (never null).
const before = z.object({
  candidate_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  jhs_id: z.string().uuid().optional(),
  association_id: z.string().uuid().optional(),
});

describe('scheduledSendBody', () => {
  it('leaves out the empty interview stage that refused every scheduled rejection', () => {
    const body = scheduledSendBody(row);
    expect('jhs_id' in body).toBe(false);
    expect(body.candidate_id).toBe(row.candidate_id);
    expect(body.association_id).toBe(row.association_id);
    // send-user-email accepts what we send now; the old body was refused.
    expect(before.safeParse(body).success).toBe(true);
    expect(before.safeParse({ ...body, jhs_id: null }).success).toBe(false);
  });

  it('keeps an interview stage that is there', () => {
    const jhs = '44444444-4444-4444-8444-444444444444';
    expect(scheduledSendBody({ ...row, jhs_id: jhs }).jhs_id).toBe(jhs);
  });

  it('leaves out every empty id, as a bulk email without a job has', () => {
    const body = scheduledSendBody({ ...row, candidate_id: null, job_id: '', association_id: undefined });
    expect(Object.keys(body).sort()).toEqual(['body_html', 'body_text', 'from_email', 'subject', 'to']);
  });

  it('sends from the sender it is given', () => {
    expect(scheduledSendBody(row, 'recruiter@example.com').from_email).toBe('recruiter@example.com');
    expect(scheduledSendBody(row).from_email).toBe('sender@example.com');
  });

  it('writes the plain text from the HTML, and copes with no body', () => {
    expect(scheduledSendBody(row).body_text).toBe('Thank you for applying.');
    const empty = scheduledSendBody({ ...row, body_html: null });
    expect(empty.body_html).toBe('');
    expect(empty.body_text).toBe('');
  });
});

describe('sendFailureReason', () => {
  const httpError = (status: number, body: unknown) => {
    const e = new Error('Edge Function returned a non-2xx status code') as Error & { context: Response };
    e.context = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    return e;
  };

  it('names the refused field instead of "non-2xx"', async () => {
    const reason = await sendFailureReason(httpError(400, {
      error: '[\n {"code":"invalid_type"} ]',
      details: [{ path: ['jhs_id'], message: 'Expected string, received null' }],
    }));
    expect(reason).toBe('send-user-email 400 · refused the request · jhs_id: Expected string, received null');
  });

  it("keeps send-user-email's own reason", async () => {
    expect(await sendFailureReason(httpError(403, { error: 'From email is not a valid connected identity' })))
      .toBe('send-user-email 403 · From email is not a valid connected identity');
    expect(await sendFailureReason(httpError(502, 'Bad gateway'))).toBe('send-user-email 502 · Bad gateway');
  });

  it('falls back to the error itself, and stays short', async () => {
    expect(await sendFailureReason(new Error('fetch failed'))).toBe('fetch failed');
    expect(await sendFailureReason('weird')).toBe('Unknown error');
    const long = await sendFailureReason(new Error('x'.repeat(500)));
    expect(long.length).toBe(300);
  });
});
