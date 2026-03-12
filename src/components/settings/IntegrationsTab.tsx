import { useState, useMemo } from 'react'
import { Search, X, ChevronUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { IntegrationCard } from './IntegrationCard'
import { CATEGORY_OPTIONS, STATUS_OPTIONS, type IntegrationCategory } from './integrationRegistry'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

// Detail components
import { ChromeExtensionTokenCard } from './ChromeExtensionTokenCard'
import { GoogleWorkspaceIntegrationSection } from './GoogleWorkspaceIntegrationSection'
import { WhatsAppIntegrationCard } from './WhatsAppIntegrationCard'

// Logos
import { GoogleLogo } from '@/components/icons/GoogleLogo'
import whatsappLogo from '@/assets/whatsapp-logo.png'
import gogioAvatar from '@/assets/gogio-avatar.png'

// Hooks for connection status
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig'

interface IntegrationEntry {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  logo: React.ReactNode
  useIsConnected: () => boolean
  DetailComponent: React.ComponentType
}

function useGoogleConnected() {
  const { identities: mail, isLoading: lm } = useMailIdentities()
  const { identities: cal, isLoading: lc } = useCalendarIdentities()
  if (lm || lc) return false
  return (mail && mail.length > 0) || (cal && cal.length > 0)
}

function useChromeConnected() {
  // Chrome extension doesn't have a persistent "connected" state in the DB
  return false
}

function useWhatsAppConnected() {
  const { isConfigured } = useWhatsAppConfig()
  return isConfigured
}

const INTEGRATIONS: IntegrationEntry[] = [
  {
    id: 'chrome-extension',
    name: 'GoGio - LinkedIn Companion',
    description: 'Add candidates from LinkedIn into your GoGio ATS in seconds.',
    category: 'sourcing',
    logo: <img src={gogioAvatar} alt="GoGio" className="h-6 w-6 rounded-full" />,
    useIsConnected: useChromeConnected,
    DetailComponent: ChromeExtensionTokenCard,
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    description: 'Connect Gmail and Google Calendar for email sending and interview scheduling.',
    category: 'productivity',
    logo: <GoogleLogo size={24} />,
    useIsConnected: useGoogleConnected,
    DetailComponent: GoogleWorkspaceIntegrationSection,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Send WhatsApp messages to candidates via Twilio for faster communication.',
    category: 'communication',
    logo: <img src={whatsappLogo} alt="WhatsApp" className="h-6 w-6" />,
    useIsConnected: useWhatsAppConnected,
    DetailComponent: WhatsAppIntegrationCard,
  },
]

// Wrapper component that calls the hook for each integration
function IntegrationCardWrapper({
  entry,
  isActive,
  onConfigure,
}: {
  entry: IntegrationEntry
  isActive: boolean
  onConfigure: () => void
}) {
  const isConnected = entry.useIsConnected()
  return (
    <IntegrationCard
      name={entry.name}
      description={entry.description}
      category={entry.category}
      isConnected={isConnected}
      logo={entry.logo}
      isActive={isActive}
      onConfigure={onConfigure}
    />
  )
}

// Wrapper to get connection status for filtering
function useIntegrationStatuses() {
  const googleConnected = useGoogleConnected()
  const chromeConnected = useChromeConnected()
  const whatsappConnected = useWhatsAppConnected()
  return {
    'chrome-extension': chromeConnected,
    'google-workspace': googleConnected,
    'whatsapp': whatsappConnected,
  } as Record<string, boolean>
}

export function IntegrationsTab() {
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const statuses = useIntegrationStatuses()

  const hasActiveFilters = search.length > 0 || selectedCategories.length > 0 || selectedStatuses.length > 0

  const filteredIntegrations = useMemo(() => {
    return INTEGRATIONS.filter((entry) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase()
        if (!entry.name.toLowerCase().includes(q) && !entry.description.toLowerCase().includes(q)) {
          return false
        }
      }
      // Category filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(entry.category)) {
        return false
      }
      // Status filter
      if (selectedStatuses.length > 0) {
        const isConn = statuses[entry.id]
        if (selectedStatuses.includes('connected') && !isConn) return false
        if (selectedStatuses.includes('not_connected') && isConn) return false
        // If both selected, show all (effectively no filter)
      }
      return true
    })
  }, [search, selectedCategories, selectedStatuses, statuses])

  const activeEntry = activeId ? INTEGRATIONS.find((e) => e.id === activeId) : null

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
            isActive={activeId === entry.id}
            onConfigure={() => setActiveId(activeId === entry.id ? null : entry.id)}
          />
        ))}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm font-poppins">
          No integrations match your filters.
        </div>
      )}

      {/* Expanded detail panel */}
      <Collapsible open={!!activeEntry}>
        <CollapsibleContent className="pt-2">
          {activeEntry && (
            <div className="relative rounded-lg border border-border bg-surface-primary p-6">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3 h-7 w-7 p-0"
                onClick={() => setActiveId(null)}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <activeEntry.DetailComponent />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
