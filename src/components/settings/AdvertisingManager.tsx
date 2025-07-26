
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Switch } from '@/components/ui/switch'
import { Megaphone, Save, Loader2, Eye, EyeOff } from 'lucide-react'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { SafeHtml } from '@/components/ui/safe-html'

export function AdvertisingManager() {
  const { getSetting, updateSetting, isUpdating } = usePlatformSettings()
  const [formData, setFormData] = useState({
    enabled: false,
    title: '',
    body: '',
    buttonText: '',
    buttonUrl: ''
  })
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form data when settings load
  useEffect(() => {
    const enabled = getSetting('ad_banner_enabled')?.setting_value === 'true'
    const title = getSetting('ad_banner_title')?.setting_value || ''
    const body = getSetting('ad_banner_body')?.setting_value || ''
    const buttonText = getSetting('ad_banner_button_text')?.setting_value || ''
    const buttonUrl = getSetting('ad_banner_button_url')?.setting_value || ''

    setFormData({ enabled, title, body, buttonText, buttonUrl })
  }, [getSetting])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    const updates = [
      updateSetting('ad_banner_enabled', formData.enabled.toString()),
      updateSetting('ad_banner_title', formData.title),
      updateSetting('ad_banner_body', formData.body),
      updateSetting('ad_banner_button_text', formData.buttonText),
      updateSetting('ad_banner_button_url', formData.buttonUrl)
    ]

    const results = await Promise.all(updates)
    const allSuccessful = results.every(result => result === true)
    
    if (allSuccessful) {
      setHasChanges(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Internal Advertising Banner
        </CardTitle>
        <CardDescription>
          Manage the internal advertising banner shown to Platform Admins and Workspace Owners on the dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Enable Advertising Banner</Label>
            <p className="text-xs text-muted-foreground">
              Show the advertising banner to Platform Admins and Workspace Owners
            </p>
          </div>
          <Switch
            checked={formData.enabled}
            onCheckedChange={(checked) => handleChange('enabled', checked)}
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="ad-title" className="text-sm font-medium">
            Banner Title
          </Label>
          <Input
            id="ad-title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enter banner title"
            disabled={!formData.enabled}
          />
        </div>

        {/* Body - Now using RichTextEditor */}
        <div className="space-y-2">
          <Label htmlFor="ad-body" className="text-sm font-medium">
            Banner Content
          </Label>
          <RichTextEditor
            value={formData.body}
            onChange={(value) => handleChange('body', value)}
            placeholder="Enter banner content/message with rich formatting..."
            minHeight="150px"
            className={!formData.enabled ? "opacity-50 pointer-events-none" : ""}
          />
        </div>

        {/* Button Text */}
        <div className="space-y-2">
          <Label htmlFor="ad-button-text" className="text-sm font-medium">
            Button Text (Optional)
          </Label>
          <Input
            id="ad-button-text"
            value={formData.buttonText}
            onChange={(e) => handleChange('buttonText', e.target.value)}
            placeholder="e.g., Learn More, Get Started"
            disabled={!formData.enabled}
          />
        </div>

        {/* Button URL */}
        <div className="space-y-2">
          <Label htmlFor="ad-button-url" className="text-sm font-medium">
            Button URL (Optional)
          </Label>
          <Input
            id="ad-button-url"
            value={formData.buttonUrl}
            onChange={(e) => handleChange('buttonUrl', e.target.value)}
            placeholder="https://example.com"
            disabled={!formData.enabled}
          />
          <p className="text-xs text-muted-foreground">
            The URL will open in a new tab when the button is clicked
          </p>
        </div>

        {/* Preview */}
        {formData.enabled && formData.title && formData.body && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </Label>
            <div 
              className="p-4 rounded-lg border text-white"
              style={{ backgroundColor: '#0d0d09' }}
            >
              <h3 className="text-lg font-medium text-white mb-2">
                {formData.title}
              </h3>
              <SafeHtml 
                content={formData.body}
                className="text-sm text-white/90 leading-relaxed mb-4 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
              />
              {formData.buttonText && (
                <Button
                  className="font-medium text-black"
                  style={{ backgroundColor: '#fffead' }}
                  disabled
                >
                  {formData.buttonText}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button 
            onClick={handleSave}
            disabled={!hasChanges || isUpdating}
            className="w-full"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Advertising Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
