import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/sign/templates/parts'
import type { OfferFormField } from '@/hooks/useOfferFormFields'
import type { LocationFieldConfig, PhoneFieldConfig, SalaryFieldConfig } from '@/hooks/useJobPostingFields'
import { COUNTRY_CODES, CURRENCIES, OFFER_FIELD_TYPES, fieldTypeInfo, type OfferFieldType } from './fieldTypes'
import type { FieldPatch } from './useOfferFormEditor'

const DEFAULT_CONFIG: Partial<Record<OfferFieldType, SalaryFieldConfig | LocationFieldConfig | PhoneFieldConfig>> = {
  salary: { currency: 'USD', period: 'annually' },
  location: { fields: ['city', 'state', 'country'] },
  phone: { defaultCountryCode: '+1' },
}

const LOCATION_PARTS = [
  ['city', 'City'],
  ['state', 'State / province'],
  ['country', 'Country'],
] as const

/**
 * One field opened in place (2026-10-19): label, type, required, the hint
 * under it, the type's own settings, and whether changing it restarts an
 * approval. Save writes it; Cancel or Esc leaves it as it was. The stored
 * name never changes, so renaming a field is safe for offers already made.
 */
export function FieldEditor({
  field,
  onSave,
  onCancel,
}: {
  field: OfferFormField
  onSave: (patch: FieldPatch) => Promise<boolean>
  onCancel: () => void
}) {
  const [label, setLabel] = useState(field.field_label)
  const [type, setType] = useState<OfferFieldType>(field.field_type)
  const [required, setRequired] = useState(field.is_required)
  const [help, setHelp] = useState(field.help_text ?? '')
  const [placeholder, setPlaceholder] = useState(field.placeholder_text ?? '')
  const [config, setConfig] = useState(field.field_config ?? DEFAULT_CONFIG[field.field_type] ?? null)
  const [restarts, setRestarts] = useState(field.triggers_approval_restart)
  const [saving, setSaving] = useState(false)
  const [missing, setMissing] = useState(false)

  const types = OFFER_FIELD_TYPES.some((t) => t.value === field.field_type)
    ? OFFER_FIELD_TYPES
    : [...OFFER_FIELD_TYPES, { ...fieldTypeInfo(field.field_type), smart: false }]
  const salary = type === 'salary' ? ((config ?? DEFAULT_CONFIG.salary) as SalaryFieldConfig) : null
  const location = type === 'location' ? ((config ?? DEFAULT_CONFIG.location) as LocationFieldConfig) : null
  const phone = type === 'phone' ? ((config ?? DEFAULT_CONFIG.phone) as PhoneFieldConfig) : null
  const typed = ['text', 'textarea', 'number', 'email', 'url'].includes(type)
  const id = `of-${field.id}`

  const save = async () => {
    if (!label.trim()) {
      setMissing(true)
      document.getElementById(`${id}-label`)?.focus()
      return
    }
    setSaving(true)
    const ok = await onSave({
      field_label: label.trim(),
      field_type: type,
      is_required: required,
      help_text: help.trim() || null,
      placeholder_text: typed ? placeholder.trim() || null : null,
      field_config: DEFAULT_CONFIG[type] ? config ?? DEFAULT_CONFIG[type]! : null,
      triggers_approval_restart: restarts,
    } as FieldPatch)
    setSaving(false)
    if (ok) onCancel()
  }

  return (
    <div
      className="border-t border-[#F1F0EC] bg-[#FBFAF7] px-4 pb-4 pt-3.5 sm:pl-11"
      data-escape-local=""
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Field label="Label" required htmlFor={`${id}-label`}>
          <Input
            id={`${id}-label`}
            value={label}
            maxLength={120}
            autoFocus
            aria-invalid={missing && !label.trim() ? true : undefined}
            onChange={(e) => {
              setLabel(e.target.value)
              if (e.target.value.trim()) setMissing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void save()
              }
            }}
          />
        </Field>
        <Field label="Type" htmlFor={`${id}-type`}>
          <Select
            value={type}
            onValueChange={(v) => {
              const next = v as OfferFieldType
              setType(next)
              setConfig(DEFAULT_CONFIG[next] ?? null)
            }}
          >
            <SelectTrigger id={`${id}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex items-center gap-2">
                    <t.icon className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                    {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Hint" optional htmlFor={`${id}-help`} help="Shown under the field when an offer is written.">
          <Input id={`${id}-help`} value={help} maxLength={200} onChange={(e) => setHelp(e.target.value)} />
        </Field>
        {typed && (
          <Field label="Placeholder" optional htmlFor={`${id}-ph`} help="Greyed text inside the empty field.">
            <Input id={`${id}-ph`} value={placeholder} maxLength={120} onChange={(e) => setPlaceholder(e.target.value)} />
          </Field>
        )}
        {salary && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency" htmlFor={`${id}-cur`}>
              <Select value={salary.currency} onValueChange={(v) => setConfig({ ...salary, currency: v })}>
                <SelectTrigger id={`${id}-cur`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Per" htmlFor={`${id}-per`}>
              <Select value={salary.period} onValueChange={(v) => setConfig({ ...salary, period: v as SalaryFieldConfig['period'] })}>
                <SelectTrigger id={`${id}-per`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hour</SelectItem>
                  <SelectItem value="monthly">Month</SelectItem>
                  <SelectItem value="annually">Year</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
        {phone && (
          <Field label="Default country code" htmlFor={`${id}-cc`}>
            <Select value={phone.defaultCountryCode || '+1'} onValueChange={(v) => setConfig({ defaultCountryCode: v })}>
              <SelectTrigger id={`${id}-cc`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="tabular-nums">{c.code}</span> · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {location && (
          <Field label="Asks for">
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5">
              {LOCATION_PARTS.map(([key, text]) => {
                const on = location.fields.includes(key)
                return (
                  <label key={key} className="flex items-center gap-2 font-inter text-[13px] text-text-primary">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(c) => {
                        const fields = c ? [...location.fields, key] : location.fields.filter((x) => x !== key)
                        if (fields.length) setConfig({ fields })
                      }}
                    />
                    {text}
                  </label>
                )
              })}
            </div>
          </Field>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
        <label className="flex items-center gap-2.5 font-inter text-[13px] text-text-primary">
          <Switch checked={required} onCheckedChange={setRequired} />
          Required
        </label>
        <label className="flex items-center gap-2.5 font-inter text-[13px] text-text-primary">
          <Switch checked={restarts} onCheckedChange={setRestarts} />
          Changing it restarts approval
        </label>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void save()} loading={saving}>
            Save field
          </Button>
        </div>
      </div>
    </div>
  )
}
