
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useCandidates } from '@/hooks/useCandidates'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { JobOverviewTab } from '@/components/jobs/JobOverviewTab'
import { CandidateTable } from '@/components/candidates/CandidateTable'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import { JobAssignmentsPanel } from '@/components/jobs/JobAssignmentsPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Archive } from 'lucide-react'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import { toast } from '@/hooks/use-toast'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userType } = useAuth()
  const permissions = usePermissions()
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Job assignments hook
  const {
    assignments,
    assignUserToJob,
    removeUserFromJob,
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

  const handleBackToJobs = () => {
    navigate('/jobs')
  }

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
              <Button onClick={handleBackToJobs}>
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
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!job) return null

  return (
    <JobAssignmentGuard>
      <div className="container mx-auto px-4 py-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleBackToJobs}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
            <h1 className="text-2xl font-bold text-text-primary">{job.title}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {permissions.canEditJobs && job.status !== 'archived' && (
              <Button variant="outline" onClick={handleArchiveJob}>
                <Archive className="h-4 w-4 mr-2" />
                Archive Job
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="candidates">Candidates</TabsTrigger>
            {userType === 'platform_admin' && (
              <TabsTrigger value="assignments">Access</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="overview">
            <JobOverviewTab 
              job={{
                ...job,
                hiring_team: job.hiring_team as any[]
              }} 
              onEdit={handleEditJob}
            />
          </TabsContent>
          
          <TabsContent value="candidates">
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
            <TabsContent value="assignments">
              <JobAssignmentsPanel
                jobId={id!}
                jobTitle={job.title}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Add Candidate Dialog */}
      <Dialog open={showAddCandidate} onOpenChange={setShowAddCandidate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Candidate</DialogTitle>
          </DialogHeader>
          <CandidateForm
            isOpen={showAddCandidate}
            onClose={() => setShowAddCandidate(false)}
            onSubmit={handleAddCandidate}
            jobId={id!}
            isLoading={candidatesLoading}
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
            isOpen={!!editingCandidate}
            onClose={() => setEditingCandidate(null)}
            onSubmit={handleUpdateCandidate}
            candidate={editingCandidate}
            jobId={id!}
            isLoading={candidatesLoading}
          />
        </DialogContent>
      </Dialog>
    </JobAssignmentGuard>
  )
}
