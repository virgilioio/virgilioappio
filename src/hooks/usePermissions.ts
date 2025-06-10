
import { useAuth } from '@/contexts/AuthContext'

export interface PermissionsState {
  // Role-based permissions
  isPlatformAdmin: boolean
  isWorkspaceOwner: boolean
  isMember: boolean
  isGuest: boolean
  
  // Sub-role permissions
  isRecruiter: boolean
  isCustomerSuccess: boolean
  isBilling: boolean
  isSales: boolean
  isAdmin: boolean
  
  // Action-based permissions
  canViewMembers: boolean
  canManageMembers: boolean
  canCreateJobs: boolean
  canRequestJobs: boolean
  canViewJobs: boolean
  canEditJobs: boolean
  canArchiveJobs: boolean
  canViewBilling: boolean
  canManageBilling: boolean
  canManageOrganization: boolean
  canInviteMembers: boolean
  canDeleteMembers: boolean
  
  // Candidate permissions
  canViewCandidates: boolean
  canManageCandidates: boolean
  
  // Job Request permissions
  canViewJobRequests: boolean
  canManageJobRequests: boolean
  canApproveJobRequests: boolean
}

export function usePermissions(): PermissionsState {
  const { userType, memberRole, hasOrganizationContext } = useAuth()
  
  // Role-based permissions (from user_type)
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner' || isPlatformAdmin
  const isMember = userType === 'member' || isWorkspaceOwner
  const isGuest = userType === 'guest' && !isPlatformAdmin
  
  // Sub-role permissions (from member_role)
  const isRecruiter = memberRole === 'recruiter'
  const isCustomerSuccess = memberRole === 'customer_success'
  const isBilling = memberRole === 'billing'
  const isSales = memberRole === 'sales'
  const isAdmin = memberRole === 'admin' || isPlatformAdmin
  
  // Action-based permissions (all require organization context unless platform admin)
  const hasOrgAccess = hasOrganizationContext || isPlatformAdmin
  
  const canViewMembers = hasOrgAccess && (isMember || isPlatformAdmin)
  const canManageMembers = hasOrgAccess && (isWorkspaceOwner || isAdmin || isPlatformAdmin)
  const canCreateJobs = hasOrgAccess && (isRecruiter || isWorkspaceOwner || isPlatformAdmin)
  const canRequestJobs = hasOrgAccess && (isMember || isPlatformAdmin)
  const canViewJobs = hasOrgAccess && (isMember || isGuest || isPlatformAdmin)
  const canEditJobs = hasOrgAccess && (isRecruiter || isWorkspaceOwner || isPlatformAdmin)
  const canArchiveJobs = canEditJobs
  const canViewBilling = hasOrgAccess && (isBilling || isWorkspaceOwner || isPlatformAdmin)
  const canManageBilling = hasOrgAccess && (isWorkspaceOwner || isPlatformAdmin)
  const canManageOrganization = hasOrgAccess && (isWorkspaceOwner || isPlatformAdmin)
  const canInviteMembers = canManageMembers
  const canDeleteMembers = hasOrgAccess && (isWorkspaceOwner || isPlatformAdmin)
  
  // Candidate permissions
  const canViewCandidates = hasOrgAccess && (isMember || isGuest || isPlatformAdmin)
  const canManageCandidates = hasOrgAccess && (isRecruiter || isWorkspaceOwner || isPlatformAdmin)
  
  // Job Request permissions
  const canViewJobRequests = hasOrgAccess && (isWorkspaceOwner || isPlatformAdmin)
  const canManageJobRequests = hasOrgAccess && (isWorkspaceOwner || isPlatformAdmin)
  const canApproveJobRequests = hasOrgAccess && (isPlatformAdmin || isCustomerSuccess)
  
  return {
    // Role-based
    isPlatformAdmin,
    isWorkspaceOwner,
    isMember,
    isGuest,
    
    // Sub-role
    isRecruiter,
    isCustomerSuccess,
    isBilling,
    isSales,
    isAdmin,
    
    // Action-based
    canViewMembers,
    canManageMembers,
    canCreateJobs,
    canRequestJobs,
    canViewJobs,
    canEditJobs,
    canArchiveJobs,
    canViewBilling,
    canManageBilling,
    canManageOrganization,
    canInviteMembers,
    canDeleteMembers,
    
    // Candidate permissions
    canViewCandidates,
    canManageCandidates,
    
    // Job Request permissions
    canViewJobRequests,
    canManageJobRequests,
    canApproveJobRequests,
  }
}
