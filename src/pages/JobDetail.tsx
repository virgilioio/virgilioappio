
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useCandidates } from '@/hooks/useCandidates'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { JobDetailSidebar } from '@/components/jobs/JobDetailSidebar'
import { JobDetailMobileHeader } from '@/components/jobs/JobDetailMobileHeader'
import { JobOverviewTab } from '@/components/jobs/JobOverviewTab'
import { CandidateTable } from '@/components/candidates/CandidateTable'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import { JobAssignmentsPanel } from '@/components/jobs/JobAssignmentsPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Edit, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/use-mobile'
import { Skeleton } from '@/components/ui/skeleton'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import { toast } from '@/hooks/use-toast'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userType } = useAuth()
  const permissions = usePermissions()
  const isMobile = useIsMobile()
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Job assignments hook
  const {
    assignments,
    assignUserToJob: addAssignment,
    removeUserFromJob: removeAssignment,
    isLoading: assignmentsLoading
  } = useJobAssignments(id!)

  // Candidates hook with new functions
  const {
    candidates,
    isLoading: candidatesLoading,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    markCandidateAsViewed,
    isCandidateNewForUser
  } = useCandidates(id!)

  // Job query
  const { data: job, isLoading: jobLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      if (!id) throw new Error('No job ID provided')
      
      console.log('Fetching job details for ID:', id)
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          organization:organizations!inner(
            id,
            name,
            country
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching job:', error)
        throw error
      }

      console.log('Fetched job:', data)
      return data
    },
    enabled: !!id && !!user,
  })

  const handleEditJob = () => {
    navigate(`/jobs/${id}/edit`)
  }

  const handleArchiveJob = async () => {
    if (!id || !confirm('Are you sure you want to archive this job?')) return

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'archived' })
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Job archived successfully'
      })

      navigate('/jobs')
    } catch (error) {
      console.error('Error archiving job:', error)
      toast({
        title: 'Error',
        description: 'Failed to archive job',
        variant: 'destructive'
      })
    }
  }

  const handleAddCandidate = async (candidateData: any) => {
    try {
      await addCandidate(candidateData)
      setShowAddCandidate(false)
    } catch (error) {
      console.error('Error adding candidate:', error)
    }
  }

  const handleEditCandidate = (candidate: any) => {
    setEditingCandidate(candidate)
  }

  const handleUpdateCandidate = async (candidateData: any) => {
    if (!editingCandidate) return
    
    try {
      await updateCandidate(editingCandidate.id, candidateData)
      setEditingCandidate(null)
    } catch (error) {
      console.error('Error updating candidate:', error)
    }
  }

  const handleDeleteCandidate = async (candidateId: string) => {
    try {
      await deleteCandidate(candidateId)
    } catch (error) {
      console.error('Error deleting candidate:', error)
    }
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Job Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The job you're looking for doesn't exist or you don't have permission to view it.
              </p>
              <Button onClick={() => navigate('/jobs')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Jobs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (jobLoading) {
    return (
      <div className="h-screen flex">
        {!isMobile && (
          <div className="w-80 border-r bg-muted/20 p-6">
            <Skeleton className="h-8 w-full mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!job) return null

  return (
    <JobAssignmentGuard>
      <div className="h-screen flex">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <JobDetailSidebar
            currentTab={activeTab}
            onTabChange={setActiveTab}
            jobTitle={job.title}
            canViewAssignments={userType === 'platform_admin'}
          />
        )}
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          {isMobile && (
            <JobDetailMobileHeader
              jobTitle={job.title}
              onMenuToggle={() => {}}
              onBackToJobs={() => navigate('/jobs')}
            />
          )}
          
          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            <div className="p-6">
              {isMobile ? (
                // Mobile: Tabs
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="candidates">Candidates</TabsTrigger>
                    {userType === 'platform_admin' && (
                      <TabsTrigger value="assignments">Access</TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="overview" className="mt-6">
                    <JobOverviewTab job={{
                      ...job,
                      hiring_team: job.hiring_team as any[]
                    }} />
                  </TabsContent>
                  
                  <TabsContent value="candidates" className="mt-6">
                    <CandidateTable
                      candidates={candidates}
                      isLoading={candidatesLoading}
                      onEdit={handleEditCandidate}
                      onDelete={handleDeleteCandidate}
                      onAddNew={() => setShowAddCandidate(true)}
                      markCandidateAsViewed={markCandidateAsViewed}
                      isCandidateNewForUser={isCandidateNewForUser}
                    />
                  </TabsContent>
                  
                  {userType === 'platform_admin' && (
                    <TabsContent value="assignments" className="mt-6">
                      <JobAssignmentsPanel
                        jobId={id!}
                        isLoading={assignmentsLoading}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              ) : (
                // Desktop: Show content based on active tab
                <>
                  {activeTab === 'overview' && <JobOverviewTab job={{
                    ...job,
                    hiring_team: job.hiring_team as any[]
                  }} />}
                  {activeTab === 'candidates' && (
                    <CandidateTable
                      candidates={candidates}
                      isLoading={candidatesLoading}
                      onEdit={handleEditCandidate}
                      onDelete={handleDeleteCandidate}
                      onAddNew={() => setShowAddCandidate(true)}
                      markCandidateAsViewed={markCandidateAsViewed}
                      isCandidateNewForUser={isCandidateNewForUser}
                    />
                  )}
                  {activeTab === 'assignments' && userType === 'platform_admin' && (
                    <JobAssignmentsPanel
                      jobId={id!}
                      isLoading={assignmentsLoading}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Candidate Dialog */}
      <Dialog open={showAddCandidate} onOpenChange={setShowAddCandidate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Candidate</DialogTitle>
          </DialogHeader>
          <CandidateForm
            onSubmit={handleAddCandidate}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Dialog */}
      <Dialog open={!!editingCandidate} onOpenChange={() => setEditingCandidate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
          </DialogHeader>
          <CandidateForm
            onSubmit={handleUpdateCandidate}
          />
        </DialogContent>
      </Dialog>
    </JobAssignmentGuard>
  )
}
