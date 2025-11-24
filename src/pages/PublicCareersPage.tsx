import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { PageTitle } from '@/components/ui/page-title'
import { MapPin, Clock, Loader2 } from 'lucide-react'
import gioEmptyState from '@/assets/gio-empty-state.png'

interface CareersSettings {
  id: string
  tenant_id: string
  logo_url: string | null
  company_website_url: string | null
  company_slug: string
  page_title: string
  header_text: string | null
  show_company_name: boolean
}

interface TenantInfo {
  id: string
  name: string
}

interface JobPosting {
  id: string
  title: string
  slug: string
  details: any
  created_at: string
  job_id: string
  tenant_id: string
  location: string | null
  job_type: string | null
}

export default function PublicCareersPage() {
  const { companySlug } = useParams<{ companySlug: string }>()
  const [settings, setSettings] = useState<CareersSettings | null>(null)
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null)
  const [postings, setPostings] = useState<JobPosting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!companySlug) {
        setError('No company slug provided')
        setIsLoading(false)
        return
      }

      try {
        // Fetch careers page settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('careers_page_settings')
          .select('*')
          .eq('company_slug', companySlug)
          .eq('is_active', true)
          .single()

        if (settingsError || !settingsData) {
          setError('Company careers page not found')
          setIsLoading(false)
          return
        }

        setSettings(settingsData)

        // Fetch tenant info
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name')
          .eq('id', settingsData.tenant_id)
          .single()

        if (!tenantError && tenantData) {
          setTenantInfo(tenantData)
        }

        // Fetch active job postings for this tenant
        const { data: postingsData, error: postingsError } = await supabase
          .from('job_postings')
          .select(`
            id,
            title,
            slug,
            details,
            created_at,
            job_id,
            tenant_id,
            location,
            job_type
          `)
          .eq('is_active', true)
          .eq('tenant_id', settingsData.tenant_id)
          .order('created_at', { ascending: false })

        if (!postingsError && postingsData) {
          setPostings(postingsData as JobPosting[])
        }

        setIsLoading(false)
      } catch (err) {
        console.error('Error fetching careers page:', err)
        setError('Failed to load careers page')
        setIsLoading(false)
      }
    }

    fetchData()
  }, [companySlug])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary">
        <Loader2 className="h-8 w-8 animate-spin text-virgilio-purple" />
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary">
        <Card className="max-w-md w-full mx-4 p-6 text-center">
          <h1 className="text-2xl font-bold text-virgilio-text mb-2">
            {error || 'Page Not Found'}
          </h1>
          <p className="text-text-tertiary">
            The careers page you're looking for doesn't exist or is no longer available.
          </p>
        </Card>
      </div>
    )
  }

  const handleLogoClick = () => {
    if (settings.company_website_url) {
      window.open(settings.company_website_url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleViewJob = (slug: string) => {
    window.open(`/p/${slug}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-surface-primary">
      {/* Header */}
      <header className="border-b border-virgilio-border bg-surface-primary">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <div className="flex">
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={tenantInfo?.name || 'Company logo'}
                  className={`max-h-11 object-contain ${settings.company_website_url ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                  onClick={handleLogoClick}
                />
              ) : (
                <div 
                  className={settings.company_website_url ? 'cursor-pointer' : ''}
                  onClick={handleLogoClick}
                >
                  <VirgilioLogo size="lg" />
                </div>
              )}
            </div>
            {settings.show_company_name && tenantInfo && (
              <div className="flex">
                <PageTitle as="h1">
                  {tenantInfo.name}
                </PageTitle>
              </div>
            )}
            {settings.header_text && (
              <p className="text-text-secondary max-w-2xl">
                {settings.header_text}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Job Listings */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-xl font-semibold text-virgilio-text mb-6">
          Open Jobs ({postings.length})
        </h2>
        {postings.length === 0 ? (
          <Card className="p-12 text-center">
            <img 
              src={gioEmptyState} 
              alt="No open positions" 
              className="h-32 w-32 mx-auto mb-6"
            />
            <p className="text-text-tertiary">
              No open positions at this time. Check back soon for new opportunities!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {postings.map((posting) => (
              <Card
                key={posting.id}
                className="p-6 hover:shadow-[var(--shadow-lg)] transition-all cursor-pointer"
                onClick={() => handleViewJob(posting.slug)}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-virgilio-text mb-2">
                      {posting.title}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
                      {posting.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{posting.location}</span>
                        </div>
                      )}
                      {posting.job_type && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{posting.job_type}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewJob(posting.slug)
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-virgilio-border bg-surface-primary mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-center gap-2 text-sm text-text-tertiary">
            <span>Powered by</span>
            <VirgilioLogo size="sm" />
          </div>
        </div>
      </footer>
    </div>
  )
}
