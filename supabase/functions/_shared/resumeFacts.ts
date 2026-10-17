/**
 * Checks on what Gio reads from a resume, before it is saved (2026-10-17).
 *
 * - The name check: a resume that names someone else is never written onto
 *   this candidate.
 * - The history check: a job is kept only when its company appears in the
 *   resume text, so Gio can't add work history the resume doesn't have.
 * - Duplicates: the same job listed twice in one reply is saved once.
 *
 * Pure functions, ASCII only (Edge Function rule), shared with the vitest suite.
 */

const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'das', 'van', 'von', 'der', 'den', 'di', 'du', 'le', 'y', 'e'])

// Words that say nothing about which company it is.
const COMPANY_FILLER = new Set([
  'grupo', 'group', 'the', 'and', 'company', 'compania', 'corp', 'corporation', 'corporativo', 'inc', 'llc', 'ltd',
  'limited', 'gmbh', 'sapi', 'srl', 'sas', 'sociedad', 'anonima', 'mexico', 'mexicana', 'mexicano', 'international',
  'internacional', 'global', 'holding', 'holdings', 'services', 'servicios', 'solutions', 'soluciones', 'consulting',
  'industries', 'industrias', 'systems', 'technologies', 'tecnologia', 'empresa',
])

// Not a company name: the resume says it in its own words, so it can't be matched.
const NO_EMPLOYER = new Set([
  'freelance', 'freelancer', 'selfemployed', 'independent', 'independiente', 'autonomo', 'confidential',
  'confidencial', 'empresaconfidencial', 'confidentialcompany', 'varios', 'various', 'multipleclients', 'personal',
])

/** Lower case, accents removed. */
export function fold(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Letters and digits only, so "Acme  Corp." and "ACME-CORP" compare equal and split words still match. */
export function squash(s: string | null | undefined): string {
  return fold(s).replace(/[^a-z0-9]/g, '')
}

function words(s: string | null | undefined): string[] {
  return fold(s).split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Whether the name on the resume can be this candidate. Unknown on either side
 * counts as yes: only a resume that clearly names another person is refused.
 */
export function sameResumeName(resumeName: string | null | undefined, candidateName: string | null | undefined): boolean {
  const a = (resumeName ?? '').trim()
  const b = (candidateName ?? '').trim()
  if (!a || !b || b.includes('@') || /^unnamed\b/i.test(b)) return true
  const sa = squash(a)
  const sb = squash(b)
  if (sa.length < 3 || sb.length < 3) return true
  if (sa.includes(sb) || sb.includes(sa)) return true
  const ta = words(a).filter((w) => w.length >= 3 && !NAME_PARTICLES.has(w))
  const tb = new Set(words(b).filter((w) => w.length >= 3 && !NAME_PARTICLES.has(w)))
  if (!ta.length || !tb.size) return true
  return ta.some((w) => tb.has(w))
}

/** Whether a company name appears in the resume text (squashed form). */
export function companyInResume(company: string | null | undefined, resumeSquashed: string): boolean {
  const whole = squash(company)
  if (!whole) return false
  if (NO_EMPLOYER.has(whole)) return true
  if (whole.length >= 2 && resumeSquashed.includes(whole)) return true
  const keys = words(company).filter((w) => w.length >= 4 && !COMPANY_FILLER.has(w))
  return keys.some((w) => resumeSquashed.includes(w))
}

export interface ResumeJob {
  job_title?: string | null
  company_name?: string | null
  start_date?: string | null
  end_date?: string | null
  description?: string | null
  [key: string]: unknown
}

/** The same job (company, title, start) listed more than once becomes one, keeping every distinct description. */
export function dedupeJobs<T extends ResumeJob>(jobs: T[]): T[] {
  const byKey = new Map<string, T>()
  const out: T[] = []
  for (const job of jobs) {
    const key = `${squash(job.company_name)}|${squash(job.job_title)}|${job.start_date ?? ''}`
    const first = byKey.get(key)
    if (!first) {
      const copy = { ...job }
      byKey.set(key, copy)
      out.push(copy)
      continue
    }
    for (const [k, v] of Object.entries(job)) {
      if (k === 'description') continue
      if ((first[k] === undefined || first[k] === null || first[k] === '') && v !== undefined && v !== null && v !== '') {
        (first as ResumeJob)[k] = v
      }
    }
    const extra = (job.description ?? '').trim()
    const have = (first.description ?? '').trim()
    if (extra && !have.includes(extra)) {
      (first as ResumeJob).description = have ? `${have}\n\n${extra}` : extra
    }
  }
  return out
}

/** Splits extracted jobs into those the resume backs and those it doesn't. */
export function checkResumeJobs<T extends ResumeJob>(jobs: T[], resumeText: string): { kept: T[]; dropped: T[] } {
  const text = squash(resumeText)
  const kept: T[] = []
  const dropped: T[] = []
  for (const job of dedupeJobs(jobs)) {
    if (job.company_name && job.job_title && companyInResume(job.company_name, text)) kept.push(job)
    else dropped.push(job)
  }
  return { kept, dropped }
}
