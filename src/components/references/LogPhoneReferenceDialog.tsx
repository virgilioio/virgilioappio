import { useEffect, useMemo, useState } from 'react'
import { Phone } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QuestionInstrument } from '@/components/public/QuestionInstrument'
import { useLogPhoneReference } from '@/hooks/useReferenceRequests'
import { RELATIONSHIP_OPTIONS } from '@/lib/references/templateModel'
import type { PublicQuestion } from '@/lib/references/publicApi'
import type { RefereeRowData } from '@/components/references/RefereeRow'

const NEW = '__new__'

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

/**
 * A reference the recruiter already has in hand (usually taken by phone).
 * Uses the SAME answer instruments the referee sees, so a logged reference is
 * comparable with a submitted one. No email, no token — nobody is contacted.
 * Available at every request state, including awaiting-candidate.
 */
export function LogPhoneReferenceDialog({
  open,
  onOpenChange,
  requestId,
  snapshot,
  candidateName,
  referees = [],
  preselectedRefereeId = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string
  /** Frozen template snapshot from the request. */
  snapshot: Record<string, any> | null
  candidateName?: string | null
  /** This request's referees — the recruiter picks one, or logs a new person. */
  referees?: RefereeRowData[]
  preselectedRefereeId?: string | null
}) {
  const logReference = useLogPhoneReference()

  const [refereeId, setRefereeId] = useState<string>(NEW)
  const [spokeAt, setSpokeAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [period, setPeriod] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!open) return
    const selected = referees.find((r) => r.id === preselectedRefereeId) ?? null
    setRefereeId(selected?.id ?? NEW)
    setSpokeAt(toLocalInput(new Date().toISOString()))
    setName(selected?.name ?? '')
    setRelationship(selected?.relationship ?? '')
    setTitle(selected?.title ?? '')
    setCompany(selected?.company ?? '')
    setPeriod(selected?.period ?? '')
    setAnswers({})
    // referees identity changes on every refetch; keying on the id is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedRefereeId])

  const pickReferee = (id: string) => {
    setRefereeId(id)
    const selected = referees.find((r) => r.id === id)
    if (!selected) {
      setName('')
      setRelationship('')
      setTitle('')
      setCompany('')
      setPeriod('')
      return
    }
    setName(selected.name ?? '')
    setRelationship(selected.relationship ?? '')
    setTitle(selected.title ?? '')
    setCompany(selected.company ?? '')
    setPeriod(selected.period ?? '')
  }

  const questions = useMemo<PublicQuestion[]>(() => {
    const list = Array.isArray(snapshot?.questions) ? snapshot!.questions : []
    return list
      .filter((q: any) => q.type !== 'employment_verification')
      .map((q: any) => ({
        id: q.id,
        label: q.label,
        type: q.type,
        required: !!q.required,
        helper: q.helper,
        options: q.options,
      }))
  }, [snapshot])

  const verificationQuestion = useMemo(() => {
    const list = Array.isArray(snapshot?.questions) ? snapshot!.questions : []
    return list.find((q: any) => q.type === 'employment_verification') ?? null
  }, [snapshot])

  const canSave = name.trim().length > 1

  const submit = async () => {
    const payload = { ...answers }
    if (verificationQuestion) {
      payload[verificationQuestion.id] = { title: title.trim(), start: period.trim(), end: '' }
    }
    await logReference.mutateAsync({
      requestId,
      refereeId: refereeId === NEW ? null : refereeId,
      name: name.trim(),
      relationship: relationship || null,
      title: title.trim() || null,
      company: company.trim() || null,
      period: period.trim() || null,
      spokeAt: spokeAt ? new Date(spokeAt).toISOString() : null,
      answers: payload,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] p-0 gap-0 overflow-hidden">
        <div
          className="flex items-center"
          style={{ gap: 11, padding: '16px 20px', borderBottom: '1px solid #F1F0EC' }}
        >
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{ width: 32, height: 32, borderRadius: 9, background: '#EDE4FF' }}
          >
            <Phone size={16} color="#6F3FF5" />
          </span>
          <div>
            {candidateName && (
              <p
                className="font-inter uppercase"
                style={{ fontSize: 10.5, letterSpacing: '0.06em', color: '#8B8F9E' }}
              >
                {candidateName} · Reference check
              </p>
            )}
            <h2
              className="font-poppins"
              style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: '#0d0d09' }}
            >
              Log a phone reference
            </h2>
            <p className="font-inter" style={{ fontSize: 11.5, color: '#5A6072', marginTop: 2 }}>
              Same question set the referee would answer. The response is stored as
              recruiter-captured, and Gio weighs it accordingly.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ padding: 20, maxHeight: '62vh' }}>
          <div className="grid grid-cols-2" style={{ gap: 14 }}>
            <div>
              <Label className="text-form-label">Which referee?</Label>
              <Select value={refereeId} onValueChange={pickReferee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {referees.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW}>Someone else</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-form-label">Spoke on</Label>
              <Input
                type="datetime-local"
                value={spokeAt}
                onChange={(e) => setSpokeAt(e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <Label className="text-form-label">Referee name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label className="text-form-label">Relationship</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-form-label">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <p
              className="font-poppins"
              style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}
            >
              Employment verification
            </p>
            <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}>
              Compared against the candidate's own profile.
            </p>
            <div className="grid grid-cols-2" style={{ gap: 14, marginTop: 10 }}>
              <div>
                <Label className="text-form-label">Job title held</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label className="text-form-label">Dates</Label>
                <Input
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="e.g. Mar 2022 – Jan 2024"
                />
              </div>
            </div>
          </div>

          {questions.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p
                className="font-poppins"
                style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230', marginBottom: 10 }}
              >
                Questions
              </p>
              <div className="flex flex-col" style={{ gap: 16 }}>
                {questions.map((q, i) => (
                  <div key={q.id}>
                    <p
                      className="font-inter"
                      style={{ fontSize: 12, color: '#1F2230', marginBottom: 7 }}
                    >
                      {q.label}
                    </p>
                    <QuestionInstrument
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                      showRatingLegend={i === 0}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between"
          style={{ gap: 8, padding: '14px 20px', borderTop: '1px solid #F1F0EC' }}
        >
          <Badge tone="purple" size="sm" icon={Phone}>
            Marked recruiter-captured
          </Badge>
          <div className="flex items-center" style={{ gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canSave} loading={logReference.isPending} onClick={submit}>
              Save reference
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LogPhoneReferenceDialog
