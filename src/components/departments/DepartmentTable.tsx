import React, { useState } from 'react'
import { MoreHorizontal, Edit, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Department } from '@/hooks/useDepartments'
import { DepartmentForm } from './DepartmentForm'
import { DeleteDepartmentDialog } from './DeleteDepartmentDialog'
import { usePermissions } from '@/hooks/usePermissions'

interface DepartmentTableProps {
  departments: Department[]
  isLoading: boolean
}

export function DepartmentTable({ departments, isLoading }: DepartmentTableProps) {
  const permissions = usePermissions()
  const [searchTerm, setSearchTerm] = useState('')
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null)
  const [showForm, setShowForm] = useState(false)

  const canManageDepartments = permissions.isPlatformAdmin || permissions.isWorkspaceOwner

  const filteredDepartments = departments?.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const handleEdit = (department: Department) => {
    setEditingDepartment(department)
    setShowForm(true)
  }

  const handleDelete = (department: Department) => {
    setDeletingDepartment(department)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingDepartment(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Created</TableHead>
              {canManageDepartments && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDepartments.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={canManageDepartments ? 4 : 3} 
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchTerm ? 'No departments match your search.' : 'No departments found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredDepartments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">
                    {department.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {department.description || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(department.created_at).toLocaleDateString()}
                  </TableCell>
                  {canManageDepartments && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(department)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(department)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DepartmentForm
        department={editingDepartment}
        open={showForm}
        onOpenChange={handleFormClose}
      />

      <DeleteDepartmentDialog
        department={deletingDepartment}
        open={!!deletingDepartment}
        onOpenChange={(open) => !open && setDeletingDepartment(null)}
      />
    </div>
  )
}