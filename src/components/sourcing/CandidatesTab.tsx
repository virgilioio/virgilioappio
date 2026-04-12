import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  RefreshCw, MoreHorizontal, Archive, Trash2, 
  Globe, Lock, Link2, Briefcase, Plus, Eye
} from 'lucide-react'
import { SourcingCandidateTable } from './SourcingCandidateTable'
import { LinkToJobDialog } from './LinkToJobDialog'
import { CreateJobFromProjectDialog } from './CreateJobFromProjectDialog'
import { RoleInterpretationDrawer } from './RoleInterpretationDrawer'
import { SourcingProject, SearchCriteria } from '@/types/sourcing'
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

interface Candidate {
  id: string;
  candidate_name: string;
  current_role?: string;
  current_company?: string;
  location_city?: string;
  location_country?: string;
  linkedin_url?: string;
  match_score: number;
  match_tier: 'excellent' | 'good' | 'fair' | 'minimal';
  skills?: string[];
  years_experience?: number;
  source: 'local' | 'apollo' | 'pdl';
  apollo_id?: string;
  apollo_score?: number;
  headline?: string;
  email?: string;
  email_status?: string;
  phone?: string;
  candidate_id?: string | null;
}

interface CandidatesTabProps {
  project: SourcingProject;
  candidates: Candidate[];
  isLoading: boolean;
  onRefresh: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onVisibilityToggle: (isPublic: boolean) => Promise<void>;
  onLinkToJob: (jobId: string) => Promise<void>;
  isRefreshing: boolean;
}

export function CandidatesTab({
  project,
  candidates,
  isLoading,
  onRefresh,
  onArchive,
  onDelete,
  onVisibilityToggle,
  onLinkToJob,
  isRefreshing,
}: CandidatesTabProps) {
  const [showLinkJobDialog, setShowLinkJobDialog] = useState(false)
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false)
  const [showInterpretationDrawer, setShowInterpretationDrawer] = useState(false)

  const linkedJobLabel = project.jobs 
    ? `${project.jobs.title}${project.jobs.organizations?.name ? ` - ${project.jobs.organizations.name}` : ''}`
    : null

  return (
    <div className="flex-1 min-h-0 overflow-hidden h-full flex flex-col">
      {/* Row 2: Button controls toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 flex-wrap">
        {/* Linked Job / Link to Job */}
        {linkedJobLabel ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            asChild
          >
            <Link to={`/jobs/${project.job_id}`}>
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              {linkedJobLabel}
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowLinkJobDialog(true)}
          >
            <Link2 className="h-3.5 w-3.5" />
            Link to Job
          </Button>
        )}

        {/* View Gio's Interpretation */}
        {project.job_spec_data && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 text-muted-foreground"
            onClick={() => setShowInterpretationDrawer(true)}
          >
            <Eye className="h-3.5 w-3.5" />
            Gio's interpretation
          </Button>
        )}

        <div className="flex-1" />

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                  <Label htmlFor="vis-toggle" className="text-sm font-medium cursor-pointer">
                    {project.is_public ? 'Public to Org' : 'Private'}
                  </Label>
                </div>
                <Switch
                  id="vis-toggle"
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

      {/* Candidate Table */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SourcingCandidateTable
          candidates={candidates}
          isLoading={isLoading}
          jobId={project.job_id}
          projectId={project.id}
          searchCriteria={project.search_criteria}
        />
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
    </div>
  )
}
