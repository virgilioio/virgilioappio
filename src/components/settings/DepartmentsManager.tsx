import { useMemo, useState } from 'react'
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, MoreHorizontal } from 'lucide-react'
import { useDepartments, type Department } from '@/hooks/useDepartments'
import { supabase } from '@/lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IdentityCell, NumericCell, StatusCell, ActionCell } from '@/components/ui/table-cells'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DepartmentFormDialog } from './DepartmentFormDialog'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftBuilding } from '@/components/ui/EmptyIllustrations'

function useJobCountsByDepartment() {
  return useQuery({
    queryKey: ['departments', 'job-counts'],
    queryFn: async (): Promise<Record<string, { total: number; open: number }>> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('department_id, status')
        .not('department_id', 'is', null)
      if (error) throw error
      // Plain object (not Map) so the React Query persister can rehydrate it
      // from localStorage without losing prototype methods.
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

export function DepartmentsManager() {
  const { departments, isLoading, createDepartment, updateDepartment, deleteDepartment } = useDepartments({ includeArchived: true })
  const { data: counts } = useJobCountsByDepartment()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [toDelete, setToDelete] = useState<Department | null>(null)

  const sorted = useMemo(() => {
    return [...departments].sort((a, b) => {
      if (a.is_system !== b.is_system) return a.is_system ? -1 : 1
      if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [departments])

  const handleSubmit = async (data: { name: string; description?: string | null }) => {
    if (editing) {
      await updateDepartment.mutateAsync({ id: editing.id, ...data })
    } else {
      await createDepartment.mutateAsync(data)
    }
    setFormOpen(false)
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E7E8EE] rounded-xl overflow-hidden">
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h3 className="font-poppins font-semibold text-[14px] text-[#0d0d09]" style={{ letterSpacing: '-0.01em' }}>
              Departments
            </h3>
            <p className="font-inter text-[12px] text-[#5A6072] mt-1 leading-relaxed">
              Group jobs by function. Shared across every client in your workspace.
            </p>
          </div>
          <Button size="sm" icon={Plus} onClick={() => { setEditing(null); setFormOpen(true) }}>
            Create department
          </Button>
        </header>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Open jobs</TableHead>
              <TableHead className="text-right">Total jobs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[32px] text-right" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-text-tertiary">Loading departments…</TableCell>
              </TableRow>
            )}
            {!isLoading && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    size="card"
                    illustration={<SoftBuilding />}
                    title="No departments yet"
                    body="Add departments to organize your jobs and teams."
                  />
                </TableCell>
              </TableRow>
            )}
            {sorted.map((d) => {
              const c = counts?.[d.id]
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <IdentityCell
                      name={
                        <span className="flex items-center gap-2">
                          {d.name}
                          {d.is_system && <Badge tone="lilac" size="xs">Default</Badge>}
                        </span>
                      }
                      sub={d.description || undefined}
                      fallback={d.name}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <NumericCell>{c?.open ?? 0}</NumericCell>
                  </TableCell>
                  <TableCell className="text-right">
                    <NumericCell>{c?.total ?? 0}</NumericCell>
                  </TableCell>
                  <TableCell>
                    <StatusCell>
                      {d.is_archived ? (
                        <Badge tone="neutral" size="sm">Archived</Badge>
                      ) : (
                        <Badge tone="green" size="sm" dot>Active</Badge>
                      )}
                    </StatusCell>
                  </TableCell>
                  <TableCell className="w-[32px] text-right">
                    <ActionCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="xs" iconOnly icon={MoreHorizontal} aria-label="Department actions" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(d); setFormOpen(true) }} disabled={d.is_system}>
                            <Pencil className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          {d.is_archived ? (
                            <DropdownMenuItem onClick={() => updateDepartment.mutate({ id: d.id, is_archived: false })}>
                              <ArchiveRestore className="h-4 w-4 mr-2" />Restore
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => updateDepartment.mutate({ id: d.id, is_archived: true })} disabled={d.is_system}>
                              <Archive className="h-4 w-4 mr-2" />Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setToDelete(d)} disabled={d.is_system || (c?.total ?? 0) > 0} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ActionCell>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <DepartmentFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null) }}
        initial={editing}
        onSubmit={handleSubmit}
        isSubmitting={createDepartment.isPending || updateDepartment.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <span className="font-medium">{toDelete?.name}</span>. You can only delete a department with no jobs assigned to it. Archive it instead if you want to keep history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) deleteDepartment.mutate(toDelete.id)
                setToDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default DepartmentsManager
