import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, FlaskConical, Plus, Sparkles, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useOrgContext } from '@/contexts/OrgContext'
import { useToast } from '@/hooks/use-toast'
import { useDepartments } from '@/hooks/useDepartments'
import { useJobs } from '@/hooks/useJobs'
import { useMembers } from '@/hooks/useMembers'
import {
  OnboardingShell,
  ObKicker,
  ObTitle,
  ObSub,
  ObPrimaryButton,
  ObLabel,
  ObInput,
  ObHint,
} from './OnboardingShell'
import { PreviewState } from './WorkspacePreview'

type FlowStep = 1 | 2 | 3 | 4 | 5 | 6

interface PersistedState {
  step: FlowStep
  orgId: string | null
  orgName: string
  departmentId: string | null
  departmentName: string
  jobId: string | null
  jobTitle: string
  jobLocation: string
  isDemo: boolean
}

const STORAGE_KEY_REAL = 'gio_ob_state'
const STORAGE_KEY_DEMO = 'gio_ob_demo_state'

interface OnboardingFlowProps {
  demo?: boolean
}

const CANDIDATE_PALETTE = ['#7C3AED', '#10B981', '#6366F1']

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '··'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : ''
  return (first + last).toUpperCase().slice(0, 2) || '··'
}

const SAMPLE_CANDIDATES = [
  { name: 'Teresa Galvan', role: 'Customer Success Manager', company: 'Konfio', match: 94, initials: 'TG', color: '#7C3AED' },
  { name: 'Sofia Camarena', role: 'CS Team Lead', company: 'Clip', match: 91, initials: 'SC', color: '#10B981' },
  { name: 'Ivan Robles', role: 'Senior CSM', company: 'Bitso', match: 87, initials: 'IR', color: '#6366F1' },
]

const DEPARTMENT_OPTIONS = ['People', 'Engineering', 'Sales', 'Marketing', 'Operations', 'Finance']

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'workspace'
  )
}

function loadState(key: string): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}
function saveState(key: string, s: PersistedState) {
  try {
    sessionStorage.setItem(key, JSON.stringify(s))
  } catch {}
}
function clearState(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {}
}

