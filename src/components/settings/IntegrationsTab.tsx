import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Unplug, X } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenant } from '@/hooks/useTenant'
import { useIntegrationStatuses } from '@/hooks/useIntegrationStatuses'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { supabase } from '@/integrations/supabase/client'
import { useDisconnectSlack, useSlackStatus } from '@/lib/slack'
import { IntegrationCard, type IntegrationState } from './IntegrationCard'
import { IntegrationDetailDialog } from './IntegrationDetailDialog'
import { CATEGORY_LABELS, type IntegrationCategory } from './integrationRegistry'
import { SlackConnectDialog } from './slack/SlackConnectDialog'
import { SlackSheet, askDisconnectSlack } from './slack/SlackSheet'

// Detail components
import { ChromeExtensionTokenCard } from './ChromeExtensionTokenCard'
import { GoogleWorkspaceConnection } from './GoogleWorkspaceConnection'
import { WhatsAppIntegrationDetail } from './WhatsAppIntegrationDetail'

// Logos
import { GoogleLogo } from '@/components/icons/GoogleLogo'
import { SlackLogo } from '@/components/icons/SlackLogo'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import gogioAvatar from '@/assets/gogio-avatar.png'
import whatsappHero from '@/assets/integrations/whatsapp-hero.png'
import googleWorkspaceImg from '@/assets/integrations/google-workspace.png'

export interface IntegrationEntry {
  id: string
  name: string
  description: string
  detailContent?: React.ReactNode
  category: IntegrationCategory
  logo: React.ReactNode
  DetailComponent: React.ComponentType
  images?: string[]
}

