/**
 * Loads places from GeoNames (CC BY 4.0, https://www.geonames.org) into
 * geo_regions and geo_cities (Allan, 2026-10-26): every country's states and
 * provinces (admin1CodesASCII.txt) and every city of 5,000 people or more
 * (cities5000.zip, populated places only, with their coordinates for the
 * People & Access map). Upserts by GeoNames' own codes, so
 * running it again refreshes names and populations and adds new places.
 *
 * Called by hand or by SQL (net.http_post) with x-internal-secret; nobody
 * else reaches it. Keep this file ASCII only: the deploy tool rewrites escape
 * sequences.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { unzipSync } from 'https://esm.sh/fflate@0.8.2'

const SOURCE = 'https://download.geonames.org/export/dump'
const BATCH = 2000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GeoNames answered ${res.status} for ${url}`)
  return new Uint8Array(await res.arrayBuffer())
}

const clean = (s: string | undefined) => (s ?? '').trim()

Deno.serve(async (req) => {
  const secret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
  if (!secret || req.headers.get('x-internal-secret') !== secret) return json({ error: 'Not allowed' }, 401)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  try {
    // States and provinces: "MX.14<TAB>Jalisco<TAB>Jalisco<TAB>4004156".
    const adminText = new TextDecoder().decode(await fetchBytes(`${SOURCE}/admin1CodesASCII.txt`))
    const regions = []
    for (const line of adminText.split('\n')) {
      const [key, name, ascii, id] = line.split('\t')
      const dot = (key ?? '').indexOf('.')
      if (dot !== 2 || !clean(name)) continue
      const country = key.slice(0, 2).toUpperCase()
      if (!/^[A-Z]{2}$/.test(country)) continue
      regions.push({
        country_code: country,
        code: key.slice(3),
        name: clean(name).slice(0, 200),
        ascii_name: clean(ascii) || null,
        geoname_id: Number(id) || null,
      })
    }
    for (let i = 0; i < regions.length; i += BATCH) {
      const { error } = await db.from('geo_regions').upsert(regions.slice(i, i + BATCH), { onConflict: 'country_code,code' })
      if (error) throw new Error(`Regions: ${error.message}`)
    }

    // Cities: the tab-separated GeoNames table, populated places (feature class P) only.
    const zip = unzipSync(await fetchBytes(`${SOURCE}/cities5000.zip`))
    const file = zip['cities5000.txt']
    if (!file) throw new Error('cities5000.txt was not in the download')
    const text = new TextDecoder().decode(file)
    let cities = 0
    let batch: Record<string, unknown>[] = []
    const flush = async () => {
      if (!batch.length) return
      const { error } = await db.from('geo_cities').upsert(batch, { onConflict: 'id' })
      if (error) throw new Error(`Cities: ${error.message}`)
      cities += batch.length
      batch = []
    }
    for (const line of text.split('\n')) {
      const f = line.split('\t')
      if (f.length < 15 || f[6] !== 'P') continue
      const id = Number(f[0])
      const country = clean(f[8]).toUpperCase()
      if (!id || !/^[A-Z]{2}$/.test(country) || !clean(f[1])) continue
      batch.push({
        id,
        country_code: country,
        region_code: clean(f[10]) || null,
        name: clean(f[1]).slice(0, 200),
        ascii_name: clean(f[2]) || null,
        population: Number(f[14]) || 0,
        latitude: Number.isFinite(Number(f[4])) ? Number(f[4]) : null,
        longitude: Number.isFinite(Number(f[5])) ? Number(f[5]) : null,
      })
      if (batch.length >= BATCH) await flush()
    }
    await flush()

    return json({ ok: true, regions: regions.length, cities })
  } catch (e) {
    console.error('geo-load failed', e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
