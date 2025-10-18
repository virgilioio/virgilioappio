import { describe, it, expect } from 'vitest';
import { sanitizeQuery } from '../useExternalSourcing';

describe('sanitizeQuery', () => {
  it('removes null values', () => {
    const input = { foo: 'bar', baz: null };
    const output = sanitizeQuery(input);
    expect(output).toEqual({ foo: 'bar' });
    expect(output).not.toHaveProperty('baz');
  });

  it('removes undefined values', () => {
    const input = { foo: 'bar', baz: undefined };
    const output = sanitizeQuery(input);
    expect(output).toEqual({ foo: 'bar' });
    expect(output).not.toHaveProperty('baz');
  });

  it('removes empty string values', () => {
    const input = { foo: 'bar', baz: '' };
    const output = sanitizeQuery(input);
    expect(output).toEqual({ foo: 'bar' });
    expect(output).not.toHaveProperty('baz');
  });

  it('removes empty array values', () => {
    const input = { foo: 'bar', baz: [] };
    const output = sanitizeQuery(input);
    expect(output).toEqual({ foo: 'bar' });
    expect(output).not.toHaveProperty('baz');
  });

  it('keeps valid number values including 0', () => {
    const input = { foo: 'bar', count: 42, zero: 0 };
    const output = sanitizeQuery(input);
    expect(output).toEqual({ foo: 'bar', count: 42, zero: 0 });
  });

  it('keeps non-empty arrays', () => {
    const input = { foo: 'bar', items: ['a', 'b'] };
    const output = sanitizeQuery(input);
    expect(output).toEqual({ foo: 'bar', items: ['a', 'b'] });
  });

  it('keeps boolean values', () => {
    const input = { foo: 'bar', flag: true, another: false };
    const output = sanitizeQuery(input);
    expect(output).toEqual({ foo: 'bar', flag: true, another: false });
  });

  it('handles mixed scenario with updated_within_days', () => {
    const input = {
      boolean: 'engineer',
      locations: ['NYC'],
      seniority: [],
      languages: [],
      require_email: false,
      require_phone: false,
      updated_within_days: null
    };
    const output = sanitizeQuery(input);
    expect(output).toEqual({
      boolean: 'engineer',
      locations: ['NYC'],
      require_email: false,
      require_phone: false
    });
    expect(output).not.toHaveProperty('updated_within_days');
  });
});
