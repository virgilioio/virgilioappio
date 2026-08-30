/**
 * Reference check templates — shared model, defaults and catalogs.
 *
 * Questions use the `reference_answer_type` enum created in Phase 1. Reference
 * checks deliberately carry their own type set so reference-only values can
 * never reach scorecard rendering paths (which have no case for them).
 */
import type { Database } from '@/integrations/supabase/types'

export type ReferenceAnswerType = Database['public']['Enums']['reference_answer_type']
export type ReferenceTemplateScope = Database['public']['Enums']['reference_template_scope']

/**
 * Referee fields carry their OWN type set — deliberately separate from the
 * question types in Section 3 and from the scorecard `field_type` enum. These
 * describe contact + relationship data the candidate supplies about a referee.
 */
export type ReferenceFieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'link'
  | 'select'
  | 'multi_select'
  | 'yes_no'
  | 'date'
  | 'date_range'
  | 'number'
  | 'rating'

/** @deprecated legacy alias — stored rows are normalised on hydrate. */
export type RefereeFieldType = ReferenceFieldType

export type ReferenceFieldPrecision = 'month_year' | 'full_date'

export interface RefereeField {
  id: string
  key: string
  label: string
  type: ReferenceFieldType
  required: boolean
  helper?: string
  options?: string[]
  /** Cannot be deleted or dragged — there is no way to reach a referee without it. */
  locked?: boolean
  precision?: ReferenceFieldPrecision
  scale?: 5 | 10
  min?: string
  max?: string
  maxlen?: string
}


export interface RefQuestion {
  id: string
  label: string
  type: ReferenceAnswerType
  required: boolean
  /** Referee never sees it — recruiter-only note field. */
  internal: boolean
  /** Candidate answers the same question about themselves (rating_1_5 only). */
  ask_candidate_too: boolean
  helper?: string
  options?: string[]
  /** yes_no only — when true, answering "Yes" is the concern (tone flips). */
  invert?: boolean
  /** number only — e.g. "direct reports". */
  unit?: string
  /** date / date_range only. */
  precision?: ReferenceFieldPrecision
}


export interface RelationshipRule {
  id: string
  count: number
  relationship: string
  enforced: boolean
}

export interface RefEmail {
  subject: string
  body: string
}

export interface RefReminders {
  enabled: boolean
  candidate_first_after_days: number
  candidate_every_days: number
  referee_first_after_days: number
  referee_max: number
}

export interface ReferenceTemplate {
  id: string
  tenant_id: string
  name: string
  scope: ReferenceTemplateScope
  client_id: string | null
  is_live: boolean
  min_referees: number
  max_referees: number
  /** Hiring stages that normally collect references — configuration, not code. */
  collect_at_stages: string[]
  relationship_rules: RelationshipRule[]
  referee_fields: RefereeField[]
  questions: RefQuestion[]
  candidate_email: RefEmail | null
  referee_email: RefEmail | null
  candidate_link_days: number
  referee_link_days: number
  reminders: RefReminders | null
  consent_text: string | null
  retention_months: number
  privacy_notice_id: string | null
  times_used: number
  created_at: string
  updated_at: string
  updated_by: string | null
}

export const RELATIONSHIP_OPTIONS = [
  'Direct manager',
  'Skip-level manager',
  'Peer',
  'Direct report',
  'Client',
  'Other',
] as const

export const DEFAULT_COLLECT_AT_STAGES = ['Final interview', 'Offer']

const uid = () => Math.random().toString(36).slice(2, 10)

/** Seed set for a brand-new template. Rows 1–2 are locked — see §7. */
export function defaultRefereeFields(): RefereeField[] {
  return [
    { id: uid(), key: 'name', label: 'Full name', type: 'short_text', required: true, locked: true },
    {
      id: uid(),
      key: 'email',
      label: 'Work email',
      type: 'email',
      required: true,
      locked: true,
      helper: 'Company address preferred',
    },
    { id: uid(), key: 'phone', label: 'Phone', type: 'phone', required: false },
    { id: uid(), key: 'company', label: 'Company', type: 'short_text', required: true },
    { id: uid(), key: 'title', label: 'Job title', type: 'short_text', required: true },
    {
      id: uid(),
      key: 'relationship',
      label: 'Relationship to candidate',
      type: 'select',
      required: true,
      options: [...RELATIONSHIP_OPTIONS],
    },
    {
      id: uid(),
      key: 'period',
      label: 'Period you worked together',
      type: 'date_range',
      required: true,
      precision: 'month_year',
    },
  ]
}

