import {
  Zap, User, Mail, Clock, Bell,
  Building2, Users, Folder, Plug, CreditCard,
  GitBranch, ListChecks, FileText, Workflow, Globe, Megaphone,
  Handshake, Building, Gauge, Package,
} from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface SettingsNavItem {
  id: string
  label: string
  icon: any
  show: boolean
  badge?: React.ReactNode
  ownerBadge?: boolean
}

interface SettingsNavSection {
  id: string
  label?: string
  show: boolean
  items: SettingsNavItem[]
}

interface SettingsSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  essentialsRemaining?: number
  className?: string
}

export function SettingsSidebar({ currentTab, onTabChange, essentialsRemaining = 0, className }: SettingsSidebarProps) {
  const permissions = usePermissions()
  const { organizationId, userType } = useAuth()

  const isOwner = userType === 'workspace_owner' && !!organizationId
  const isAdminOrOwner = permissions.isPlatformAdmin || permissions.isAdmin || isOwner
  const isPlatform = permissions.isPlatformAdmin

  const setupBadge =
    essentialsRemaining > 0 ? (
      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold bg-[#EDE4FF] text-[#5B21B6] leading-none">
        {essentialsRemaining}
      </span>
    ) : undefined

  const sections: SettingsNavSection[] = [
    {
      id: 'top',
      show: true,
      items: [
        { id: 'setup', label: 'Setup', icon: Zap, show: essentialsRemaining > 0, badge: setupBadge },
      ],
    },
    {
      id: 'you',
      label: 'YOU',
      show: true,
      items: [
        { id: 'profile', label: 'Profile', icon: User, show: true },
        { id: 'email-calendar', label: 'Email & calendar', icon: Mail, show: true },
        { id: 'booking', label: 'Booking & event types', icon: Clock, show: true },
        { id: 'notifications', label: 'Notifications', icon: Bell, show: true },
      ],
    },
    {
      id: 'workspace',
      label: 'WORKSPACE',
      show: isAdminOrOwner,
      items: [
        { id: 'organization', label: 'General', icon: Building2, show: permissions.canManageOrganization },
        { id: 'members', label: 'Members', icon: Users, show: permissions.canViewMembers },
        { id: 'workspace-departments', label: 'Departments', icon: Folder, show: isAdminOrOwner },
        { id: 'integrations', label: 'Integrations', icon: Plug, show: true },
        { id: 'billing', label: 'Billing', icon: CreditCard, show: isOwner, ownerBadge: true },
      ],
    },
    {
      id: 'recruiting',
      label: 'RECRUITING',
      show: isAdminOrOwner,
      items: [
        { id: 'pipeline-stages', label: 'Pipeline stages', icon: GitBranch, show: true },
        { id: 'application-form', label: 'Application form', icon: ListChecks, show: true },
        { id: 'templates', label: 'Templates', icon: FileText, show: true },
        { id: 'automations', label: 'Automations', icon: Workflow, show: true },
        { id: 'careers-page', label: 'Careers page', icon: Globe, show: true },
        { id: 'job-boards', label: 'Job boards', icon: Megaphone, show: true },
      ],
    },
    {
      id: 'crm',
      label: 'CRM',
      show: isAdminOrOwner,
      items: [
        { id: 'workspace-deal-stages', label: 'Deal stages', icon: Handshake, show: permissions.canViewOrganizations },
        { id: 'customers', label: 'Customers', icon: Building, show: isAdminOrOwner },
      ],
    },
    {
      id: 'platform',
      label: 'PLATFORM',
      show: isPlatform,
      items: [
        { id: 'platform-dashboard', label: 'Dashboard', icon: BarChart3, show: true },
        { id: 'platform-settings', label: 'App Personalization', icon: SettingsIcon, show: true },
        { id: 'platform-job-settings', label: 'Job Settings', icon: Briefcase, show: true },
        { id: 'platform-saas-customers', label: 'SaaS Customers', icon: UsersIcon, show: true },
      ],
    },
  ]

  const visibleSections = sections
    .filter((s) => s.show)
    .map((s) => ({ ...s, items: s.items.filter((i) => i.show) }))
    .filter((s) => s.items.length > 0)

  return (
    <nav className={cn('w-[224px] shrink-0', className)}>
      <div className="space-y-4">
        {visibleSections.map((section) => (
          <div key={section.id} className="space-y-0.5">
            {section.label && (
              <div
                className="px-2.5 mb-1.5 font-inter font-semibold uppercase text-[#8B8F9E]"
                style={{ fontSize: '10px', letterSpacing: '0.08em' }}
              >
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = currentTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-lg transition-colors text-left',
                    'font-inter',
                    isActive
                      ? 'bg-[#0d0d09] text-[#fffcf9]'
                      : 'text-[#1F2230] hover:bg-[rgba(13,13,9,0.05)]'
                  )}
                  style={{ padding: '7px 10px', fontSize: '12.5px' }}
                >
                  <Icon className="w-[14px] h-[14px] shrink-0" strokeWidth={2} />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge}
                  {item.ownerBadge && (
                    <span
                      className={cn(
                        'inline-flex items-center px-1.5 h-[16px] rounded-md text-[9px] font-semibold uppercase tracking-wider',
                        isActive ? 'bg-white/10 text-[#fffcf9]/80' : 'bg-[#F1F0EC] text-[#8B8F9E]'
                      )}
                      style={{ letterSpacing: '0.06em' }}
                    >
                      Owners
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
