import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Trash2, Edit, Save, X, Plus, DollarSign, Link2, MapPin, Phone, Users, Briefcase, Building2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SalaryFieldConfig, LocationFieldConfig, PhoneFieldConfig, FieldType, SelectOptionData } from '@/hooks/useJobPostingFields'

// ---- Shared constants ----

export const ALL_FIELD_TYPES: FieldType[] = [
  'text', 'number', 'email', 'url', 'textarea', 'select',
  'checkbox', 'checkbox_group', 'date', 'file', 'salary', 'location', 'phone', 'recruiter'
]

export const CURRENCIES = ['USD','EUR','GBP','CAD','AUD','CHF','JPY','INR','BRL','MXN','SGD','HKD','NZD','ZAR','AED','SAR']

export function fieldTypeLabel(t: string) {
  switch (t) {
    case 'checkbox_group': return 'Checkbox Group'
    case 'salary': return 'Salary'
    case 'location': return 'Location'
    case 'phone': return 'Phone'
    case 'recruiter': return 'Recruiter'
    default: return t
  }
}

// ---- Generic field shape ----

export interface FormFieldData {
  id: string
  field_label: string
  field_type: FieldType
  is_required: boolean
  help_text?: string | null
  accepted_file_types?: string | null
  max_file_size_mb?: number | null
  field_config?: SalaryFieldConfig | LocationFieldConfig | PhoneFieldConfig | null
}

export interface FormFieldEditorProps {
  field: FormFieldData
  onUpdate: (fieldId: string, updates: Partial<FormFieldData> & { select_options?: SelectOptionData[] }) => void
  onDelete: (fieldId: string) => void
  disabled?: boolean
  readOnly?: boolean
  dragHandlers?: { attributes: any; listeners: any }
  /** Extra badge shown in view mode (e.g. "Library" / "Custom") */
  sourceBadge?: string
  /** If true, editing and deleting are disabled */
  isLocked?: boolean
  /** Async callback to load select options when entering edit mode */
  loadSelectOptions?: (fieldId: string) => Promise<SelectOptionData[]>
  /** Subset of field types to show in the type selector (defaults to ALL_FIELD_TYPES) */
  availableTypes?: FieldType[]
  /** Context determines sync messaging: job_posting shows "Syncs to Profile", offer hides it */
  context?: 'job_posting' | 'offer'
}

