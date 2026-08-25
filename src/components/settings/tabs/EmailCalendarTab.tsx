import { AlertTriangle, Lock } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GoogleLogo } from '@/components/icons/GoogleLogo'
import { supabase } from '@/integrations/supabase/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { toast } from 'sonner'

type WorkspaceState = 'disconnected' | 'connected' | 'reconnect'

function hasTokenFailure(identity: { sync_status?: string | null; sync_error?: string | null; sync_error_message?: string | null; is_active?: boolean }) {
  const status = (identity.sync_status || '').toLowerCase()
  const message = `${identity.sync_error || ''} ${identity.sync_error_message || ''}`.toLowerCase()
  return (
    identity.is_active === false ||
    status === 'expired' ||
    status === 'error' ||
    message.includes('token') ||
    message.includes('revoked') ||
    message.includes('refresh') ||
    message.includes('invalid_grant')
  )
}

function getIdentityErrorMessage(identity: { sync_error?: string | null; sync_error_message?: string | null } | undefined) {
  return identity?.sync_error_message || identity?.sync_error || null
}

interface ProviderRowProps {
  logo: React.ReactNode
  name: string
  /** Subtitle shown when disconnected */
  subtitle?: string
  /** Email shown when connected */
  email?: string
  connected: boolean
  /** Capability chips shown when connected */
  capabilities?: string[]
  action: React.ReactNode
  state: WorkspaceState
  statusMessage?: string | null
}

function ProviderRow({
  logo,
  name,
  subtitle,
  email,
  connected,
  capabilities,
  action,
  state,
  statusMessage,
}: ProviderRowProps) {
  const badge = state === 'connected'
    ? <Badge tone="green" size="xs" dot>Connected</Badge>
    : state === 'reconnect'
      ? <Badge tone="yellow" size="xs" icon={AlertTriangle}>Reconnect required</Badge>
      : null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#E7E8EE] bg-white p-4">
      <div className="shrink-0 mt-0.5">{logo}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-poppins font-semibold text-[13px] text-[#0d0d09]">
            {name}
          </h4>
          {badge}
        </div>
        {connected ? (
          email && (
            <p className="font-inter text-[12px] text-[#5A6072] mt-0.5">{email}</p>
          )
        ) : (
          subtitle && (
            <p className="font-inter text-[12px] text-[#5A6072] mt-0.5">{subtitle}</p>
          )
        )}
        {connected && capabilities && capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {capabilities.map((c) => (
              <Badge key={c} tone="purple" size="xs">
                {c}
              </Badge>
            ))}
          </div>
        )}
        {statusMessage && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-pastel-yellow px-2.5 py-2 font-inter text-[11.5px] text-pastel-yellow-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
      <div className="shrink-0 self-center">{action}</div>
    </div>
  )
}

export function EmailCalendarTab() {
  const queryClient = useQueryClient()
  const {
    identities: mailIdentities,
    isLoading: isLoadingMail,
    connectGmail,
  } = useMailIdentities()

  const {
    identities: calendarIdentities,
    isLoading: isLoadingCalendar,
  } = useCalendarIdentities()

  const disconnectGoogleWorkspace = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('disconnect-google-workspace', {
        body: {},
      })
      if (error) throw error
      return data as { success: boolean }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-identities'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-identities'] })
      toast.success('Google Workspace disconnected')
    },
    onError: (error: Error) => {
      toast.error(`Failed to disconnect Google Workspace: ${error.message}`)
    },
  })

  const isLoading = isLoadingMail || isLoadingCalendar
  const hasMail = (mailIdentities?.length ?? 0) > 0
  const hasCalendar = (calendarIdentities?.length ?? 0) > 0
  const needsReconnect = [...(mailIdentities ?? []), ...(calendarIdentities ?? [])].some(hasTokenFailure)
  const workspaceState: WorkspaceState = hasMail || hasCalendar ? (needsReconnect ? 'reconnect' : 'connected') : 'disconnected'
  const googleConnected = hasMail || hasCalendar
  const googleEmail =
    mailIdentities?.[0]?.email_address || calendarIdentities?.[0]?.email_address
  const statusMessage = needsReconnect
    ? getIdentityErrorMessage([...(mailIdentities ?? []), ...(calendarIdentities ?? [])].find(hasTokenFailure)) ||
      'Google access was revoked or expired. Reconnect Google Workspace to send mail, create calendar invites, and keep booking links active.'
    : null

  const googleCapabilities: string[] = []
  if (hasMail) googleCapabilities.push('Mail · two-way')
  if (hasCalendar) googleCapabilities.push('Calendar · two-way')

  const handleDisconnectGoogle = () => {
    disconnectGoogleWorkspace.mutate()
  }

  return (
    <SettingsCard
      title="Email & calendar"
      description="One connection powers both — candidate replies from your address, and scheduling against your real calendar."
    >
      <div className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-[88px] w-full rounded-lg" />
        ) : (
          <>
            <ProviderRow
              logo={<GoogleLogo size={22} />}
              name="Google Workspace"
              subtitle="Gmail and Google Calendar."
              email={googleEmail}
              connected={googleConnected}
              capabilities={googleCapabilities}
              state={workspaceState}
              statusMessage={statusMessage}
              action={
                googleConnected ? (
                  <div className="flex items-center gap-2">
                    {needsReconnect && (
                      <Button
                        size="sm"
                        onClick={() => connectGmail.mutate()}
                        disabled={connectGmail.isPending || disconnectGoogleWorkspace.isPending}
                      >
                        {connectGmail.isPending ? 'Connecting…' : 'Reconnect Google'}
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="secondary" size="sm" disabled={disconnectGoogleWorkspace.isPending}>
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Google Workspace</AlertDialogTitle>
                          <AlertDialogDescription>
                            You won't be able to send candidate emails from your address or
                            schedule interviews against your real calendar until you reconnect.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDisconnectGoogle}
                            disabled={disconnectGoogleWorkspace.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connectGmail.mutate()}
                    disabled={connectGmail.isPending}
                  >
                    {connectGmail.isPending ? 'Connecting…' : 'Connect'}
                  </Button>
                )
              }
            />

            <p className="flex items-center gap-1.5 font-inter text-[11.5px] text-[#8B8F9E] pt-1">
              <Lock className="h-3 w-3" strokeWidth={2} />
              Gio never reads your inbox — two-way for mail, free/busy + write for
              calendar. Disconnect anytime.
            </p>
          </>
        )}
      </div>
    </SettingsCard>
  )
}
