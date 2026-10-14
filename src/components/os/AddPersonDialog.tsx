import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMembers } from '@/hooks/useMembers'
import { useOrgContext } from '@/contexts/OrgContext'
import { appName, roleLabel, type Bundle } from '@/lib/os/peopleAccess'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Invites someone to Gio. The ATS invitation is the account; the job role's
 * ATS role is set now, and its other apps are applied from the person's page
 * once they accept (People & Access grants need an account).
 */
export function AddPersonDialog({
  open,
  onOpenChange,
  bundles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bundles: Bundle[]
}) {
  const qc = useQueryClient()
  const { organizationId } = useOrgContext()
  const { createMember } = useMembers()
  const [email, setEmail] = useState('')
  const [bundleId, setBundleId] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail('')
      setBundleId('')
      setError(undefined)
      setFormError(null)
    }
  }, [open])

  const bundle = bundles.find((b) => b.id === bundleId)
  const atsRole = (bundle?.grants.find((g) => g.app === 'ats')?.role ?? 'member') as 'admin' | 'member' | 'sales'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    const value = email.trim().toLowerCase()
    if (!EMAIL.test(value)) {
      setError('Enter a work email, like name@virgilio.tech.')
      return
    }
    if (!organizationId) {
      setFormError("Your workspace hasn't loaded yet. Try again in a moment.")
      return
    }
    setSending(true)
    setFormError(null)
    try {
      await createMember({ organization_id: organizationId, system_role: atsRole, email: value })
      await qc.invalidateQueries({ queryKey: ['os-people'] })
      toast(`Invitation sent to ${value}`, {
        description: bundle
          ? `Open their page after they accept to apply ${bundle.name}.`
          : 'They join the ATS as a Member with no jobs.',
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setFormError(
        /already exists|pending invitation/i.test(message)
          ? 'This email already has an account or a pending invitation.'
          : "Couldn't send the invitation. Try again.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
            <DialogDescription>
              They get an email invitation. Gio is invite-only, so this is the only way in.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <FormField label="Work email" error={error} required>
              <Input
                type="email"
                autoComplete="off"
                value={email}
                disabled={sending}
                aria-invalid={!!error}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error && EMAIL.test(e.target.value.trim())) setError(undefined)
                }}
                placeholder="name@virgilio.tech"
              />
            </FormField>

            <FormField label="Job role" helpText="Decides which apps they get and their role in each.">
              <Select value={bundleId} onValueChange={setBundleId} disabled={sending}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a job role" />
                </SelectTrigger>
                <SelectContent>
                  {bundles.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {bundle && (
              <ul className="space-y-1 rounded-[10px] bg-[#F7F6F2] px-3 py-2.5 font-inter text-[12px] text-[#1F2230]">
                {bundle.grants.length === 0 && <li className="text-[#6B7080]">No apps besides the ATS.</li>}
                {bundle.grants.map((g) => (
                  <li key={g.app} className="flex justify-between gap-3">
                    <span>{appName(g.app)}</span>
                    <span className="text-[#6B7080]">{roleLabel(g.app, g.role)}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role="alert">
              {formError}
            </p>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="secondary" size="md" disabled={sending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={sending}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
