import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/**
 * How many rows of `table` point at `id` through `column` (null while
 * loading, or when `id` is null). Delete dialogs use it to say what goes with
 * a record, or to block a delete the database would refuse (2026-10-13).
 */
export function useRecordCount(table: string, column: string, id: string | null | undefined, extra?: (q: any) => any) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!id) { setCount(null); return }
    let alive = true
    setCount(null)
    let q: any = (supabase.from(table as any) as any).select('id', { count: 'exact', head: true }).eq(column, id)
    if (extra) q = extra(q)
    q.then(({ count: c, error }: { count: number | null; error: unknown }) => {
      if (alive) setCount(error ? 0 : c ?? 0)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, column, id])
  return count
}
