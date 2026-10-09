import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { CareersTopBar } from '@/components/careers/public/CareersTopBar'
import { VirgilioCareersHero } from '@/components/careers/virgilio/VirgilioCareersHero'
import { CareersFilterBar } from '@/components/careers/public/CareersFilterBar'
import { CareersRoleList, type CareersRole } from '@/components/careers/public/CareersRoleList'
import { CareersHowWeHireCard } from '@/components/careers/public/CareersHowWeHireCard'
import { CareersOpenApplicationBand } from '@/components/careers/public/CareersOpenApplicationBand'
import { CareersFooter } from '@/components/careers/public/CareersFooter'
import { EmptyState } from '@/components/ui/empty-state'
import { AnimatedEmpty, EmptyCard } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { SoftFlag } from '@/components/ui/EmptyIllustrations'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'

// Hardcoded so the duplicate "Virgilio" org (with 0 jobs) can never be selected.
// Org id is the one currently holding the 7 internal Virgilio job postings.
const VIRGILIO_INTERNAL_ORG_ID = '4b8e739f-2b15-487e-8d31-0a2ce765a8ef'
const VIRGILIO_TENANT_ID = '5ba7b145-f251-4b18-8900-724cb06028ab'

interface CareersSettings {
  id: string
  tenant_id: string
  logo_url: string | null
  company_website_url: string | null
  company_slug: string
  page_title: string
  header_text: string | null
  show_company_name: boolean
}

interface TenantInfo { id: string; name: string }

interface RawPosting {
  id: string
  title: string
  slug: string
  details: any
  created_at: string
  job_id: string
  tenant_id: string
  location: string | null
  job_type: string | null
}

