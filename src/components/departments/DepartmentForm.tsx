import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCreateDepartment, useUpdateDepartment, Department } from '@/hooks/useDepartments'
import { useUserProfile } from '@/hooks/useUserProfile'

const departmentFormSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100, 'Department name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
})

type DepartmentFormData = z.infer<typeof departmentFormSchema>

interface DepartmentFormProps {
  department?: Department
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DepartmentForm({ department, open, onOpenChange }: DepartmentFormProps) {
  const { profile: userProfile } = useUserProfile()
  const createDepartment = useCreateDepartment()
  const updateDepartment = useUpdateDepartment()

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: department?.name || '',
      description: department?.description || '',
    },
  })

  const onSubmit = async (data: DepartmentFormData) => {
    if (!userProfile?.organization_id) {
      console.error('No organization ID found')
      return
    }

    try {
      if (department) {
        await updateDepartment.mutateAsync({
          id: department.id,
          data: {
            name: data.name,
            description: data.description,
          },
        })
      } else {
        await createDepartment.mutateAsync({
          name: data.name,
          description: data.description,
          organization_id: userProfile.organization_id,
        })
      }
      
      form.reset()
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the hooks
    }
  }

  const isLoading = createDepartment.isPending || updateDepartment.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {department ? 'Edit Department' : 'Create Department'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Engineering, Sales, HR" 
                      {...field}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the department"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : department ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}