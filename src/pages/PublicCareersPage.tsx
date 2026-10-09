import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { CareersTopBar } from '@/components/careers/public/CareersTopBar'
import { CareersHero } from '@/components/careers/public/CareersHero'
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

// Virgilio internal org — its jobs live exclusively on /virgilio-careers, never here.
const VIRGILIO_INTERNAL_ORG_ID = '4b8e739f-2b15-487e-8d31-0a2ce765a8ef'

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

export default function PublicCareersPage() {
  const { companySlug } = useParams<{ companySlug: string }>()
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
      if (!companySlug) { setError('No company slug provided'); setIsLoading(false); return }
      try {
        const { data: s, error: se } = await supabase
          .from('careers_page_settings').select('*')
          .eq('company_slug', companySlug).eq('is_active', true).single()
        if (se && se.code !== 'PGRST116') throw se
        if (se || !s) { setError('Company careers page not found'); setIsLoading(false); return }
        setSettings(s)

        const { data: tRows } = await supabase
          .rpc('get_public_tenant_info', { p_tenant_id: s.tenant_id })
        const t = Array.isArray(tRows) ? tRows[0] : null
        if (t) setTenantInfo({ id: t.id, name: t.name })

        const { data: p, error: pe } = await supabase
          .from('job_postings')
          .select('id, title, slug, details, created_at, job_id, tenant_id, location, job_type, jobs!inner(status, organization_id)')
          .eq('is_active', true).eq('tenant_id', s.tenant_id)
          .eq('jobs.status', 'open')
          .neq('jobs.organization_id', VIRGILIO_INTERNAL_ORG_ID)
          .order('created_at', { ascending: false })
        if (pe) throw pe
        if (p) setPostings(p as RawPosting[])

        const { data: deps } = await supabase
          .from('departments')
          .select('name')
          .eq('tenant_id', s.tenant_id)
          .eq('is_archived', false)
          .order('name')
        if (deps) setWorkspaceDepartments(deps.map((d: any) => d.name).filter(Boolean))

        setIsLoading(false)
      } catch (e) {
        console.error(e); setLoadFailed(true); setIsLoading(false)
      }
    }
    fetchData()
  }, [companySlug, reload])

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

  // Sort departments alphabetically, but pin the generic catch-alls ("General", "Other") last
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

  const companyName = tenantInfo?.name || settings.page_title || 'Company'

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <CareersTopBar
        logoUrl={settings.logo_url}
        companyName={companyName}
        websiteUrl={settings.company_website_url}
        showCompanyName={settings.show_company_name}
      />
      <CareersHero
        openRolesCount={roles.length}
        departmentsCount={departments.length}
        companyName={companyName}
        headerText={settings.header_text}
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
      <CareersHowWeHireCard />
      <CareersOpenApplicationBand companyName={companyName} />
      <CareersFooter companyName={companyName} logoUrl={settings.logo_url} websiteUrl={settings.company_website_url} />
    </div>
  )
}