export type ReferenceFieldGroup = 'text' | 'choice' | 'datenum'
export type ReferenceFieldConfig = 'options' | 'precision' | 'range' | 'scale' | 'maxlen'

export interface ReferenceFieldTypeMeta {
  type: ReferenceFieldType
  label: string
  group: ReferenceFieldGroup
  /** Tooltip hint carried on the picker chip's `title`. */
  hint: string
}

export const REFERENCE_FIELD_GROUPS: { id: ReferenceFieldGroup; heading: string }[] = [
  { id: 'text', heading: 'Text & contact' },
  { id: 'choice', heading: 'Choice' },
  { id: 'datenum', heading: 'Date & number' },
]

export const REFERENCE_FIELD_TYPES: ReferenceFieldTypeMeta[] = [
  { type: 'short_text', label: 'Short text', group: 'text', hint: 'One line' },
  { type: 'long_text', label: 'Long text', group: 'text', hint: 'Paragraph' },
  { type: 'email', label: 'Email', group: 'text', hint: 'Validated address' },
  { type: 'phone', label: 'Phone', group: 'text', hint: 'With country code' },
  { type: 'link', label: 'Link', group: 'text', hint: 'LinkedIn, company page' },
  { type: 'select', label: 'Select', group: 'choice', hint: 'Pick one' },
  { type: 'multi_select', label: 'Multi-select', group: 'choice', hint: 'Pick several' },
  { type: 'yes_no', label: 'Yes / no', group: 'choice', hint: 'Two options' },
  { type: 'date', label: 'Date', group: 'datenum', hint: 'Single date' },
  { type: 'date_range', label: 'Date range', group: 'datenum', hint: 'From and to' },
  { type: 'number', label: 'Number', group: 'datenum', hint: 'Numeric only' },
  { type: 'rating', label: 'Rating', group: 'datenum', hint: 'Rarely used here' },
]

export const REFERENCE_FIELD_LABEL: Record<ReferenceFieldType, string> =
  REFERENCE_FIELD_TYPES.reduce(
    (acc, t) => ({ ...acc, [t.type]: t.label }),
    {} as Record<ReferenceFieldType, string>,
  )

/** Which config controls the inline editor shows per type. */
export const FIELD_CONFIG: Record<ReferenceFieldType, ReferenceFieldConfig[]> = {
  select: ['options'],
  multi_select: ['options'],
  date: ['precision'],
  date_range: ['precision'],
  number: ['range'],
  rating: ['scale'],
  short_text: ['maxlen'],
  yes_no: [],
  long_text: [],
  email: [],
  phone: [],
  link: [],
}

export function newRefereeField(type: ReferenceFieldType): RefereeField {
  const base: RefereeField = {
    id: uid(),
    key: `field_${uid()}`,
    label: '',
    type,
    required: false,
  }
  if (type === 'select' || type === 'multi_select') base.options = ['', '']
  if (type === 'date' || type === 'date_range') base.precision = 'month_year'
  if (type === 'rating') base.scale = 5
  return base
}

const LEGACY_TYPE_MAP: Record<string, ReferenceFieldType> = {
  text: 'short_text',
  textarea: 'long_text',
  url: 'link',
  single_select: 'select',
}

export function normalizeRefereeFieldType(type: string): ReferenceFieldType {
  if (LEGACY_TYPE_MAP[type]) return LEGACY_TYPE_MAP[type]
  return (REFERENCE_FIELD_LABEL as Record<string, string>)[type]
    ? (type as ReferenceFieldType)
    : 'short_text'
}

const LOCKED_KEYS = ['name', 'email']

/** Rows persisted before the new type set still hydrate into the typed model. */
export function normalizeRefereeField(raw: any): RefereeField {
  const type = normalizeRefereeFieldType(String(raw?.type ?? 'short_text'))
  return {
    ...raw,
    type,
    locked: raw?.locked ?? LOCKED_KEYS.includes(raw?.key),
    precision:
      type === 'date' || type === 'date_range' ? (raw?.precision ?? 'month_year') : raw?.precision,
  }
}



export const WOULD_REHIRE_OPTIONS = [
  'Yes without hesitation',
  'Yes with reservations',
  'No',
] as const

