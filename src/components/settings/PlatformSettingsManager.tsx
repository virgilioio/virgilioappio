
import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Save, Loader2, Coins } from 'lucide-react'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { CurrencySettings } from './CurrencySettings'

export function PlatformSettingsManager() {
  const { settings, isLoading, isUpdating, updateSetting, getSetting } = usePlatformSettings()
  const [browserTitle, setBrowserTitle] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  // Initialize browser title when settings load
  React.useEffect(() => {
    const titleSetting = getSetting('browser_title')
    if (titleSetting && titleSetting.setting_value) {
      setBrowserTitle(titleSetting.setting_value)
    }
  }, [settings, getSetting])

  const handleTitleChange = (value: string) => {
    setBrowserTitle(value)
    const currentTitle = getSetting('browser_title')?.setting_value || ''
    setHasChanges(value !== currentTitle)
  }

  const handleSave = async () => {
    const success = await updateSetting('browser_title', browserTitle)
    if (success) {
      setHasChanges(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading settings...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Platform Settings
        </CardTitle>
        <CardDescription>
          Configure global platform settings that apply across the entire application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="currency" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Currency
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="browser-title" className="text-sm font-medium">
                  Browser Tab Title
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="browser-title"
                    value={browserTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Enter the title that appears in browser tabs"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSave}
                    disabled={!hasChanges || isUpdating}
                    size="sm"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This title will appear in browser tabs across the entire platform
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="currency" className="mt-6">
            <CurrencySettings />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
