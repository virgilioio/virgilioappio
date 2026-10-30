import { beforeEach, describe, expect, it } from 'vitest';
import {
  inPipelineSection,
  neighbours,
  pipelineSectionOf,
  readCandidateNavOrder,
  saveCandidateNavOrder,
  sectionOrder,
  type NavAssoc,
} from '@/lib/candidateNavOrder';

const types: Record<string, string> = { ar: 'application_review', scr: 'screening', hm: 'interview', off: 'offer', hired: 'hired' };
const stageType = (id: string) => types[id];
const position = (id: string) => ['ar', 'scr', 'hm', 'off', 'hired'].indexOf(id);

const a = (candidate_id: string, status: string, current_stage_id: string | null, extra: Partial<NavAssoc> = {}): NavAssoc => ({
  candidate_id, status, current_stage_id, created_at: '2026-10-01T00:00:00Z', ...extra,
});

const JOB: NavAssoc[] = [
  a('app-low', 'active', 'ar', { ai_fit_score: 41, created_at: '2026-10-05T00:00:00Z' }),
  a('app-high', 'active', 'ar', { ai_fit_score: 88, created_at: '2026-10-02T00:00:00Z' }),
  a('rec-hm', 'active', 'hm', { created_at: '2026-10-06T00:00:00Z' }),
  a('rec-scr', 'active', 'scr', { created_at: '2026-10-03T00:00:00Z' }),
  a('offer-status', 'offer', 'hm'),
  a('offer-stage', 'active', 'off'),
  a('hired-1', 'hired', 'hired'),
  a('rej-old', 'rejected', 'scr', { rejected_at: '2026-10-10T00:00:00Z' }),
  a('rej-new', 'rejected', 'ar', { rejected_at: '2026-10-20T00:00:00Z' }),
];

describe('which list a candidate is in', () => {
  it('follows the job page rules', () => {
    const of = (id: string) => pipelineSectionOf(JOB.find((x) => x.candidate_id === id)!, stageType);
    expect(of('app-low')).toBe('application');
    expect(of('rec-hm')).toBe('recruiting');
    expect(of('offer-status')).toBe('offers');
    expect(of('offer-stage')).toBe('offers');
    expect(of('hired-1')).toBe('hired');
    expect(of('rej-new')).toBe('rejected');
  });

  it('a rejected candidate in application review is only in Rejected', () => {
    const r = JOB.find((x) => x.candidate_id === 'rej-new')!;
    expect(inPipelineSection(r, 'application', stageType)).toBe(false);
    expect(inPipelineSection(r, 'recruiting', stageType)).toBe(false);
  });
});

describe('a list rebuilt for a link', () => {
  it('Application review by Gio Fit score', () => {
    expect(sectionOrder(JOB, 'application', stageType, position)).toEqual(['app-high', 'app-low']);
  });
  it('Recruiting process by stage', () => {
    expect(sectionOrder(JOB, 'recruiting', stageType, position)).toEqual(['rec-scr', 'rec-hm']);
  });
  it('Rejected newest first', () => {
    expect(sectionOrder(JOB, 'rejected', stageType, position)).toEqual(['rej-new', 'rej-old']);
  });
  it('never mixes lists', () => {
    const all = (['application', 'recruiting', 'offers', 'hired', 'rejected'] as const).flatMap((s) => sectionOrder(JOB, s, stageType, position));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(JOB.length);
  });
});

describe('‹ › within one list', () => {
  const list = ['a', 'b', 'c'];
  it('the first has no Previous, the last no Next', () => {
    expect(neighbours(list, 'a')).toEqual({ index: 0, prev: null, next: 'b' });
    expect(neighbours(list, 'b')).toEqual({ index: 1, prev: 'a', next: 'c' });
    expect(neighbours(list, 'c')).toEqual({ index: 2, prev: 'b', next: null });
  });
  it('someone not in the list goes nowhere', () => {
    expect(neighbours(list, 'z')).toEqual({ index: -1, prev: null, next: null });
  });
});

describe('the saved list', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    };
  });
  it('remembers which list it is and for which job', () => {
    saveCandidateNavOrder('job-1', 'rejected', ['x', 'y']);
    expect(readCandidateNavOrder('job-1')).toEqual({ section: 'rejected', order: ['x', 'y'] });
    expect(readCandidateNavOrder('job-2')).toBeNull();
  });
  it('ignores an older save without a list name', () => {
    sessionStorage.setItem('gio:candidateNavOrder', JSON.stringify({ jobId: 'job-1', order: ['x'], savedAt: 1 }));
    expect(readCandidateNavOrder('job-1')).toBeNull();
  });
});
