import { Mail, LogOut } from 'lucide-react'
import { GioAtsLogo } from '@/components/brand/GioAtsLogo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

const SUPPORT_EMAIL = 'support@virgilio.tech'

interface LockedScreenProps {
  /** The workspace's billing status; every closed state reads the same now. */
  status?: string
}

/**
 * A closed workspace (2026-10-24). Gio ATS is no longer sold, so a workspace
 * whose trial or subscription ended stays closed: no plans or prices, just
 * what happened and who to write to. Its data is left as it was.
 */
export function LockedScreen(_props: LockedScreenProps) {
  const { logout } = useAuth()

  return (
    <div
      className="fixed inset-0 z-[100] flex overflow-auto bg-virgilio-cream font-inter"
      role="main"
      aria-labelledby="locked-title"
    >
      <div className="flex w-full max-w-[560px] flex-col px-6 py-7 sm:px-12">
        <div className="flex items-center">
          <GioAtsLogo height={96} />
        </div>

        <div className="flex flex-1 flex-col justify-center pb-8">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#8B8F9E]">Workspace closed</div>
          <h1 id="locked-title" className="m-0 font-poppins text-[34px] font-semibold leading-[1.1] tracking-[-0.04em] text-[#0d0d09]">
            This workspace is closed<span className="text-[#D7C5FB]">.</span>
          </h1>
          <p className="mt-3 max-w-[400px] text-[13.5px] leading-[1.55] text-[#5A6072]">
            Gio ATS is no longer offered as a subscription, so this workspace stays closed. Nothing in it has been changed.
            If you need anything from it, write to us at {SUPPORT_EMAIL}.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button icon={Mail} onClick={() => window.open(`mailto:${SUPPORT_EMAIL}`, '_blank', 'noopener')}>
              Write to us
            </Button>
            <Button variant="secondary" icon={LogOut} onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
