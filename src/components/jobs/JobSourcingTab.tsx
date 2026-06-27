import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { useJobSourcingProject } from '@/hooks/useJobSourcingProject'

interface JobSourcingTabProps {
  jobId: string
  jobTitle: string
  seed?: Record<string, any>
}

export function JobSourcingTab({ jobId, jobTitle, seed }: JobSourcingTabProps) {
  const navigate = useNavigate()
  const { project, isLoading, ensureProject } = useJobSourcingProject(jobId)
  const [creating, setCreating] = React.useState(false)

  const goToProject = (projectId: string) => {
    navigate(`/find/${projectId}`)
  }

  const handleStart = async () => {
    setCreating(true)
    const p = await ensureProject({ name: `Sourcing — ${jobTitle}`, seed })
    setCreating(false)
    if (p) goToProject(p.id)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-48 rounded-2xl bg-[#F1F0EC] animate-pulse" />
      </div>
    )
  }

  if (project) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-white border border-virgilio-border p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#EDE4FF] inline-flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-virgilio-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-poppins font-semibold text-text-primary truncate">
                {project.name}
              </p>
              <Badge tone="lilac" size="xs">Linked to this job</Badge>
            </div>
            <p className="text-[12.5px] text-text-secondary mt-0.5">
              Gio is sourcing candidates for this role. Open the project to review and act on results.
            </p>
          </div>
          <Button variant="primary" size="sm" iconRight={ArrowRight} onClick={() => goToProject(project.id)}>
            Open sourcing project
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <EmptyState
        size="card"
        title="No sourcing project yet"
        body="Start a sourcing project linked to this job — Gio will surface matching candidates and keep them organized in one place."
        primary={
          <EmptyAction
            icon={<Sparkles size={16} strokeWidth={2} />}
            onClick={creating ? undefined : handleStart}
          >
            {creating ? 'Starting…' : 'Start sourcing for this job'}
          </EmptyAction>
        }
      />
    </div>
  )
}
