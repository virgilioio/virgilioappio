import { useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Mail, Phone, Copy, ExternalLink, MapPin, DollarSign, ChevronDown } from 'lucide-react'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { copyToClipboard } from '@/utils/clipboard'
import { getEmailFromEntry, getPhoneFromEntry } from '@/utils/parseContactEntry'
import { formatE164Display, buildWhatsAppUrl } from '@/utils/phoneUtils'
import { cn } from '@/lib/utils'

interface CandidateDetailsCollapsibleProps {
  candidate: any
  whatsAppEnabled: boolean
  handleWhatsAppClick: (phone: string) => void
}

export function CandidateDetailsCollapsible({ candidate, whatsAppEnabled, handleWhatsAppClick }: CandidateDetailsCollapsibleProps) {
  const [open, setOpen] = useState(false)

  // Get primary email for collapsed view
  const primaryEmail = candidate?.contact_emails?.length > 0
    ? getEmailFromEntry(candidate.contact_emails[0]).email
    : candidate?.email || null

  // Get primary phone for collapsed view
  const primaryPhone = candidate?.contact_phones?.length > 0
    ? getPhoneFromEntry(candidate.contact_phones[0]).phone
    : candidate?.phone || null

  return (
    <Card className="bg-surface-primary border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="px-6 py-4 flex items-center justify-between gap-3 min-w-0">
            <CardTitle className="truncate">Candidate Details</CardTitle>
            <div className="flex items-center gap-3 min-w-0">
              {/* Collapsed summary: show email + phone inline (desktop only) */}
              {!open && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-text-secondary min-w-0 max-w-[60%]" onClick={(e) => e.stopPropagation()}>
                  {primaryEmail && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-text-tertiary" />
                      <span className="max-w-[140px] truncate">{primaryEmail}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(primaryEmail, 'Email copied') }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {primaryPhone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-text-tertiary" />
                      <span>{formatE164Display(primaryPhone)}</span>
                      {whatsAppEnabled && buildWhatsAppUrl(primaryPhone) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-[#25D366] hover:text-[#128C7E]"
                          onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(primaryPhone) }}
                        >
                          <WhatsAppIcon size={12} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(primaryPhone, 'Phone copied') }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <ChevronDown className={cn("h-4 w-4 text-text-tertiary transition-transform", open && "rotate-180")} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Emails Section */}
            <div className="space-y-2">
              {candidate?.contact_emails?.length > 0 ? (
                candidate.contact_emails.map((ce: any, idx: number) => {
                  const { email: emailValue, type: emailType } = getEmailFromEntry(ce)
                  if (!emailValue) return null
                  return (
                    <div key={`email-${idx}`} className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <a href={`mailto:${emailValue}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                            {emailValue}
                          </a>
                          <span className="text-xs text-text-tertiary capitalize">{emailType}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => copyToClipboard(emailValue, 'Email copied to clipboard')}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })
              ) : candidate?.email ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                    <a href={`mailto:${candidate.email}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                      {candidate.email}
                    </a>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={() => copyToClipboard(candidate.email, 'Email copied to clipboard')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Phones Section */}
            <div className="space-y-2">
              {candidate?.contact_phones?.length > 0 ? (
                candidate.contact_phones.map((cp: any, idx: number) => {
                  const { phone: phoneValue, type: phoneType } = getPhoneFromEntry(cp)
                  if (!phoneValue) return null
                  return (
                    <div key={`phone-${idx}`} className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <a href={`tel:${phoneValue}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                            {formatE164Display(phoneValue)}
                          </a>
                          <span className="text-xs text-text-tertiary capitalize">{phoneType}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {whatsAppEnabled && buildWhatsAppUrl(phoneValue) && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0 text-[#25D366] hover:text-[#128C7E]"
                            onClick={() => handleWhatsAppClick(phoneValue)}>
                            <WhatsAppIcon size={14} />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                          onClick={() => copyToClipboard(phoneValue, 'Phone number copied to clipboard')}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                    {candidate?.phone ? (
                      <a href={`tel:${candidate.phone}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                        {formatE164Display(candidate.phone)}
                      </a>
                    ) : (
                      <span className="text-sm text-text-tertiary italic">Phone not available</span>
                    )}
                  </div>
                  {candidate?.phone && (
                    <div className="flex items-center gap-0.5">
                      {whatsAppEnabled && buildWhatsAppUrl(candidate.phone) && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0 text-[#25D366] hover:text-[#128C7E]"
                          onClick={() => handleWhatsAppClick(candidate.phone)}>
                          <WhatsAppIcon size={14} />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => copyToClipboard(candidate.phone, 'Phone number copied to clipboard')}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* LinkedIn */}
            {candidate?.linkedin_url && (
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <LinkedInFilled className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                  <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                    LinkedIn Profile
                  </a>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
              </div>
            )}

            {/* Location */}
            {(candidate?.location_city || candidate?.location_state || candidate?.location_country) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-text-primary">
                  {[candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}

            {/* Salary */}
            {candidate?.salary_amount && (
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-text-primary">
                  {candidate.salary_currency || 'USD'} {candidate.salary_amount.toLocaleString()} / {candidate.salary_period || 'annually'}
                </span>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
