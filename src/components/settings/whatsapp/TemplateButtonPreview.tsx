import { ExternalLink, Phone } from 'lucide-react'
import type { WhatsAppContentType, QuickReplyAction, CallToActionAction } from '@/hooks/useWhatsAppConfig'

interface TemplateButtonPreviewProps {
  contentType: WhatsAppContentType
  actions: (QuickReplyAction | CallToActionAction)[]
}

export function TemplateButtonPreview({ contentType, actions }: TemplateButtonPreviewProps) {
  if (contentType === 'text' || !actions?.length) return null

  if (contentType === 'quick_reply') {
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {actions.map((a, i) => (
          <span
            key={i}
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-[#25D366]/40 text-[#25D366] bg-[#25D366]/5"
          >
            {(a as QuickReplyAction).title || `Button ${i + 1}`}
          </span>
        ))}
      </div>
    )
  }

  if (contentType === 'call_to_action') {
    return (
      <div className="mt-2 border-t border-[#25D366]/20 pt-1.5 space-y-1">
        {actions.map((a, i) => {
          const cta = a as CallToActionAction
          return (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-[#25D366] cursor-pointer hover:bg-[#25D366]/5 rounded transition-colors"
            >
              {cta.type === 'URL' ? (
                <ExternalLink className="h-3 w-3" />
              ) : (
                <Phone className="h-3 w-3" />
              )}
              {cta.title || `Button ${i + 1}`}
            </div>
          )
        })}
      </div>
    )
  }

  return null
}
