import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  RefreshCw, MoreHorizontal, Archive, Trash2,
  Globe, Lock, Link2, Briefcase, Plus, Eye
} from 'lucide-react'
import { SourcingProjectCollaborators } from './SourcingProjectCollaborators'
import { LinkToJobDialog } from './LinkToJobDialog'
import { CreateJobFromProjectDialog } from './CreateJobFromProjectDialog'
import { RoleInterpretationDrawer } from './RoleInterpretationDrawer'
import { SourcingProject } from '@/types/sourcing'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SourcingProjectActionsProps {
  project: SourcingProject
  isRefreshing: boolean
  onRefresh: () => void
  onArchive: () => void
  onDelete: () => void
  onVisibilityToggle: (isPublic: boolean) => Promise<void>
  onLinkToJob: (jobId: string) => Promise<void>
}

export function SourcingProjectActions({
  project,
  isRefreshing,
  onRefresh,
  onArchive,
  onDelete,
  onVisibilityToggle,
  onLinkToJob,
}: SourcingProjectActionsProps) {
  const [showLinkJobDialog, setShowLinkJobDialog] = useState(false)
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false)
  const [showInterpretationDrawer, setShowInterpretationDrawer] = useState(false)

  const linkedJobLabel = project.jobs
    ? `${project.jobs.title}${project.jobs.organizations?.name ? ` - ${project.jobs.organizations.name}` : ''}`
    : null

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Collaborators */}
        <SourcingProjectCollaborators projectId={project.id} createdBy={project.created_by} />

        <div className="w-px h-5 bg-border mx-1" />

        {/* Linked Job / Link to Job */}
        {linkedJobLabel ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" asChild>
            <Link to={`/jobs/${project.job_id}`}>
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              <span className="hidden lg:inline">{linkedJobLabel}</span>
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowLinkJobDialog(true)}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Link to Job</span>
          </Button>
        )}

        {/* View Gio's Interpretation */}
        {project.job_spec_data && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground"
            onClick={() => setShowInterpretationDrawer(true)}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Gio's interpretation</span>
          </Button>
        )}

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* Visibility toggle */}
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {project.is_public ? (
                    <Globe className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Label htmlFor="vis-toggle-header" className="text-sm font-medium cursor-pointer">
                    {project.is_public ? 'Public to Org' : 'Private'}
                  </Label>
                </div>
                <Switch
                  id="vis-toggle-header"
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

            {/* Create Job from Spec */}
            {!project.job_id && project.job_spec_data && (
              <>
                <DropdownMenuItem onClick={() => setShowCreateJobDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Job from Spec
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Link / Change linked job */}
            {project.job_id ? (
              <>
                <DropdownMenuItem onClick={() => setShowLinkJobDialog(true)}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Change Linked Job
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setShowLinkJobDialog(true)}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Link to Existing Job
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

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

      {/* Dialogs */}
      <LinkToJobDialog
        open={showLinkJobDialog}
        onOpenChange={setShowLinkJobDialog}
        onConfirm={async (jobId) => { await onLinkToJob(jobId) }}
        currentJobId={project.job_id}
      />

      <CreateJobFromProjectDialog
        open={showCreateJobDialog}
        onOpenChange={setShowCreateJobDialog}
        projectId={project.id}
        projectName={project.name}
        jobSpecData={project.job_spec_data || null}
      />

      <RoleInterpretationDrawer
        open={showInterpretationDrawer}
        onOpenChange={setShowInterpretationDrawer}
        jobSpecData={project.job_spec_data || null}
      />
    </>
  )
}
