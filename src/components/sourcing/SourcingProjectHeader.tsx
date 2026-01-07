import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { 
  Edit2, MoreHorizontal, RefreshCw, Archive, Trash2, 
  MapPin, Coins, Globe, Lock, Link2, Briefcase, Plus, Eye
} from 'lucide-react'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SourcingProject } from '@/types/sourcing'
import { LinkToJobDialog } from './LinkToJobDialog'
import { CreateJobFromProjectDialog } from './CreateJobFromProjectDialog'
import { RoleInterpretationDrawer } from './RoleInterpretationDrawer'

interface SourcingProjectHeaderProps {
  project: SourcingProject
  breakdown: {
    excellent: number
    good: number
    fair: number
    minimal: number
    localCandidates?: number
    apolloCandidates?: number
    creditsUsed?: number
    collectCreditsUsed?: number
  }
  onRefresh: () => void
  onArchive: () => void
  onDelete: () => void
  onNameUpdate: (name: string) => void
  onVisibilityToggle?: (isPublic: boolean) => Promise<void>
  onLinkToJob?: (jobId: string) => Promise<void>
}

export function SourcingProjectHeader({
  project,
  breakdown,
  onRefresh,
  onArchive,
  onDelete,
  onNameUpdate,
  onVisibilityToggle,
  onLinkToJob
}: SourcingProjectHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(project.name)
  const [showLinkJobDialog, setShowLinkJobDialog] = useState(false)
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false)
  const [showInterpretationDrawer, setShowInterpretationDrawer] = useState(false)
  const { data: usage } = useSourcingCredits()

  const handleSaveName = () => {
    if (editedName.trim()) {
      onNameUpdate(editedName)
      setIsEditingName(false)
    }
  }

  const handleLinkToJob = async (jobId: string) => {
    if (onLinkToJob) {
      await onLinkToJob(jobId)
    }
  }

  const linkedJobLabel = project.jobs 
    ? `${project.jobs.title}${project.jobs.organizations?.name ? ` - ${project.jobs.organizations.name}` : ''}`
    : null

  return (
    <>
      <div className="space-y-4">
        {/* Project Name & Actions */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input 
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="max-w-md"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveName}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-h3-mobile sm:text-h3-desktop font-poppins font-bold text-foreground tracking-page-title">
                  {project.name}<span className="text-purple-period">.</span>
                </h1>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setEditedName(project.name)
                    setIsEditingName(true)
                  }}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                {project.status}
              </Badge>
              {project.job_spec_data && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowInterpretationDrawer(true)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Gio's interpretation
                </Button>
              )}
              {project.last_search_at && (
                <span className="text-sm text-muted-foreground">
                  Last updated {formatDistanceToNow(new Date(project.last_search_at))} ago
                </span>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {project.is_public ? (
                      <Globe className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="visibility-toggle" className="text-sm font-medium cursor-pointer">
                      {project.is_public ? 'Public to Organization' : 'Private'}
                    </Label>
                  </div>
                  <Switch
                    id="visibility-toggle"
                    checked={project.is_public}
                    onCheckedChange={onVisibilityToggle}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {project.is_public 
                    ? 'Anyone in your organization can view this project' 
                    : 'Only you can view this project'}
                </p>
              </div>
              
              {/* Create Job option - only show if no job linked and has job_spec_data */}
              {!project.job_id && project.job_spec_data && (
                <>
                  <DropdownMenuItem onClick={() => setShowCreateJobDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job from Spec
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              {/* Link to Job option - only show if no job linked */}
              {!project.job_id && onLinkToJob && (
                <>
                  <DropdownMenuItem onClick={() => setShowLinkJobDialog(true)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Link to Existing Job
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              {/* Change linked job - only show if job is linked */}
              {project.job_id && onLinkToJob && (
                <>
                  <DropdownMenuItem onClick={() => setShowLinkJobDialog(true)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Change Linked Job
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Results
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-4 w-4 mr-2" />
                {project.status === 'active' ? 'Archive' : 'Unarchive'} Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search Location Context & Stats */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search Location */}
          {project.search_criteria?.locations && project.search_criteria.locations.length > 0 && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Search Results in {project.search_criteria.locations.join(', ')}
              </span>
            </div>
          )}

          {/* Linked Job Display */}
          {linkedJobLabel ? (
            <>
              {project.search_criteria?.locations && project.search_criteria.locations.length > 0 && (
                <span className="text-muted-foreground">•</span>
              )}
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Linked to:{' '}
                  <Link 
                    to={`/jobs/${project.job_id}`}
                    className="text-primary hover:underline"
                  >
                    {linkedJobLabel}
                  </Link>
                </span>
              </div>
            </>
          ) : onLinkToJob ? (
            <>
              {project.search_criteria?.locations && project.search_criteria.locations.length > 0 && (
                <span className="text-muted-foreground">•</span>
              )}
              <button
                onClick={() => setShowLinkJobDialog(true)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Link2 className="h-4 w-4" />
                Link to Job
              </button>
            </>
          ) : null}

          {/* Total Candidates */}
          {(breakdown.localCandidates !== undefined || breakdown.apolloCandidates !== undefined) && (
            <>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Candidates: {(breakdown.localCandidates || 0) + (breakdown.apolloCandidates || 0)}
                </span>
              </div>
            </>
          )}

          {/* Credit Usage */}
          {usage && (breakdown.creditsUsed !== undefined || breakdown.collectCreditsUsed !== undefined) && (
            <>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center gap-2">
                <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {usage.search_credits_used || 0}/{usage.search_credits_limit || 0} search, {usage.collect_credits_used || 0}/{usage.collect_credits_limit || 0} collect
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Link to Job Dialog */}
      <LinkToJobDialog
        open={showLinkJobDialog}
        onOpenChange={setShowLinkJobDialog}
        onConfirm={handleLinkToJob}
        currentJobId={project.job_id}
      />

      {/* Create Job from Project Dialog */}
      <CreateJobFromProjectDialog
        open={showCreateJobDialog}
        onOpenChange={setShowCreateJobDialog}
        projectId={project.id}
        projectName={project.name}
        jobSpecData={project.job_spec_data || null}
      />

      {/* Role Interpretation Drawer */}
      <RoleInterpretationDrawer
        open={showInterpretationDrawer}
        onOpenChange={setShowInterpretationDrawer}
        jobSpecData={project.job_spec_data || null}
      />
    </>
  )
}
