// The post editor's pay reminder (2026-11-28, Allan: keep "pay shows on the boards
// when the page shows it" and remind). The editor reminds; it never decides what the law needs.

/** Places with pay-transparency rules for job ads in several states and provinces. */
const PAY_RANGE_COUNTRIES = new Set(['US', 'CA'])

export const PAY_RANGE_NOTE =
  'Several US states and Canadian provinces require a pay range on job ads. Show pay to list it there safely.'

/** True when a post reaches the US or Canada and shows no pay. */
export function needsPayNote(countries: string[], showsPay: boolean | undefined): boolean {
  return showsPay === false && countries.some((c) => PAY_RANGE_COUNTRIES.has(c))
}
