import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Organization, CreateOrganizationData, UpdateOrganizationData } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'

const formSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  status: z.enum(['active', 'inactive'])
})

type FormData = z.infer<typeof formSchema>

interface OrganizationFormSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateOrganizationData | UpdateOrganizationData) => Promise<void>
  organization?: Organization | null
  isLoading: boolean
}

export function OrganizationFormSheet({ 
  isOpen, 
  onClose, 
  onSubmit, 
  organization, 
  isLoading 
}: OrganizationFormSheetProps) {
  const permissions = usePermissions()
  const isEditing = !!organization
  const { user } = useAuth()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      status: 'active'
    }
  })

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name,
        status: organization.status
      })
    } else {
      form.reset({
        name: '',
        status: 'active'
      })
    }
  }, [organization, form])

  const handleSubmit = async (data: FormData) => {
    try {
      await onSubmit(data)
      onClose()
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] h-full p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle className="text-lg">
              {isEditing ? 'Edit Department' : 'Create Department'}
            </SheetTitle>
            <SheetDescription>
              {isEditing ? 'Update department details' : 'Create a new department. Parent and ownership will be set automatically based on your role.'}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter department name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  )
}