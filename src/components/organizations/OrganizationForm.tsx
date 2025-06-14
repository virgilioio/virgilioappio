
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Organization, CreateOrganizationData, UpdateOrganizationData } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { useMembers } from '@/hooks/useMembers'
import { COUNTRIES } from '@/constants/countries'

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

export function OrganizationForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  organization, 
  isLoading 
}: OrganizationFormProps) {
  const permissions = usePermissions()
  const { members } = useMembers()
  const isEditing = !!organization

  // Get workspace owners for the owner dropdown - filter out members without valid user_id
  const workspaceOwners = members.filter(member => 
    member.user_type === 'workspace_owner' && 
    member.user_status === 'active' &&
    member.user_id && // Only show members with actual user accounts
    member.user_id.trim() !== '' // Ensure it's not an empty string
  )

  // Create formatted options for the owner dropdown
  const ownerOptions = [
    { value: 'none', label: 'No owner assigned' },
    ...workspaceOwners.map(member => {
      const firstName = member.user_first_name || ''
      const lastName = member.user_last_name || ''
      const fullName = `${firstName} ${lastName}`.trim()
      const email = member.user_email || member.invited_email || ''
      
      let displayLabel = ''
      if (fullName && email) {
        displayLabel = `${fullName} (${email})`
      } else if (email) {
        displayLabel = email
      } else if (fullName) {
        displayLabel = `${fullName} (No email)`
      } else {
        displayLabel = `Unknown User (ID: ${member.user_id})`
      }
      
      return {
        value: member.user_id!,
        label: displayLabel
      }
    }),
    // Also include invited workspace owners
    ...members
      .filter(member => 
        member.user_type === 'workspace_owner' && 
        member.user_status === 'invited' &&
        member.invited_email
      )
      .map(member => ({
        value: `invited_${member.id}`, // Use a different prefix for invited users
        label: `Pending Invitation (${member.invited_email})`
      }))
  ]

  console.log('Workspace owners for select:', workspaceOwners)
  console.log('Owner options:', ownerOptions)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      country: '',
      status: 'active',
      owner_id: 'none' // Use 'none' instead of empty string
    }
  })

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name,
        country: organization.country,
        status: organization.status,
        owner_id: organization.owner_id || 'none' // Convert null to 'none'
      })
    } else {
      form.reset({
        name: '',
        country: '',
        status: 'active',
        owner_id: 'none' // Use 'none' instead of empty string
      })
    }
  }, [organization, form])

  const handleSubmit = async (data: FormData) => {
    try {
      const submitData = {
        ...data,
        // Only set owner_id if it's not 'none' and doesn't start with 'invited_'
        owner_id: data.owner_id === 'none' || data.owner_id?.startsWith('invited_') ? null : data.owner_id
      }
      console.log('Submitting organization data:', submitData)
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
                  <FormControl>
                    <SearchableSelect
                      options={COUNTRIES}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select a country"
                      searchPlaceholder="Search countries..."
                      emptyMessage="No countries found."
                    />
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

            {permissions.canManageOrganization && (
              <FormField
                control={form.control}
                name="owner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner (Optional)</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={ownerOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select an owner"
                        searchPlaceholder="Search owners..."
                        emptyMessage="No owners found."
                      />
                    </FormControl>
                    <FormDescription>
                      Optional. You can assign a workspace owner to manage this organization.
                      {ownerOptions.length <= 1 && " No workspace owners available - invite users with workspace owner role first."}
                    </FormDescription>
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
