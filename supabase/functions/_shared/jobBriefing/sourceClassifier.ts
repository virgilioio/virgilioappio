export type SourceKind = 'inbound' | 'sourced' | 'unknown';

export type ClassifiedSource = {
  kind: SourceKind;
  label: string;
  raw: string;
};

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function norm(value: unknown): string {
  return clean(value).toLowerCase().replace(/[\s_-]+/g, ' ');
}

export function classifyCandidateSource(source: unknown, jobBoardSource?: unknown): ClassifiedSource {
  const rawSource = clean(source);
  const rawBoard = clean(jobBoardSource);
  const value = norm(rawSource);
  const board = norm(rawBoard);
  const joined = [value, board].filter(Boolean).join(' ');

  if (!joined) return { kind: 'unknown', label: 'Unknown', raw: '' };

  if (
    board ||
    /public posting|public_posting|career|careers|application|apply|applicant|job board|jobboard|portal|inbound|website|talent\.com|indeed|whatjobs|juju|jooble|google jobs/.test(joined)
  ) {
    return { kind: 'inbound', label: rawBoard || rawSource || 'Inbound', raw: rawSource || rawBoard };
  }

  if (
    /sourc|outreach|chrome|extension|apollo|coresignal|pdl|manual|direct|linkedin|linked in|referral|headhunt|prospect|import|csv/.test(joined)
  ) {
    return { kind: 'sourced', label: rawSource || rawBoard || 'Sourced', raw: rawSource || rawBoard };
  }

  return { kind: 'unknown', label: rawSource || rawBoard || 'Unknown', raw: rawSource || rawBoard };
}

export function incrementSourceBreakdown(
  breakdown: Record<SourceKind, number>,
  classified: ClassifiedSource,
) {
  breakdown[classified.kind] = (breakdown[classified.kind] ?? 0) + 1;
}