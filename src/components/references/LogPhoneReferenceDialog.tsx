import { useEffect, useMemo, useState } from 'react'
import { Phone } from 'lucide-react'

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

/**
 * A reference the recruiter already has in hand (usually taken by phone).
 * Uses the SAME answer instruments the referee sees, so a logged reference is
 * comparable with a submitted one. No email, no token — nobody is contacted.
 */
export function LogPhoneReferenceDialog({
  open,
  onOpenChange,
  requestId,
  snapshot,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string
  /** Frozen template snapshot from the request. */
  snapshot: Record<string, any> | null
}) {
  const logReference = useLogPhoneReference()

  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [period, setPeriod] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (open) {
      setName('')
      setRelationship('')
      setTitle('')
      setCompany('')
      setPeriod('')
      setAnswers({})
    }
  }, [open])

  const questions = useMemo<PublicQuestion[]>(() => {
    const list = Array.isArray(snapshot?.questions) ? snapshot!.questions : []
    return list.map((q: any) => ({
      id: q.id,
      label: q.label,
      type: q.type,
      required: !!q.required,
      helper: q.helper,
      options: q.options,
    }))
  }, [snapshot])

  const canSave = name.trim().length > 1

  const submit = async () => {
    await logReference.mutateAsync({
      requestId,
      name: name.trim(),
      relationship: relationship || null,
      title: title.trim() || null,
      company: company.trim() || null,
      period: period.trim() || null,
      answers,
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
            <h2
              className="font-poppins"
              style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: '#0d0d09' }}
            >
              Log a phone reference
            </h2>
            <p className="font-inter" style={{ fontSize: 11.5, color: '#5A6072', marginTop: 2 }}>
              Nobody is emailed — this records a reference you already have.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ padding: 20, maxHeight: '62vh' }}>
          <div className="grid grid-cols-2" style={{ gap: 12 }}>
            <div className="col-span-2">
              <Label className="text-form-label">Referee name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
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
              <Label className="text-form-label">Period worked together</Label>
              <Input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. 2022 – 2024"
              />
            </div>
            <div>
              <Label className="text-form-label">Job title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-form-label">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>

          {questions.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p
                className="font-poppins"
                style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230', marginBottom: 10 }}
              >
                What they said
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
          className="flex items-center justify-end"
          style={{ gap: 8, padding: '14px 20px', borderTop: '1px solid #F1F0EC' }}
        >
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSave} loading={logReference.isPending} onClick={submit}>
            Save reference
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LogPhoneReferenceDialog
