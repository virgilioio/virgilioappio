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
  const { user, userType } = useAuth()

  const getOrganizations = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching organizations for user:', user.id, 'userType:', userType)
      
      let query = supabase
        .from('organizations')
        .select(`
          *,
          owner_profile:profiles!fk_organizations_owner_profiles(email),
          creator_profile:profiles!fk_organizations_created_by_profiles(email)
        `)
        .order('created_at', { ascending: false })

      // For workspace owners, prioritize organizations they own
      if (userType === 'workspace_owner') {
        // First try to get organizations where user is the owner
        const { data: ownedOrgs, error: ownedError } = await supabase
          .from('organizations')
          .select(`
            *,
            owner_profile:profiles!fk_organizations_owner_profiles(email),
            creator_profile:profiles!fk_organizations_created_by_profiles(email)
          `)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })

        if (ownedError) {
          console.error('Error fetching owned organizations:', ownedError)
        }

        if (ownedOrgs && ownedOrgs.length > 0) {
          console.log('Found owned organizations for workspace owner:', ownedOrgs)
          const organizationsWithDetails: Organization[] = ownedOrgs.map((org: any) => ({
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
          }))
          setOrganizations(organizationsWithDetails)
          return
        }

        // Fallback: Get organizations via member relationship
        console.log('No owned organizations found, checking member relationship')
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('organization_id')
          .eq('user_id', user.id)

        if (memberError) {
          throw memberError
        }

        const orgIds = memberData?.map(m => m.organization_id).filter(Boolean) || []
        
        if (orgIds.length === 0) {
          console.log('No organization found for workspace owner')
          setOrganizations([])
          return
        }

        query = query.in('id', orgIds)
      }

      // For platform admins, get all organizations (no filtering needed)
      const { data: orgsData, error: fetchError } = await query

      if (fetchError) {
        console.error('Error fetching organizations with relationships:', fetchError)
        
        // Fallback to basic query without relationships
        console.log('Falling back to basic query without profile relationships')
        
        let basicQuery = supabase
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: false })

        // Apply same filtering for workspace owners
        if (userType === 'workspace_owner') {
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('organization_id')
            .eq('user_id', user.id)

          if (memberError) {
            throw memberError
          }

          const orgIds = memberData?.map(m => m.organization_id).filter(Boolean) || []
          
          if (orgIds.length === 0) {
            setOrganizations([])
            return
          }

          basicQuery = basicQuery.in('id', orgIds)
        }

        const { data: basicOrgsData, error: basicFetchError } = await basicQuery

        if (basicFetchError) {
          throw basicFetchError
        }

        // Transform basic data without profile relationships
        const organizationsWithoutProfiles: Organization[] = (basicOrgsData || []).map((org: any) => ({
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
          owner_email: null,
          created_by_email: null
        }))

        setOrganizations(organizationsWithoutProfiles)
        return
      }

      console.log('Successfully fetched organizations with profile relationships:', orgsData)
      
      // Transform the data to include email information from relationships
      const organizationsWithDetails: Organization[] = (orgsData || []).map((org: any) => ({
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
      }))

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

      await getOrganizations() // Refresh the list
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
  }, [user, userType])

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
