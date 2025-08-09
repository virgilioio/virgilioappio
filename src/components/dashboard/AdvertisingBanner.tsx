
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SafeHtml } from '@/components/ui/safe-html'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { usePermissions } from '@/hooks/usePermissions'

export function AdvertisingBanner() {
  const { getSetting } = usePlatformSettings()
  const { isPlatformAdmin, isWorkspaceOwner } = usePermissions()

  // Only show to platform admins and workspace owners
  if (!isPlatformAdmin && !isWorkspaceOwner) {
    return null
  }

  const adTitle = getSetting('ad_banner_title')?.setting_value
  const adBody = getSetting('ad_banner_body')?.setting_value
  const adButtonText = getSetting('ad_banner_button_text')?.setting_value
  const adButtonUrl = getSetting('ad_banner_button_url')?.setting_value
  const adEnabled = getSetting('ad_banner_enabled')?.setting_value === 'true'

  // Don't show if disabled or missing required content
  if (!adEnabled || !adTitle || !adBody) {
    return null
  }

  const handleButtonClick = () => {
    if (adButtonUrl) {
      window.open(adButtonUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Card 
      className="border-0 bg-surface-tertiary text-text-primary"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-4xl font-medium">
          {adTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SafeHtml 
          content={adBody}
          className="text-sm text-text-secondary leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
        />
        {adButtonText && (
          <div className="flex justify-start">
            <Button
              onClick={handleButtonClick}
              variant="secondary"
              className="font-medium"
            >
              {adButtonText}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
