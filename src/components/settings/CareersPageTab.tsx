import { useState, useEffect } from 'react'
import { useCareersPageSettings } from '@/hooks/useCareersPageSettings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { FormField } from '@/components/ui/form-field'
import { ReadOnlyOverlay } from '@/components/ui/read-only-overlay'
import { Copy, ExternalLink, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'

export function CareersPageTab() {
  const { organizationId } = useAuth()
  const [tenantName, setTenantName] = useState('')

  // Fetch tenant name for display
  useEffect(() => {
    const fetchTenantName = async () => {
      if (!organizationId) return

      const { data } = await supabase
        .from('organizations')
        .select('tenant_id, tenants(name)')
        .eq('id', organizationId)
        .single()

      if (data?.tenants) {
        setTenantName((data.tenants as any).name)
      }
    }

    fetchTenantName()
  }, [organizationId])
  const {
    settings,
    isLoading,
    initializeSettings,
    isInitializing,
    updateSettings,
    isUpdating,
    uploadLogo,
    isUploadingLogo,
    checkSlugAvailability,
  } = useCareersPageSettings()

  const [companySlug, setCompanySlug] = useState('')
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('Careers')
  const [headerText, setHeaderText] = useState('')
  const [showCompanyName, setShowCompanyName] = useState(true)
  const [slugError, setSlugError] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize settings if they don't exist
  useEffect(() => {
    if (!isLoading && !settings && !isInitializing) {
      initializeSettings()
    }
  }, [isLoading, settings, isInitializing, initializeSettings])

  // Sync form state with settings
  useEffect(() => {
    if (settings) {
      setCompanySlug(settings.company_slug)
      setCompanyWebsiteUrl(settings.company_website_url || '')
      setPageTitle(settings.page_title)
      setHeaderText(settings.header_text || '')
      setShowCompanyName(settings.show_company_name)
    }
  }, [settings])

  // Track changes (excluding company_slug as it's read-only)
  useEffect(() => {
    if (settings) {
      const changed =
        companyWebsiteUrl !== (settings.company_website_url || '') ||
        pageTitle !== settings.page_title ||
        headerText !== (settings.header_text || '') ||
        showCompanyName !== settings.show_company_name

      setHasChanges(changed)
    }
  }, [settings, companyWebsiteUrl, pageTitle, headerText, showCompanyName])

  const careersPageUrl = `${window.location.origin}/careers/${companySlug || settings?.company_slug || 'your-company'}`

  const handleSlugChange = async (value: string) => {
    // Format slug: lowercase, replace spaces with hyphens, remove special chars
    const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    setCompanySlug(formatted)

    if (formatted && formatted !== settings?.company_slug) {
      const isAvailable = await checkSlugAvailability(formatted)
      setSlugError(isAvailable ? '' : 'This slug is already taken')
    } else {
      setSlugError('')
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(careersPageUrl)
    toast.success('Careers page URL copied to clipboard')
  }

  const handlePreview = () => {
    window.open(careersPageUrl, '_blank')
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      uploadLogo(file)
    }
  }

  const handleSave = () => {
    updateSettings({
      company_website_url: companyWebsiteUrl || null,
      page_title: pageTitle,
      header_text: headerText || null,
      show_company_name: showCompanyName,
    })
  }

  if (isLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-virgilio-purple" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Public URL Display */}
      <Card>
        <CardHeader>
          <CardTitle>Public Careers Page URL</CardTitle>
          <CardDescription>
            Share this URL with candidates to view all your open positions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={careersPageUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyUrl}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreview}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Company Slug */}
      <Card>
        <CardHeader>
          <CardTitle>Company Slug</CardTitle>
          <CardDescription>
            This slug is used in your public careers page URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReadOnlyOverlay 
            active={true}
            message="The company slug cannot be changed after creation to prevent breaking existing shared URLs. Contact support if you need to change it."
          >
            <FormField
              label="Slug"
              helpText={`Your URL will be: ${window.location.origin}/careers/${companySlug || '...'}`}
            >
              <Input
                value={companySlug}
                readOnly
                placeholder="your-company-name"
              />
            </FormField>
          </ReadOnlyOverlay>
        </CardContent>
      </Card>

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
          <CardDescription>
            Upload your logo to appear on the careers page. PNG, JPG, or SVG up to 2MB. Recommended dimensions: 200x60px.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings?.logo_url && (
            <div className="flex items-center justify-center p-4 bg-surface-secondary rounded-lg">
              <img
                src={settings.logo_url}
                alt="Company logo"
                className="max-h-16 object-contain"
              />
            </div>
          )}
          <div>
            <Label htmlFor="logo-upload" className="cursor-pointer">
              <div className="flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-virgilio-border rounded-lg hover:border-virgilio-purple transition-colors">
                <Upload className="h-4 w-4" />
                <span>{isUploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
              </div>
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                onChange={handleLogoUpload}
                disabled={isUploadingLogo}
                className="hidden"
              />
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Company Website URL */}
      <Card>
        <CardHeader>
          <CardTitle>Company Website</CardTitle>
          <CardDescription>
            The URL where your logo should link (e.g., your company homepage)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField label="Website URL">
            <Input
              type="url"
              value={companyWebsiteUrl}
              onChange={(e) => setCompanyWebsiteUrl(e.target.value)}
              placeholder="https://yourcompany.com"
            />
          </FormField>
        </CardContent>
      </Card>

      {/* Additional Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Page Customization</CardTitle>
          <CardDescription>
            Customize how your careers page appears to candidates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Page Title">
            <Input
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="Careers"
            />
          </FormField>

          <FormField
            label="Header Text (Optional)"
            helpText="A welcome message or description for candidates"
          >
            <Textarea
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Join our team and help us build amazing products..."
              rows={3}
            />
          </FormField>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Company Name</Label>
              <div className="text-sm text-text-tertiary">
                Display {tenantName || 'your company name'} below the logo
              </div>
            </div>
            <Switch
              checked={showCompanyName}
              onCheckedChange={setShowCompanyName}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isUpdating}
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        <Button variant="outline" onClick={handlePreview}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Preview Careers Page
        </Button>
      </div>
    </div>
  )
}
