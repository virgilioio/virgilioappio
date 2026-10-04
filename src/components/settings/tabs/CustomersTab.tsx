import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { ClientsManagedNote } from '@/components/organizations/ClientsManagedNote'
import { VIRGILIO_TENANT_ID } from '@/hooks/useChildOrganizationsForJobCreation'

const STATUS_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  active:   { bg: '#D1FAE5', fg: '#0B7A57', label: 'Active' },
  inactive: { bg: '#F1F0EC', fg: '#5A6072', label: 'Inactive' },
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?'
}

interface ClientRow {
  id: string
  name: string
  status: string
  is_internal: boolean
  sales_company_id: string | null
}

/**
 * Settings · Clients — read-only. Gio Sales is the master client list; the
 * ATS keeps mirrored client records only because jobs point at them.
 */
export function CustomersTab() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['clients-readonly'],
    queryFn: async () => {
      const [orgs, jobs] = await Promise.all([
        (supabase as any)
          .from('organizations')
          .select('id, name, status, is_internal, sales_company_id')
          .eq('tenant_id', VIRGILIO_TENANT_ID)
          .eq('org_kind', 'client')
          .order('name'),
        supabase.from('jobs').select('organization_id').eq('tenant_id', VIRGILIO_TENANT_ID).is('deleted_at', null),
      ])
      if (orgs.error) throw orgs.error
      const jobCounts: Record<string, number> = {}
      ;(jobs.data ?? []).forEach((j: any) => {
        if (j.organization_id) jobCounts[j.organization_id] = (jobCounts[j.organization_id] ?? 0) + 1
      })
      return { orgs: (orgs.data ?? []) as ClientRow[], jobCounts }
    },
  })

  const filtered = useMemo(() => {
    const rows = data?.orgs ?? []
    const q = search.trim().toLowerCase()
    return q ? rows.filter((o) => o.name.toLowerCase().includes(q)) : rows
  }, [data, search])

  const gridCols: React.CSSProperties = { gridTemplateColumns: '1fr 140px 70px 90px' }
  const head = 'font-inter text-[10px] font-semibold tracking-[0.07em] text-[#8B8F9E] uppercase'

  return (
    <section className="bg-white rounded-[12px] overflow-hidden mb-[14px]" style={{ border: '1px solid #E7E8EE' }}>
      <header className="flex items-center justify-between gap-4" style={{ padding: '14px 18px', borderBottom: '1px solid #F1F0EC' }}>
        <div className="min-w-0">
          <h3 className="font-poppins font-semibold text-[#0d0d09] m-0" style={{ fontSize: 13.5, letterSpacing: '-0.01em' }}>
            Clients
          </h3>
          <ClientsManagedNote label="Managed in Gio Sales" />
        </div>
        <div className="relative shrink-0">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B8F9E] pointer-events-none" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="font-inter outline-none h-[30px] w-[180px] pl-[26px] pr-[10px] bg-[#F6F5F1] rounded-lg text-[12px] text-[#1F2230]"
          />
        </div>
      </header>

      {isLoading ? (
        <div className="font-inter p-[18px] text-[12px] text-[#8B8F9E]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="font-inter text-center px-[18px] py-[28px] text-[12px] text-[#8B8F9E]">No clients here.</div>
      ) : (
        <>
          <div className="grid items-center" style={{ ...gridCols, padding: '8px 18px 4px' }}>
            <div className={head}>Client</div>
            <div className={head}>Source</div>
            <div className={`${head} text-right`}>Jobs</div>
            <div className={`${head} text-center`}>Gio Sales status</div>
          </div>
          {filtered.map((org, idx) => {
            const chip = STATUS_CHIP[org.status] ?? STATUS_CHIP.inactive
            return (
              <div
                key={org.id}
                className="grid items-center"
                style={{ ...gridCols, padding: '10px 18px', borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid #F1F0EC' }}
              >
                <div className="flex items-center min-w-0 gap-[9px]">
                  <div className="shrink-0 inline-flex items-center justify-center font-inter w-6 h-6 rounded-md bg-[#F1F0EC] text-[#5A6072] text-[10px] font-semibold">
                    {initials(org.name)}
                  </div>
                  <span className="truncate font-inter text-[12.5px] font-medium text-[#1F2230]">{org.name}</span>
                </div>
                <div className="font-inter text-[11.5px] text-[#8B8F9E]">
                  {org.is_internal ? 'Internal' : org.sales_company_id ? 'Managed in Gio Sales' : 'Legacy (not linked)'}
                </div>
                <div className="font-inter text-right tabular-nums text-[12px] text-[#8B8F9E]">{data?.jobCounts[org.id] ?? 0}</div>
                <div className="flex justify-center">
                  <span className="inline-flex items-center font-inter text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: chip.bg, color: chip.fg }}>
                    {chip.label}
                  </span>
                </div>
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}
