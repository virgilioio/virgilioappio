import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { zodResolver as oldResolver } from '@hookform/resolvers/zod';
import { zodResolver } from '../zodResolver';

const schema = z.object({
  candidate_name: z.string().min(2, 'Name must be at least 2 characters'),
  candidate_email: z.string().email('Invalid email address'),
  notes: z.string().optional(),
});
const options = { fields: {}, shouldUseNativeValidation: false } as never;

describe('zodResolver (zod 4)', () => {
  it('returns field errors instead of throwing', async () => {
    const r = await zodResolver(schema)({ candidate_name: 'Steven Scott', candidate_email: '' }, undefined, options);
    expect(r.values).toEqual({});
    expect(r.errors.candidate_email?.message).toBe('Invalid email address');
    expect(r.errors.candidate_name).toBeUndefined();
  });

  it('gives each field its first message', async () => {
    const r = await zodResolver(schema)({ candidate_name: 'S', candidate_email: 'a b@gmail.com' }, undefined, options);
    expect(Object.keys(r.errors).sort()).toEqual(['candidate_email', 'candidate_name']);
  });

  it('passes valid values through', async () => {
    const values = { candidate_name: 'Steven Scott', candidate_email: 'shscott1371@gmail.com', notes: '' };
    const r = await zodResolver(schema)(values, undefined, options);
    expect(r.errors).toEqual({});
    expect(r.values).toEqual(values);
  });

  it('the package resolver throws on the same input (why this exists)', async () => {
    await expect(
      oldResolver(schema as never)({ candidate_name: 'Steven Scott', candidate_email: '' }, undefined, options),
    ).rejects.toThrow();
  });
});
