
import { supabase } from '@/integrations/supabase/client'

export interface OrganizationMetadata {
  organization_id: string
  member_role?: string
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
    
    // Get current user metadata
    const { data: currentUser, error: getUserError } = await supabase.auth.admin.getUserById(userId)
    
    if (getUserError) {
      console.error('Error getting user:', getUserError)
      throw getUserError
    }

    // Merge with existing metadata
    const updatedMetadata = {
      ...currentUser.user?.user_metadata,
      organization_id: organizationId,
      ...additionalMetadata
    }

    // Update user metadata
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: updatedMetadata
    })

    if (error) {
      console.error('Error updating user metadata:', error)
      throw error
    }

    console.log('Successfully updated user metadata:', data)
    return data
  } catch (error) {
    console.error('Failed to inject organization metadata:', error)
    throw error
  }
}

/**
 * Validate that a user has required organization context
 */
export function validateOrganizationContext(user: any): {
  isValid: boolean
  organizationId: string | null
  errors: string[]
} {
  const errors: string[] = []
  const organizationId = user?.user_metadata?.organization_id || null

  if (!organizationId) {
    errors.push('Missing organization_id in user metadata')
  }

  return {
    isValid: errors.length === 0,
    organizationId,
    errors
  }
}
