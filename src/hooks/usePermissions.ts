
import { useAuth } from '@/contexts/AuthContext'
import { useIsPlatformAdmin } from '@/hooks/useIsPlatformAdmin'

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

  // Customer Management permissions
  canAccessCustomerManagement: boolean
  
  // Admin permissions and roles
  isWorkspaceOwner: boolean
  isPlatformAdmin: boolean
  isMember: boolean
  isAdmin: boolean
  isSalesUser: boolean
  hasOrganizationContext: boolean
}

export function usePermissions(): PermissionsState {
  const { user, organizationId, userType, memberRole, hasOrganizationContext } = useAuth()
  const isGoGioAdmin = useIsPlatformAdmin()
  
  // System-level role classification
  // memberRole now returns 'admin', 'member', or 'sales' from resolve_org_context (system_role)
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner'
  const isMember = userType === 'member' && hasOrganizationContext
  
  // System role classification
  const isAdmin = isMember && memberRole === 'admin'
  const isSalesUser = isMember && memberRole === 'sales'
  // ATS member = member with no sales role (i.e. recruiter/hiring manager/interviewer via job_assignments)
  const isAtsMember = isMember && !isSalesUser

  return {
    // Job permissions — Sales has NO ATS access
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin || isAtsMember,
    canCreateJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canEditJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canDeleteJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canArchiveJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Member permissions
    canViewMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canCreateMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canEditMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canDeleteMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Organization / CRM permissions — Sales granted access
    canViewOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin || isSalesUser,
    canCreateOrganizations: isPlatformAdmin || isWorkspaceOwner || isSalesUser,
    canEditOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin || isSalesUser,
    canDeleteOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin || isSalesUser,
    canManageOrganization: isPlatformAdmin || isWorkspaceOwner || isAdmin || isSalesUser,
    
    // Candidate permissions — Sales has NO ATS access
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isAtsMember,
    canCreateCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isAtsMember,
    canEditCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isAtsMember,
    canDeleteCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isAtsMember,
    
    canViewCandidatesNavigation: isPlatformAdmin || isWorkspaceOwner || isAdmin || isAtsMember,
    
    canViewJobAssignments: isPlatformAdmin || isWorkspaceOwner || isAdmin || isAtsMember,
    canManageJobAssignments: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Billing — only platform admins and workspace owners
    canViewInvoices: isPlatformAdmin || isWorkspaceOwner,
    canCreateInvoices: isPlatformAdmin || isWorkspaceOwner,
    canManageInvoices: isPlatformAdmin || isWorkspaceOwner,
    canUploadInvoicePDFs: isPlatformAdmin || isWorkspaceOwner,
    canViewBilling: isPlatformAdmin || isWorkspaceOwner,

    canAccessCustomerManagement: isGoGioAdmin,
    
    // Role flags
    isWorkspaceOwner,
    isPlatformAdmin,
    isMember,
    isAdmin,
    isSalesUser,
    hasOrganizationContext,
  }
}
