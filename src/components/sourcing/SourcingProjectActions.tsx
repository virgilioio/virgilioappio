import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import {
  RefreshCw, MoreHorizontal, Archive, Trash2,
  Globe, Lock, Link2, Briefcase, Plus, Eye, Users
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
  const queryClient = useQueryClient()
  const [poolOn, setPoolOn] = useState(!!project.pool_enabled)
  useEffect(() => { setPoolOn(!!project.pool_enabled) }, [project.id, project.pool_enabled])

  // The talent pool (Find Phase 2): this search gets a share of the credits
  // active searches don't need, collected without phones.
  const togglePool = async (on: boolean) => {
    setPoolOn(on)
    const { error } = await supabase.from('sourcing_projects').update({ pool_enabled: on }).eq('id', project.id)
    if (error) {
      setPoolOn(!on)
      toast.error("Couldn't change the talent pool setting", { description: 'Try again in a moment.' })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['sourcing-project', project.id] })
    toast(on ? 'This search now fills the talent pool' : 'This search no longer fills the talent pool', {
      action: { label: 'Undo', onClick: () => void togglePool(!on) },
    })
  }

  const linkedJobLabel = project.jobs
    ? `${project.jobs.title}${project.jobs.organizations?.name ? ` - ${project.jobs.organizations.name}` : ''}`
    : null

  return (
    <>
      <div className="flex items-center gap-2">
        {poolOn && <Badge tone="purple" size="xs" icon={Users}>Talent pool</Badge>}

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

            {/* Talent pool */}
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="pool-toggle-header" className="text-sm font-medium cursor-pointer">
                    Fills the talent pool
                  </Label>
                </div>
                <Switch id="pool-toggle-header" checked={poolOn} onCheckedChange={(v) => void togglePool(v)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {poolOn
                  ? 'Gets a share of the credits active searches don\'t need. New people only, no phones, 25 per company a month.'
                  : 'Off. Turn on to collect new people from this search with spare credits.'}
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
        onConfirm={async (payload) => { await onLinkToJob(payload.jobId) }}
        currentJobId={project.job_id}
        project={project}
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
