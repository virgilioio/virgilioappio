
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'

export interface PermissionsState {
  // Job permissions
  canViewJobs: boolean
  canCreateJobs: boolean
  canEditJobs: boolean
  canDeleteJobs: boolean
  canArchiveJobs: boolean
  
  // Member permissions
  canViewMembers: boolean
  canCreateMembers: boolean
  canEditMembers: boolean
  canDeleteMembers: boolean
  canManageMembers: boolean
  
  // Organization permissions
  canViewOrganizations: boolean
  canCreateOrganizations: boolean
  canEditOrganizations: boolean
  canDeleteOrganizations: boolean
  canManageOrganization: boolean
  
  // Job request permissions
  canViewJobRequests: boolean
  canCreateJobRequests: boolean
  canApproveJobRequests: boolean
  canManageJobRequests: boolean
  canRequestJobs: boolean
  
  // Candidate permissions
  canViewCandidates: boolean
  canCreateCandidates: boolean
  canEditCandidates: boolean
  canDeleteCandidates: boolean
  canManageCandidates: boolean
  
  // Billing & Invoice permissions
  canViewInvoices: boolean
  canCreateInvoices: boolean
  canManageInvoices: boolean
  canUploadInvoicePDFs: boolean
  canViewBilling: boolean
  
  // Admin permissions
  isWorkspaceOwner: boolean
  isPlatformAdmin: boolean
  isBillingMember: boolean
  isMember: boolean
  isClient: boolean
  isGuest: boolean
  hasOrganizationContext: boolean
}

export function usePermissions(): PermissionsState {
  const { user, organizationId } = useAuth()
  const { profile } = useUserProfile()
  
  // Get user type and member role from user metadata or profile
  const userType = user?.user_metadata?.user_type || 'guest'
  const memberRole = user?.user_metadata?.member_role || 'guest'
  
  // Platform admin has all permissions
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner'
  const isBillingMember = memberRole === 'billing'
  
  // Check if user has organization context (critical for security)
  const hasOrganizationContext = !!organizationId
  
  // Client members have 'client' role and organization context
  const isClient = memberRole === 'client' && hasOrganizationContext
  
  // Members are users with specific member roles and org context
  const isMember = ['recruiter', 'admin', 'billing', 'client'].includes(memberRole) && hasOrganizationContext
  
  // Guests are users without membership or org context
  const isGuest = (memberRole === 'guest' || !hasOrganizationContext) && !isPlatformAdmin && !isWorkspaceOwner

  // Add debug logging to help troubleshoot permission issues
  console.log('Permission Debug:', {
    userType,
    memberRole,
    isPlatformAdmin,
    isWorkspaceOwner,
    isBillingMember,
    hasOrganizationContext,
    isClient,
    isMember,
    isGuest
  })
  
  return {
    // Job permissions - SECURED: Only platform admins and admin members can create jobs directly
    // Clients can only view jobs they're assigned to (enforced by RLS)
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    canCreateJobs: isPlatformAdmin || memberRole === 'admin',
    canEditJobs: isPlatformAdmin || memberRole === 'admin',
    canDeleteJobs: isPlatformAdmin || memberRole === 'admin',
    canArchiveJobs: isPlatformAdmin || memberRole === 'admin',
    
    // Member permissions - clients can view their org members but not manage them
    canViewMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canCreateMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canEditMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canDeleteMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canManageMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    
    // Organization permissions - workspace owners and platform admins only
    canViewOrganizations: isPlatformAdmin,
    canCreateOrganizations: isPlatformAdmin,
    canEditOrganizations: isPlatformAdmin || isWorkspaceOwner,
    canDeleteOrganizations: isPlatformAdmin,
    canManageOrganization: isPlatformAdmin || isWorkspaceOwner,
    
    // Job request permissions - SECURED: Guests cannot request jobs
    canViewJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    canCreateJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    canApproveJobRequests: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canManageJobRequests: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canRequestJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    
    // Candidate permissions - SECURED: Only Platform Admins and Virgilio team members can manage candidates
    // Clients can view candidates for jobs they're assigned to (enforced by RLS)
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    canCreateCandidates: isPlatformAdmin || ['recruiter', 'admin'].includes(memberRole),
    canEditCandidates: isPlatformAdmin || ['recruiter', 'admin'].includes(memberRole),
    canDeleteCandidates: isPlatformAdmin || memberRole === 'admin',
    canManageCandidates: isPlatformAdmin || ['recruiter', 'admin'].includes(memberRole),
    
    // Job assignment permissions - NEW: Control who can assign users to jobs
    canViewJobAssignments: isPlatformAdmin || ['recruiter', 'admin'].includes(memberRole),
    canManageJobAssignments: isPlatformAdmin || ['recruiter', 'admin'].includes(memberRole),
    
    // Billing & Invoice permissions - CRITICAL SECURITY FIX
    // Only users with org context can view billing (prevents guests from accessing)
    canViewInvoices: isPlatformAdmin || isBillingMember || (isWorkspaceOwner && hasOrganizationContext) || (isClient && hasOrganizationContext),
    canCreateInvoices: isPlatformAdmin || isBillingMember,
    canManageInvoices: isPlatformAdmin || isBillingMember,
    canUploadInvoicePDFs: isPlatformAdmin || isBillingMember,
    canViewBilling: isPlatformAdmin || isBillingMember || (isWorkspaceOwner && hasOrganizationContext) || (isClient && hasOrganizationContext),
    
    // Admin flags
    isWorkspaceOwner,
    isPlatformAdmin,
    isBillingMember,
    isMember,
    isClient,
    isGuest,
    hasOrganizationContext,
  }
}
