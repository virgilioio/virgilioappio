import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { buildPostingPath } from '@/lib/postingUrl'
import PublicJobPosting from '@/pages/PublicJobPosting'

/**
 * Resolves a legacy /p/:slug URL to the canonical namespaced URL
 * (/careers/:companySlug/:slug or /virgilio-careers/:slug). Falls back
 * to rendering the standard PublicJobPosting page when no careers
 * settings exist (so the page still loads instead of hard-redirecting
 * to itself).
 */
export default function LegacyPostingRedirect() {
  const { slug } = useParams<{ slug: string }>()
  const [target, setTarget] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!slug) { setResolved(true); return }
      const { data: posting } = await supabase
        .from('job_postings')
        .select('slug, tenant_id, jobs!inner(organization_id)')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()

      if (cancelled) return
      if (!posting) { setResolved(true); return }

      const organizationId = (posting as any).jobs?.organization_id ?? null

      const { data: careers } = await supabase
        .from('careers_page_settings')
        .select('company_slug')
        .eq('tenant_id', (posting as any).tenant_id)
        .eq('is_active', true)
        .maybeSingle()

      if (cancelled) return

      const path = buildPostingPath({
        postingSlug: slug,
        organizationId,
        companySlug: careers?.company_slug ?? null,
      })
      // Only navigate if it's different from the current /p/:slug
      if (path !== `/p/${slug}`) {
        setTarget(path)
      }
      setResolved(true)
    }
    run()
    return () => { cancelled = true }
  }, [slug])

  if (target) return <Navigate to={target} replace />
  if (!resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <Loader2 className="h-6 w-6 animate-spin text-virgilio-purple" />
      </div>
    )
  }
  // No careers settings or posting not found — render the standard page
  // (which will show its own canonical "Posting not found" empty state if needed).
  return <PublicJobPosting />
}