export default function OnboardingFlow({ demo = false }: OnboardingFlowProps) {
  const STORAGE_KEY = demo ? STORAGE_KEY_DEMO : STORAGE_KEY_REAL
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, organizationId } = useAuth()
  const { refreshOrgContext } = useOrgContext()
  const { createDepartment } = useDepartments()
  const { createJob } = useJobs()
  const { createMember } = useMembers()

  const initial = loadState(STORAGE_KEY)
  const [step, setStep] = useState<FlowStep>(initial?.step || 1)
  const [orgId, setOrgId] = useState<string | null>(initial?.orgId || null)
  const [orgName, setOrgName] = useState(initial?.orgName || '')
  const [departmentId, setDepartmentId] = useState<string | null>(initial?.departmentId || null)
  const [departmentName, setDepartmentName] = useState(initial?.departmentName || '')
  const [jobId, setJobId] = useState<string | null>(initial?.jobId || null)
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle || '')
  const [jobLocation, setJobLocation] = useState(initial?.jobLocation || '')
  const [isDemo, setIsDemo] = useState(initial?.isDemo || false)

  useEffect(() => {
    saveState(STORAGE_KEY, { step, orgId, orgName, departmentId, departmentName, jobId, jobTitle, jobLocation, isDemo })
  }, [STORAGE_KEY, step, orgId, orgName, departmentId, departmentName, jobId, jobTitle, jobLocation, isDemo])

  // Step 4 candidate phase + real Apollo results
  const [candidatesPhase, setCandidatesPhase] = useState<'idle' | 'searching' | 'ready'>('idle')
  const [realCandidates, setRealCandidates] = useState<typeof SAMPLE_CANDIDATES | null>(null)
  const [usedRealCandidates, setUsedRealCandidates] = useState(false)

  // Derived preview
  const preview: PreviewState = useMemo(() => {
    const base: PreviewState = {
      orgName: orgName || undefined,
      orgSlug: orgName ? slugify(orgName) : undefined,
      department: departmentName || undefined,
      jobTitle: jobTitle || undefined,
      jobLocation: jobLocation || undefined,
    }
    if (step === 4 && candidatesPhase === 'searching') {
      return {
        ...base,
        pipelineMode: 'placeholder',
        searchingLabel: 'Scanning 2,400+ LATAM profiles…',
      }
    }
    const displayCandidates = realCandidates ?? SAMPLE_CANDIDATES
    if (step === 4 && candidatesPhase === 'ready') {
      return { ...base, pipelineMode: 'with-candidates', candidates: displayCandidates }
    }
    if (step === 5) {
      return { ...base, pipelineMode: 'with-candidates', candidates: displayCandidates, teamCount: 3 }
    }
    if (step === 6) {
      return {
        ...base,
        pipelineMode: 'with-candidates',
        candidates: displayCandidates,
        teamCount: 3,
        showFinalStrip: true,
        finalCaption: true,
      }
    }
    if (step >= 3 && jobTitle) {
      return { ...base, pipelineMode: 'placeholder' }
    }
    if (step >= 3) {
      return { ...base, pipelineMode: 'placeholder' }
    }
    return base
  }, [step, candidatesPhase, orgName, departmentName, jobTitle, jobLocation, realCandidates])

  // ─── Step 1: Provision organization ───
  const [submitting1, setSubmitting1] = useState(false)
  const handleSubmitOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim() || submitting1) return
    if (demo) {
      setOrgId('demo-org-id')
      setStep(2)
      return
    }
    setSubmitting1(true)
    try {
      const { data, error } = await supabase.functions.invoke('provision-tenant', {
        body: { workspaceName: orgName.trim() },
      })
      if (error) throw error
      const workspaceId = (data as any)?.workspaceId
      if (!workspaceId) throw new Error('No workspace id returned')
      setOrgId(workspaceId)

      // Set current org + refresh context (non-blocking timeouts as in existing flow)
      try {
        await Promise.race([
          supabase.functions.invoke('set-current-organization', { body: { organizationId: workspaceId } }),
          new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 8000)),
        ])
      } catch (e) {
        console.warn('[Onboarding] set-current-organization slow/failed, continuing', e)
      }
      await refreshOrgContext()

      // Booking config (non-fatal)
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user?.id)
          .single()
        if (profile?.first_name && profile?.last_name) {
          await supabase.functions.invoke('create-booking-config', {
            body: {
              first_name: profile.first_name,
              last_name: profile.last_name,
              organization_id: workspaceId,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          })
          sessionStorage.setItem('virgilio_booking_link_created', 'true')
        }
      } catch (err) {
        console.warn('[Onboarding] booking config skipped', err)
      }

      setStep(2)
    } catch (err: any) {
      console.error('[Onboarding] provision failed', err)
      toast({
        title: 'Could not create workspace',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting1(false)
    }
  }

  // ─── Step 2: Department ───
  const [deptSelection, setDeptSelection] = useState<string>(departmentName || '')
  const [customDept, setCustomDept] = useState('')
  const [showCustomDept, setShowCustomDept] = useState(false)
  const [submitting2, setSubmitting2] = useState(false)
  const handleSubmitDept = async () => {
    const name = (showCustomDept ? customDept : deptSelection).trim()
    if (!name || submitting2) return
    if (demo) {
      setDepartmentId('demo-dept-id')
      setDepartmentName(name)
      setStep(3)
      return
    }
    setSubmitting2(true)
    try {
      const result = await createDepartment.mutateAsync({ name })
      setDepartmentId(result.id)
      setDepartmentName(result.name)
      setStep(3)
    } catch (err: any) {
      toast({ title: 'Could not create department', description: err?.message, variant: 'destructive' })
    } finally {
      setSubmitting2(false)
    }
  }

  // ─── Step 3: Job ───
  const [submitting3, setSubmitting3] = useState(false)
  const createJobAndAdvance = async (input: { title: string; location: string; demo: boolean }) => {
    if (demo) {
      setJobId('demo-job-id')
      setJobTitle(input.title)
      setJobLocation(input.location)
      setIsDemo(input.demo)
      setStep(4)
      return
    }
    if (!organizationId) {
      toast({ title: 'Workspace not ready', description: 'Refresh and try again.', variant: 'destructive' })
      return
    }
    setSubmitting3(true)
    try {
      const newJob = await createJob({
        title: input.title,
        location: input.location,
        department_id: departmentId || undefined,
        organization_id: organizationId,
        status: 'open',
        description: input.demo ? '[demo job]' : undefined,
      })
      setJobId(newJob.id)
      setJobTitle(newJob.title)
      setJobLocation(newJob.location || input.location)
      setIsDemo(input.demo)
      setStep(4)
    } catch (err: any) {
      toast({ title: 'Could not create job', description: err?.message, variant: 'destructive' })
    } finally {
      setSubmitting3(false)
    }
  }

  // ─── Step 4: Candidate matching (auto-play) ───
  useEffect(() => {
    if (step !== 4 || !jobId) return
    let cancelled = false
    setCandidatesPhase('searching')
    setRealCandidates(null)
    setUsedRealCandidates(false)
    const start = Date.now()
    ;(async () => {
      if (!demo) {
        try {
          const criteria = {
            skills: [] as string[],
            title_keywords: jobTitle ? [jobTitle] : [],
            locations: jobLocation ? [jobLocation] : [],
          }
          // 1) Create a sourcing project tied to the freshly-created job
          const { data: projectRes, error: projectErr } = await supabase.functions.invoke(
            'create-sourcing-project',
            {
              body: {
                name: `${jobTitle || 'Onboarding'} — first search`,
                description: 'Auto-created during onboarding',
                job_id: jobId,
                search_criteria: criteria,
              },
            },
          )
          if (projectErr || !projectRes?.id) {
            throw projectErr || new Error('No sourcing project returned')
          }

          // 2) Apollo preview search — search itself is free; cap to 3 results
          const { data: apolloRes, error: apolloErr } = await supabase.functions.invoke(
            'search-apollo-candidates',
            {
              body: {
                project_id: projectRes.id,
                criteria,
                limit: 3,
                max_results: 3,
              },
            },
          )
          if (apolloErr) throw apolloErr

          const raw = Array.isArray(apolloRes?.candidates) ? apolloRes.candidates.slice(0, 3) : []
          if (raw.length > 0) {
            const mapped = raw.map((c: any, i: number) => {
              const name: string =
                c.full_name ||
                `${c.first_name || ''} ${c.last_name_obfuscated || ''}`.trim() ||
                'Candidate'
              return {
                name,
                role: c.current_title || c.headline || 'Candidate',
                company: c.current_company || '—',
                match: [94, 91, 88][i] ?? 85,
                initials: initialsFrom(name),
                color: CANDIDATE_PALETTE[i % CANDIDATE_PALETTE.length],
              }
            })
            if (!cancelled) {
              setRealCandidates(mapped)
              setUsedRealCandidates(true)
            }
          }
        } catch (err) {
          console.warn('[Onboarding] Apollo seed failed (non-fatal, showing samples)', err)
        }
      }
      const elapsed = Date.now() - start
      const minMs = 1600
      if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed))
      if (!cancelled) setCandidatesPhase('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [step, jobId, demo, jobTitle, jobLocation])

  // ─── Step 5: Team ───
  type InviteRow = { email: string; role: 'admin' | 'member' | 'sales' }
  const [invites, setInvites] = useState<InviteRow[]>([{ email: '', role: 'member' }])
  const [submitting5, setSubmitting5] = useState(false)
  const handleSendInvites = async () => {
    if (demo) {
      setStep(6)
      return
    }
    if (!organizationId) {
      setStep(6)
      return
    }
    const filled = invites.filter((i) => i.email.trim())
    if (filled.length === 0) {
      setStep(6)
      return
    }
    setSubmitting5(true)
    try {
      for (const inv of filled) {
        try {
          await createMember({
            organization_id: organizationId,
            email: inv.email.trim(),
            system_role: inv.role,
            user_status: 'invited',
          })
        } catch (err) {
          console.warn('[Onboarding] invite failed for', inv.email, err)
        }
      }
      setStep(6)
    } finally {
      setSubmitting5(false)
    }
  }

  // ─── Step 6: Done ───
  const handleFinish = () => {
    clearState(STORAGE_KEY)
    if (demo) {
      // Reset preview flow back to start instead of navigating
      setStep(1)
      setOrgId(null)
      setOrgName('')
      setDepartmentId(null)
      setDepartmentName('')
      setJobId(null)
      setJobTitle('')
      setJobLocation('')
      setIsDemo(false)
      setCandidatesPhase('idle')
      return
    }
    sessionStorage.setItem('virgilio_first_run', 'true')
    navigate('/trial-activation', { replace: true })
  }

  // ─── Skip handlers ───
  const skipJob = () => {
    // Skipping job auto-skips candidates → go straight to Team
    setStep(5)
  }
  const skipCandidates = () => setStep(5)
  const skipTeam = () => setStep(6)

  // Render per step
  if (step === 1) {
    return (
      <OnboardingShell step={1} preview={preview}>
        <ObKicker>Welcome to Gio</ObKicker>
        <ObTitle>Name your organization</ObTitle>
        <ObSub>
          Your workspace — jobs, candidates and team live under it. Watch it take shape on the right.
        </ObSub>
        <form onSubmit={handleSubmitOrg} style={{ marginTop: 28, maxWidth: 380 }}>
          <ObLabel htmlFor="org-name">Organization name</ObLabel>
          <ObInput
            id="org-name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Inc."
            autoFocus
            required
          />
          <ObHint>You can change this anytime in Settings.</ObHint>
          <div style={{ marginTop: 20 }}>
            <ObPrimaryButton type="submit" disabled={!orgName.trim() || submitting1}>
              {submitting1 ? 'Creating…' : 'Continue'}
            </ObPrimaryButton>
          </div>
        </form>
      </OnboardingShell>
    )
  }

  if (step === 2) {
    const selected = showCustomDept ? '__custom' : deptSelection
    return (
      <OnboardingShell step={2} preview={preview}>
        <ObTitle>Where are you hiring first</ObTitle>
        <ObSub>Departments keep jobs organized. Pick one to start — add the rest later.</ObSub>
        <div style={{ marginTop: 28, maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {DEPARTMENT_OPTIONS.map((d) => {
              const isSel = selected === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setShowCustomDept(false)
                    setDeptSelection(d)
                  }}
                  style={{
                    height: 46,
                    borderRadius: 10,
                    border: `1.5px solid ${isSel ? '#6F3FF5' : '#E7E8EE'}`,
                    background: isSel ? '#EDE4FF' : '#FFFFFF',
                    color: isSel ? '#3D1FA3' : '#0d0d09',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13.5,
                    fontWeight: isSel ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    textAlign: 'left',
                    padding: '0 16px',
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>
          {!showCustomDept ? (
            <button
              type="button"
              onClick={() => {
                setShowCustomDept(true)
                setDeptSelection('')
              }}
              style={{
                height: 46,
                borderRadius: 10,
                border: '1.5px dashed #D2D4DC',
                background: 'transparent',
                color: '#8B8F9E',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Plus size={14} strokeWidth={2} /> Something else
            </button>
          ) : (
            <ObInput
              autoFocus
              placeholder="Department name"
              value={customDept}
              onChange={(e) => setCustomDept(e.target.value)}
            />
          )}
          <div style={{ marginTop: 20 }}>
            <ObPrimaryButton
              type="button"
              onClick={handleSubmitDept}
              disabled={
                submitting2 || (showCustomDept ? !customDept.trim() : !deptSelection)
              }
            >
              {submitting2 ? 'Creating…' : 'Continue'}
            </ObPrimaryButton>
          </div>
        </div>
      </OnboardingShell>
    )
  }

  if (step === 3) {
    return (
      <OnboardingShell step={3} preview={preview} onSkip={skipJob}>
        <ObTitle>Create your first job</ObTitle>
        <ObSub>Just the basics — Gio drafts the description and sets up the pipeline.</ObSub>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!jobTitle.trim() || !jobLocation.trim()) return
            createJobAndAdvance({ title: jobTitle.trim(), location: jobLocation.trim(), demo: false })
          }}
          style={{ marginTop: 28, maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div>
            <ObLabel htmlFor="job-title">Job title</ObLabel>
            <ObInput
              id="job-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Customer Success Lead"
              autoFocus
            />
          </div>
          <div>
            <ObLabel htmlFor="job-location">Location</ObLabel>
            <ObInput
              id="job-location"
              value={jobLocation}
              onChange={(e) => setJobLocation(e.target.value)}
              placeholder="Remote · LATAM"
            />
          </div>
          <div>
            <ObPrimaryButton
              type="submit"
              disabled={submitting3 || !jobTitle.trim() || !jobLocation.trim()}
            >
              {submitting3 ? 'Creating…' : 'Create job'}
            </ObPrimaryButton>
          </div>

          {/* Demo job card */}
          <button
            type="button"
            disabled={submitting3}
            onClick={() =>
              createJobAndAdvance({
                title: 'Customer Success Lead',
                location: 'Remote · LATAM',
                demo: true,
              })
            }
            style={{
              marginTop: 6,
              background: '#FFFFFF',
              border: '1px solid #E7E8EE',
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 150ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#D7C5FB')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E7E8EE')}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#EDE4FF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6F3FF5',
                flexShrink: 0,
              }}
            >
              <FlaskConical size={16} strokeWidth={2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#0d0d09',
                }}
              >
                Not hiring yet? Start with a demo job
              </div>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 11,
                  color: '#8B8F9E',
                  marginTop: 2,
                }}
              >
                Fully set up with sample candidates — delete it anytime.
              </div>
            </div>
          </button>
        </form>
      </OnboardingShell>
    )
  }

  if (step === 4) {
    if (candidatesPhase !== 'ready') {
      return (
        <OnboardingShell step={4} preview={preview} onSkip={skipCandidates}>
          <ObTitle>Gio is finding candidates</ObTitle>
          <ObSub>
            Scanning profiles that match {jobTitle || 'your job'}
            {jobLocation ? ` · ${jobLocation}` : ''}.
          </ObSub>
        </OnboardingShell>
      )
    }
    return (
      <OnboardingShell step={4} preview={preview} onSkip={skipCandidates}>
        <ObTitle>Your first candidates</ObTitle>
        <ObSub>
          18 strong matches. The top three just landed in your pipeline — the rest are waiting in Find.
        </ObSub>
        <div
          className="ob-in"
          style={{
            marginTop: 22,
            background: '#EDE4FF',
            borderRadius: 10,
            padding: '10px 13px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            maxWidth: 420,
          }}
        >
          <BadgeCheck size={14} strokeWidth={2} style={{ color: '#6F3FF5', marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#3D1FA3', lineHeight: 1.45 }}>
            <span style={{ fontWeight: 600 }}>These are real, sourceable people</span> — live profiles matched
            to your job just now, not sample data.
          </div>
        </div>
        <div
          className="ob-in"
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'Inter, sans-serif',
            fontSize: 12.5,
            color: '#5A6072',
            animationDelay: '0.1s',
          }}
        >
          <Sparkles size={14} strokeWidth={2} style={{ color: '#6F3FF5' }} />
          Matches are scored on skills, seniority, location and intent.
        </div>
        <div style={{ marginTop: 22 }}>
          <ObPrimaryButton type="button" onClick={() => setStep(5)}>
            Continue
          </ObPrimaryButton>
        </div>
      </OnboardingShell>
    )
  }

  if (step === 5) {
    const update = (idx: number, patch: Partial<InviteRow>) => {
      setInvites((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
    }
    return (
      <OnboardingShell step={5} preview={preview} onSkip={skipTeam}>
        <ObTitle>Bring your team</ObTitle>
        <ObSub>Interviewers see their schedule and scorecards — nothing else to set up.</ObSub>
        <div style={{ marginTop: 28, maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {invites.map((inv, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8 }}>
              <ObInput
                type="email"
                placeholder="teammate@company.com"
                value={inv.email}
                onChange={(e) => update(i, { email: e.target.value })}
              />
              <div style={{ position: 'relative' }}>
                <select
                  value={inv.role}
                  onChange={(e) => update(i, { role: e.target.value as InviteRow['role'] })}
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 10,
                    border: '1.5px solid #E7E8EE',
                    background: '#FFFFFF',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    color: '#0d0d09',
                    padding: '0 36px 0 14px',
                    appearance: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="member">Interviewer</option>
                  <option value="member">Recruiter</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#8B8F9E',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setInvites((p) => [...p, { email: '', role: 'member' }])}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6F3FF5',
              fontFamily: 'Inter, sans-serif',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
              alignSelf: 'flex-start',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={12} strokeWidth={2} /> Add another
          </button>
          <div style={{ marginTop: 14 }}>
            <ObPrimaryButton
              type="button"
              onClick={handleSendInvites}
              disabled={submitting5}
            >
              {submitting5 ? 'Sending…' : 'Send invites'}
            </ObPrimaryButton>
          </div>
        </div>
      </OnboardingShell>
    )
  }

  // Step 6
  return (
    <OnboardingShell step={6} totalSteps={5} showTracker={false} preview={preview}>
      <ObKicker>All set</ObKicker>
      <ObTitle>Your workspace is ready</ObTitle>
      <ObSub>
        Organization, department, a live job and 18 candidate matches — your queue already has work in it.
      </ObSub>
      <div style={{ marginTop: 28 }}>
        <ObPrimaryButton type="button" onClick={handleFinish}>
          Go to your dashboard
        </ObPrimaryButton>
      </div>
    </OnboardingShell>
  )
}
