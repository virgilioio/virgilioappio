import React, { useState } from 'react'
import { MoreHorizontal, Edit, Trash2, Search, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
      <Card className="bg-surface-primary">
        <CardHeader>
          <Skeleton className="h-10 w-full max-w-sm" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-surface-primary">
      <CardHeader>
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
      </CardHeader>

      <CardContent>
        {filteredDepartments.length === 0 ? (
          <div className="text-center py-12 bg-surface-secondary rounded-brand">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-text-secondary opacity-50" />
            <p className="text-lg font-medium text-text-primary mb-2">
              {searchTerm ? 'No departments match your search' : 'No departments found'}
            </p>
            <p className="text-sm text-text-secondary">
              {searchTerm ? 'Try adjusting your search criteria.' : 'Create your first department to get started.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    {canManageDepartments && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartments.map((department) => (
                    <TableRow key={department.id} interactive>
                      <TableCell className="font-medium">
                        {department.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[300px]">
                        {department.description || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(department.created_at).toLocaleDateString()}
                      </TableCell>
                      {canManageDepartments && (
                        <TableCell className="text-right">
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
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredDepartments.map((department) => (
                <Card key={department.id} className="bg-background">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-text-primary mb-1">
                          {department.name}
                        </h4>
                        {department.description && (
                          <p className="text-sm text-text-secondary mb-2">
                            {department.description}
                          </p>
                        )}
                        <p className="text-xs text-text-secondary">
                          Created {new Date(department.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {canManageDepartments && (
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
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

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
      </CardContent>
    </Card>
  )
}