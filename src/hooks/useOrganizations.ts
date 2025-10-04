import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useIsVirgilioAdmin } from '@/hooks/useIsVirgilioAdmin'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'

export interface Organization {
  id: string
  name: string
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
  status: 'active' | 'inactive'
}

export interface UpdateOrganizationData {
  name?: string
  status?: 'active' | 'inactive'
  owner_id?: string | null
  billing_poc_user_id?: string | null
  billing_poc_additional_email?: string | null
  billing_poc_phone?: string | null
  billing_poc_updated_by?: string | null
  billing_poc_updated_at?: string | null
  parent_organization_id?: string | null
}

// Optimized organizations hook - no longer needs helper function due to JOIN queries

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
  const { user, userType, organizationId } = useAuth()
  const isVirgilioAdmin = useIsVirgilioAdmin()

  // Helper function to get user's tenant organization
  const getUserTenantOrganization = async () => {
    if (userType === 'platform_admin' && isVirgilioAdmin) {
      // Platform admins use Virgilio as parent
      const { data: virgilioOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('name', 'Virgilio')
        .eq('organization_type', 'platform')
        .eq('tenant_type', 'saas')
        .single()
      
      return virgilioOrg?.id || null
    } else {
      // Workspace owners use their current organization's tenant
      const { data: memberData } = await supabase
        .from('members')
        .select('organizations!inner(tenant_id)')
        .eq('user_id', user?.id)
        .eq('user_status', 'active')
        .single()
      
      return memberData?.organizations?.tenant_id || null
    }
  }

  const getOrganizations = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching organizations for user:', user.id, 'userType:', userType)
      
      let query = supabase
        .from('organizations')
        .select(`*`)

      if (userType === 'platform_admin') {
        // Platform admins see all manual client organizations
        query = query
          .eq('signup_source', 'manual')
          .eq('organization_type', 'client')
      } else {
        // SaaS customers see only organizations in their tenant scope
        const { data: memberData } = await supabase
          .from('members')
          .select('organization_id, organizations!inner(tenant_id)')
          .eq('user_id', user.id)
          .eq('user_status', 'active')
          .single()

        if (memberData?.organizations?.tenant_id) {
          // Filter by tenant_id to show only organizations in their workspace
          query = query.eq('tenant_id', memberData.organizations.tenant_id)
        } else {
          // No tenant context, return empty
          setOrganizations([])
          setIsLoading(false)
          return
        }
      }

      const { data: orgsData, error: fetchError } = await withAuthRetry(async () =>
        await query.order('created_at', { ascending: false })
      )

      if (fetchError) {
        console.error('Error fetching organizations:', fetchError)
        throw fetchError
      }

      console.log('Successfully fetched organizations:', orgsData?.length)
      
      // Transform data to match Organization interface
      const organizationsWithDetails: Organization[] = (orgsData || []).map(org => {
        return {
          id: org.id,
          name: org.name,
          status: org.status as 'active' | 'inactive',
          organization_type: org.organization_type as 'platform' | 'client',
          owner_id: org.owner_id,
          created_at: org.created_at,
          updated_at: org.updated_at,
          created_by: org.created_by,
          owner_assigned_at: org.owner_assigned_at,
          owner_email: null, // Will be populated if needed
          owner_name: null,   // Will be populated if needed
          created_by_email: null, // Will be populated if needed
          created_by_name: null,  // Will be populated if needed
          billing_poc_additional_email: org.billing_poc_additional_email,
          billing_poc_phone: org.billing_poc_phone,
          billing_poc_updated_by: org.billing_poc_updated_by,
          billing_poc_updated_at: org.billing_poc_updated_at,
          billing_poc_user_email: null,
          billing_poc_user_name: null,
          parent_organization_id: org.parent_organization_id || null,
          tenant_id: org.tenant_id || null,
          org_kind: org.org_kind || null
        }
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
      
      // Get user's tenant organization for parent assignment
      const tenantOrgId = await getUserTenantOrganization()
      
      if (!tenantOrgId) {
        throw new Error('Unable to determine parent organization. Please ensure you have proper permissions.')
      }
      
      // Build the complete organization data with implicit values
      const organizationData = {
        ...data,
        org_kind: 'client' as const, // Always client for manually created orgs
        owner_id: user?.id || null, // Current user as owner
        parent_organization_id: tenantOrgId, // Auto-determined parent
        tenant_id: tenantOrgId, // Same as parent for client orgs
        signup_source: 'manual', // Mark as manually created
        tenant_type: 'internal', // Internal tenant type
        organization_type: 'client' // Client organization type
      }
      
      console.log('Creating organization with data:', organizationData)
      
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([organizationData])
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
