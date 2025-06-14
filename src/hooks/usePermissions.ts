
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
  hasOrganizationContext: boolean
}

export function usePermissions(): PermissionsState {
  const { user, organizationId, userType, memberRole, hasOrganizationContext } = useAuth()
  const { profile } = useUserProfile()
  
  // Platform admin has all permissions
  const isPlatformAdmin = userType === 'platform_admin'
  const isWorkspaceOwner = userType === 'workspace_owner'
  const isBillingMember = memberRole === 'billing'
  
  // Client members have 'client' role and organization context
  const isClient = memberRole === 'client' && hasOrganizationContext
  
  // Members are users with specific member roles and org context
  const isMember = ['recruiter', 'admin', 'billing', 'client', 'customer_success'].includes(memberRole || '') && hasOrganizationContext
  
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
    // Job permissions - UPDATED: Customer Success can create and manage jobs
    canViewJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || ''),
    canCreateJobs: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canEditJobs: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canDeleteJobs: isPlatformAdmin || memberRole === 'admin',
    canArchiveJobs: isPlatformAdmin || memberRole === 'admin',
    
    // Member permissions - UPDATED: Customer Success can manage members
    canViewMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin' || memberRole === 'customer_success',
    canCreateMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin' || memberRole === 'customer_success',
    canEditMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin' || memberRole === 'customer_success',
    canDeleteMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin',
    canManageMembers: isPlatformAdmin || isWorkspaceOwner || memberRole === 'admin' || memberRole === 'customer_success',
    
    // Organization permissions - UPDATED: Customer Success can manage organizations
    canViewOrganizations: isPlatformAdmin || memberRole === 'customer_success',
    canCreateOrganizations: isPlatformAdmin || memberRole === 'customer_success',
    canEditOrganizations: isPlatformAdmin || isWorkspaceOwner || memberRole === 'customer_success',
    canDeleteOrganizations: isPlatformAdmin,
    canManageOrganization: isPlatformAdmin || isWorkspaceOwner,
    
    // Job request permissions - Customer Success already has these permissions
    canViewJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || ''),
    canCreateJobRequests: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || ''),
    canApproveJobRequests: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canManageJobRequests: isPlatformAdmin || memberRole === 'admin' || memberRole === 'customer_success',
    canRequestJobs: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || ''),
    
    // Candidate permissions - SECURED: Only Platform Admins and Virgilio team members can manage candidates
    canViewCandidates: isPlatformAdmin || isWorkspaceOwner || ['recruiter', 'admin', 'client', 'customer_success'].includes(memberRole || ''),
    canCreateCandidates: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || ''),
    canEditCandidates: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || ''),
    canDeleteCandidates: isPlatformAdmin || memberRole === 'admin',
    canManageCandidates: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || ''),
    
    // Job assignment permissions - UPDATED: Customer Success can manage job assignments
    canViewJobAssignments: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || ''),
    canManageJobAssignments: isPlatformAdmin || ['recruiter', 'admin', 'customer_success'].includes(memberRole || ''),
    
    // Billing & Invoice permissions - CRITICAL SECURITY FIX
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
