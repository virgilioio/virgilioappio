// Job-board feeds as static files on app.gogio.io (2026-11-28).
//
// Supabase's gateway serves everything on *.supabase.co (functions and Storage
// alike) as text/plain with a sandbox CSP, and Talent.com needs application/xml.
// app.gogio.io serves files in public/ as application/xml (as it does
// jobs-sitemap.xml), so each feed is copied from generate-talent-feed into
// public/feeds/{board}/{tenant_id}.xml by scripts/generate-job-feeds.ts: at
// every build (prebuild) and hourly by the GitHub job "Job feeds", which
// commits to main only when a feed really changed. Boards read
//   https://app.gogio.io/feeds/{board}/{tenant_id}.xml
// Pure, so the script, Settings and the tests share it.

export const FEED_SITE = 'https://app.gogio.io'
export const FEED_FUNCTION = 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-talent-feed'

/**
 * The feeds kept as files: every board a workspace has switched on
 * (job_board_integrations.is_enabled). A workspace that switches a board on
 * needs its line here before the file exists.
 */
export const STATIC_FEEDS: ReadonlyArray<{ tenantId: string; board: string }> = [
  // Virgilio
  { tenantId: '5ba7b145-f251-4b18-8900-724cb06028ab', board: 'talent' },
  { tenantId: '5ba7b145-f251-4b18-8900-724cb06028ab', board: 'jooble' },
  { tenantId: '5ba7b145-f251-4b18-8900-724cb06028ab', board: 'careerjet' },
  { tenantId: '5ba7b145-f251-4b18-8900-724cb06028ab', board: 'whatjobs' },
  { tenantId: '5ba7b145-f251-4b18-8900-724cb06028ab', board: 'juju' },
  { tenantId: '5ba7b145-f251-4b18-8900-724cb06028ab', board: 'adzuna' },
  { tenantId: '5ba7b145-f251-4b18-8900-724cb06028ab', board: 'jobrapido' },
  // Motive
  { tenantId: '90e2f4fe-7c51-4eab-bb15-a883fdeb5b5a', board: 'talent' },
  // Allan Bravo - Headhunting
  { tenantId: 'd7760c77-a936-4234-a673-5467f8d8fb39', board: 'talent' },
]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOARD = /^[a-z][a-z0-9_-]{0,31}$/

/** The file's path under public/, or null for anything that isn't a board and a workspace id. */
export function feedFilePath(board: string, tenantId: string): string | null {
  if (!BOARD.test(board) || !UUID.test(tenantId)) return null
  return `feeds/${board}/${tenantId.toLowerCase()}.xml`
}

/** The address a board reads the feed from. */
export function feedFileUrl(board: string, tenantId: string): string | null {
  const path = feedFilePath(board, tenantId)
  return path ? `${FEED_SITE}/${path}` : null
}

/** Where the script reads the feed (the function answers the XML, served as text/plain). */
export function feedSourceUrl(board: string, tenantId: string, base: string = FEED_FUNCTION): string {
  return `${base}?tenant_id=${encodeURIComponent(tenantId)}&board=${encodeURIComponent(board)}`
}

/** A feed's content without the stamps that change on every build (lastbuilddate, Juju's feeddate). */
export function feedBody(xml: string): string {
  return xml
    .replace(/<lastbuilddate>[^<]*<\/lastbuilddate>/g, '<lastbuilddate/>')
    .replace(/<feeddate>[^<]*<\/feeddate>/g, '<feeddate/>')
    .replace(/\r\n/g, '\n')
    .trim()
}

/** True when a new copy says nothing the old one didn't (so nothing is rewritten or committed). */
export function sameFeed(previous: string | null, next: string): boolean {
  return previous !== null && feedBody(previous) === feedBody(next)
}

/** What the function answered is a feed (not an error or an HTML page). */
export function looksLikeFeed(body: string): boolean {
  const head = body.trimStart().slice(0, 200)
  return head.startsWith('<?xml') && (head.includes('<source>') || head.includes('<jobs>'))
}
