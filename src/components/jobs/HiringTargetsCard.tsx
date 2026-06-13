import { useEffect, useState, KeyboardEvent } from 'react'
import { Target, X, Edit, Save } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { CURRENCIES } from '@/constants/currencies'

interface Targets {
  budget_salary_min: number | null
  budget_salary_max: number | null
  budget_currency: string
  budget_period: 'monthly' | 'annual'
  target_fill_date: string | null
  must_have_skills: string[]
  location_requirement: 'onsite' | 'hybrid' | 'remote'
}

const DEFAULTS: Targets = {
  budget_salary_min: null,
  budget_salary_max: null,
  budget_currency: 'MXN',
  budget_period: 'monthly',
  target_fill_date: null,
  must_have_skills: [],
  location_requirement: 'onsite',
}

export function HiringTargetsCard({ jobId }: { jobId: string }) {
  const { toast } = useToast()
  const { canEditJobs } = usePermissions()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<Targets>(DEFAULTS)
  const [draft, setDraft] = useState<Targets>(DEFAULTS)
  const [skillInput, setSkillInput] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: row, error } = await supabase
        .from('jobs')
        .select('budget_salary_min, budget_salary_max, budget_currency, budget_period, target_fill_date, must_have_skills, location_requirement')
        .eq('id', jobId)
        .maybeSingle()
      if (cancelled || error || !row) return
      const next: Targets = {
        budget_salary_min: (row as any).budget_salary_min ?? null,
        budget_salary_max: (row as any).budget_salary_max ?? null,
        budget_currency: (row as any).budget_currency ?? 'MXN',
        budget_period: ((row as any).budget_period ?? 'monthly') as 'monthly' | 'annual',
        target_fill_date: (row as any).target_fill_date ?? null,
        must_have_skills: ((row as any).must_have_skills ?? []) as string[],
        location_requirement: ((row as any).location_requirement ?? 'onsite') as 'onsite' | 'hybrid' | 'remote',
      }
      setData(next)
      setDraft(next)
    })()
    return () => { cancelled = true }
  }, [jobId])

  const startEdit = () => { setDraft(data); setSkillInput(''); setEditing(true) }
  const cancel = () => { setDraft(data); setSkillInput(''); setEditing(false) }

  const save = async () => {
    if (draft.budget_salary_min != null && draft.budget_salary_max != null && draft.budget_salary_min > draft.budget_salary_max) {
      toast({ title: 'Invalid salary range', description: 'Minimum cannot exceed maximum.', variant: 'destructive' })
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('jobs')
      .update({
        budget_salary_min: draft.budget_salary_min,
        budget_salary_max: draft.budget_salary_max,
        budget_currency: draft.budget_currency,
        budget_period: draft.budget_period,
        target_fill_date: draft.target_fill_date,
        must_have_skills: draft.must_have_skills,
        location_requirement: draft.location_requirement,
      } as any)
      .eq('id', jobId)
    setSaving(false)
    if (error) {
      toast({ title: 'Could not save hiring targets', description: error.message, variant: 'destructive' })
      return
    }
    setData(draft)
    setEditing(false)
    toast({ title: 'Hiring targets saved' })
  }

  const addSkill = (raw: string) => {
    const v = raw.trim()
    if (!v) return
    if (draft.must_have_skills.some(s => s.toLowerCase() === v.toLowerCase())) { setSkillInput(''); return }
    setDraft({ ...draft, must_have_skills: [...draft.must_have_skills, v] })
    setSkillInput('')
  }
  const removeSkill = (s: string) => setDraft({ ...draft, must_have_skills: draft.must_have_skills.filter(x => x !== s) })
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput) }
    else if (e.key === 'Backspace' && !skillInput && draft.must_have_skills.length) {
      setDraft({ ...draft, must_have_skills: draft.must_have_skills.slice(0, -1) })
    }
  }

  const fmtMoney = (n: number | null) => (n == null ? '—' : n.toLocaleString())
  const salaryDisplay = () => {
    const { budget_salary_min: lo, budget_salary_max: hi, budget_currency: c, budget_period: p } = data
    if (lo == null && hi == null) return 'Not set'
    const range = lo != null && hi != null ? `${fmtMoney(lo)} – ${fmtMoney(hi)}` : lo != null ? `${fmtMoney(lo)}+` : `Up to ${fmtMoney(hi)}`
    return `${c} ${range} / ${p}`
  }
  const locLabel = { onsite: 'Onsite', hybrid: 'Hybrid', remote: 'Remote' }[data.location_requirement]

  return (
    <Card className="shadow-calendly border-virgilio-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-virgilio-text font-poppins">
          <Target className="h-5 w-5 text-virgilio-purple" />
          Hiring targets<span className="text-virgilio-purple">.</span>
        </CardTitle>
        {canEditJobs && !editing && (
          <Button variant="ghost" size="sm" icon={Edit} onClick={startEdit}>Edit</Button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>Cancel</Button>
            <Button size="sm" icon={Save} onClick={save} loading={saving}>Save</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-virgilio-muted text-xs uppercase tracking-wider mb-1">Salary budget</dt>
              <dd className="text-virgilio-text font-medium">{salaryDisplay()}</dd>
            </div>
            <div>
              <dt className="text-virgilio-muted text-xs uppercase tracking-wider mb-1">Target fill date</dt>
              <dd className="text-virgilio-text font-medium">
                {data.target_fill_date ? format(new Date(data.target_fill_date), 'PPP') : 'Not set'}
              </dd>
            </div>
            <div>
              <dt className="text-virgilio-muted text-xs uppercase tracking-wider mb-1">Location requirement</dt>
              <dd className="text-virgilio-text font-medium">{locLabel}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-virgilio-muted text-xs uppercase tracking-wider mb-1">Must-have skills</dt>
              <dd>
                {data.must_have_skills.length === 0 ? (
                  <span className="text-virgilio-muted">None set</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {data.must_have_skills.map(s => (
                      <Badge key={s} tone="lilac" size="sm">{s}</Badge>
                    ))}
                  </div>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="space-y-5">
            {/* Salary */}
            <div>
              <label className="text-form-label text-virgilio-text">Salary budget</label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={draft.budget_salary_min ?? ''}
                  onChange={e => setDraft({ ...draft, budget_salary_min: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={draft.budget_salary_max ?? ''}
                  onChange={e => setDraft({ ...draft, budget_salary_max: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <Select value={draft.budget_currency} onValueChange={v => setDraft({ ...draft, budget_currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={draft.budget_period} onValueChange={v => setDraft({ ...draft, budget_period: v as 'monthly' | 'annual' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target date + location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-form-label text-virgilio-text">Target fill date</label>
                <div className="mt-2">
                  <DatePickerVirgilio
                    value={draft.target_fill_date ? new Date(draft.target_fill_date) : undefined}
                    onChange={(d) => setDraft({ ...draft, target_fill_date: format(d, 'yyyy-MM-dd') })}
                    placeholder="Pick a date"
                  />
                </div>
              </div>
              <div>
                <label className="text-form-label text-virgilio-text">Location requirement</label>
                <div className="mt-2">
                  <Select value={draft.location_requirement} onValueChange={v => setDraft({ ...draft, location_requirement: v as Targets['location_requirement'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="text-form-label text-virgilio-text">Must-have skills</label>
              <div className="mt-2 rounded-lg border border-virgilio-border bg-white p-2 flex flex-wrap gap-1.5">
                {draft.must_have_skills.map(s => (
                  <Badge key={s} tone="lilac" size="sm" className="gap-1">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} className="hover:text-virgilio-purple" aria-label={`Remove ${s}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  type="text"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={onSkillKey}
                  onBlur={() => addSkill(skillInput)}
                  placeholder={draft.must_have_skills.length === 0 ? 'Type a skill and press Enter' : ''}
                  className="flex-1 min-w-[160px] bg-transparent outline-none text-sm px-1"
                />
              </div>
              <p className="mt-1.5 text-xs text-virgilio-muted">Press Enter or comma to add. These are used by the briefing to gauge candidate fit.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
