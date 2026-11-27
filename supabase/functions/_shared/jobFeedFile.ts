// Where each job board's feed is kept as a file (2026-11-27).
//
// Supabase serves Edge Function responses on its own *.supabase.co address as
// text/plain whatever the function says, and Talent.com (and other boards)
// want application/xml. Storage keeps a file's own type (only text/html is
// turned into text/plain), so every feed is also written to the public bucket
// `job-feeds` and boards read it from there:
//   {SUPABASE_URL}/storage/v1/object/public/job-feeds/{board}/{tenant_id}.xml
// generate-talent-feed writes it on every request and once an hour
// (pg_cron 'job-feeds-refresh'). Screens import from src/lib/jobFeedFile.ts.

export const FEED_BUCKET = 'job-feeds'
export const FEED_CONTENT_TYPE = 'application/xml; charset=utf-8'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOARD = /^[a-z][a-z0-9_-]{0,31}$/

/** The file's path inside the bucket, or null for anything that isn't a board and a workspace id. */
export function feedFilePath(board: string, tenantId: string): string | null {
  if (!BOARD.test(board) || !UUID.test(tenantId)) return null
  return `${board}/${tenantId.toLowerCase()}.xml`
}

/** The address a board reads the feed from. */
export function feedFileUrl(supabaseUrl: string, board: string, tenantId: string): string | null {
  const path = feedFilePath(board, tenantId)
  if (!path) return null
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${FEED_BUCKET}/${path}`
}
