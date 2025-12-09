
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
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
  isRecruiter: boolean
  isHiringManager: boolean
  isInterviewer: boolean
  hasOrganizationContext: boolean
}

export function usePermissions(): PermissionsState {
  const { user, organizationId, userType, memberRole, hasOrganizationContext } = useAuth()
  const { profile } = useUserProfile()
  const isGoGioAdmin = useIsPlatformAdmin()
  
  // Simplified user type classification
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner'
  const isMember = userType === 'member' && hasOrganizationContext
  
  // Member role classification (only for members)
  const isAdmin = isMember && memberRole === 'admin'
  const isRecruiter = isMember && memberRole === 'recruiter'
  const isHiringManager = isMember && memberRole === 'hiring_manager'
  const isInterviewer = isMember && memberRole === 'interviewer'

  // Check if user is a platform (GoGio organization) recruiter
  const isPlatformRecruiter = isRecruiter && hasOrganizationContext

  return {
    // Job permissions
    // Note: Recruiters can view jobs, but RLS restricts them to only assigned jobs
    // HMs and Interviewers are also restricted to assigned jobs via RLS
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter || isHiringManager || isInterviewer,
    canCreateJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canEditJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
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
    canCreateOrganizations: isPlatformAdmin || isWorkspaceOwner, // Only platform admins can create parent orgs, workspace owners can create child orgs
    canEditOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canDeleteOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageOrganization: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Candidate permissions - Different access levels based on role
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter || isHiringManager || isInterviewer,
    canCreateCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canEditCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canDeleteCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    
    // Navigation permissions - Show candidates for Platform Admins, platform recruiters, Workspace owners, and member recruiters
    canViewCandidatesNavigation: isPlatformAdmin || isPlatformRecruiter || isWorkspaceOwner || (isRecruiter && hasOrganizationContext),
    
    // Job assignment permissions - Only admins and recruiters can manage assignments
    canViewJobAssignments: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canManageJobAssignments: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    
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
    isRecruiter,
    isHiringManager,
    isInterviewer,
    hasOrganizationContext,
  }
}
