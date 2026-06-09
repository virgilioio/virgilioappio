import { Building, Building2, Receipt, Users, Shield, Settings as SettingsIcon, BarChart3, Briefcase, UsersIcon, Layers, Plug, Handshake, Network } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useIntegrationStatuses } from '@/hooks/useIntegrationStatuses'
import { INTEGRATIONS } from './IntegrationsTab'

interface SettingsNavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  show: boolean
  badge?: React.ReactNode
}

interface SettingsNavSection {
  id: string
  label: string
  show: boolean
  items: SettingsNavItem[]
}

interface SettingsSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  className?: string
}

export function SettingsSidebar({ currentTab, onTabChange, className }: SettingsSidebarProps) {
  const permissions = usePermissions()
  const { organizationId, userType } = useAuth()
  const { tenant } = useTenant()
  const integrationStatuses = useIntegrationStatuses()
  const installedIntegrations = INTEGRATIONS.filter((i) => integrationStatuses[i.id])

  const isWorkspaceOwnerOfSaaSOrg = userType === 'workspace_owner' && !!organizationId
  const showWorkspaceGroup =
    permissions.isPlatformAdmin || permissions.isAdmin || isWorkspaceOwnerOfSaaSOrg
  const memberOnlyIntegrations =
    permissions.isMember && !permissions.isAdmin && !permissions.isWorkspaceOwner && !permissions.isPlatformAdmin

  const integrationsBadge =
    installedIntegrations.length > 0 ? (
      <span className="text-[11px] font-medium text-virgilio-muted">
        {installedIntegrations.length}
      </span>
    ) : undefined

  const sections: SettingsNavSection[] = [
    {
      id: 'account',
      label: 'Account',
      show: userType === 'workspace_owner' && !!organizationId || memberOnlyIntegrations,
      items: [
        {
          id: 'billing',
          label: 'Billing',
          icon: Receipt,
          show: userType === 'workspace_owner' && !!organizationId,
        },
        {
          id: 'integrations',
          label: 'Integrations',
          icon: Plug,
          show: memberOnlyIntegrations,
          badge: memberOnlyIntegrations ? integrationsBadge : undefined,
        },
      ],
    },
    {
      id: 'workspace',
      label: 'Workspace',
      show: showWorkspaceGroup,
      items: [
        { id: 'organization', label: 'General Settings', icon: Building, show: permissions.canManageOrganization },
        { id: 'members', label: 'Members', icon: Users, show: permissions.canViewMembers },
        { id: 'workspace-departments', label: 'Departments', icon: Network, show: showWorkspaceGroup },
        { id: 'workspace-job-settings', label: 'Job Settings', icon: SettingsIcon, show: showWorkspaceGroup },
        { id: 'workspace-deal-stages', label: 'Deal Stages', icon: Handshake, show: permissions.canViewOrganizations },
        { id: 'integrations', label: 'Integrations', icon: Plug, show: true, badge: integrationsBadge },
      ],
    },
    {
      id: 'platform',
      label: 'Platform',
      show: permissions.isPlatformAdmin,
      items: [
        { id: 'platform-dashboard', label: 'Dashboard', icon: BarChart3, show: true },
        { id: 'platform-settings', label: 'App Personalization', icon: SettingsIcon, show: true },
        { id: 'platform-job-settings', label: 'Job Settings', icon: Briefcase, show: true },
        { id: 'platform-saas-customers', label: 'SaaS Customers', icon: UsersIcon, show: true },
        { id: 'platform-customers', label: 'Legacy Customer Management', icon: Building2, show: permissions.canAccessCustomerManagement },
      ],
    },
  ]

  const visibleSections = sections
    .filter((s) => s.show)
    .map((s) => ({ ...s, items: s.items.filter((i) => i.show) }))
    .filter((s) => s.items.length > 0)

  const tenantTypeLabel =
    tenant?.tenant_type === 'organization'
      ? 'Organization'
      : tenant?.tenant_type === 'saas_customer'
      ? 'Workspace'
      : tenant?.tenant_type
      ? tenant.tenant_type.charAt(0).toUpperCase() + tenant.tenant_type.slice(1)
      : 'Workspace'

  return (
    <Card className={cn('w-64 h-fit shadow-calendly border-virgilio-border/50 rounded-xl', className)}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-virgilio-border/30">
        <h2 className="text-lg font-semibold text-virgilio-text leading-none">
          Settings<span className="text-virgilio-purple">.</span>
        </h2>
        {tenant?.name && (
          <p className="mt-1.5 text-xs text-virgilio-muted truncate">
            {tenant.name} <span className="text-virgilio-muted/70">· {tenantTypeLabel}</span>
          </p>
        )}
      </div>

      <CardContent className="p-3">
        <div className="space-y-3">
          {visibleSections.map((section) => (
            <div key={section.id} className="space-y-0.5">
              <div className="px-3 mt-1 mb-1 text-[11px] font-medium uppercase tracking-wider text-virgilio-muted">
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = currentTab === item.id
                return (
                  <div key={`${section.id}-${item.id}`}>
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start h-9 px-3 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-foreground text-background hover:bg-foreground hover:text-background'
                          : 'text-virgilio-muted hover:text-virgilio-text hover:bg-muted'
                      )}
                      onClick={() => onTabChange(item.id)}
                    >
                      <Icon className="h-4 w-4 mr-2.5 shrink-0" />
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'ml-2 shrink-0',
                            isActive ? 'text-background/70' : 'text-virgilio-muted'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Button>
                    {item.id === 'integrations' && installedIntegrations.length > 0 && (
                      <div className="space-y-0.5 mt-0.5 pl-7">
                        {installedIntegrations.map((integration) => {
                          const integrationTabId = `integration-${integration.id}`
                          const isIntegrationActive = currentTab === integrationTabId
                          return (
                            <Button
                              key={integrationTabId}
                              variant="ghost"
                              className={cn(
                                'w-full justify-start h-8 px-2 rounded-md text-xs font-medium transition-colors',
                                isIntegrationActive
                                  ? 'bg-foreground text-background hover:bg-foreground hover:text-background'
                                  : 'text-virgilio-muted hover:text-virgilio-text hover:bg-muted'
                              )}
                              onClick={() => onTabChange(integrationTabId)}
                            >
                              <span className="flex h-4 w-4 items-center justify-center mr-2 shrink-0">
                                {integration.logo}
                              </span>
                              <span className="truncate">{integration.name}</span>
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
