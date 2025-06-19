
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Organization {
  id: string
  name: string
  country: string
  status: 'active' | 'inactive'
  organization_type: 'platform' | 'client'
  owner_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  owner_assigned_at: string | null
  owner_email?: string
  created_by_email?: string
}

export interface CreateOrganizationData {
  name: string
  country: string
  status: 'active' | 'inactive'
  owner_id?: string | null
}

export interface UpdateOrganizationData {
  name?: string
  country?: string
  status?: 'active' | 'inactive'
  owner_id?: string | null
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getOrganizations = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching organizations for user:', user.id)
      
      // First, debug the user's permissions
      const { data: debugData, error: debugError } = await supabase
        .rpc('debug_user_permissions')
      
      if (debugError) {
        console.error('Debug permissions error:', debugError)
      } else {
        console.log('User permissions debug:', debugData?.[0])
      }
      
      // Query organizations with proper relationship syntax for profile data
      const { data: orgsData, error: fetchError } = await supabase
        .from('organizations')
        .select(`
          *,
          owner_profile:profiles!organizations_owner_id_fkey(email),
          creator_profile:profiles!organizations_created_by_fkey(email)
        `)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching organizations:', fetchError)
        // If the relationship query fails, fall back to basic query
        console.log('Falling back to basic query without profile relationships')
        
        const { data: basicOrgsData, error: basicFetchError } = await supabase
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: false })

        if (basicFetchError) {
          throw basicFetchError
        }

        // For basic query, we'll fetch profile data separately for each org
        const organizationsWithProfiles = await Promise.all(
          (basicOrgsData || []).map(async (org: any) => {
            let ownerEmail = null
            let createdByEmail = null

            // Fetch owner profile if owner_id exists
            if (org.owner_id) {
              const { data: ownerProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('user_id', org.owner_id)
                .single()
              ownerEmail = ownerProfile?.email || null
            }

            // Fetch creator profile if created_by exists
            if (org.created_by) {
              const { data: creatorProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('user_id', org.created_by)
                .single()
              createdByEmail = creatorProfile?.email || null
            }

            return {
              ...org,
              owner_email: ownerEmail,
              created_by_email: createdByEmail
            }
          })
        )

        setOrganizations(organizationsWithProfiles.map((org: any) => ({
          id: org.id,
          name: org.name,
          country: org.country,
          status: org.status as 'active' | 'inactive',
          organization_type: org.organization_type as 'platform' | 'client',
          owner_id: org.owner_id,
          created_at: org.created_at,
          updated_at: org.updated_at,
          created_by: org.created_by,
          owner_assigned_at: org.owner_assigned_at,
          owner_email: org.owner_email,
          created_by_email: org.created_by_email
        })))

        return
      }

      console.log('Fetched organizations with profile relationships:', orgsData)
      
      // Transform the data to include email information from relationships
      const organizationsWithDetails: Organization[] = (orgsData || []).map((org: any) => {
        const typedOrg: Organization = {
          id: org.id,
          name: org.name,
          country: org.country,
          status: org.status as 'active' | 'inactive',
          organization_type: org.organization_type as 'platform' | 'client',
          owner_id: org.owner_id,
          created_at: org.created_at,
          updated_at: org.updated_at,
          created_by: org.created_by,
          owner_assigned_at: org.owner_assigned_at,
          owner_email: org.owner_profile?.email || null,
          created_by_email: org.creator_profile?.email || null
        }
        
        return typedOrg
      })

      setOrganizations(organizationsWithDetails)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch organizations'
      console.error('Organizations fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createOrganization = async (data: CreateOrganizationData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating organization:', data)
      
      // Note: created_by will be automatically populated by the database trigger
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([data])
        .select()
        .single()

      if (createError) {
        console.error('Error creating organization:', createError)
        throw createError
      }

      console.log('Created organization:', newOrg)
      toast({
        title: 'Success',
        description: 'Organization created successfully'
      })

      await getOrganizations() // Refresh the list to show the new org immediately
      return newOrg
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create organization'
      console.error('Organization creation error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateOrganization = async (id: string, data: UpdateOrganizationData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating organization:', id, data)
      const { data: updatedOrg, error: updateError } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating organization:', updateError)
        throw updateError
      }

      console.log('Updated organization:', updatedOrg)
      toast({
        title: 'Success',
        description: 'Organization updated successfully'
      })

      await getOrganizations() // Refresh the list
      return updatedOrg
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update organization'
      console.error('Organization update error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const deleteOrganization = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Soft deleting organization:', id)
      const { error: deleteError } = await supabase
        .from('organizations')
        .update({ status: 'inactive' })
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting organization:', deleteError)
        throw deleteError
      }

      console.log('Soft deleted organization:', id)
      toast({
        title: 'Success',
        description: 'Organization deactivated successfully'
      })

      await getOrganizations() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deactivate organization'
      console.error('Organization deletion error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      getOrganizations()
    }
  }, [user])

  return {
    organizations,
    isLoading,
    error,
    getOrganizations,
    createOrganization,
    updateOrganization,
    deleteOrganization
  }
}
