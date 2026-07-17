import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User as UserIcon,
  CalendarClock,
  Settings,
  CreditCard,
  Users,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Zap,
  Link as LinkIcon,
  Copy,
  Check,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useTenant } from '@/hooks/useTenant'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useBookingConfig } from '@/hooks/useBookingConfig'
import { cn } from '@/lib/utils'

type RowProps = {
  icon: typeof UserIcon
  label: string
  meta?: string
  to?: string
  onClick?: () => void
  keycaps?: string[]
  chevron?: boolean
  danger?: boolean
  closeMenu: () => void
}

function Row({
  icon: Icon,
  label,
  meta,
  to,
  onClick,
  keycaps,
  chevron,
  danger,
  closeMenu,
}: RowProps) {
  const navigate = useNavigate()
  const handle = () => {
    closeMenu()
    if (onClick) onClick()
    else if (to) navigate(to)
  }

  return (
    <button
      type="button"
      onClick={handle}
      className={cn(
        'group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[9px]',
        'transition-colors focus:outline-none focus-visible:bg-[#F6F5F1]',
        danger ? 'hover:bg-[#FEF2F2]' : 'hover:bg-[#F6F5F1]',
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center h-[30px] w-[30px] rounded-lg shrink-0 transition-colors',
          danger
            ? 'bg-[#FEE2E2] text-[#DC2626]'
            : 'bg-[#F1F0EC] text-[#5A6072] group-hover:bg-[#EDE4FF] group-hover:text-[#6F3FF5]',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span
          className={cn(
            'block font-inter text-[13px] font-medium leading-tight truncate',
            danger ? 'text-[#DC2626]' : 'text-[#0d0d09]',
          )}
        >
          {label}
        </span>
        {meta && (
          <span className="block font-inter text-[11px] leading-tight text-[#8B8F9E] truncate mt-0.5">
            {meta}
          </span>
        )}
      </span>
      {keycaps && (
        <span className="flex items-center gap-0.5 shrink-0">
          {keycaps.map((k) => (
            <kbd
              key={k}
              className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-[5px] bg-[#F1F0EC] text-[#5A6072] font-inter text-[10.5px] font-medium"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
      {chevron && (
        <ChevronRight className="h-3.5 w-3.5 text-[#8B8F9E] shrink-0" />
      )}
    </button>
  )
}

type AccountMenuProps = {
  children: React.ReactNode
}

export function AccountMenu({ children }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const { user, logout, isLoggingOut, organizationId } = useAuth()
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin, isMember } = usePermissions()
  const { profile } = useUserProfile()
  const { tenant } = useTenant()
  const { data: credits } = useSourcingCredits()
  const { data: billing } = useBillingStatus()
  const { bookingUrl } = useBookingConfig()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const close = () => setOpen(false)

  const displayName =
    (profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile?.first_name) ||
    user?.email?.split('@')[0] ||
    'User'

  const initials =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase() || 'U'

  const workspaceName = tenant?.name || 'Workspace'
  const workspaceInitial = workspaceName.charAt(0).toUpperCase()

  const roleLabel = isPlatformAdmin
    ? 'Platform admin'
    : isWorkspaceOwner
    ? 'Owner'
    : isAdmin
    ? 'Admin'
    : isMember
    ? 'Member'
    : 'Member'

  const creditsRemaining = credits
    ? Math.max(0, (credits.collect_credits_limit || 0) - (credits.collect_credits_used || 0))
    : 0

  const planName = (() => {
    const t = billing?.subscription_tier
    if (!t) return null
    if (t === 'per_seat') return 'Per seat'
    return t.charAt(0).toUpperCase() + t.slice(1)
  })()

  const renewsAt = billing?.subscription_end
    ? new Date(billing.subscription_end).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  const billingMeta = planName
    ? renewsAt
      ? `${planName} · renews ${renewsAt}`
      : planName
    : 'Manage subscription'

  const handleLogout = async () => {
    await logout()
    setTimeout(() => navigate('/auth', { replace: true }), 100)
  }

  const handleBuyMore = () => {
    close()
    navigate('/billing')
  }

  const bookingDisplay = bookingUrl
    ? bookingUrl.replace(/^https?:\/\//, '')
    : null

  const handleCopyBooking = async () => {
    if (!bookingUrl) return
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* no-op */
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="p-0 w-[316px] bg-white rounded-2xl border border-[#E7E8EE] overflow-hidden"
        style={{
          boxShadow:
            '0 20px 56px -12px rgba(13,13,9,0.28), 0 0 0 1px rgba(13,13,9,0.03)',
        }}
      >
        {/* 1. Identity */}
        <div className="p-[14px] flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11">
              <AvatarImage src={profile?.avatar_url} alt={displayName} />
              <AvatarFallback className="bg-virgilio-purple text-white font-poppins font-semibold text-[13px]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span
              aria-hidden
              className="absolute bottom-0 right-0 h-[10px] w-[10px] rounded-full bg-[#12B886]"
              style={{ boxShadow: '0 0 0 2.5px #fff' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="font-poppins font-semibold text-[14.5px] leading-tight text-[#0d0d09] truncate"
              style={{ letterSpacing: '-0.01em' }}
            >
              {displayName}
            </p>
            <p className="mt-0.5 font-inter text-[12px] leading-tight text-[#8B8F9E] truncate">
              {user?.email}
            </p>
          </div>
        </div>

        {/* 2. Current workspace */}
        <div className="px-3 pb-3">
          <div
            className="flex items-center gap-2.5 rounded-[10px] bg-[#F6F5F1] border border-[#ECEAE2]"
            style={{ padding: '9px 11px' }}
          >
            <div
              className="flex items-center justify-center h-[26px] w-[26px] rounded-lg bg-[#0d0d09] text-white font-poppins font-semibold text-[12px] shrink-0"
              style={{ letterSpacing: '-0.01em' }}
            >
              {workspaceInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-poppins font-semibold text-[12.5px] leading-tight text-[#0d0d09] truncate">
                {workspaceName}
              </p>
              <p className="mt-0.5 font-inter text-[10.5px] leading-tight text-[#8B8F9E]">
                Workspace
              </p>
            </div>
            <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-[#EDE4FF] text-[#5B21B6] font-poppins font-semibold text-[10.5px] shrink-0">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* 3. Credits */}
        <div className="px-3 pb-3">
          <div
            className="flex items-center gap-2.5 rounded-[10px] border border-[#EDE4FF]"
            style={{
              background: 'linear-gradient(180deg,#FAF8FF,#fff)',
              padding: '10px 11px',
            }}
          >
            <div className="flex items-center justify-center h-[28px] w-[28px] rounded-lg bg-[#EDE4FF] text-[#6F3FF5] shrink-0">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-poppins font-semibold text-[13.5px] leading-tight text-[#0d0d09] tabular-nums">
                {creditsRemaining.toLocaleString()} credits
              </p>
              <p className="mt-0.5 font-inter text-[10.5px] leading-tight text-[#8B8F9E]">
                AI sourcing & enrichment
              </p>
            </div>
            <button
              type="button"
              onClick={handleBuyMore}
              className="inline-flex items-center h-[24px] px-2.5 rounded-full bg-[#0d0d09] text-[#FFFCF9] font-poppins font-semibold text-[11px] hover:bg-[#1a1a15] transition-colors shrink-0"
              style={{ letterSpacing: '-0.005em' }}
            >
              Buy more
            </button>
          </div>
        </div>

        <div className="h-px bg-[#F1F0EC]" />

        {/* 4. Quick access */}
        <div className="px-2 pt-2.5 pb-2">
          <p className="px-2 pb-1.5 font-poppins font-semibold text-[10px] uppercase tracking-[0.08em] text-[#8B8F9E]">
            Quick access
          </p>
          <div className="flex flex-col gap-0.5">
            <Row
              icon={UserIcon}
              label="My profile"
              meta="Personal info & signature"
              to="/settings?tab=profile"
              closeMenu={close}
            />
            <Row
              icon={CalendarClock}
              label="My availability"
              meta="Interview scheduling hours"
              to="/settings?tab=booking"
              closeMenu={close}
            />
            <Row
              icon={Settings}
              label="Settings"
              to="/settings"
              closeMenu={close}
            />
            <Row
              icon={CreditCard}
              label="Billing & plan"
              meta={billingMeta}
              to="/billing"
              closeMenu={close}
            />
            <Row
              icon={Users}
              label="Members & invites"
              to="/settings?tab=members"
              chevron
              closeMenu={close}
            />
          </div>
        </div>

        <div className="h-px bg-[#F1F0EC]" />

        {/* 5. Footer */}
        <div className="px-2 py-2 flex flex-col gap-0.5">
          <Row
            icon={LifeBuoy}
            label="Help & support"
            onClick={() =>
              window.open('mailto:support@gogio.io', '_blank', 'noopener')
            }
            closeMenu={close}
          />
          <Row
            icon={LogOut}
            label={isLoggingOut ? 'Logging out…' : 'Log out'}
            danger
            onClick={handleLogout}
            closeMenu={close}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