export function FormFieldEditor({
  field,
  onUpdate,
  onDelete,
  disabled,
  readOnly,
  dragHandlers,
  sourceBadge,
  isLocked,
  loadSelectOptions,
  availableTypes = ALL_FIELD_TYPES,
  context = 'job_posting',
}: FormFieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false)

  // Local editing state
  const [localLabel, setLocalLabel] = useState(field.field_label || '')
  const [localType, setLocalType] = useState<FieldType>(field.field_type || 'text')
  const [localRequired, setLocalRequired] = useState(field.is_required || false)
  const [localHelpText, setLocalHelpText] = useState(field.help_text || '')
  const [localAcceptedFileTypes, setLocalAcceptedFileTypes] = useState(field.accepted_file_types || '')
  const [localMaxFileSize, setLocalMaxFileSize] = useState<number | ''>(field.max_file_size_mb ?? '')
  const [localOptions, setLocalOptions] = useState<SelectOptionData[]>([])
  const [localSalaryConfig, setLocalSalaryConfig] = useState<SalaryFieldConfig>({ currency: 'USD', period: 'annually' })
  const [localLocationConfig, setLocalLocationConfig] = useState<LocationFieldConfig>({ fields: ['city', 'state', 'country'] })
  const [localPhoneConfig, setLocalPhoneConfig] = useState<PhoneFieldConfig>({ defaultCountryCode: '+1' })

  const handleEdit = async () => {
    setLocalLabel(field.field_label || '')
    setLocalType(field.field_type || 'text')
    setLocalRequired(field.is_required || false)
    setLocalHelpText(field.help_text || '')
    setLocalAcceptedFileTypes(field.accepted_file_types || '')
    setLocalMaxFileSize(field.max_file_size_mb ?? '')
    setLocalSalaryConfig((field.field_config as SalaryFieldConfig) || { currency: 'USD', period: 'annually' })
    setLocalLocationConfig((field.field_config as LocationFieldConfig) || { fields: ['city', 'state', 'country'] })
    setLocalPhoneConfig((field.field_config as PhoneFieldConfig) || { defaultCountryCode: '+1' })

    if ((field.field_type === 'select' || field.field_type === 'checkbox_group') && loadSelectOptions) {
      const opts = await loadSelectOptions(field.id)
      setLocalOptions(opts)
    } else {
      setLocalOptions([])
    }

    setIsEditing(true)
  }

  const handleSave = () => {
    const getConfig = () => {
      if (localType === 'salary') return localSalaryConfig
      if (localType === 'location') return localLocationConfig
      if (localType === 'phone') return localPhoneConfig
      return null
    }
    const updates: Partial<FormFieldData> & { select_options?: SelectOptionData[] } = {
      field_label: localLabel,
      field_type: localType,
      is_required: localRequired,
      help_text: localHelpText || null,
      accepted_file_types: localAcceptedFileTypes || null,
      max_file_size_mb: localMaxFileSize === '' ? null : localMaxFileSize,
      field_config: getConfig(),
    }
    if (localType === 'select' || localType === 'checkbox_group') {
      updates.select_options = localOptions
    }
    onUpdate(field.id, updates)
    setIsEditing(false)
  }

  const handleCancel = () => setIsEditing(false)

  useEffect(() => {
    if (localType !== 'select' && localType !== 'checkbox_group') setLocalOptions([])
    if (localType !== 'file') { setLocalAcceptedFileTypes(''); setLocalMaxFileSize('') }
  }, [localType])

  const toSnakeCase = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const addOption = () => setLocalOptions(prev => [...prev, { option_value: '', option_label: '', display_order: prev.length }])
  const removeOption = (i: number) => setLocalOptions(prev => prev.filter((_, idx) => idx !== i))
  const updateOptionLabel = (i: number, label: string) =>
    setLocalOptions(prev => prev.map((o, idx) => idx === i ? { ...o, option_label: label, option_value: toSnakeCase(label) } : o))

  const showHelpText = ['text', 'number', 'email', 'url', 'textarea', 'checkbox', 'checkbox_group', 'date'].includes(localType)
  const showOptions = ['select', 'checkbox_group'].includes(localType)
  const showFileConfig = localType === 'file'
  const showSalaryConfig = localType === 'salary'
  const showLocationConfig = localType === 'location'
  const showPhoneConfig = localType === 'phone'

  const isDisabled = disabled || readOnly || isLocked

  // Smart field type badge (used in both view & edit rows)
  const isSmartField = field.field_type === 'salary' || field.field_type === 'location' || field.field_type === 'phone' || field.field_type === 'recruiter'
  const showSyncMessaging = context !== 'offer'

  return (
    <div className={cn('p-3 border border-border/40 rounded-brand flex-1', isLocked && 'bg-muted/20')}>
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          {...dragHandlers?.attributes}
          {...dragHandlers?.listeners}
          disabled={isDisabled}
          title="Drag to reorder"
          className="self-center shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              {/* Row: Label, Type, Required, Source */}
              <div className="grid md:grid-cols-6 gap-3 items-end">
                <div className="md:col-span-2">
                  <Input value={localLabel} onChange={(e) => setLocalLabel(e.target.value)} placeholder="Label" autoFocus />
                </div>
                <div>
                  <Select value={localType} onValueChange={(v: FieldType) => setLocalType(v)}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      {availableTypes.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{fieldTypeLabel(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center h-10">
                  <Checkbox checked={localRequired} onCheckedChange={(c) => setLocalRequired(c as boolean)} />
                  <span className="ml-2 text-xs text-muted-foreground">Required</span>
                </div>
                {sourceBadge && (
                  <div className="flex items-center"><span className="text-xs text-muted-foreground">{sourceBadge}</span></div>
                )}
              </div>

              {showHelpText && (
                <Input value={localHelpText} onChange={(e) => setLocalHelpText(e.target.value)} placeholder="Help text (shown below field)" />
              )}

              {showOptions && (
                <div className="space-y-2 border border-border/30 rounded-brand p-3">
                  <p className="text-xs font-medium text-muted-foreground">Options</p>
                  {localOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={opt.option_label} onChange={(e) => updateOptionLabel(i, e.target.value)} placeholder="Option label" className="flex-1" />
                      <Button variant="ghost" size="sm" onClick={() => removeOption(i)} className="shrink-0 h-8"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOption} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
                </div>
              )}

              {showFileConfig && (
                <div className="grid md:grid-cols-2 gap-3">
                  <Input value={localAcceptedFileTypes} onChange={(e) => setLocalAcceptedFileTypes(e.target.value)} placeholder="Accepted file types (e.g. .pdf,.docx)" />
                  <Input type="number" value={localMaxFileSize} onChange={(e) => setLocalMaxFileSize(e.target.value ? Number(e.target.value) : '')} placeholder="Max file size (MB)" />
                </div>
              )}

              {showSalaryConfig && (
                <SyncConfigPanel title="Syncs to Candidate Profile" description="The salary value entered by the applicant will automatically update their candidate profile's salary fields.">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Currency</p>
                      <Select value={localSalaryConfig.currency} onValueChange={(v) => setLocalSalaryConfig(prev => ({ ...prev, currency: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Period</p>
                      <Select value={localSalaryConfig.period} onValueChange={(v: any) => setLocalSalaryConfig(prev => ({ ...prev, period: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SyncConfigPanel>
              )}

              {showLocationConfig && (
                <SyncConfigPanel title="Syncs to Candidate Profile" description="The location entered by the applicant will automatically update their candidate profile's location fields (city, state, country).">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Sub-fields to include</p>
                    {([['city', 'City'], ['state', 'State / Province'], ['country', 'Country']] as const).map(([key, lbl]) => (
                      <div key={key} className="flex items-center gap-2">
                        <Checkbox
                          checked={localLocationConfig.fields.includes(key)}
                          onCheckedChange={(checked) => setLocalLocationConfig(prev => ({
                            fields: checked ? [...prev.fields, key] : prev.fields.filter(f => f !== key)
                          }))}
                        />
                        <span className="text-sm">{lbl}</span>
                      </div>
                    ))}
                  </div>
                </SyncConfigPanel>
              )}

              {showPhoneConfig && (
                <SyncConfigPanel title="Syncs to Candidate Profile" description="The phone number entered by the applicant will automatically update their candidate profile's phone field.">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Default Country Code</p>
                    <Select value={localPhoneConfig.defaultCountryCode || '+1'} onValueChange={(v) => setLocalPhoneConfig({ defaultCountryCode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PHONE_COUNTRY_CODES.map((cc) => (
                          <SelectItem key={`${cc.country}-${cc.code}`} value={cc.code}>
                            {cc.flag} {cc.code} — {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </SyncConfigPanel>
              )}

              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" onClick={handleSave} className="h-8"><Save className="h-3 w-3 mr-1" /> Save</Button>
                <Button variant="outline" size="sm" onClick={handleCancel} className="h-8"><X className="h-3 w-3 mr-1" /> Cancel</Button>
              </div>
            </div>
          ) : (
            // ---- View Mode ----
            <div className="grid md:grid-cols-6 gap-3 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-medium">{field.field_label}</div>
                {field.field_type === 'salary' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-300 gap-1"><DollarSign className="h-3 w-3" /> Salary</Badge>
                    {showSyncMessaging && <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-300 gap-1"><Link2 className="h-3 w-3" /> Syncs to Profile</Badge>}
                    {(field.field_config as SalaryFieldConfig) && (
                      <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">{(field.field_config as SalaryFieldConfig).currency} / {(field.field_config as SalaryFieldConfig).period}</Badge>
                    )}
                  </div>
                )}
                {field.field_type === 'location' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-300 gap-1"><MapPin className="h-3 w-3" /> Location</Badge>
                    {showSyncMessaging && <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-300 gap-1"><Link2 className="h-3 w-3" /> Syncs to Profile</Badge>}
                    {(field.field_config as LocationFieldConfig) && (
                      <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">{(field.field_config as LocationFieldConfig).fields?.map(f => f === 'city' ? 'City' : f === 'state' ? 'State' : 'Country').join(', ')}</Badge>
                    )}
                  </div>
                )}
                {field.field_type === 'phone' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-teal-500/10 text-teal-700 border-teal-300 gap-1"><Phone className="h-3 w-3" /> Phone</Badge>
                    {showSyncMessaging && <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-300 gap-1"><Link2 className="h-3 w-3" /> Syncs to Profile</Badge>}
                    {(field.field_config as PhoneFieldConfig)?.defaultCountryCode && (
                      <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">Default: {(field.field_config as PhoneFieldConfig).defaultCountryCode}</Badge>
                    )}
                  </div>
                )}
                {field.field_type === 'recruiter' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-300 gap-1"><Users className="h-3 w-3" /> Recruiter</Badge>
                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-300 gap-1">Team Member Selector</Badge>
                  </div>
                )}
              </div>
              {!isSmartField && (
                <div><div className="text-sm text-muted-foreground capitalize">{fieldTypeLabel(field.field_type)}</div></div>
              )}
              {isSmartField && <div />}
              <div className="flex items-center">
                <div className="text-sm text-muted-foreground">{field.is_required ? 'Required' : 'Optional'}</div>
              </div>
              <div className="flex items-center gap-2">
                {sourceBadge && <span className="text-xs text-muted-foreground">{sourceBadge}</span>}
                {!readOnly && !isLocked && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleEdit} className="h-8" disabled={disabled}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(field.id)} title="Delete field" className="h-8" disabled={disabled}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Internal UI helper ----

function SyncConfigPanel({ title, description, children, showSyncIcon = true }: { title: string; description: string; children: React.ReactNode; showSyncIcon?: boolean }) {
  return (
    <div className="bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-virgilio-purple">
        {showSyncIcon ? <Link2 className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="bg-white border border-border/40 rounded-md p-3">
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

// Compact subset used for the phone config default country code picker
const PHONE_COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+81', country: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+82', country: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+27', country: 'ZA', flag: '🇿🇦', name: 'South Africa' },
  { code: '+234', country: 'NG', flag: '🇳🇬', name: 'Nigeria' },
]
