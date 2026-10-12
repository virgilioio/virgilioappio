/**
 * Reading an Apollo person (2026-10-12). Apollo's enrichment now puts the
 * company in `organization.name`, not `organization_name`; reading only the
 * old field left 234 of October's collects with no current company.
 */
// deno-lint-ignore no-explicit-any
export function apolloCompany(person: any): string | null {
  const current = Array.isArray(person?.employment_history)
    ? person.employment_history.find((e: { current?: boolean }) => e?.current)
    : null;
  const name = person?.organization_name || person?.organization?.name || current?.organization_name || null;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}
