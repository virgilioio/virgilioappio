
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Organization, CreateOrganizationData, UpdateOrganizationData } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'

const formSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  country: z.string().min(1, 'Country is required'),
  status: z.enum(['active', 'inactive']),
  owner_id: z.string().optional()
})

type FormData = z.infer<typeof formSchema>

interface OrganizationFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateOrganizationData | UpdateOrganizationData) => Promise<void>
  organization?: Organization | null
  isLoading: boolean
}

const countries = [
  'United States',
  'United Kingdom',
  'Germany',
  'France',
  'Canada',
  'Australia',
  'Japan',
  'Brazil',
  'India',
  'Netherlands',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Switzerland',
  'Austria',
  'Belgium',
  'Spain',
  'Italy',
  'Portugal'
].sort()

export function OrganizationForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  organization, 
  isLoading 
}: OrganizationFormProps) {
  const permissions = usePermissions()
  const isEditing = !!organization

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      country: '',
      status: 'active',
      owner_id: ''
    }
  })

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name,
        country: organization.country,
        status: organization.status,
        owner_id: organization.owner_id || ''
      })
    } else {
      form.reset({
        name: '',
        country: '',
        status: 'active',
        owner_id: ''
      })
    }
  }, [organization, form])

  const handleSubmit = async (data: FormData) => {
    try {
      const submitData = {
        ...data,
        owner_id: data.owner_id || null
      }
      await onSubmit(submitData)
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Organization' : 'Create Organization'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-token-lg">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter organization name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

            {permissions.isPlatformAdmin && (
              <FormField
                control={form.control}
                name="owner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter owner user ID" 
                        {...field}
                        disabled={isEditing && !permissions.isPlatformAdmin}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
