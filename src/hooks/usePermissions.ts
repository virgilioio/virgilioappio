
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
  const isMember = ['recruiter', 'admin', 'billing'].includes(memberRole)
  const isGuest = memberRole === 'guest' && !isPlatformAdmin && !isWorkspaceOwner
  
  return {
    // Job permissions
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canCreateJobs: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canEditJobs: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canDeleteJobs: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canArchiveJobs: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    
    // Member permissions  
    canViewMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canCreateMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canEditMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canDeleteMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canManageMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    
    // Organization permissions
    canViewOrganizations: isPlatformAdmin,
    canCreateOrganizations: isPlatformAdmin,
    canEditOrganizations: isPlatformAdmin || isWorkspaceOwner,
    canDeleteOrganizations: isPlatformAdmin,
    canManageOrganization: isPlatformAdmin || isWorkspaceOwner,
    
    // Job request permissions
    canViewJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canCreateJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canApproveJobRequests: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canManageJobRequests: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canRequestJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    
    // Candidate permissions
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canCreateCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canEditCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    canDeleteCandidates: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canManageCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin'].includes(memberRole),
    
    // Billing & Invoice permissions
    canViewInvoices: isPlatformAdmin || isWorkspaceOwner || isBillingMember,
    canCreateInvoices: isPlatformAdmin || isBillingMember,
    canManageInvoices: isPlatformAdmin || isBillingMember,
    canUploadInvoicePDFs: isPlatformAdmin || isBillingMember,
    canViewBilling: isPlatformAdmin || isWorkspaceOwner || isBillingMember,
    
    // Admin flags
    isWorkspaceOwner,
    isPlatformAdmin,
    isBillingMember,
    isMember,
    isGuest,
  }
}
