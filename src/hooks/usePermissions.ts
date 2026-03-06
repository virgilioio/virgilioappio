
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
  hasOrganizationContext: boolean
}

export function usePermissions(): PermissionsState {
  const { user, organizationId, userType, memberRole, hasOrganizationContext } = useAuth()
  const isGoGioAdmin = useIsPlatformAdmin()
  
  // System-level role classification
  // memberRole now returns 'admin' or 'member' from resolve_org_context (system_role)
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner'
  const isMember = userType === 'member' && hasOrganizationContext
  
  // System role classification (only 'admin' or 'member' at system level)
  const isAdmin = isMember && memberRole === 'admin'
  // All non-admin members are 'member' — their job-level roles come from job_assignments

  return {
    // Job permissions
    // Members can view jobs they're assigned to (enforced by RLS via job_assignments)
    // Admins, WOs, PAs see all jobs
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember,
    canCreateJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canEditJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canDeleteJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canArchiveJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Member permissions - Only platform admins, workspace owners and admin members can manage members
    canViewMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canCreateMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canEditMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canDeleteMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Organization permissions - Platform admins and workspace owners only
    canViewOrganizations: isPlatformAdmin || isWorkspaceOwner,
    canCreateOrganizations: isPlatformAdmin || isWorkspaceOwner,
    canEditOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canDeleteOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageOrganization: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Candidate permissions - All members can view candidates on their assigned jobs
    // Creating/editing requires admin or job-level recruiter role (enforced by RLS)
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember,
    canCreateCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember,
    canEditCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember,
    canDeleteCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember,
    
    // Navigation permissions - Show candidates for all authenticated users with org context
    canViewCandidatesNavigation: isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember,
    
    // Job assignment permissions - Only admins can manage assignments at system level
    canViewJobAssignments: isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember,
    canManageJobAssignments: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Billing & Invoice permissions - Only platform admins and workspace owners
    canViewInvoices: isPlatformAdmin || isWorkspaceOwner,
    canCreateInvoices: isPlatformAdmin || isWorkspaceOwner,
    canManageInvoices: isPlatformAdmin || isWorkspaceOwner,
    canUploadInvoicePDFs: isPlatformAdmin || isWorkspaceOwner,
    canViewBilling: isPlatformAdmin || isWorkspaceOwner,

    // Customer Management permissions - Only GoGio platform admins
    canAccessCustomerManagement: isGoGioAdmin,
    
    // Role flags
    isWorkspaceOwner,
    isPlatformAdmin,
    isMember,
    isAdmin,
    hasOrganizationContext,
  }
}
