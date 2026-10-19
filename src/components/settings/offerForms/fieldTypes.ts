import {
  AlignLeft,
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  CircleCheck,
  Hash,
  Link2,
  Mail,
  MapPin,
  Phone,
  Type,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type { OfferFormField } from '@/hooks/useOfferFormFields'

export type OfferFieldType = OfferFormField['field_type']

/**
 * The field types the offer composer can really fill in (OfferComposerBody's
 * renderFieldInput). Dropdown and File aren't offered: the composer shows
 * both as a plain text box. A field that already has one keeps it.
 */
export const OFFER_FIELD_TYPES: { value: OfferFieldType; label: string; icon: LucideIcon; smart?: boolean }[] = [
  { value: 'text', label: 'Short text', icon: Type },
  { value: 'textarea', label: 'Long text', icon: AlignLeft },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: CalendarDays },
  { value: 'checkbox', label: 'Yes / no', icon: CircleCheck },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'url', label: 'Link', icon: Link2 },
  { value: 'salary', label: 'Salary', icon: Banknote, smart: true },
  { value: 'location', label: 'Location', icon: MapPin, smart: true },
  { value: 'phone', label: 'Phone', icon: Phone, smart: true },
  { value: 'recruiter', label: 'Recruiter', icon: UserRound, smart: true },
  { value: 'employment_type', label: 'Employment type', icon: Briefcase, smart: true },
  { value: 'work_location', label: 'Work location', icon: Building2, smart: true },
]

const LEGACY: Partial<Record<OfferFieldType, string>> = { select: 'Dropdown', file: 'File' }

export function fieldTypeInfo(type: OfferFieldType) {
  return OFFER_FIELD_TYPES.find((t) => t.value === type) ?? { value: type, label: LEGACY[type] ?? type, icon: Type }
}

/** A sensible label when a smart type is picked before anything is typed. */
export const SMART_DEFAULT_LABEL: Partial<Record<OfferFieldType, string>> = {
  salary: 'Salary',
  location: 'Location',
  phone: 'Phone number',
  recruiter: 'Recruiter',
  employment_type: 'Employment type',
  work_location: 'Work location',
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'INR', 'BRL', 'MXN', 'SGD', 'HKD', 'NZD', 'ZAR', 'AED', 'SAR']

export const COUNTRY_CODES = [
  { code: '+1', name: 'United States / Canada' },
  { code: '+52', name: 'Mexico' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+33', name: 'France' },
  { code: '+49', name: 'Germany' },
  { code: '+34', name: 'Spain' },
  { code: '+91', name: 'India' },
  { code: '+61', name: 'Australia' },
  { code: '+55', name: 'Brazil' },
  { code: '+81', name: 'Japan' },
  { code: '+971', name: 'UAE' },
]
