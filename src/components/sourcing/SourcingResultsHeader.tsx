import { useState } from 'react'
import { RefreshCw, Share2, MoreHorizontal, Sparkles, Archive, Trash2, Globe, Lock, Link2, Plus, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { IconTip } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LinkToJobDialog, type LinkToJobPayload } from './LinkToJobDialog'
import { CreateJobFromProjectDialog } from './CreateJobFromProjectDialog'
import { RoleInterpretationDrawer } from './RoleInterpretationDrawer'
import { SourcingProject } from '@/types/sourcing'
import { cn } from '@/lib/utils'

interface SourcingResultsHeaderProps {
  project: SourcingProject
  isRefreshing: boolean
  onRefresh: () => void
  onShare?: () => void
  onArchive: () => void
  onDelete: () => void
  onVisibilityToggle: (v: boolean) => Promise<void>
  onLinkToJob: (payload: LinkToJobPayload) => Promise<void>
  onChatWithGio?: () => void
}

export function SourcingResultsHeader({
  project,
  isRefreshing,
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

  // When the search last ran; older projects fall back to their last edit.
  const ranAt = project.last_search_at || project.updated_at
  const refreshedAt = ranAt ? formatDistanceToNow(new Date(ranAt), { addSuffix: true }) : null

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border shrink-0">
        {/* Left: the search's name (pick another under My searches) */}
        <div className="min-w-0 flex-1">
          <div className="truncate font-poppins text-[14px] font-semibold tracking-[-0.01em] text-text-primary">{project.name}</div>
          {refreshedAt && <div className="truncate font-inter text-[11.5px] leading-tight text-text-tertiary">Searched {refreshedAt}</div>}
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-1.5 shrink-0">
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
            <IconTip label="More actions">
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" iconOnly icon={MoreHorizontal} aria-label="More actions" />
              </DropdownMenuTrigger>
            </IconTip>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-[272px]">
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
                    <Eye />
                    <span className="truncate">View Gio's interpretation</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {!project.job_id && project.job_spec_data && (
                <DropdownMenuItem onClick={() => setShowCreateJobDialog(true)}>
                  <Plus />
                  <span className="truncate">Create a job from this search</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowLinkJobDialog(true)}>
                <Link2 />
                <span className="truncate">{project.job_id ? 'Change the linked job' : 'Link to a job'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive}>
                <Archive />
                <span className="truncate">{project.status === 'active' ? 'Archive search' : 'Unarchive search'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 />
                <span className="truncate">Delete search</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <LinkToJobDialog
        open={showLinkJobDialog}
        onOpenChange={setShowLinkJobDialog}
        onConfirm={async (payload) => { await onLinkToJob(payload) }}
        currentJobId={project.job_id}
        project={project as any}
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
