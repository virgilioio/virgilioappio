import { useState, useEffect } from 'react'
import { useCareersPageSettings } from '@/hooks/useCareersPageSettings'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Copy, ExternalLink, Upload, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { SpecCard } from './shared/SpecCard'
import { NOIR_BTN, SEC_BTN } from './shared/SpecRow'

export function CareersPageTab() {
  const { organizationId } = useAuth()
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    const fetchTenantName = async () => {
      if (!organizationId) return
      const { data } = await supabase
        .from('organizations')
        .select('tenant_id, tenants(name)')
        .eq('id', organizationId)
        .single()
      if (data?.tenants) setTenantName((data.tenants as any).name)
    }
    fetchTenantName()
  }, [organizationId])

  const {
    settings, isLoading, initializeSettings, isInitializing,
    updateSettings, isUpdating, uploadLogo, isUploadingLogo,
  } = useCareersPageSettings()

  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('Careers')
  const [headerText, setHeaderText] = useState('')
  const [showCompanyName, setShowCompanyName] = useState(true)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (!isLoading && !settings && !isInitializing) initializeSettings()
  }, [isLoading, settings, isInitializing, initializeSettings])

  useEffect(() => {
    if (settings) {
      setCompanyWebsiteUrl(settings.company_website_url || '')
      setPageTitle(settings.page_title)
      setHeaderText(settings.header_text || '')
      setShowCompanyName(settings.show_company_name)
    }
  }, [settings])

  useEffect(() => {
    if (settings) {
      setHasChanges(
        companyWebsiteUrl !== (settings.company_website_url || '') ||
        pageTitle !== settings.page_title ||
        headerText !== (settings.header_text || '') ||
        showCompanyName !== settings.show_company_name
      )
    }
  }, [settings, companyWebsiteUrl, pageTitle, headerText, showCompanyName])

  const careersPageUrl = `${window.location.origin}/careers/${settings?.company_slug || 'your-company'}`
  const handleCopyUrl = () => { navigator.clipboard.writeText(careersPageUrl); toast.success('URL copied') }
  const handlePreview = () => window.open(careersPageUrl, '_blank')
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadLogo(file)
  }
  const handleSave = () => updateSettings({
    company_website_url: companyWebsiteUrl || null,
    page_title: pageTitle,
    header_text: headerText || null,
    show_company_name: showCompanyName,
  })

  if (isLoading || isInitializing) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#8B8F9E]" /></div>
  }

  return (
    <div className="max-w-[860px]">
      {/* Public URL */}
      <SpecCard
        title="Public careers page"
        description="Share this URL with candidates — all open positions, live."
        action={
          <div className="flex gap-1.5">
            <button type="button" className={SEC_BTN} style={{ height: 26, padding: '0 10px', fontSize: 11.5 }} onClick={handleCopyUrl}>
              <Copy size={11} /> Copy
            </button>
            <button type="button" className={SEC_BTN} style={{ height: 26, padding: '0 10px', fontSize: 11.5 }} onClick={handlePreview}>
              <ExternalLink size={11} /> Open
            </button>
          </div>
        }
      >
        <div style={{ padding: '14px 18px' }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12, color: '#0d0d09',
              background: '#F6F5F1', padding: '9px 12px', borderRadius: 8,
              wordBreak: 'break-all',
            }}
          >
            {careersPageUrl}
          </div>
          <p className="font-inter text-[#8B8F9E] mt-2" style={{ fontSize: 10.5 }}>
            The slug can't change after creation — it would break shared URLs. Contact support if you need to.
          </p>
        </div>
      </SpecCard>

      {/* Brand */}
      <SpecCard
        title="Brand"
        description="Logo and link shown on the careers page. PNG, JPG or SVG up to 2MB · ideal 200×60."
      >
        <div style={{ padding: '14px 18px' }} className="flex items-start gap-4">
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 180, height: 64, background: '#F6F5F1', borderRadius: 10 }}
          >
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain' }} />
            ) : (
              <span className="font-inter text-[#B5B9C4]" style={{ fontSize: 11 }}>No logo</span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <label htmlFor="logo-upload" className={SEC_BTN + ' cursor-pointer self-start'} style={{ height: 30, padding: '0 12px', fontSize: 12 }}>
              <Upload size={12} /> {isUploadingLogo ? 'Uploading…' : 'Upload logo'}
              <input id="logo-upload" type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} disabled={isUploadingLogo} className="hidden" />
            </label>
            <div className="flex flex-col gap-1">
              <label className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>Logo links to</label>
              <Input
                type="url"
                value={companyWebsiteUrl}
                onChange={e => setCompanyWebsiteUrl(e.target.value)}
                placeholder="https://yourcompany.com"
              />
            </div>
          </div>
        </div>
      </SpecCard>

      {/* Page content */}
      <SpecCard title="Page content" description="What candidates read above your job list.">
        <div style={{ padding: '14px 18px' }} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>Page title</label>
            <Input value={pageTitle} onChange={e => setPageTitle(e.target.value)} placeholder="Careers" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>Header text</label>
            <Textarea
              value={headerText}
              onChange={e => setHeaderText(e.target.value)}
              placeholder="Join our team…"
              style={{ minHeight: 56 }}
            />
          </div>
          <div className="flex items-center justify-between" style={{ paddingTop: 4 }}>
            <div className="flex flex-col">
              <span className="font-inter text-[#0d0d09]" style={{ fontSize: 12.5, fontWeight: 500 }}>
                Show company name below the logo
              </span>
              <span className="font-inter text-[#8B8F9E]" style={{ fontSize: 11 }}>
                Display "{tenantName || 'your company'}" beneath the logo on every page.
              </span>
            </div>
            <Switch checked={showCompanyName} onCheckedChange={setShowCompanyName} />
          </div>
        </div>
        <div style={{ borderTop: '1px solid #F1F0EC', padding: '10px 18px' }} className="flex justify-end gap-1.5">
          <button type="button" className={SEC_BTN} style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={handlePreview}>
            <Eye size={12} /> Preview
          </button>
          <button
            type="button"
            className={NOIR_BTN}
            style={{ height: 30, padding: '0 14px', fontSize: 12 }}
            onClick={handleSave}
            disabled={!hasChanges || isUpdating}
          >
            {isUpdating && <Loader2 size={12} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </SpecCard>
    </div>
  )
}
