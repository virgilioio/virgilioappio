import { Lock } from 'lucide-react'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GoogleLogo } from '@/components/icons/GoogleLogo'
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
}

function ProviderRow({
  logo,
  name,
  subtitle,
  email,
  connected,
  capabilities,
  action,
}: ProviderRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#E7E8EE] bg-white p-4">
      <div className="shrink-0 mt-0.5">{logo}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-poppins font-semibold text-[13px] text-[#0d0d09]">
            {name}
          </h4>
          {connected && (
            <Badge tone="green" size="xs" dot>
              Connected
            </Badge>
          )}
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
      </div>
      <div className="shrink-0 self-center">{action}</div>
    </div>
  )
}

export function EmailCalendarTab() {
  const {
    identities: mailIdentities,
    isLoading: isLoadingMail,
    connectGmail,
    disconnectIdentity: disconnectMail,
  } = useMailIdentities()

  const {
    identities: calendarIdentities,
    isLoading: isLoadingCalendar,
    disconnectCalendar,
    isDisconnecting,
  } = useCalendarIdentities()

  const isLoading = isLoadingMail || isLoadingCalendar
  const hasMail = (mailIdentities?.length ?? 0) > 0
  const hasCalendar = (calendarIdentities?.length ?? 0) > 0
  const googleConnected = hasMail || hasCalendar
  const googleEmail =
    mailIdentities?.[0]?.email_address || calendarIdentities?.[0]?.email_address

  const googleCapabilities: string[] = []
  if (hasMail) googleCapabilities.push('Mail · two-way')
  if (hasCalendar) googleCapabilities.push('Calendar · two-way')

  const handleDisconnectGoogle = async () => {
    try {
      if (mailIdentities) {
        for (const id of mailIdentities) {
          await disconnectMail.mutateAsync(id.id)
        }
      }
      if (calendarIdentities) {
        for (const id of calendarIdentities) {
          await disconnectCalendar(id.id)
        }
      }
      toast.success('Google Workspace disconnected')
    } catch {
      toast.error('Failed to disconnect')
    }
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
              action={
                googleConnected ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="secondary" size="sm">
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
                          disabled={isDisconnecting || disconnectMail.isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
