
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useIsVirgilioAdmin } from '@/hooks/useIsVirgilioAdmin'

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
  isGuest: boolean
  hasOrganizationContext: boolean
}

export function usePermissions(): PermissionsState {
  const { user, organizationId, userType, memberRole, hasOrganizationContext } = useAuth()
  const { profile } = useUserProfile()
  const isVirgilioAdmin = useIsVirgilioAdmin()
  
  // Simplified user type classification
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner'
  const isMember = userType === 'member' && hasOrganizationContext
  const isGuest = userType === 'guest'
  
  // Member role classification (only for members)
  const isAdmin = isMember && memberRole === 'admin'
  const isRecruiter = isMember && memberRole === 'recruiter'
  const isHiringManager = isMember && memberRole === 'hiring_manager'
  const isInterviewer = isMember && memberRole === 'interviewer'

  // Check if user is a Virgilio (platform organization) recruiter
  const isVirgilioRecruiter = isRecruiter && hasOrganizationContext

  return {
    // Job permissions
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter || isHiringManager || isInterviewer,
    canCreateJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canEditJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canDeleteJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canArchiveJobs: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Member permissions - Only workspace owners and admins can manage members
    canViewMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canCreateMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canEditMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canDeleteMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageMembers: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Organization permissions - Platform admins, workspace owners, and admin members
    canViewOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canCreateOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canEditOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canDeleteOrganizations: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageOrganization: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    
    // Candidate permissions - Different access levels based on role
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter || isHiringManager || isInterviewer,
    canCreateCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canEditCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canDeleteCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin,
    canManageCandidates: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    
    // Navigation permissions - Show candidates in header for Platform Admins and Virgilio recruiters
    canViewCandidatesNavigation: isPlatformAdmin || isVirgilioRecruiter,
    
    // Job assignment permissions - Only admins and recruiters can manage assignments
    canViewJobAssignments: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    canManageJobAssignments: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    
    // Billing & Invoice permissions - Only platform admins and workspace owners
    canViewInvoices: isPlatformAdmin || isWorkspaceOwner,
    canCreateInvoices: isPlatformAdmin || isWorkspaceOwner,
    canManageInvoices: isPlatformAdmin || isWorkspaceOwner,
    canUploadInvoicePDFs: isPlatformAdmin || isWorkspaceOwner,
    canViewBilling: isPlatformAdmin || isWorkspaceOwner,

    // Customer Management permissions - Only Virgilio platform admins
    canAccessCustomerManagement: isVirgilioAdmin,
    
    // Role flags
    isWorkspaceOwner,
    isPlatformAdmin,
    isMember,
    isAdmin,
    isRecruiter,
    isHiringManager,
    isInterviewer,
    isGuest,
    hasOrganizationContext,
  }
}