export interface QuestionTypeMeta {
  type: ReferenceAnswerType
  label: string
  family: 'standard' | 'reference'
  /** Short description shown in the picker. */
  hint?: string
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  { type: 'rating_1_5', label: 'Rating', family: 'standard', hint: '1–5 scale' },
  { type: 'single_select', label: 'Select', family: 'standard', hint: 'One option' },
  { type: 'multi_select', label: 'Multi-select', family: 'standard', hint: 'Several options' },
  { type: 'yes_no', label: 'Yes / no', family: 'standard' },
  { type: 'short_text', label: 'Short text', family: 'standard' },
  { type: 'long_text', label: 'Long text', family: 'standard' },
  { type: 'section_header', label: 'Section header', family: 'standard', hint: 'Not a question' },
  {
    type: 'employment_verification',
    label: 'Employment verification',
    family: 'reference',
    hint: 'Captures title + dates. Capture only — no automated comparison.',
  },
  {
    type: 'would_rehire',
    label: 'Would you rehire?',
    family: 'reference',
    hint: 'Fixed options',
  },
  { type: 'number', label: 'Number', family: 'standard', hint: 'Numeric only' },
  { type: 'date', label: 'Date', family: 'standard', hint: 'Single date' },
  { type: 'date_range', label: 'Date range', family: 'standard', hint: 'From and to' },
  {
    type: 'recommendation_score',
    label: 'Recommendation score',
    family: 'reference',
    hint: '10-point scale',
  },
]

export const QUESTION_TYPE_LABEL: Record<ReferenceAnswerType, string> = QUESTION_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.type]: t.label }),
  {} as Record<ReferenceAnswerType, string>,
)

/**
 * "Ask candidate" is enabled ONLY on rating_1_5 — the one type carrying the same
 * 1–5 scale on both sides, which is what makes the two answers comparable.
 * recommendation_score is excluded on purpose: it runs on a 10-point scale, and
 * "recommend yourself" is not a question a candidate can answer meaningfully.
 */
export const ASK_CANDIDATE_DISABLED_TOOLTIP = 'Only 1–5 rating questions can be compared.'
export function canAskCandidate(type: ReferenceAnswerType): boolean {
  return type === 'rating_1_5'
}

export function newQuestion(type: ReferenceAnswerType): RefQuestion {
  return {
    id: uid(),
    label: '',
    type,
    required: type !== 'section_header',
    internal: false,
    ask_candidate_too: false,
    options:
      type === 'would_rehire'
        ? [...WOULD_REHIRE_OPTIONS]
        : type === 'single_select' || type === 'multi_select'
          ? ['Option 1', 'Option 2']
          : undefined,
    precision: type === 'date' || type === 'date_range' ? 'month_year' : undefined,
  }
}

export function defaultQuestions(): RefQuestion[] {
  return [
    {
      ...newQuestion('employment_verification'),
      label: 'Employment verification',
      helper: 'Dates and title — captured for the record, not auto-compared',
    },
    { ...newQuestion('short_text'), label: 'Your job title at the time' },
    {
      ...newQuestion('single_select'),
      label: 'How did you work together?',
      options: ['I managed them', 'We were peers', 'They managed me', 'They were my client'],
    },
    {
      ...newQuestion('multi_select'),
      label: 'Which areas did they own?',
      required: false,
      options: ['Reporting', 'Budgeting', 'Audit', 'Team leadership', 'Systems'],
    },
    {
      ...newQuestion('number'),
      label: 'How many people did they manage?',
      required: false,
      unit: 'direct reports',
    },
    {
      ...newQuestion('rating_1_5'),
      label: 'How would you rate their technical ability?',
      ask_candidate_too: true,
    },
    { ...newQuestion('rating_1_5'), label: 'How would you rate their reliability?' },
    { ...newQuestion('rating_1_5'), label: 'Handles conflict well', ask_candidate_too: true },
    { ...newQuestion('would_rehire'), label: 'Would you rehire this person?' },
    { ...newQuestion('recommendation_score'), label: 'Recommendation score' },
    {
      ...newQuestion('yes_no'),
      label: 'Any concerns we should know about?',
      invert: true,
    },
    {
      ...newQuestion('date'),
      label: 'Last day you worked together',
      required: false,
    },
    { ...newQuestion('long_text'), label: 'In what capacity did you work with the candidate?' },
    {
      ...newQuestion('long_text'),
      label: 'Anything a future employer should know?',
      required: false,
    },
    {
      ...newQuestion('long_text'),
      label: 'Internal note on this referee',
      required: false,
      internal: true,
    },
  ]
}


export const CANDIDATE_PLACEHOLDERS = [
  'candidate_first_name',
  'candidate_name',
  'job_title',
  'client_name',
  'referee_count',
  'secure_link',
  'recruiter_name',
  'expiry_date',
] as const

