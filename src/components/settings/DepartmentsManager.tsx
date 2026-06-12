import { useMemo, useState } from 'react'
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react'
import { useDepartments, type Department } from '@/hooks/useDepartments'
import { supabase } from '@/lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import { SpecCard } from '@/components/settings/shared/SpecCard'
import { SpecChip } from '@/components/settings/shared/SpecChip'
import { DepartmentFormDialog } from './DepartmentFormDialog'

function useJobCountsByDepartment() {
  return useQuery({
    queryKey: ['departments', 'job-counts'],
    queryFn: async (): Promise<Record<string, { total: number; open: number }>> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('department_id, status')
        .not('department_id', 'is', null)
      if (error) throw error
      const counts: Record<string, { total: number; open: number }> = {}
      for (const row of data || []) {
        const id = (row as any).department_id as string
        const c = counts[id] || { total: 0, open: 0 }
        c.total += 1
        if ((row as any).status === 'open') c.open += 1
        counts[id] = c
      }
      return counts
    },
    staleTime: 30_000,
  })
}

const GRID = '1fr 90px 90px 80px 60px'

export function DepartmentsManager() {
  const { departments, isLoading, createDepartment, updateDepartment } = useDepartments({ includeArchived: true })
  const { data: counts } = useJobCountsByDepartment()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)

  const sorted = useMemo(() => {
    return [...departments].sort((a, b) => {
      if (a.is_system !== b.is_system) return a.is_system ? -1 : 1
      if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [departments])

  const handleSubmit = async (data: { name: string; description?: string | null }) => {
    if (editing) await updateDepartment.mutateAsync({ id: editing.id, ...data })
    else await createDepartment.mutateAsync(data)
    setFormOpen(false); setEditing(null)
  }

  return (
    <>
      <SpecCard
        title="Departments"
        description="Group jobs by function. Shared across every client — one client can have jobs in many departments."
        action={
          <button
            type="button"
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="inline-flex items-center gap-1.5 font-inter font-semibold text-[12px] rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#0d0d09', color: '#fffcf9', height: 30, padding: '0 12px' }}
          >
            <Plus size={14} strokeWidth={2} /> Create department
          </button>
        }
      >
        {/* Column header row */}
        <div
          className="grid font-inter uppercase text-[#8B8F9E]"
          style={{
            gridTemplateColumns: GRID,
            gap: 12,
            padding: '8px 18px',
            borderBottom: '1px solid #F1F0EC',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.07em',
          }}
        >
          <div>Name</div>
          <div className="text-right">Open</div>
          <div className="text-right">Total</div>
          <div className="text-center">Status</div>
          <div />
        </div>

        {isLoading ? (
          <div className="font-inter text-[12px] text-[#8B8F9E]" style={{ padding: '18px' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="font-inter text-[12px] text-[#8B8F9E] text-center" style={{ padding: '24px 18px' }}>No departments yet.</div>
        ) : (
          sorted.map((d, idx) => {
            const c = counts?.[d.id]
            const open = c?.open ?? 0
            const total = c?.total ?? 0
            return (
              <div
                key={d.id}
                className="grid items-center group"
                style={{
                  gridTemplateColumns: GRID,
                  gap: 12,
                  padding: '9px 18px',
                  borderBottom: idx === sorted.length - 1 ? 'none' : '1px solid #F1F0EC',
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-inter text-[#1F2230] truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{d.name}</span>
                  {d.is_system && <SpecChip tone="purple">Default</SpecChip>}
                </div>
                <div
                  className="text-right font-poppins tabular-nums"
                  style={{ fontSize: 12.5, fontWeight: 600, color: open > 0 ? '#1F2230' : '#B5B9C4' }}
                >
                  {open}
                </div>
                <div className="text-right font-inter tabular-nums text-[#8B8F9E]" style={{ fontSize: 12 }}>
                  {total}
                </div>
                <div className="flex justify-center">
                  {d.is_archived ? <SpecChip tone="gray">Archived</SpecChip> : <SpecChip tone="green">Active</SpecChip>}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    aria-label="Edit department"
                    onClick={() => { setEditing(d); setFormOpen(true) }}
                    disabled={d.is_system}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[#8B8F9E] hover:text-[#0d0d09] hover:bg-[#F1F0EC] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Pencil size={12} />
                  </button>
                  {d.is_archived ? (
                    <button
                      type="button"
                      aria-label="Restore department"
                      onClick={() => updateDepartment.mutate({ id: d.id, is_archived: false })}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[#8B8F9E] hover:text-[#0d0d09] hover:bg-[#F1F0EC]"
                    >
                      <ArchiveRestore size={12} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Archive department"
                      onClick={() => updateDepartment.mutate({ id: d.id, is_archived: true })}
                      disabled={d.is_system}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[#8B8F9E] hover:text-[#0d0d09] hover:bg-[#F1F0EC] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Archive size={12} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </SpecCard>

      <DepartmentFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null) }}
        initial={editing}
        onSubmit={handleSubmit}
        isSubmitting={createDepartment.isPending || updateDepartment.isPending}
      />
    </>
  )
}

export default DepartmentsManager
