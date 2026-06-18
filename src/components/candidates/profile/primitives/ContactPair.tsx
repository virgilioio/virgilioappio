import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { buildWhatsAppUrl, formatE164Display } from '@/utils/phoneUtils'

interface ContactPairProps {
  icon: LucideIcon | ((props: any) => JSX.Element)
  label: string
  value: ReactNode
}

/**
 * Shared contact-info row used in candidate Contact Information cards
 * (Independent profile and in-job profile overview). Visual markup must
 * stay in sync with the original primitive in IndependentCandidateProfile.
 */
export function ContactPair({ icon: Icon, label, value }: ContactPairProps) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="h-8 w-8 rounded-[9px] bg-[#FAFAF7] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[#5A6072]" />
      </div>
      <div className="min-w-0">
        <div className="font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E]">{label}</div>
        <div className="font-inter text-[13px] font-medium text-[#1F2230] truncate mt-0.5">
          {value || <span className="text-[#8B8F9E]">—</span>}
        </div>
      </div>
    </div>
  )
}

interface PhoneContactPairProps {
  icon: LucideIcon | ((props: any) => JSX.Element)
  label?: string
  phone?: string | null
  whatsAppEnabled?: boolean
  onWhatsAppClick?: (phone: string) => void
}

/**
 * Phone variant: appends a WhatsApp shortcut icon when the integration is
 * active and the phone resolves to a valid wa.me URL.
 */
export function PhoneContactPair({
  icon,
  label = 'Phone',
  phone,
  whatsAppEnabled,
  onWhatsAppClick,
}: PhoneContactPairProps) {
  const waUrl = phone ? buildWhatsAppUrl(phone) : null
  const display = phone ? formatE164Display(phone) || phone : null

  return (
    <ContactPair
      icon={icon}
      label={label}
      value={
        phone ? (
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="truncate">{display}</span>
            {whatsAppEnabled && waUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onWhatsAppClick) onWhatsAppClick(phone)
                  else window.open(waUrl, '_blank')
                }}
                className="shrink-0 p-1 rounded-md hover:bg-[#F1F0EC] transition-colors text-[#25D366]"
                aria-label="Start WhatsApp conversation"
                title="Start WhatsApp conversation"
              >
                <WhatsAppIcon size={14} />
              </button>
            )}
          </span>
        ) : null
      }
    />
  )
}
