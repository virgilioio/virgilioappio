
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
  const { user } = useAuth()
  
  // Mock user metadata - in real app this would come from Supabase user metadata or database
  const userType = user?.user_metadata?.user_type || 'guest'
  const memberRole = user?.user_metadata?.member_role || 'member'
  
  // Role-based permissions
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner' || isPlatformAdmin
  const isMember = userType === 'member' || isWorkspaceOwner
  const isGuest = userType === 'guest'
  
  // Sub-role permissions
  const isRecruiter = memberRole === 'recruiter'
  const isCustomerSuccess = memberRole === 'customer_success'
  const isBilling = memberRole === 'billing'
  const isSales = memberRole === 'sales'
  const isAdmin = memberRole === 'admin' || isPlatformAdmin
  
  // Action-based permissions (derived from roles)
  const canViewMembers = isMember
  const canManageMembers = isWorkspaceOwner || isAdmin
  const canCreateJobs = isRecruiter || isWorkspaceOwner || isPlatformAdmin
  const canRequestJobs = isMember
  const canViewJobs = isMember || isGuest
  const canEditJobs = isRecruiter || isWorkspaceOwner || isPlatformAdmin
  const canArchiveJobs = canEditJobs
  const canViewBilling = isBilling || isWorkspaceOwner || isPlatformAdmin
  const canManageBilling = isWorkspaceOwner || isPlatformAdmin
  const canManageOrganization = isWorkspaceOwner || isPlatformAdmin
  const canInviteMembers = canManageMembers
  const canDeleteMembers = isWorkspaceOwner || isPlatformAdmin
  
  // Candidate permissions
  const canViewCandidates = isMember || isGuest
  const canManageCandidates = isRecruiter || isWorkspaceOwner || isPlatformAdmin
  
  // Job Request permissions
  const canViewJobRequests = isWorkspaceOwner || isPlatformAdmin
  const canManageJobRequests = isWorkspaceOwner || isPlatformAdmin
  const canApproveJobRequests = isPlatformAdmin || isCustomerSuccess
  
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
