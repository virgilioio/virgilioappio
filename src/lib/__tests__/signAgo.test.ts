import { describe, expect, it } from 'vitest';
import { agoInline } from '@/lib/sign/status';

describe('agoInline: a time that follows a word ("Signed …")', () => {
  const now = new Date('2026-10-30T18:00:00Z').getTime();
  it('lowercases just now and yesterday', () => {
    expect(agoInline('2026-10-30T17:59:40Z', now)).toBe('just now');
    expect(agoInline('2026-10-29T12:00:00Z', now)).toBe('yesterday');
  });
  it('keeps relative times as they are', () => {
    expect(agoInline('2026-10-30T17:45:00Z', now)).toBe('15 min ago');
    expect(agoInline('2026-10-30T15:00:00Z', now)).toBe('3 h ago');
  });
  it('keeps the month capitalised', () => {
    expect(agoInline('2026-09-12T12:00:00Z', now)).toBe('Sep 12');
  });
});
