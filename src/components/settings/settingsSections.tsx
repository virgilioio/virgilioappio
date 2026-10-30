import {
  Zap, Clock, Bell,
  Building2, Users, Folder, Plug,
  GitBranch, ListChecks, FileText, Globe, Megaphone, Sparkles,
  Building, ShieldCheck, type LucideIcon,
} from 'lucide-react'

import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'

export interface SettingsNavItem {
  id: string
  label: string
  icon: LucideIcon
  show: boolean
  badge?: React.ReactNode
}

export interface SettingsNavSection {
  id: string
  label?: string
  show: boolean
  items: SettingsNavItem[]
  groupBadge?: React.ReactNode
}

/** The sections and rows the signed-in person may see, shared by the sidebar and the phone list. */
export function useSettingsSections(essentialsRemaining = 0) {
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
        { id: 'booking', label: permissions.isExternal ? 'Availability' : 'Booking & event types', icon: Clock, show: true },
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
      ],
    },
    {
      id: 'recruiting',
      label: 'RECRUITING',
      show: isAdminOrOwner,
      items: [
        { id: 'gio', label: 'Gio', icon: Sparkles, show: true },
        { id: 'pipeline-stages', label: 'Pipeline stages', icon: GitBranch, show: true },
        { id: 'application-form', label: 'Application form', icon: ListChecks, show: true },
        { id: 'templates', label: 'Templates', icon: FileText, show: true },
        { id: 'reference-templates', label: 'Reference templates', icon: ShieldCheck, show: true },

        { id: 'careers-page', label: 'Careers page', icon: Globe, show: true },
        { id: 'job-boards', label: 'Job boards', icon: Megaphone, show: true },
      ],
    },
    {
      id: 'clients',
      label: 'CLIENTS',
      show: isAdminOrOwner,
      items: [
        { id: 'customers', label: 'Clients', icon: Building, show: isAdminOrOwner },
      ],
    },
    {
      id: 'platform',
      label: 'PLATFORM',
      show: isPlatform,
      groupBadge: (
        <span
          title="Visible to platform admins"
          className="inline-flex items-center font-inter font-semibold rounded-full"
          style={{ fontSize: '8.5px', padding: '1px 5px', background: '#F1F0EC', color: '#8B8F9E', letterSpacing: '0.06em' }}
        >
          ADMIN
        </span>
      ),
      items: [
        { id: 'platform-customers', label: 'SaaS customers', icon: Building2, show: true },
      ],
    },
  ]

  const visibleSections = sections
    .filter((s) => s.show)
    .map((s) => ({ ...s, items: s.items.filter((i) => i.show) }))
    .filter((s) => s.items.length > 0)

  return visibleSections
}

/** A row's label ("Email & calendar"), for the phone's section title. */
export function settingsLabel(sections: ReturnType<typeof useSettingsSections>, id: string) {
  for (const s of sections) for (const i of s.items) if (i.id === id) return i.label
  return id.startsWith('integration-') ? 'Integrations' : null
}
