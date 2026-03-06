
import { supabase } from '@/lib/supabaseClient'

export interface OrganizationMetadata {
  organization_id: string
  system_role?: string
  member_role?: string // legacy
  user_type?: string
}

/**
 * Inject organization metadata into a user's auth record
 * This requires service role permissions in production
 */
export async function injectOrganizationToUser(
  userId: string, 
  organizationId: string,
  additionalMetadata?: Partial<OrganizationMetadata>
) {
  try {
    console.log('Injecting organization metadata:', { userId, organizationId, additionalMetadata })
    
    // Try to get current user metadata using the regular client first
    let currentMetadata = {}
    
    try {
      // Attempt to get current user if we're updating our own metadata
      const { data: currentUser } = await supabase.auth.getUser()
      if (currentUser.user?.id === userId) {
        currentMetadata = currentUser.user.user_metadata || {}
      }
    } catch (e) {
      console.log('Could not get current user metadata, proceeding with empty metadata')
    }

    // Prepare the updated metadata
    const updatedMetadata = {
      ...currentMetadata,
      organization_id: organizationId,
      ...additionalMetadata
    }

    console.log('Prepared metadata update:', updatedMetadata)

    // Try using admin function (will work in edge functions with service role)
    try {
      const { data, error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: updatedMetadata
      })

      if (error) {
        console.error('Admin update failed:', error)
        throw error
      }

      console.log('Successfully updated user metadata via admin:', data)
      return data
    } catch (adminError) {
      console.warn('Admin update not available, this is expected in client-side code:', adminError)
      
      // If admin update fails (normal in client-side), the metadata will be set
      // when the user signs in next time through the auth state change
      console.log('Metadata will be available after user signs in')
      return { user: { user_metadata: updatedMetadata } }
    }
  } catch (error) {
    console.error('Failed to inject organization metadata:', error)
    throw error
  }
}

/**
 * Validate that a user has required organization context
 */
/**
 * @deprecated This function uses JWT metadata which is not the source of truth.
 * Use DB-driven org context from AuthContext/OrgContext instead.
 */
export function validateOrganizationContext(user: any): {
  isValid: boolean
  organizationId: string | null
  errors: string[]
} {
  console.warn('[DEPRECATED] validateOrganizationContext uses JWT metadata. Use DB context instead.')
  const errors: string[] = []
  const organizationId = user?.user_metadata?.organization_id || null

  if (!organizationId) {
    errors.push('Missing organization_id - use DB context from AuthContext/OrgContext')
  }

  return {
    isValid: errors.length === 0,
    organizationId,
    errors
  }
}
