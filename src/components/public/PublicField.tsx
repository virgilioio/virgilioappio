/** Label + control primitive for the public reference pages. */
import { useEffect, useState, type ReactNode } from 'react'
import { COUNTRY_CODES, parsePhoneValue } from '@/components/ui/phone-input'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { MonthPicker } from '@/components/ui/month-picker'
import { format } from 'date-fns'

/** Trigger styling shared by the public date/month pickers. */
const dateTriggerClass =
  'w-full h-[38px] rounded-[9px] border-[#E3E0D6] bg-white px-[11px] font-inter text-[13px] text-[#1F2230] shadow-none hover:bg-white hover:border-[#D7C5FB]'

function parseDateString(value: string | undefined, day: 'first' | 'exact'): Date | undefined {
  if (!value) return undefined
  const m = day === 'exact' ? /^(\d{4})-(\d{2})-(\d{2})$/ : /^(\d{4})-(\d{2})/
  const match = value.match(m)
  if (!match) return undefined
  const d = new Date(Number(match[1]), Number(match[2]) - 1, day === 'exact' ? Number(match[3]) : 1)
  return isNaN(d.getTime()) ? undefined : d
}

/**
 * Canonical DatePickerVirgilio in the public pages' chrome.
 * Value is a `yyyy-MM-dd` string, or '' when empty.
 */
export function PublicDateField({
  value,
  onChange,
  onBlur,
  placeholder = 'Pick a date',
}: {
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  return (
    <DatePickerVirgilio
      value={parseDateString(value, 'exact')}
      onChange={(d) => {
        onChange(format(d, 'yyyy-MM-dd'))
        onBlur?.()
      }}
      placeholder={placeholder}
      className={dateTriggerClass}
    />
  )
}

/**
 * Canonical MonthPicker in the public pages' chrome.
 * Value is a `yyyy-MM` string, or '' when empty.
 */
export function PublicMonthField({
  value,
  onChange,
  onBlur,
  placeholder = 'Pick a month',
}: {
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  return (
    <MonthPicker
      selected={parseDateString(value, 'first')}
      onSelect={(d) => {
        onChange(d ? format(d, 'yyyy-MM') : '')
        onBlur?.()
      }}
      placeholder={placeholder}
      className={dateTriggerClass}
    />
  )
}

const controlStyle: React.CSSProperties = {
  height: 38,
  width: '100%',
  borderRadius: 9,
  border: '1px solid #E3E0D6',
  background: '#fff',
  padding: '0 11px',
  fontSize: 13,
  color: '#1F2230',
  outline: 'none',
}

export function PublicField({
  label,
  required,
  helper,
  children,
}: {
  label: string
  required?: boolean
  helper?: string
  children: ReactNode
}) {
  return (
    <label className="block" style={{ minWidth: 0 }}>
      <span
        className="font-inter block"
        style={{ fontSize: 11.5, fontWeight: 500, color: '#5A6072', marginBottom: 5 }}
      >
        {label}
        {required && <span style={{ color: '#E8590C' }}> *</span>}
      </span>
      {children}
      {helper && (
        <span className="font-inter block" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 4 }}>
          {helper}
        </span>
      )}
    </label>
  )
}

export function PublicInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="font-inter" style={{ ...controlStyle, ...props.style }} />
}

export function PublicSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="font-inter"
      style={{ ...controlStyle, appearance: 'none', ...props.style }}
    />
  )
}

export function PublicTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="font-inter"
      style={{
        ...controlStyle,
        height: 'auto',
        minHeight: 96,
        padding: '10px 11px',
        lineHeight: 1.55,
        resize: 'vertical',
        ...props.style,
      }}
    />
  )
}

/**
 * Dial-code + subscriber split, in the public pages' inline-style chrome.
 * Emits E.164 (`+<code><digits>`) or '' when empty. Codes/parsing shared with
 * the app-wide PhoneInput.
 */
export function PublicPhoneField({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  const parsed = parsePhoneValue(value ?? '')
  const [code, setCode] = useState(parsed.countryCode)
  const [number, setNumber] = useState(parsed.number)

  useEffect(() => {
    const p = parsePhoneValue(value ?? '')
    setCode(p.countryCode)
    setNumber(p.number)
  }, [value])

  const emit = (nextCode: string, nextNumber: string) => {
    const clean = nextNumber.replace(/\D/g, '')
    onChange(clean ? `${nextCode}${clean}` : '')
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select
        className="font-inter"
        aria-label="Country code"
        value={code}
        onChange={(e) => {
          setCode(e.target.value)
          emit(e.target.value, number)
        }}
        onBlur={onBlur}
        style={{ ...controlStyle, width: 92, flex: '0 0 auto', appearance: 'none', padding: '0 8px' }}
      >
        {COUNTRY_CODES.map((c, i) => (
          <option key={`${c.country}-${c.code}-${i}`} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
      <input
        className="font-inter"
        type="tel"
        value={number}
        placeholder={placeholder}
        onChange={(e) => {
          const display = e.target.value.replace(/[^\d\s-]/g, '')
          setNumber(display)
          emit(code, display)
        }}
        onBlur={onBlur}
        style={{ ...controlStyle, flex: 1, minWidth: 0 }}
      />
    </div>
  )
}
