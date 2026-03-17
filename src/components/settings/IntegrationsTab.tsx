import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { IntegrationCard } from './IntegrationCard'
import { IntegrationDetailDialog } from './IntegrationDetailDialog'
import { CATEGORY_OPTIONS, STATUS_OPTIONS, type IntegrationCategory } from './integrationRegistry'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIntegrationStatuses } from '@/hooks/useIntegrationStatuses'

// Detail components
import { ChromeExtensionTokenCard } from './ChromeExtensionTokenCard'
import { GoogleWorkspaceIntegrationSection } from './GoogleWorkspaceIntegrationSection'
import { WhatsAppIntegrationDetail } from './WhatsAppIntegrationDetail'

// Logos
import { GoogleLogo } from '@/components/icons/GoogleLogo'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import gogioAvatar from '@/assets/gogio-avatar.png'

// Hooks
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'

export interface IntegrationEntry {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  logo: React.ReactNode
  DetailComponent: React.ComponentType
  images?: string[]
}

export const INTEGRATIONS: IntegrationEntry[] = [
  {
    id: 'chrome-extension',
    name: 'GoGio - LinkedIn Companion',
    description: 'Add candidates directly from LinkedIn with one click using our browser extension.',
    category: 'sourcing',
    logo: <img src={gogioAvatar} alt="GoGio" className="h-6 w-6 rounded-full" />,
    DetailComponent: ChromeExtensionTokenCard,
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    description: 'Connect Gmail and Google Calendar for email sending and interview scheduling.',
    category: 'productivity',
    logo: <GoogleLogo size={24} />,
    DetailComponent: GoogleWorkspaceIntegrationSection,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Open candidate phone numbers directly in WhatsApp with one click.',
    category: 'communication',
    logo: <WhatsAppIcon size={20} className="text-[#25D366]" />,
    DetailComponent: WhatsAppIntegrationDetail,
  },
]

// Wrapper component that calls the hook for each integration
function IntegrationCardWrapper({
  entry,
  onClickCard,
}: {
  entry: IntegrationEntry
  onClickCard: () => void
}) {
  const statuses = useIntegrationStatuses()
  const isConnected = statuses[entry.id] ?? false
  return (
    <IntegrationCard
      name={entry.name}
      description={entry.description}
      category={entry.category}
      isConnected={isConnected}
      logo={entry.logo}
      isActive={false}
      onConfigure={onClickCard}
    />
  )
}

// Hook to get install/uninstall actions for a specific integration
function useIntegrationActions(integrationId: string | null) {
  const { toggle: toggleWhatsApp, isSaving: whatsAppSaving } = useWorkspaceAutomation('whatsapp_integration')
  const { connectGmail } = useMailIdentities()
  const { disconnectCalendar } = useCalendarIdentities()
  const { identities: mailIdentities, disconnectIdentity: disconnectMail } = useMailIdentities()
  const { identities: calendarIdentities } = useCalendarIdentities()

  const install = () => {
    switch (integrationId) {
      case 'whatsapp':
        toggleWhatsApp(true)
        break
      case 'google-workspace':
        connectGmail.mutate()
        break
      case 'chrome-extension':
        window.open('https://chromewebstore.google.com/detail/gogio-linkedin-extension/nhkooggcjgdckjlpbogeanhohjkndhcj', '_blank')
        break
    }
  }

  const uninstall = async () => {
    switch (integrationId) {
      case 'whatsapp':
        toggleWhatsApp(false)
        break
      case 'google-workspace':
        if (mailIdentities) {
          for (const identity of mailIdentities) {
            await disconnectMail.mutateAsync(identity.id)
          }
        }
        if (calendarIdentities) {
          for (const identity of calendarIdentities) {
            await disconnectCalendar(identity.id)
          }
        }
        break
      case 'chrome-extension':
        // No server-side uninstall needed
        break
    }
  }

  return { install, uninstall, isInstalling: whatsAppSaving || connectGmail.isPending }
}

interface IntegrationsTabProps {
  initialConfigureId?: string | null
}

export function IntegrationsTab({ initialConfigureId }: IntegrationsTabProps) {
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [dialogId, setDialogId] = useState<string | null>(null)
  const [configureId, setConfigureId] = useState<string | null>(initialConfigureId ?? null)

  const statuses = useIntegrationStatuses()
  const { install, uninstall, isInstalling } = useIntegrationActions(dialogId)

  const hasActiveFilters = search.length > 0 || selectedCategories.length > 0 || selectedStatuses.length > 0

  const filteredIntegrations = useMemo(() => {
    return INTEGRATIONS.filter((entry) => {
      if (search) {
        const q = search.toLowerCase()
        if (!entry.name.toLowerCase().includes(q) && !entry.description.toLowerCase().includes(q)) {
          return false
        }
      }
      if (selectedCategories.length > 0 && !selectedCategories.includes(entry.category)) {
        return false
      }
      if (selectedStatuses.length > 0) {
        const isConn = statuses[entry.id]
        if (selectedStatuses.includes('connected') && !isConn) return false
        if (selectedStatuses.includes('not_connected') && isConn) return false
      }
      return true
    })
  }, [search, selectedCategories, selectedStatuses, statuses])

  const dialogEntry = dialogId ? INTEGRATIONS.find((e) => e.id === dialogId) : null
  const configEntry = configureId ? INTEGRATIONS.find((e) => e.id === configureId) : null

  const clearAll = () => {
    setSearch('')
    setSelectedCategories([])
    setSelectedStatuses([])
  }

  return (
    <div className="space-y-md">
      <PageHeader
        title="Integrations"
        subtitle="Connect external services to enhance your workflow"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        <FilterChipPopover
          label="Category"
          options={CATEGORY_OPTIONS}
          selectedValues={selectedCategories}
          onSelectionChange={setSelectedCategories}
        />

        <FilterChipPopover
          label="Status"
          options={STATUS_OPTIONS}
          selectedValues={selectedStatuses}
          onSelectionChange={setSelectedStatuses}
        />

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-xs font-poppins text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.map((entry) => (
          <IntegrationCardWrapper
            key={entry.id}
            entry={entry}
            onClickCard={() => setDialogId(entry.id)}
          />
        ))}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm font-poppins">
          No integrations match your filters.
        </div>
      )}

      {/* Detail dialog */}
      {dialogEntry && (
        <IntegrationDetailDialog
          open={!!dialogEntry}
          onOpenChange={(open) => { if (!open) setDialogId(null) }}
          name={dialogEntry.name}
          description={dialogEntry.description}
          category={dialogEntry.category}
          logo={dialogEntry.logo}
          isConnected={statuses[dialogEntry.id] ?? false}
          onInstall={install}
          onUninstall={uninstall}
          onConfigure={() => setConfigureId(dialogEntry.id)}
          isInstalling={isInstalling}
        />
      )}

      {/* Configuration sheet */}
      <Sheet open={!!configEntry} onOpenChange={(open) => { if (!open) setConfigureId(null) }}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          {configEntry && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
                    {configEntry.logo}
                  </div>
                  <SheetTitle className="text-base font-poppins">{configEntry.name}</SheetTitle>
                </div>
              </SheetHeader>
              <div className="mt-6">
                <configEntry.DetailComponent />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
