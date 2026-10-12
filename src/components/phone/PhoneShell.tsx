import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Briefcase, CalendarDays, LogOut, Search, Settings, Sun, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { IconTip } from '@/components/ui/tooltip'
import { SearchResultsDialog } from '@/components/search/SearchResultsDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { BookingLinkCard } from './BookingLinkCard'

/**
 * The phone shell (2026-10-12): the desktop's dark pill top bar (logo,
 * search, you) and a matching dark tab bar for what a consultant needs on
 * the road — Today, Jobs, Candidates, Calendar. Analytics, Intelligence and
 * chat stay on the computer. Replaces the old bottom nav and its mascot.
 */

const TABS = [
  { href: '/dashboard', label: 'Today', Icon: Sun, match: (p: string) => p === '/' || p === '/dashboard', show: () => true },
  { href: '/jobs', label: 'Jobs', Icon: Briefcase, match: (p: string) => p.startsWith('/jobs'), show: (perm: ReturnType<typeof usePermissions>) => perm.canViewJobs },
  { href: '/candidates', label: 'Candidates', Icon: Users, match: (p: string) => p.startsWith('/candidates'), show: (perm: ReturnType<typeof usePermissions>) => perm.canViewCandidates },
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays, match: (p: string) => p.startsWith('/calendar'), show: () => true },
]

function useMe() {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const name = (profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name) || user?.email?.split('@')[0] || 'You'
  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U'
  return { name, initials, email: user?.email ?? '', avatar: profile?.avatar_url ?? undefined }
}

export function PhoneShell() {
  const location = useLocation()
  const perm = usePermissions()
  const me = useMe()
  const [searchOpen, setSearchOpen] = useState(false)
  const [youOpen, setYouOpen] = useState(false)
  const tabs = TABS.filter(t => t.show(perm))

  return (
    <>
      {/* Top bar */}
      <header
        className="sm:hidden fixed left-3 right-3 z-50 flex h-12 items-center justify-between rounded-2xl pl-1 pr-1.5 ring-1 ring-white/[0.06] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.35)]"
        style={{ backgroundColor: '#0d0d09', top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      >
        <Link to="/dashboard" aria-label="Gio ATS, today" className="flex items-center">
          <img src="/brand/gio-ats-logo.png" alt="Gio ATS" className="block h-11 w-auto" />
        </Link>
        <div className="flex items-center gap-1">
          <IconTip label="Search">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="gio-pressable inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/80 active:bg-white/[0.08]"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          </IconTip>
          <IconTip label="You, your booking link and settings">
            <button
              type="button"
              aria-label="You, your booking link and settings"
              onClick={() => setYouOpen(true)}
              className="gio-pressable inline-flex h-9 w-9 items-center justify-center rounded-xl active:bg-white/[0.08]"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={me.avatar} alt="" />
                <AvatarFallback className="bg-white/10 text-[11px] font-poppins font-semibold text-white">{me.initials}</AvatarFallback>
              </Avatar>
            </button>
          </IconTip>
        </div>
      </header>

      {/* Tab bar */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 px-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
      >
        <nav
          aria-label="Main"
          className="flex h-[62px] items-center gap-1 rounded-2xl p-1.5 ring-1 ring-white/[0.06] shadow-[0_8px_24px_rgba(15,18,34,0.18)]"
          style={{ backgroundColor: '#0d0d09' }}
        >
          {tabs.map(({ href, label, Icon, match }) => {
            const active = match(location.pathname)
            return (
              <Link
                key={href}
                to={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'gio-pressable flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-xl font-poppins text-[11px] tracking-[-0.01em] transition-colors duration-150',
                  active ? 'bg-[#fffcf9] font-semibold text-[#0d0d09]' : 'font-medium text-[rgba(255,252,249,0.72)]',
                )}
              >
                <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <SearchResultsDialog open={searchOpen} onOpenChange={setSearchOpen} initialQuery="" />
      <YouSheet open={youOpen} onOpenChange={setYouOpen} me={me} />
    </>
  )
}

function YouSheet({ open, onOpenChange, me }: { open: boolean; onOpenChange: (o: boolean) => void; me: ReturnType<typeof useMe> }) {
  const { logout, isLoggingOut } = useAuth()
  const navigate = useNavigate()
  const go = (to: string) => { onOpenChange(false); navigate(to) }
  const signOut = async () => {
    await logout()
    setTimeout(() => navigate('/auth', { replace: true }), 100)
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px] border-0 bg-[#F6F5F1] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3">
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D9D6CE]" />
        <div className="mb-4 flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={me.avatar} alt="" />
            <AvatarFallback className="bg-[#0d0d09] text-[14px] font-poppins font-semibold text-[#fffcf9]">{me.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <SheetTitle className="truncate font-poppins font-semibold text-[16px] text-[#0d0d09]">{me.name}</SheetTitle>
            <SheetDescription className="truncate font-inter text-[12.5px] text-[#5A6072]">{me.email}</SheetDescription>
          </div>
        </div>

        <BookingLinkCard dark />

        <div className="mt-3 overflow-hidden rounded-[14px] border border-[#E7E8EE] bg-white">
          <button type="button" onClick={() => go('/settings')} className="gio-pressable flex w-full items-center gap-3 border-b border-[#F1F0EC] px-4 py-3.5 text-left font-inter font-medium text-[14px] text-[#0d0d09]">
            <Settings className="h-[18px] w-[18px] text-[#5A6072]" />
            Settings
          </button>
          <button type="button" onClick={signOut} disabled={isLoggingOut} className="gio-pressable flex w-full items-center gap-3 px-4 py-3.5 text-left font-inter font-medium text-[14px] text-[#B91C1C] disabled:opacity-60">
            <LogOut className="h-[18px] w-[18px]" />
            {isLoggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
