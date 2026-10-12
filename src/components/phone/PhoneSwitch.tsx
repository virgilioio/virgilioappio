import { Suspense, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Monitor } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { PhoneCard, PhonePage, PhoneSkeletonRows } from './PhoneUI'

/**
 * Routes that look different on a phone (2026-10-12): the phone version
 * when the screen is under the shell breakpoint, the desktop page otherwise.
 */
export function PhoneSwitch({ phone, children }: { phone: ReactNode; children: ReactNode }) {
  const isPhone = useIsMobile()
  if (!isPhone) return <>{children}</>
  return (
    <Suspense fallback={<PhonePage><PhoneCard><PhoneSkeletonRows rows={4} /></PhoneCard></PhonePage>}>
      {phone}
    </Suspense>
  )
}

/** Analytics, Intelligence and chat aren't part of the phone version. */
export function DesktopOnly({ what }: { what: string }) {
  return (
    <PhonePage>
      <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#EDE4FF] text-[#6F3FF5]">
          <Monitor className="h-6 w-6" />
        </span>
        <h1 className="font-poppins font-semibold text-[20px] tracking-[-0.02em] text-[#0d0d09]">
          {what} is on the computer<span className="text-[#D7C5FB]">.</span>
        </h1>
        <p className="mt-2 max-w-[280px] font-inter text-[13.5px] leading-[1.5] text-[#5A6072]">
          The phone version keeps what you need on the road: your agenda, booking link, candidates and jobs.
        </p>
        <Link
          to="/dashboard"
          className="gio-pressable mt-5 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0d0d09] px-5 font-poppins font-semibold text-[13.5px] text-[#fffcf9]"
        >
          Go to Today
        </Link>
      </div>
    </PhonePage>
  )
}