export const INTEGRATIONS: IntegrationEntry[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send hires, new applicants, interviews and more to your channels and people, as they happen.',
    category: 'communication',
    logo: <SlackLogo size={22} />,
    DetailComponent: () => null,
    detailContent: (
      <>
        <p>Gio sends your team a Slack message when something happens: a hire, a new applicant, a stage move, an interview, a scorecard, an offer signed. You choose what, where it goes and what it says.</p>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">How it works</h4>
        <ol className="list-inside list-decimal space-y-1">
          <li>An admin connects your Slack workspace (once, for everyone).</li>
          <li>Add an automation: when this happens, send this message to these channels or people.</li>
          <li>Put in details like the candidate, the job, the client or who did it, and @tag anyone in your Slack. People in details are tagged when Slack knows their email.</li>
        </ol>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">For the whole workspace, or one job</h4>
        <p>Admins set up automations for every job (or the jobs, departments, clients and stages they pick). A job&rsquo;s Recruiter adds automations for their own job in the job&rsquo;s Setup › Slack, and can send to its Recruiter, Sourcer, Hiring manager or interviewer by direct message.</p>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">What stays out of Slack</h4>
        <p>Pay and salary never go to Slack, and offer events are for admins only. Gio doesn&rsquo;t read your Slack messages.</p>
      </>
    ),
  },
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
    DetailComponent: GoogleWorkspaceConnection,
    images: [googleWorkspaceImg],
    detailContent: (
      <>
        <p>The Google Workspace integration in GoGio enables seamless communication and scheduling by connecting your Gmail and Google Calendar directly to the platform. This allows recruiters to manage candidate outreach and coordinate interviews without leaving GoGio.</p>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">Key Functionality</h4>
        <p>Users can send and receive emails with candidates directly from GoGio, ensuring all communication is centralized and easily accessible within each candidate profile.</p>
        <p>The integration also powers GoGio's scheduling capabilities, allowing users to coordinate interviews quickly by leveraging their Google Calendar availability. This reduces back-and-forth and simplifies the interview setup process.</p>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">Email Communication</h4>
        <p>Once connected, users can:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Send emails to candidates directly from GoGio</li>
          <li>View email history within the candidate profile</li>
          <li>Use templates to standardize and speed up outreach</li>
          <li>Maintain a centralized communication record tied to each candidate</li>
        </ul>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">Scheduling</h4>
        <p>GoGio integrates with Google Calendar to enable:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Real-time visibility into user availability</li>
          <li>Quick scheduling of interviews with candidates</li>
          <li>Calendar event creation and synchronization</li>
          <li>Streamlined coordination with internal team members and candidates</li>
        </ul>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">How It Works</h4>
        <ol className="list-inside list-decimal space-y-1">
          <li>The user connects their Google Workspace account through GoGio settings.</li>
          <li>Gmail and Calendar permissions are granted securely.</li>
          <li>Users can immediately start sending emails and scheduling interviews within the platform.</li>
          <li>All activity is synced with the user's Google Workspace account in real time.</li>
        </ol>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">Requirements</h4>
        <p>A valid Google Workspace (Gmail) account is required to enable this integration. Users must grant the necessary permissions for email and calendar access during setup.</p>
      </>
    ),
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Open candidate phone numbers directly in WhatsApp with one click.',
    detailContent: (
      <>
        <p>The WhatsApp integration in GoGio enables recruiters to quickly connect with candidates directly from the platform, streamlining outbound communication and reducing friction in the outreach process.</p>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">Key Functionality</h4>
        <p>Users can access a candidate's WhatsApp conversation directly from their profile or pipeline view. With a single click, GoGio opens a WhatsApp chat window pre-filled with the candidate's phone number, allowing immediate contact.</p>
        <p>A <strong>First-Click Template</strong> feature is included to accelerate initial outreach. The first time a user opens a WhatsApp conversation with a candidate from GoGio, a pre-configured message template is automatically inserted into the chat. This ensures consistency, speed, and quality in first-touch communication.</p>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">Template Configuration</h4>
        <p>The First-Click Template is fully customizable within the integration settings. Users can define and update their default outreach message to match their tone, role, or hiring context.</p>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">How It Works</h4>
        <ol className="list-inside list-decimal space-y-1">
          <li>The user clicks the WhatsApp icon from a candidate profile or pipeline view.</li>
          <li>GoGio opens a WhatsApp chat with the candidate's number.</li>
          <li>If it is the first interaction, the configured template is automatically populated in the message field.</li>
          <li>The user can edit or send the message directly.</li>
        </ol>

        <h4 className="pt-2 font-poppins text-[13px] font-semibold text-text-primary">Requirements</h4>
        <p>For the best experience, it is recommended to have WhatsApp Desktop installed:{' '}
          <a href="https://www.whatsapp.com/download" target="_blank" rel="noopener noreferrer" className="text-virgilio-purple underline hover:text-virgilio-purple/80">
            https://www.whatsapp.com/download
          </a>
        </p>
        <p>The integration leverages WhatsApp's native behavior, so users must have an active WhatsApp account linked to their device.</p>
      </>
    ),
    category: 'communication',
    logo: <WhatsAppIcon size={20} className="text-[#25D366]" />,
    DetailComponent: WhatsAppIntegrationDetail,
    images: [whatsappHero],
  },
]

/**
 * Settings › Integrations (2026-10-27): All · Connected · Not connected with
 * counts and a search, then the integrations by category, each a card with
 * its state and actions (Connect, Configure, Details; Disconnect in ⋯).
 * Slack's Configure opens its own sheet; Slack sends people back here with
 * ?slack=connected|cancelled|error after its sign-in.
 */
const SECTIONS: Array<{ id: IntegrationCategory; body: string }> = [
  { id: 'communication', body: 'Where your team hears about candidates, and talks to them.' },
  { id: 'productivity', body: 'The email and calendars Gio works through.' },
  { id: 'sourcing', body: 'Bring candidates in from where you find them.' },
]

const SLACK_ERRORS: Record<string, string> = {
  expired: 'The Slack sign-in took too long. Try again.',
  setup: 'Slack isn\u2019t set up for Gio yet.',
  slack: 'Slack didn\u2019t finish the sign-in. Try again.',
  admin: 'Only admins connect Slack.',
  save: 'Gio couldn\u2019t save the connection. Try again.',
}

type Tab = 'all' | 'connected' | 'off'

interface IntegrationsTabProps {
  initialConfigureId?: string | null
}

