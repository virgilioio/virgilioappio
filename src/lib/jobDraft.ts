/** The job columns the job wizards edit and save with a draft (JobWizard, CrmJobSetup). */
export const JOB_DATA_KEYS = [
  'title', 'description', 'location', 'department', 'salary_min', 'salary_max', 'currency', 'status',
  'skills', 'skill_priorities', 'auto_generated_skills', 'last_skills_generation', 'hiring_team', 'organization_id',
  'department_id', 'internal_title', 'job_level', 'work_mode', 'employment_type', 'additional_locations',
  'show_salary_public', 'include_equity', 'include_signing_bonus', 'min_years_experience',
  'max_years_experience', 'priority', 'salary_period', 'reports_to_user_id', 'coordinator_user_id',
] as const

/** A job row's wizard fields, leaving out nulls. */
export function jobRowToData(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of JOB_DATA_KEYS) if (row[k] !== null && row[k] !== undefined) out[k] = row[k]
  return out
}
