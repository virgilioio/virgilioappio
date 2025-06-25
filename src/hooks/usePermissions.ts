
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
  
  // Navigation permissions
  canViewCandidatesNavigation: boolean
  
  // Job assignment permissions
  canViewJobAssignments: boolean
  canManageJobAssignments: boolean
  
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
  isGuestClient: boolean
  hasOrganizationContext: boolean
}

export function usePermissions(): PermissionsState {
  const { user, organizationId, userType, memberRole, hasOrganizationContext } = useAuth()
  const { profile } = useUserProfile()
  
  // Platform admin has user_type = 'platform_admin' - memberRole is not required
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner'
  const isBillingMember = memberRole === 'billing'
  
  // Client members have 'client' role and organization context
  const isClient = memberRole === 'client' && hasOrganizationContext
  
  // Members are users with specific member roles and org context
  const isMember = ['recruiter', 'admin', 'billing', 'client', 'customer_success'].includes(memberRole || '') && hasOrganizationContext
  
  // Guests are users with userType === 'guest' - this is the key fix
  const isGuest = userType === 'guest'
  
  // Guest clients specifically - users with guest userType and client memberRole
  const isGuestClient = userType === 'guest' && memberRole === 'client'

  // Check if user is a Virgilio (platform organization) recruiter
  const isVirgilioRecruiter = memberRole === 'recruiter' && hasOrganizationContext

  return {
    // Job permissions - Guest users can only view jobs (restricted to assigned jobs in useJobs hook)
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || '') || isGuest,
    canCreateJobs: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canEditJobs: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canDeleteJobs: isPlatformAdmin || memberRole === 'admin',
    canArchiveJobs: isPlatformAdmin || memberRole === 'admin',
    
    // Member permissions - Guest users cannot manage members
    canViewMembers: isPlatformAdmin || isWorkspaceOwner || (memberRole === 'admin' || memberRole === 'customer_success') && !isGuest,
    canCreateMembers: isPlatformAdmin || isWorkspaceOwner || (memberRole === 'admin' || memberRole === 'customer_success') && !isGuest,
    canEditMembers: isPlatformAdmin || isWorkspaceOwner || (memberRole === 'admin' || memberRole === 'customer_success') && !isGuest,
    canDeleteMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin' && !isGuest,
    canManageMembers: isPlatformAdmin || isWorkspaceOwner || (memberRole === 'admin' || memberRole === 'customer_success') && !isGuest,
    
    // Organization permissions - Guest users cannot manage organizations
    canViewOrganizations: isPlatformAdmin || memberRole === 'customer_success' && !isGuest,
    canCreateOrganizations: isPlatformAdmin || memberRole === 'customer_success' && !isGuest,
    canEditOrganizations: isPlatformAdmin || isWorkspaceOwner || memberRole === 'customer_success' && !isGuest,
    canDeleteOrganizations: isPlatformAdmin && !isGuest,
    canManageOrganization: isPlatformAdmin || isWorkspaceOwner || memberRole === 'customer_success' && !isGuest,
    
    // Job request permissions - Guest users can view and create job requests
    canViewJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || '') || isGuest,
    canCreateJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || '') || isGuest,
    canApproveJobRequests: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canManageJobRequests: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canRequestJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || '') || isGuest,
    
    // Candidate permissions - Guest users can view candidates for their assigned jobs
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || '') || isGuest,
    canCreateCandidates: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || ''),
    canEditCandidates: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || ''),
    canDeleteCandidates: isPlatformAdmin || memberRole === 'admin',
    canManageCandidates: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || ''),
    
    // Navigation permissions - Show candidates in header for Platform Admins and Virgilio recruiters
    canViewCandidatesNavigation: isPlatformAdmin || isVirgilioRecruiter,
    
    // Job assignment permissions - Guest users cannot manage job assignments
    canViewJobAssignments: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || '') && !isGuest,
    canManageJobAssignments: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || '') && !isGuest,
    
    // Billing & Invoice permissions - Guest users are COMPLETELY EXCLUDED from all billing access
    canViewInvoices: (isPlatformAdmin || isBillingMember || isWorkspaceOwner) && !isGuest,
    canCreateInvoices: (isPlatformAdmin || isBillingMember) && !isGuest,
    canManageInvoices: (isPlatformAdmin || isBillingMember) && !isGuest,
    canUploadInvoicePDFs: (isPlatformAdmin || isBillingMember) && !isGuest,
    canViewBilling: (isPlatformAdmin || isBillingMember || isWorkspaceOwner) && !isGuest,
    
    // Admin flags
    isWorkspaceOwner,
    isPlatformAdmin,
    isBillingMember,
    isMember,
    isClient,
    isGuest,
    isGuestClient,
    hasOrganizationContext,
  }
}