export function IntegrationsTab({ initialConfigureId }: IntegrationsTabProps) {
  const { tenant } = useTenant()
  const tenantId = tenant?.id
  const slack = useSlackStatus(tenantId)
  const statuses = useIntegrationStatuses()
  const { isAdmin, isWorkspaceOwner, isPlatformAdmin } = usePermissions()
  const isAdminLevel = isAdmin || isWorkspaceOwner || isPlatformAdmin
  const [params, setParams] = useSearchParams()

  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [configureId, setConfigureId] = useState<string | null>(initialConfigureId === 'slack' ? null : initialConfigureId ?? null)
  const [slackOpen, setSlackOpen] = useState(initialConfigureId === 'slack')
  const [connectSlack, setConnectSlack] = useState(false)

  const { toggle: toggleWhatsApp, isSaving: whatsAppSaving } = useWorkspaceAutomation('whatsapp_integration')
  const { connectGmail } = useMailIdentities()
  const disconnectSlack = useDisconnectSlack(tenantId)
  const queryClient = useQueryClient()

  // Back from Slack's sign-in.
  useEffect(() => {
    const result = params.get('slack')
    if (!result) return
    if (result === 'connected') {
      toast.success('Slack is connected', { description: 'Add an automation to choose what Gio sends.' })
      void queryClient.invalidateQueries({ queryKey: ['slack-status'] })
      setSlackOpen(true)
    } else if (result === 'error') {
      toast.error('Slack isn\u2019t connected', { description: SLACK_ERRORS[params.get('reason') ?? ''] ?? 'Try again.' })
    }
    const next = new URLSearchParams(params)
    next.delete('slack')
    next.delete('reason')
    setParams(next, { replace: true })
  }, [params, setParams, queryClient])

  const stateOf = (id: string): IntegrationState => {
    if (id === 'slack') return slack.data?.connected ? (slack.data.status === 'broken' ? 'attention' : 'connected') : 'off'
    return statuses[id] ? 'connected' : 'off'
  }

  const available = useMemo(
    () => INTEGRATIONS.filter((e) => e.id !== 'whatsapp' || isAdminLevel),
    [isAdminLevel],
  )
  const counts = {
    all: available.length,
    connected: available.filter((e) => stateOf(e.id) !== 'off').length,
    off: available.filter((e) => stateOf(e.id) === 'off').length,
  }
  const q = search.trim().toLowerCase()
  const shown = available.filter((e) => {
    const st = stateOf(e.id)
    if (tab === 'connected' && st === 'off') return false
    if (tab === 'off' && st !== 'off') return false
    if (q && !e.name.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q)) return false
    return true
  })

  const disconnect = async (id: string) => {
    switch (id) {
      case 'slack': {
        if (!(await askDisconnectSlack(slack.data))) return
        disconnectSlack.mutate(undefined, {
          onSuccess: () => toast.success('Slack disconnected'),
          onError: (e) => toast.error('Couldn\u2019t disconnect Slack', { description: e.message }),
        })
        return
      }
      case 'whatsapp': {
        const ok = await confirmDestructive({
          variant: 'remove',
          icon: Unplug,
          title: 'Turn off WhatsApp shortcuts?',
          description: 'The WhatsApp buttons next to candidate phone numbers go away for everyone in this workspace. Your pre-filled message is kept for when you turn it back on.',
          confirmLabel: 'Turn off WhatsApp',
        })
        if (ok) toggleWhatsApp(false)
        return
      }
      case 'google-workspace': {
        const ok = await confirmDestructive({
          variant: 'remove',
          icon: Unplug,
          title: 'Disconnect Google Workspace?',
          description: 'Gio stops sending candidate email from your address and stops reading your calendar. Your booking links stop offering times and new interviews can\u2019t go on your calendar until you reconnect. Emails already sent and events already booked stay.',
          confirmLabel: 'Disconnect Google',
        })
        if (!ok) return
        const { error } = await supabase.functions.invoke('disconnect-google-workspace', { body: {} })
        if (error) {
          toast.error('Couldn\u2019t disconnect Google Workspace. Nothing was changed; try again.')
          return
        }
        queryClient.invalidateQueries({ queryKey: ['mail-identities'] })
        queryClient.invalidateQueries({ queryKey: ['calendar-identities'] })
        toast.success('Google Workspace disconnected')
      }
    }
  }

  const configure = (id: string) => (id === 'slack' ? setSlackOpen(true) : setConfigureId(id))

  const primaryFor = (e: IntegrationEntry): { label: string; onClick: () => void; loading?: boolean } | undefined => {
    const st = stateOf(e.id)
    switch (e.id) {
      case 'slack':
        if (st !== 'off') return { label: 'Configure', onClick: () => setSlackOpen(true) }
        return isAdminLevel ? { label: 'Connect', onClick: () => setConnectSlack(true) } : undefined
      case 'google-workspace':
        return st === 'off'
          ? { label: 'Connect', onClick: () => connectGmail.mutate(), loading: connectGmail.isPending }
          : { label: 'Configure', onClick: () => configure(e.id) }
      case 'whatsapp':
        return st === 'off'
          ? { label: 'Turn on', onClick: () => toggleWhatsApp(true), loading: whatsAppSaving }
          : { label: 'Configure', onClick: () => configure(e.id) }
      case 'chrome-extension':
        return { label: 'Set up', onClick: () => configure(e.id) }
      default:
        return undefined
    }
  }

  const canDisconnect = (e: IntegrationEntry) =>
    stateOf(e.id) !== 'off' && (e.id === 'google-workspace' || (e.id === 'whatsapp' && isAdminLevel) || (e.id === 'slack' && !!slack.data?.is_admin))

  const details = detailsId ? INTEGRATIONS.find((e) => e.id === detailsId) : null
  const configEntry = configureId ? INTEGRATIONS.find((e) => e.id === configureId) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList indicator="pill">
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="connected">Connected ({counts.connected})</TabsTrigger>
            <TabsTrigger value="off">Not connected ({counts.off})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations"
            aria-label="Search integrations"
            className="h-9 pl-9 pr-9 text-[13px]"
          />
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            data-visible={search ? '' : undefined}
            tabIndex={search ? 0 : -1}
            className="gio-search-clear absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <AnimatedEmpty
          scene="search"
          onceKey="integrations-filtered"
          title={q ? `No integration matches \u201c${search.trim()}\u201d` : tab === 'connected' ? 'Nothing is connected yet' : 'Everything here is connected'}
          body={q ? 'Try another word, or look through them all.' : undefined}
          primary={{ label: q ? 'Clear search' : 'Show all', onClick: () => { setSearch(''); setTab('all') } }}
        />
      ) : (
        SECTIONS.map((sec) => {
          const list = shown.filter((e) => e.category === sec.id)
          if (!list.length) return null
          return (
            <section key={sec.id} aria-labelledby={`integrations-${sec.id}`}>
              <h3 id={`integrations-${sec.id}`} className="font-poppins text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
                {CATEGORY_LABELS[sec.id]}
              </h3>
              <p className="mt-0.5 font-inter text-[12.5px] text-text-secondary">{sec.body}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((e) => (
                  <IntegrationCard
                    key={e.id}
                    name={e.name}
                    description={e.description}
                    logo={e.logo}
                    state={stateOf(e.id)}
                    primary={primaryFor(e)}
                    note={e.id === 'slack' && !isAdminLevel ? 'An admin connects Slack' : undefined}
                    onDetails={() => setDetailsId(e.id)}
                    onDisconnect={canDisconnect(e) ? () => void disconnect(e.id) : undefined}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      {details && (
        <IntegrationDetailDialog
          open={!!details}
          onOpenChange={(o) => !o && setDetailsId(null)}
          name={details.name}
          description={details.description}
          detailContent={details.detailContent}
          category={details.category}
          logo={details.logo}
          images={details.images}
          state={stateOf(details.id)}
          primary={primaryFor(details)}
          onDisconnect={canDisconnect(details) ? () => void disconnect(details.id) : undefined}
        />
      )}

      {/* Google, WhatsApp and the extension keep their own configuration */}
      <Sheet open={!!configEntry} onOpenChange={(open) => { if (!open) setConfigureId(null) }}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          {configEntry && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EFEEEA] bg-[#FAFAF7]">
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

      {tenantId && (
        <>
          <SlackConnectDialog open={connectSlack} onOpenChange={setConnectSlack} tenantId={tenantId} />
          <SlackSheet open={slackOpen} onOpenChange={setSlackOpen} tenantId={tenantId} status={slack.data} />
        </>
      )}
    </div>
  )
}
