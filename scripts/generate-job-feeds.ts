// Copies each job-board feed from the generate-talent-feed function into
// public/feeds/{board}/{tenant_id}.xml, so app.gogio.io serves it as
// application/xml (Supabase serves the function itself as text/plain).
// Runs before every build (prebuild) and hourly in the GitHub job "Job feeds",
// which commits public/feeds only when this script changed a file.
//
// A feed is written only when its content changed (the build stamps don't
// count, see sameFeed), and a feed that can't be read keeps the copy already
// there: a failed fetch must never empty a board's feed. Never fails the build.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { FEED_FUNCTION, STATIC_FEEDS, feedFilePath, feedSourceUrl, looksLikeFeed, sameFeed } from '../src/lib/jobFeedFiles'

const BASE = process.env.JOB_FEEDS_SOURCE || FEED_FUNCTION
const PUBLIC_DIR = resolve(process.env.JOB_FEEDS_PUBLIC_DIR || 'public')

async function fetchFeed(url: string): Promise<string> {
  let last: unknown = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(60_000) })
      const body = await res.text()
      if (!res.ok) throw new Error(`answered ${res.status}`)
      if (!looksLikeFeed(body)) throw new Error('answered something that is not a feed')
      return body
    } catch (err) {
      last = err
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

async function main() {
  let written = 0
  let unchanged = 0
  let kept = 0
  for (const { tenantId, board } of STATIC_FEEDS) {
    const rel = feedFilePath(board, tenantId)
    if (!rel) continue
    const out = resolve(PUBLIC_DIR, rel)
    const previous = existsSync(out) ? readFileSync(out, 'utf8') : null
    try {
      const xml = await fetchFeed(feedSourceUrl(board, tenantId, BASE))
      if (sameFeed(previous, xml)) {
        unchanged++
        continue
      }
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, xml.endsWith('\n') ? xml : `${xml}\n`)
      written++
      console.log(`[generate-job-feeds] ${rel} written (${(xml.match(/<job[ >]/g) ?? []).length} listings)`)
    } catch (err) {
      kept++
      console.warn(`[generate-job-feeds] ${rel}: ${(err as Error).message}; ${previous === null ? 'no copy yet' : 'keeping the copy already there'}`)
    }
  }
  console.log(`[generate-job-feeds] ${written} written, ${unchanged} unchanged, ${kept} kept`)
}

main().catch((err) => {
  console.warn(`[generate-job-feeds] stopped: ${(err as Error).message}`)
})
