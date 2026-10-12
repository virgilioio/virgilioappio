import { useState } from 'react'
import { CalendarClock, Copy, Check, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { useBookingConfig } from '@/hooks/useBookingConfig'
import { IconSwap } from '@/components/ui/icon-swap'
import { cn } from '@/lib/utils'

/**
 * Your booking link on the phone: copy it, or hand it to the phone's share
 * sheet (WhatsApp, Messages, email) when the phone has one. The same link
 * the desktop account menu copies.
 */
export function BookingLinkCard({ dark = false }: { dark?: boolean }) {
  const { bookingUrl, isLoading } = useBookingConfig()
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const display = bookingUrl?.replace(/^https?:\/\//, '') ?? null

  const copy = async () => {
    if (!bookingUrl) return
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Couldn't copy the link", { description: 'Press and hold the link to copy it.' })
    }
  }
  const share = async () => {
    if (!bookingUrl) return
    try {
      await navigator.share({ title: 'Book a time with me', url: bookingUrl })
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <div className={cn('rounded-[14px] p-4', dark ? 'bg-[#0d0d09] text-[#fffcf9]' : 'border border-[#E7E8EE] bg-white')}>
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-[9px]', dark ? 'bg-white/10 text-[#D7C5FB]' : 'bg-[#EDE4FF] text-[#6F3FF5]')}>
          <CalendarClock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn('font-poppins font-semibold text-[14px]', dark ? 'text-[#fffcf9]' : 'text-[#0d0d09]')}>Your booking link</div>
          <div className={cn('truncate font-inter text-[12.5px] select-all', dark ? 'text-white/70' : 'text-[#5A6072]')}>
            {isLoading ? 'Loading…' : display ?? 'Set it up in Settings › Booking on a computer'}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!bookingUrl}
          className={cn(
            'gio-pressable inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] font-poppins font-semibold text-[13.5px] disabled:opacity-50',
            dark ? 'bg-[#fffcf9] text-[#0d0d09]' : 'bg-[#0d0d09] text-[#fffcf9]',
          )}
        >
          <IconSwap swapped={copied} from={<Copy className="h-4 w-4" />} to={<Check className="h-4 w-4" />} />
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={share}
            disabled={!bookingUrl}
            className={cn(
              'gio-pressable inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] font-poppins font-semibold text-[13.5px] disabled:opacity-50',
              dark ? 'bg-white/10 text-[#fffcf9]' : 'border border-[#E7E8EE] bg-white text-[#0d0d09]',
            )}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        )}
      </div>
    </div>
  )
}
