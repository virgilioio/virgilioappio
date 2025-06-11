
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ArrowLeft, Archive } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useJobs, Job } from '@/hooks/useJobs'
import { usePermissions } from '@/hooks/usePermissions'
import { JobForm } from '@/components/jobs/JobForm'
import { useCandidates } from '@/hooks/useCandidates'
import { CandidateTable } from '@/components/candidates/CandidateTable'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import { JobDetailSidebar } from '@/components/jobs/JobDetailSidebar'
import { JobOverviewTab } from '@/components/jobs/JobOverviewTab'
import { JobDetailMobileHeader } from '@/components/jobs/JobDetailMobileHeader'
import type { Candidate } from '@/hooks/useCandidates'

const VALID_TABS = ['overview', 'candidates'] as const
type ValidTab = typeof VALID_TABS[number]

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [job, setJob] = useState<Job | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isCandidateFormOpen, setIsCandidateFormOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { getJob, updateJob, archiveJob, isLoading } = useJobs()
  const { 
    candidates, 
    isLoading: candidatesLoading, 
    addCandidate, 
    updateCandidate, 
    deleteCandidate 
  } = useCandidates(id)
  const permissions = usePermissions()

  // Get tab from URL or default to 'overview'
  const urlTab = searchParams.get('tab')
  const currentTab = VALID_TABS.includes(urlTab as ValidTab) ? (urlTab as ValidTab) : 'overview'

  useEffect(() => {
    if (id) {
      loadJob()
    }
  }, [id])

  const loadJob = async () => {
    if (!id) return
    
    try {
      const jobData = await getJob(id)
      setJob(jobData)
    } catch (error) {
      console.error('Failed to load job:', error)
      navigate('/jobs')
    }
  }

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab })
    setMobileMenuOpen(false) // Close mobile menu when switching tabs
  }

  const handleEdit = () => {
    setIsFormOpen(true)
  }

  const handleArchive = async () => {
    if (!job) return
    
    if (confirm('Are you sure you want to archive this job?')) {
      try {
        await archiveJob(job.id)
        await loadJob()
      } catch (error) {
        console.error('Failed to archive job:', error)
      }
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (!job) return
    await updateJob(job.id, data)
    await loadJob()
  }

  const handleAddCandidate = () => {
    setSelectedCandidate(null)
    setIsCandidateFormOpen(true)
  }

  const handleEditCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate)
    setIsCandidateFormOpen(true)
  }

  const handleCandidateFormSubmit = async (data: any) => {
    if (selectedCandidate) {
      await updateCandidate(selectedCandidate.id, data)
    } else {
      await addCandidate(data)
    }
    setIsCandidateFormOpen(false)
    setSelectedCandidate(null)
  }

  const handleDeleteCandidate = async (candidateId: string) => {
    await deleteCandidate(candidateId)
  }

  const handleBackToJobs = () => {
    navigate('/jobs')
  }

  const renderTabContent = () => {
    if (!job) return null

    switch (currentTab) {
      case 'overview':
        return <JobOverviewTab job={job} onEdit={handleEdit} />
      case 'candidates':
        return (
          <PermissionGate permission="canViewCandidates">
            <CandidateTable
              candidates={candidates}
              isLoading={candidatesLoading}
              onEdit={handleEditCandidate}
              onDelete={handleDeleteCandidate}
              onAddNew={handleAddCandidate}
            />
          </PermissionGate>
        )
      default:
        return <JobOverviewTab job={job} onEdit={handleEdit} />
    }
  }

  if (isLoading || !job) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewJobs">
          <div className="min-h-screen bg-background">
            <div className="container mx-auto py-lg px-md">
              <div className="flex items-center justify-center py-xl">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              </div>
            </div>
          </div>
        </PermissionGate>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewJobs">
        <div className="min-h-screen bg-background">
          {/* Mobile Header */}
          <JobDetailMobileHeader 
            jobTitle={job.title}
            onMenuToggle={() => setMobileMenuOpen(true)}
            onBackToJobs={handleBackToJobs}
          />

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between mb-6 lg:mb-8 pt-6 lg:pt-8 container mx-auto px-md max-w-7xl">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={handleBackToJobs}
                className="flex items-center gap-2 min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Jobs
              </Button>
            </div>
            
            {permissions.canArchiveJobs && job.status !== 'archived' && (
              <Button variant="outline" onClick={handleArchive} className="min-h-[44px] gap-sm">
                <Archive className="h-5 w-5" />
                Archive
              </Button>
            )}
          </div>

          {/* Main Layout */}
          <div className="flex flex-col lg:flex-row min-h-[calc(100vh-200px)] gap-6 container mx-auto px-md max-w-7xl">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-6 h-[calc(100vh-200px)] overflow-y-auto">
                <div className="bg-surface-primary border border-border rounded-brand p-2">
                  <JobDetailSidebar 
                    currentTab={currentTab}
                    onTabChange={handleTabChange}
                    jobTitle={job.title}
                  />
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              <div className="w-full px-4 lg:px-0">
                {renderTabContent()}
              </div>
            </div>
          </div>

          {/* Mobile Sidebar Sheet */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-72 p-0">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-text-primary">Job Details</h2>
                <p className="text-sm text-text-secondary mt-1 truncate">
                  {job.title}
                </p>
              </div>
              <div className="p-2">
                <JobDetailSidebar 
                  currentTab={currentTab}
                  onTabChange={handleTabChange}
                  jobTitle={job.title}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Forms */}
          <JobForm
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSubmit={handleFormSubmit}
            job={job}
            isLoading={isLoading}
          />

          {job && (
            <CandidateForm
              isOpen={isCandidateFormOpen}
              onClose={() => {
                setIsCandidateFormOpen(false)
                setSelectedCandidate(null)
              }}
              onSubmit={handleCandidateFormSubmit}
              candidate={selectedCandidate}
              jobId={job.id}
              isLoading={candidatesLoading}
            />
          )}
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
