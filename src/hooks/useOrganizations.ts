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
  owner_email?: string | null
  owner_name?: string | null
  created_by_email?: string | null
  created_by_name?: string | null
  billing_poc_user_id?: string | null
  billing_poc_additional_email?: string | null
  billing_poc_phone?: string | null
  billing_poc_updated_by?: string | null
  billing_poc_updated_at?: string | null
  billing_poc_user_email?: string | null
  billing_poc_user_name?: string | null
  default_currency?: string | null
  parent_organization_id?: string | null
  tenant_id?: string | null
  org_kind?: string | null
}

export interface CreateOrganizationData {
  name: string
  country: string
  status: 'active' | 'inactive'
  owner_id?: string | null
  parent_organization_id?: string | null
}

export interface UpdateOrganizationData {
  name?: string
  country?: string
  status?: 'active' | 'inactive'
  owner_id?: string | null
  billing_poc_user_id?: string | null
  billing_poc_additional_email?: string | null
  billing_poc_phone?: string | null
  billing_poc_updated_by?: string | null
  billing_poc_updated_at?: string | null
  parent_organization_id?: string | null
}

// Helper function to fetch user display info
const fetchUserDisplayInfo = async (userId: string | null): Promise<{ email: string; name: string } | null> => {
  if (!userId) return null
  
  try {
    // Try to get user info from profiles table first
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', userId)
      .single()
    
    if (profileData && !profileError) {
      const name = [profileData.first_name, profileData.last_name].filter(Boolean).join(' ')
      return {
        email: profileData.email || '',
        name: name || 'Unnamed User'
      }
    }
    
    // Fallback: try to use the get_member_display_info function
    const { data: memberData, error: memberError } = await supabase
      .rpc('get_member_display_info', { member_user_id: userId })
    
    if (memberData && memberData.length > 0 && !memberError) {
      const member = memberData[0]
      const name = [member.first_name, member.last_name].filter(Boolean).join(' ')
      return {
        email: member.email || '',
        name: name || 'Unnamed User'
      }
    }
    
    console.warn(`Could not fetch user info for user ID: ${userId}`)
    return null
  } catch (error) {
    console.error('Error fetching user display info:', error)
    return null
  }
}

/**
 * Hook for managing Virgilio's internal client organizations.
 * 
 * Organization Structure:
 * - Virgilio (platform): The main platform organization
 * - Internal Clients: Organizations with signup_source = 'manual' (manually created by Virgilio staff)
 * - SaaS Customers: Organizations with signup_source = 'self_serve' (self-registered customers via signup flow)
 * 
 * This hook ONLY returns Virgilio's internal client organizations for the main Organizations page.
 * SaaS customers are managed separately in the Customer Management (SaaS) section.
 */
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
      
      // Only fetch internal client organizations (manually created by Virgilio staff)
      const { data: orgsData, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('signup_source', 'manual')
        .eq('organization_type', 'client')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching organizations:', fetchError)
        throw fetchError
      }

      console.log('Successfully fetched organizations:', orgsData)
      
      // Fetch user information for created_by and owner_id fields
      const organizationsWithDetails: Organization[] = []
      
      for (const org of orgsData || []) {
        // Fetch created_by user info
        const createdByInfo = await fetchUserDisplayInfo(org.created_by)
        
        // Fetch owner user info
        const ownerInfo = await fetchUserDisplayInfo(org.owner_id)
        
        // Billing POC functionality removed
        const billingPocInfo = null
        
        organizationsWithDetails.push({
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
          owner_email: ownerInfo?.email || null,
          owner_name: ownerInfo?.name || null,
          created_by_email: createdByInfo?.email || null,
          created_by_name: createdByInfo?.name || null,
          // billing_poc_user_id: removed
          billing_poc_additional_email: org.billing_poc_additional_email,
          billing_poc_phone: org.billing_poc_phone,
          billing_poc_updated_by: org.billing_poc_updated_by,
          billing_poc_updated_at: org.billing_poc_updated_at,
          billing_poc_user_email: billingPocInfo?.email || null,
          billing_poc_user_name: billingPocInfo?.name || null,
          // default_currency: removed
          parent_organization_id: (org as any).parent_organization_id || null,
          tenant_id: (org as any).tenant_id || null,
          org_kind: (org as any).org_kind || null
        })
      }

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

      await getOrganizations()
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
      
      const updateData = { ...data }
      if (data.billing_poc_user_id !== undefined || data.billing_poc_additional_email !== undefined || data.billing_poc_phone !== undefined) {
        updateData.billing_poc_updated_by = user?.id
        updateData.billing_poc_updated_at = new Date().toISOString()
      }
      
      const { data: updatedOrg, error: updateError } = await supabase
        .from('organizations')
        .update(updateData)
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

      await getOrganizations()
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

      await getOrganizations()
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
