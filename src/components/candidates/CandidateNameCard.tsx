import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Mail, Phone, Copy } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { StyledPageTitle } from '@/components/ui/styled-page-title'

export type CandidateNameCardTab = {
  value: string
  label: string
  Icon?: React.ComponentType<{ className?: string }>
}

interface CandidateNameCardProps {
  name: string
  linkedinUrl?: string | null
  badgeText?: string | null
  tabs: CandidateNameCardTab[]
  activeTab: string
  onTabChange: (value: string) => void
  rightActions?: React.ReactNode
  subtitle?: React.ReactNode
  email?: string | null
  phone?: string | null
  className?: string
}

export function CandidateNameCard({
  name,
  linkedinUrl,
  badgeText,
  tabs,
  activeTab,
  onTabChange,
  rightActions,
  subtitle,
  email,
  phone,
  className,
}: CandidateNameCardProps) {
  const copyToClipboard = async (text: string, type: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copied to clipboard',
        description: `${type === 'email' ? 'Email' : 'Phone number'} copied successfully`,
      })
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      })
    }
  }
  return (
    <Card className={cn('bg-surface-primary border-border', className)}>
      <CardContent className="p-layout-md">
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <StyledPageTitle className="text-2xl truncate">{name}</StyledPageTitle>
              <Button
                size="icon"
                className="aspect-square rounded-md bg-foreground text-background hover:bg-foreground"
                onClick={() => linkedinUrl && window.open(linkedinUrl, '_blank')}
                disabled={!linkedinUrl}
                aria-label="Open LinkedIn profile"
                title={linkedinUrl ? 'Open LinkedIn profile' : 'No LinkedIn profile'}
              >
                <LinkedInFilled className="h-4 w-4" />
              </Button>
            </div>
            {badgeText && (
              <div className="mt-1">
                <Badge variant="secondary">{badgeText}</Badge>
              </div>
            )}
            {subtitle && (
              <p className="text-text-secondary mt-1 text-sm">{subtitle}</p>
            )}
            {(email || phone) && (
              <div className="flex items-center gap-6 mt-2 text-sm">
                {email && (
                  <div className="flex items-center gap-1 group">
                    <Mail className="h-3 w-3 text-text-secondary" />
                    <a 
                      href={`mailto:${email}`}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {email}
                    </a>
                    <Button
                      variant="ghost"
                      className="!h-4 !w-4 !min-w-4 !max-w-4 !p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2 hover:!bg-black !rounded-sm flex items-center justify-center"
                      onClick={() => copyToClipboard(email, 'email')}
                      title="Copy email"
                    >
                      <Copy className="h-3 w-3 group-hover:text-white" />
                    </Button>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-1 group">
                    <Phone className="h-3 w-3 text-text-secondary" />
                    <a 
                      href={`tel:${phone}`}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {phone}
                    </a>
                    <Button
                      variant="ghost"
                      className="!h-4 !w-4 !min-w-4 !max-w-4 !p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2 hover:!bg-black !rounded-sm flex items-center justify-center"
                      onClick={() => copyToClipboard(phone, 'phone')}
                      title="Copy phone number"
                    >
                      <Copy className="h-3 w-3 group-hover:text-white" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          {rightActions && (
            <div className="flex items-center gap-sm">{rightActions}</div>
          )}
        </div>

        {/* Tabs */}
        <div className="w-full bg-surface-secondary rounded-xl p-1">
          <div className="inline-flex h-auto items-center justify-start rounded-xl bg-transparent p-0 text-muted-foreground w-full">
            {tabs.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => onTabChange(value)}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50',
                  activeTab === value && 'bg-accent text-accent-foreground'
                )}
              >
                {Icon ? <Icon className="h-4 w-4 mr-2" /> : null}
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CandidateNameCard
