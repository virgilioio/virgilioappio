import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { CareersTopBar } from '@/components/careers/public/CareersTopBar'
import { CareersHero } from '@/components/careers/public/CareersHero'
import { CareersFilterBar } from '@/components/careers/public/CareersFilterBar'
import { CareersRoleList, type CareersRole } from '@/components/careers/public/CareersRoleList'
import { CareersHowWeHireCard } from '@/components/careers/public/CareersHowWeHireCard'
import { CareersOpenApplicationBand } from '@/components/careers/public/CareersOpenApplicationBand'
import { CareersFooter } from '@/components/careers/public/CareersFooter'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftFlag, SoftMagnifier } from '@/components/ui/EmptyIllustrations'

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
        if (se || !s) { setError('Company careers page not found'); setIsLoading(false); return }
        setSettings(s)

        const { data: t } = await supabase
          .from('tenants').select('id, name').eq('id', s.tenant_id).single()
        if (t) setTenantInfo(t)

        const { data: p } = await supabase
          .from('job_postings')
          .select('id, title, slug, details, created_at, job_id, tenant_id, location, job_type, jobs!inner(status, organization_id)')
          .eq('is_active', true).eq('tenant_id', s.tenant_id)
          .eq('jobs.status', 'open')
          .neq('jobs.organization_id', VIRGILIO_INTERNAL_ORG_ID)
          .order('created_at', { ascending: false })
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
        console.error(e); setError('Failed to load careers page'); setIsLoading(false)
      }
    }
    fetchData()
  }, [companySlug])

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

  const handleOpen = (slug: string) => window.open(`/p/${slug}`, '_blank', 'noopener,noreferrer')
  const scrollToRoles = () => rolesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <Loader2 className="h-8 w-8 animate-spin text-virgilio-purple" />
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
            {roles.length === 0 ? (
              <EmptyState
                size="card"
                illustration={<SoftFlag />}
                title="No open roles right now"
                body="Check back soon — we're always on the lookout for great people."
              />
            ) : (
              <EmptyState
                size="card"
                illustration={<SoftMagnifier />}
                title="No roles match your filters"
                body="Try clearing your filters to see all open positions."
                primary={
                  <EmptyAction
                    variant="primary"
                    onClick={() => { setSearch(''); setDepartment('all'); setLocation('all'); setType('all') }}
                  >
                    Clear filters
                  </EmptyAction>
                }
              />
            )}
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
