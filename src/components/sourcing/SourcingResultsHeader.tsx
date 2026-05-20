import { useState } from 'react'
import { RefreshCw, Share2, ChevronDown, MoreHorizontal, Sparkles, Archive, Trash2, Globe, Lock, Link2, Plus, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
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
import { SavedSearchSelector } from './SavedSearchSelector'
import { LinkToJobDialog } from './LinkToJobDialog'
import { CreateJobFromProjectDialog } from './CreateJobFromProjectDialog'
import { RoleInterpretationDrawer } from './RoleInterpretationDrawer'
import { SourcingProject } from '@/types/sourcing'
import { cn } from '@/lib/utils'

interface SourcingResultsHeaderProps {
  project: SourcingProject
  candidateCount: number
  isRefreshing: boolean
  isAutoRefreshing?: boolean
  onSelectProject: (id: string) => void
  onNewSearch: () => void
  onRefresh: () => void
  onShare?: () => void
  onArchive: () => void
  onDelete: () => void
  onVisibilityToggle: (v: boolean) => Promise<void>
  onLinkToJob: (jobId: string) => Promise<void>
  onChatWithGio?: () => void
}

export function SourcingResultsHeader({
  project,
  candidateCount,
  isRefreshing,
  isAutoRefreshing = true,
  onSelectProject,
  onNewSearch,
  onRefresh,
  onShare,
  onArchive,
  onDelete,
  onVisibilityToggle,
  onLinkToJob,
  onChatWithGio,
}: SourcingResultsHeaderProps) {
  const [showLinkJobDialog, setShowLinkJobDialog] = useState(false)
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false)
  const [showInterpretationDrawer, setShowInterpretationDrawer] = useState(false)

  const refreshedAt = project.updated_at
    ? formatDistanceToNow(new Date(project.updated_at), { addSuffix: false })
    : null

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border shrink-0">
        {/* Left: saved-search selector with project meta */}
        <div className="min-w-0 flex-1">
          <SavedSearchSelector
            selectedProjectId={project.id}
            currentProject={project}
            onSelectProject={onSelectProject}
            onNewSearch={onNewSearch}
            trigger={
              <button
                type="button"
                className="group flex items-center gap-2 max-w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-[#FAFAF7] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-poppins text-[14px] font-semibold tracking-[-0.01em] text-text-primary truncate">
                      {project.name}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-text-tertiary shrink-0 group-hover:text-text-secondary transition-colors" />
                  </div>
                  <div className="font-inter text-[11.5px] text-text-tertiary truncate leading-tight">
                    {candidateCount} candidates
                    {refreshedAt && <> · refreshed {refreshedAt} ago</>}
                  </div>
                </div>
              </button>
            }
          />
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isAutoRefreshing && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 px-2.5 h-7 font-poppins text-[11.5px] font-medium">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                <span className="relative rounded-full bg-emerald-500 h-1.5 w-1.5" />
              </span>
              Auto-refreshing
            </span>
          )}

          <Button
            size="sm"
            variant="ghost"
            icon={RefreshCw}
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(isRefreshing && '[&_svg]:animate-spin')}
          >
            Refresh now
          </Button>

          {onShare && (
            <Button size="sm" variant="ghost" icon={Share2} onClick={onShare}>
              Share
            </Button>
          )}

          {onChatWithGio && (
            <Button
              size="sm"
              variant="ghost"
              icon={Sparkles}
              onClick={onChatWithGio}
              className="text-virgilio-purple hover:bg-virgilio-purple/10"
            >
              Chat with Gio
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" iconOnly icon={MoreHorizontal} aria-label="More actions" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-64">
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {project.is_public ? (
                      <Globe className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-text-tertiary" />
                    )}
                    <Label htmlFor="vis-toggle-results-header" className="text-sm font-medium cursor-pointer">
                      {project.is_public ? 'Public to Org' : 'Private'}
                    </Label>
                  </div>
                  <Switch
                    id="vis-toggle-results-header"
                    checked={project.is_public}
                    onCheckedChange={onVisibilityToggle}
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  {project.is_public
                    ? 'Anyone in your organization can view this project'
                    : 'Only you can view this project'}
                </p>
              </div>

              {project.job_spec_data && (
                <>
                  <DropdownMenuItem onClick={() => setShowInterpretationDrawer(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Gio's interpretation
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {!project.job_id && project.job_spec_data && (
                <DropdownMenuItem onClick={() => setShowCreateJobDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Job from Spec
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowLinkJobDialog(true)}>
                <Link2 className="h-4 w-4 mr-2" />
                {project.job_id ? 'Change Linked Job' : 'Link to Existing Job'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
      </div>

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
