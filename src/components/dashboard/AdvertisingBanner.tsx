
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
      className="border-0 text-white" 
      style={{ backgroundColor: '#0d0d09' }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-4xl font-medium text-white">
          {adTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-white/90 leading-relaxed">
          {adBody}
        </p>
        {adButtonText && (
          <div className="flex justify-start">
            <Button
              onClick={handleButtonClick}
              className="font-medium text-black hover:bg-[#fffead]/90"
              style={{ backgroundColor: '#fffead' }}
            >
              {adButtonText}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
