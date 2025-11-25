import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useIsVirgilioAdmin } from '@/hooks/useIsVirgilioAdmin'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'
import { useQueryClient } from '@tanstack/react-query'
import { logActivity } from '@/lib/activityLogger'

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
  const queryClient = useQueryClient()

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
      log.debug('Fetching organizations for user:', user.id, 'userType:', userType)
      
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
        log.error('Error fetching organizations:', fetchError)
        throw fetchError
      }

      log.debug('Successfully fetched organizations:', orgsData?.length)
      
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
      const errorMessage = extractErrorMessage(err)
      log.error('Organizations fetch error:', err)
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
      log.debug('Creating organization:', data)
      
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
      
      log.debug('Creating organization with data:', organizationData)
      
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([organizationData])
        .select()
        .single()

      if (createError) {
        log.error('Error creating organization:', createError)
        throw createError
      }

      log.debug('Created organization:', newOrg)
      toast({
        title: 'Success',
        description: 'Organization created successfully'
      })

      // Log activity
      await logActivity({
        activityType: 'organization_created',
        title: `Department created: ${newOrg.name}`,
        description: `New department/organization created`,
        entityType: 'organization',
        entityId: newOrg.id,
        organizationId: newOrg.id,
        metadata: {
          org_name: newOrg.name,
          org_kind: newOrg.org_kind,
          parent_id: newOrg.parent_organization_id
        }
      });

      await getOrganizations()
      
      // Recompute onboarding progress
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id) {
          const { data: member } = await supabase
            .from('members')
            .select('tenant_id')
            .eq('user_id', authUser.id)
            .eq('user_status', 'active')
            .single();

          if (member?.tenant_id) {
            await supabase.rpc('check_onboarding_task_completion', {
              p_user_id: authUser.id,
              p_tenant_id: member.tenant_id
            });
            queryClient.invalidateQueries({ 
              queryKey: ['onboarding-progress', authUser.id, member.tenant_id] 
            });
          }
        }
      } catch (error) {
        console.error('Failed to update onboarding progress:', error);
      }
      
      return newOrg
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Organization creation error:', err)
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
      log.debug('Updating organization:', id, data)
      
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
        log.error('Error updating organization:', updateError)
        throw updateError
      }

      log.debug('Updated organization:', updatedOrg)
      toast({
        title: 'Success',
        description: 'Organization updated successfully'
      })

      // Log activity
      await logActivity({
        activityType: 'organization_updated',
        title: `Department updated: ${updatedOrg.name}`,
        description: `Department/organization details modified`,
        entityType: 'organization',
        entityId: updatedOrg.id,
        organizationId: updatedOrg.id,
        metadata: {
          updated_fields: Object.keys(data)
        }
      });

      await getOrganizations()
      return updatedOrg
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Organization update error:', err)
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
      log.debug('Deleting organization:', id)
      
      // Platform admins must use the admin-operations edge function
      // This ensures all admin actions are audited
      if (userType === 'platform_admin') {
        log.debug('Platform admin deleting organization via edge function:', id)
        const { data, error: edgeFunctionError } = await supabase.functions.invoke('admin-operations', {
          body: { 
            action: 'manage-organization',
            organization_id: id,
            changes: { _delete: true }
          }
        })

        if (edgeFunctionError) {
          log.error('Error calling admin-operations edge function:', edgeFunctionError)
          throw edgeFunctionError
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to delete organization')
        }

        log.debug('Organization deleted via admin edge function:', data)
        toast({
          title: 'Success',
          description: data.message || 'Organization deactivated successfully'
        })
      } else {
        // Workspace owners can soft delete directly via RLS (status = inactive)
        const { error: deleteError } = await supabase
          .from('organizations')
          .update({ status: 'inactive' })
          .eq('id', id)

        if (deleteError) {
          log.error('Error deleting organization:', deleteError)
          throw deleteError
        }

        log.debug('Soft deleted organization:', id)
        toast({
          title: 'Success',
          description: 'Organization deactivated successfully'
        })
      }

      // Log activity (organization may not be fully accessible after deletion)
      await logActivity({
        activityType: 'organization_deleted',
        title: `Department archived`,
        description: `Department/organization deactivated`,
        entityType: 'organization',
        entityId: id,
        metadata: {
          deleted_by_admin: userType === 'platform_admin'
        }
      });

      await getOrganizations()
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Organization deletion error:', err)
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
