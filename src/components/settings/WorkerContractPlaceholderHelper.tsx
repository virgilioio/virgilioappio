import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  User, 
  Building, 
  MapPin,
  Copy
} from 'lucide-react'
import { useWorkerContractPlaceholders } from '@/hooks/useWorkerContractPlaceholders'
import { useToast } from '@/hooks/use-toast'

interface PlaceholderHelperProps {
  selectedCountryId: string
  onInsertPlaceholder: (placeholder: string) => void
}

interface PlaceholderSectionProps {
  title: string
  icon: any
  placeholders: Array<{ key: string; label: string; description?: string }>
  onInsert: (placeholder: string) => void
}

function PlaceholderSection({ title, icon: Icon, placeholders, onInsert }: PlaceholderSectionProps) {
  const { toast } = useToast()

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copied',
        description: `${text} copied to clipboard`
      })
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  if (placeholders.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <h4 className="font-medium">{title}</h4>
        <Badge variant="secondary" className="text-xs">
          {placeholders.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {placeholders.map((placeholder) => (
          <div
            key={placeholder.key}
            className="flex items-center justify-between p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {placeholder.label}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {placeholder.key}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(placeholder.key)}
                className="p-1 h-auto"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onInsert(placeholder.key)}
                className="p-1 h-auto text-xs"
              >
                Insert
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function WorkerContractPlaceholderHelper({ 
  selectedCountryId, 
  onInsertPlaceholder 
}: PlaceholderHelperProps) {
  const { getPlaceholdersByCategory } = useWorkerContractPlaceholders(selectedCountryId)

  const systemPlaceholders = getPlaceholdersByCategory('system')
  const workerContractPlaceholders = getPlaceholdersByCategory('worker_contract')
  const organizationCompliancePlaceholders = getPlaceholdersByCategory('organization_compliance')
  const countryCompliancePlaceholders = getPlaceholdersByCategory('country_compliance')

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Available Placeholders</CardTitle>
        <p className="text-sm text-muted-foreground">
          Click to insert placeholder into your template
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6">
            <PlaceholderSection
              title="Worker & Contract"
              icon={User}
              placeholders={workerContractPlaceholders}
              onInsert={onInsertPlaceholder}
            />

            <PlaceholderSection
              title="Organization Compliance"
              icon={Building}
              placeholders={organizationCompliancePlaceholders}
              onInsert={onInsertPlaceholder}
            />

            <PlaceholderSection
              title="Country Compliance"
              icon={MapPin}
              placeholders={countryCompliancePlaceholders}
              onInsert={onInsertPlaceholder}
            />

            <PlaceholderSection
              title="System"
              icon={Settings}
              placeholders={systemPlaceholders}
              onInsert={onInsertPlaceholder}
            />

            {countryCompliancePlaceholders.length === 0 && (
              <div className="text-center p-4 text-muted-foreground text-sm">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No country-specific fields available.
                Create fields for this country to see placeholders here.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}