export default function VirgilioCareersPage() {
  const [settings, setSettings] = useState<CareersSettings | null>(null)
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null)
  const [postings, setPostings] = useState<RawPosting[]>([])
  const [workspaceDepartments, setWorkspaceDepartments] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // A failed fetch is not "not found": it gets Retry (§16).
  const [loadFailed, setLoadFailed] = useState(false)
  const [reload, setReload] = useState(0)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('all')
  const [location, setLocation] = useState('all')
  const [type, setType] = useState('all')

  const rolesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: s, error: se } = await supabase
          .from('careers_page_settings').select('*')
          .eq('tenant_id', VIRGILIO_TENANT_ID).eq('is_active', true).maybeSingle()
        if (se && se.code !== 'PGRST116') throw se
        if (se || !s) { setError('Virgilio careers page is not configured'); setIsLoading(false); return }
        setSettings(s)

        const { data: tRows } = await supabase
          .rpc('get_public_tenant_info', { p_tenant_id: VIRGILIO_TENANT_ID })
        const t = Array.isArray(tRows) ? tRows[0] : null
        if (t) setTenantInfo({ id: t.id, name: t.name })

        const { data: p, error: pe } = await supabase
          .from('job_postings')
          .select('id, title, slug, details, created_at, job_id, tenant_id, location, job_type, jobs!inner(status, organization_id)')
          .eq('is_active', true).eq('tenant_id', VIRGILIO_TENANT_ID)
          .eq('jobs.status', 'open')
          .eq('jobs.organization_id', VIRGILIO_INTERNAL_ORG_ID)
          .order('created_at', { ascending: false })
        if (pe) throw pe
        if (p) setPostings(p as RawPosting[])

        const { data: deps } = await supabase
          .from('departments')
          .select('name')
          .eq('tenant_id', VIRGILIO_TENANT_ID)
          .eq('is_archived', false)
          .order('name')
        if (deps) setWorkspaceDepartments(deps.map((d: any) => d.name).filter(Boolean))

        setIsLoading(false)
      } catch (e) {
        console.error(e); setLoadFailed(true); setIsLoading(false)
      }
    }
    fetchData()
  }, [reload])

  const roles: CareersRole[] = useMemo(() => postings.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    department: (p.details?.department as string) || 'Other',
    location: p.location,
    type: p.job_type,
    workMode: (p.details?.work_mode as string) || (p.location?.toLowerCase().includes('remote') ? 'Remote' : null),
    postedAt: p.created_at,
    featured: !!p.details?.featured,
  })), [postings])

  const sortDepartments = (a: string, b: string) => {
    const pinned = (s: string) => s === 'General' || s === 'Other'
    if (pinned(a) && !pinned(b)) return 1
    if (!pinned(a) && pinned(b)) return -1
    if (a === 'Other' && b === 'General') return 1
    if (a === 'General' && b === 'Other') return -1
    return a.localeCompare(b)
  }

  const departments = useMemo(
    () => Array.from(new Set([...workspaceDepartments, ...roles.map((r) => r.department)])).sort(sortDepartments),
    [roles, workspaceDepartments],
  )
  const locations = useMemo(() => Array.from(new Set(roles.map((r) => r.location).filter(Boolean) as string[])).sort(), [roles])
  const types = useMemo(() => Array.from(new Set(roles.map((r) => r.type).filter(Boolean) as string[])).sort(), [roles])

  const filtered = useMemo(() => roles.filter((r) => {
    if (department !== 'all' && r.department !== department) return false
    if (location !== 'all' && r.location !== location) return false
    if (type !== 'all' && r.type !== type) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!r.title.toLowerCase().includes(q) && !r.department.toLowerCase().includes(q) && !(r.location || '').toLowerCase().includes(q)) return false
    }
    return true
  }), [roles, department, location, type, search])

  const groups = useMemo(() => {
    const map = new Map<string, CareersRole[]>()
    for (const r of filtered) {
      const arr = map.get(r.department) || []
      arr.push(r); map.set(r.department, arr)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => sortDepartments(a, b))
      .map(([dep, arr]) => ({ department: dep, roles: arr }))
  }, [filtered])

  useReportSplashReady(!isLoading)

  const handleOpen = (slug: string) => window.open(`/p/${slug}`, '_blank', 'noopener,noreferrer')
  const scrollToRoles = () => rolesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <Loader2 className="h-8 w-8 animate-spin text-virgilio-purple" />
      </div>
    )
  }

  if (loadFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] px-4">
        <div className="max-w-md w-full">
          <EmptyCard>
            <LoadError
              what="this careers page"
              onRetry={() => { setLoadFailed(false); setIsLoading(true); setReload((n) => n + 1) }}
            />
          </EmptyCard>
        </div>
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] px-4">
        <div className="max-w-md w-full">
          <EmptyState
            size="card"
            illustration={<SoftFlag />}
            title={error || 'Page not found'}
            body="The careers page you're looking for doesn't exist or is no longer available."
          />
        </div>
      </div>
    )
  }

  const companyName = tenantInfo?.name || settings.page_title || 'Virgilio'

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <CareersTopBar
        logoUrl={settings.logo_url}
        companyName={companyName}
        websiteUrl={settings.company_website_url}
        showCompanyName={settings.show_company_name}
      />
      <VirgilioCareersHero
        openRolesCount={roles.length}
        departmentsCount={departments.length}
        onScrollToRoles={scrollToRoles}
      />
      <div ref={rolesRef}>
        <CareersFilterBar
          search={search} onSearch={setSearch}
          department={department} onDepartment={setDepartment}
          location={location} onLocation={setLocation}
          type={type} onType={setType}
          departments={departments} locations={locations} types={types}
        />
        {groups.length === 0 ? (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <EmptyCard>
              {roles.length === 0 ? (
                <AnimatedEmpty
                  scene="jobs"
                  onceKey="careers-roles"
                  title="No open roles right now"
                  body="Check back soon, or follow us to hear when something opens."
                />
              ) : (
                <AnimatedEmpty
                  scene="search"
                  onceKey="careers-roles"
                  title="No roles match your filters"
                  body="Clear filters to see every open role."
                  primary={{
                    label: 'Clear filters',
                    icon: <RotateCcw size={16} strokeWidth={2} />,
                    onClick: () => { setSearch(''); setDepartment('all'); setLocation('all'); setType('all') },
                  }}
                />
              )}
            </EmptyCard>
          </div>
        ) : (
          <CareersRoleList groups={groups} onOpen={handleOpen} />
        )}
      </div>
      <CareersHowWeHireCard paragraph="Every applicant hears back within 48 hours. Most processes take 2–3 weeks, with the same small panel for everyone. We share scorecards ahead of time, we pay for take-home assignments, and we never ghost." />
      <CareersOpenApplicationBand
        companyName={companyName}
        text="Don't see the right role yet? Send us a note about the kind of work you're looking for. A real person reads every one."
      />
      <CareersFooter companyName={companyName} logoUrl={settings.logo_url} websiteUrl={settings.company_website_url} tagline="We're building the modern way to hire: AI for speed, people for judgement." />
    </div>
  )
}