export const REFEREE_PLACEHOLDERS = [
  'referee_first_name',
  'candidate_name',
  'job_title',
  'client_name',
  'estimated_minutes',
  'secure_link',
  'recruiter_name',
  'expiry_date',
] as const

export const PLACEHOLDER_SAMPLES: Record<string, string> = {
  candidate_first_name: 'Priya',
  candidate_name: 'Priya Raman',
  referee_first_name: 'Dami',
  job_title: 'Senior Financial Controller',
  client_name: 'Meridian Foods',
  referee_count: '3',
  estimated_minutes: '8',
  secure_link: 'https://app.gogio.io/r/8f3a…',
  recruiter_name: 'Allan Bravo',
  expiry_date: '4 September 2026',
}

/** Preview recipients shown in the Emails section. */
export const PREVIEW_RECIPIENTS = {
  candidate: 'priya.raman@gmail.com',
  referee: 'd.okonjo@meridianfoods.com',
} as const

export const PREVIEW_CTA = {
  candidate: 'Add your references',
  referee: 'Answer the reference',
} as const

export function renderPlaceholders(text: string): string {
  return (text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) => PLACEHOLDER_SAMPLES[key] ?? m)
}

export function defaultCandidateEmail(): RefEmail {
  return {
    subject: '{{candidate_first_name}}, we need your references for {{job_title}}',
    body:
      'Hi {{candidate_first_name}},\n\n' +
      "We're at the final stage for the {{job_title}} role at {{client_name}}. To move forward we need {{referee_count}} references.\n\n" +
      "Please add their details using the secure link below. You'll be asked to confirm you have their permission first, and you can flag anyone we shouldn't contact yet.\n\n" +
      '{{secure_link}}\n\n' +
      'Thanks,\n{{recruiter_name}}',
  }
}

export function defaultRefereeEmail(): RefEmail {
  return {
    subject: '{{candidate_name}} listed you as a reference',
    body:
      'Hi {{referee_first_name}},\n\n' +
      '{{candidate_name}} has listed you as a reference for a {{job_title}} role with {{client_name}}.\n\n' +
      'It takes about {{estimated_minutes}} minutes. Your answers are shared with the hiring team and never with the candidate.\n\n' +
      '{{secure_link}}\n\n' +
      "If you'd rather not take part, you can decline on that page.\n\n" +
      '{{recruiter_name}}',
  }
}

export function defaultReminders(): RefReminders {
  return {
    enabled: true,
    candidate_first_after_days: 3,
    candidate_every_days: 4,
    referee_first_after_days: 2,
    referee_max: 3,
  }
}

export const DEFAULT_CONSENT_TEXT =
  "I confirm that I have asked each person listed above for their permission to be contacted as a reference, and that the details I've provided are accurate."


export const PRIVACY_NOTICES = [
  { id: 'gdpr_standard', label: 'Gio standard notice (EU/UK)' },
  { id: 'uk_gdpr', label: 'UK GDPR privacy notice' },
  { id: 'us_standard', label: 'US standard privacy notice' },
] as const

export function newTemplateDraft(tenantId: string): Omit<ReferenceTemplate, 'id' | 'created_at' | 'updated_at' | 'updated_by' | 'times_used'> {
  return {
    tenant_id: tenantId,
    name: 'New reference template',
    scope: 'default',
    client_id: null,
    is_live: false,
    min_referees: 2,
    max_referees: 3,
    collect_at_stages: [...DEFAULT_COLLECT_AT_STAGES],
    relationship_rules: [
      { id: uid(), count: 1, relationship: 'Direct manager', enforced: true },
    ],
    referee_fields: defaultRefereeFields(),
    questions: defaultQuestions(),
    candidate_email: defaultCandidateEmail(),
    referee_email: defaultRefereeEmail(),
    candidate_link_days: 14,
    referee_link_days: 21,
    reminders: defaultReminders(),
    consent_text: DEFAULT_CONSENT_TEXT,
    retention_months: 24,
    privacy_notice_id: 'gdpr_standard',
  }
}

export function isComplianceReady(t: Pick<ReferenceTemplate, 'consent_text' | 'privacy_notice_id' | 'retention_months'>) {
  const consentOk = !!t.consent_text && t.consent_text.trim().length > 0
  const privacyOk = !!t.privacy_notice_id
  const retentionOk = !!t.retention_months && t.retention_months > 0
  return { consentOk, privacyOk, retentionOk, ready: consentOk && privacyOk && retentionOk }
}

export const makeId = uid
