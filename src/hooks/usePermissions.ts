
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
  isGuest: boolean
}

export function usePermissions(): PermissionsState {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  
  // Get user type and member role from user metadata or profile
  const userType = user?.user_metadata?.user_type || 'guest'
  const memberRole = user?.user_metadata?.member_role || 'guest'
  
  // Platform admin has all permissions
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner'
  const isBillingMember = memberRole === 'billing'
  
  // Update member check to include 'client' role for workspace owners and guests
  const isMember = ['recruiter', 'admin', 'billing', 'client'].includes(memberRole)
  
  // Guests are users who either have 'guest' member_role OR 'client' member_role 
  // (since clients are technically guests from an access perspective)
  const isGuest = (memberRole === 'guest' || memberRole === 'client') && !isPlatformAdmin && !isWorkspaceOwner
  
  return {
    // Job permissions - clients/workspace owners can view but not create/edit/delete
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canCreateJobs: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canEditJobs: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canDeleteJobs: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canArchiveJobs: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    
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
    
    // Job request permissions - clients can view and create requests for their org
    canViewJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    canCreateJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    canApproveJobRequests: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canManageJobRequests: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canRequestJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    
    // Candidate permissions - clients can view candidates for their jobs
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client'].includes(memberRole),
    canCreateCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canEditCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canDeleteCandidates: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canManageCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    
    // Billing & Invoice permissions - clients can view their own billing
    canViewInvoices: isPlatformAdmin || isWorkspaceOwner || isBillingMember || memberRole === 'client',
    canCreateInvoices: isPlatformAdmin || isBillingMember,
    canManageInvoices: isPlatformAdmin || isBillingMember,
    canUploadInvoicePDFs: isPlatformAdmin || isBillingMember,
    canViewBilling: isPlatformAdmin || isWorkspaceOwner || isBillingMember || memberRole === 'client',
    
    // Admin flags
    isWorkspaceOwner,
    isPlatformAdmin,
    isBillingMember,
    isMember,
    isGuest,
  }
}
