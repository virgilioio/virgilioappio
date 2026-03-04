import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Trash2, Edit, Save, X, DollarSign, Link2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OfferFormField } from '@/hooks/useOfferFormFields'
import type { SalaryFieldConfig, LocationFieldConfig } from '@/hooks/useJobPostingFields'

type OfferFieldType = OfferFormField['field_type']

interface OfferFieldEditorProps {
  field: OfferFormField
  onUpdate: (fieldId: string, updates: Partial<OfferFormField>) => void
  onDelete: (fieldId: string) => void
  disabled?: boolean
  dragHandlers?: {
    attributes: any
    listeners: any
  }
}

const ALL_FIELD_TYPES: OfferFieldType[] = ['text', 'number', 'email', 'url', 'textarea', 'select', 'checkbox', 'date', 'file', 'salary', 'location']

export function OfferFieldEditor({
  field,
  onUpdate,
  onDelete,
  disabled,
  dragHandlers,
}: OfferFieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false)

  const [localLabel, setLocalLabel] = useState(field.field_label || '')
  const [localType, setLocalType] = useState<OfferFieldType>(field.field_type || 'text')
  const [localRequired, setLocalRequired] = useState(field.is_required || false)
  const [localHelpText, setLocalHelpText] = useState(field.help_text || '')
  const [localAcceptedFileTypes, setLocalAcceptedFileTypes] = useState(field.accepted_file_types || '')
  const [localMaxFileSize, setLocalMaxFileSize] = useState<number | ''>(field.max_file_size_mb ?? '')
  const [localSalaryConfig, setLocalSalaryConfig] = useState<SalaryFieldConfig>({ currency: 'USD', period: 'annually' })
  const [localLocationConfig, setLocalLocationConfig] = useState<LocationFieldConfig>({ fields: ['city', 'state', 'country'] })

  const handleEdit = () => {
    setLocalLabel(field.field_label || '')
    setLocalType(field.field_type || 'text')
    setLocalRequired(field.is_required || false)
    setLocalHelpText(field.help_text || '')
    setLocalAcceptedFileTypes(field.accepted_file_types || '')
    setLocalMaxFileSize(field.max_file_size_mb ?? '')
    setLocalSalaryConfig((field.field_config as SalaryFieldConfig) || { currency: 'USD', period: 'annually' })
    setLocalLocationConfig((field.field_config as LocationFieldConfig) || { fields: ['city', 'state', 'country'] })
    setIsEditing(true)
  }

  const handleSave = () => {
    onUpdate(field.id, {
      field_label: localLabel,
      field_type: localType,
      is_required: localRequired,
      help_text: localHelpText || undefined,
      accepted_file_types: localAcceptedFileTypes || undefined,
      max_file_size_mb: localMaxFileSize === '' ? undefined : localMaxFileSize,
      field_config: localType === 'salary' ? localSalaryConfig : localType === 'location' ? localLocationConfig : null,
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  useEffect(() => {
    if (localType !== 'file') {
      setLocalAcceptedFileTypes('')
      setLocalMaxFileSize('')
    }
  }, [localType])

  const showHelpText = ['text', 'number', 'email', 'url', 'textarea', 'checkbox', 'date'].includes(localType)
  const showFileConfig = localType === 'file'
  const showSalaryConfig = localType === 'salary'
  const showLocationConfig = localType === 'location'

  return (
    <div className="p-3 border border-border/40 rounded-brand flex-1">
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          {...dragHandlers?.attributes}
          {...dragHandlers?.listeners}
          disabled={disabled}
          title="Drag to reorder"
          className="self-center shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid md:grid-cols-6 gap-3 items-end">
                <div className="md:col-span-2">
                  <Input
                    value={localLabel}
                    onChange={(e) => setLocalLabel(e.target.value)}
                    placeholder="Label"
                    autoFocus
                  />
                </div>
                <div>
                  <Select value={localType} onValueChange={(v: OfferFieldType) => setLocalType(v)}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      {ALL_FIELD_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t === 'salary' ? 'Salary' : t === 'location' ? 'Location' : t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center h-10">
                  <Checkbox
                    checked={localRequired}
                    onCheckedChange={(checked) => setLocalRequired(checked as boolean)}
                  />
                  <span className="ml-2 text-xs text-muted-foreground">Required</span>
                </div>
              </div>

              {showHelpText && (
                <Input
                  value={localHelpText}
                  onChange={(e) => setLocalHelpText(e.target.value)}
                  placeholder="Help text (shown below field)"
                />
              )}

              {showFileConfig && (
                <div className="grid md:grid-cols-2 gap-3">
                  <Input
                    value={localAcceptedFileTypes}
                    onChange={(e) => setLocalAcceptedFileTypes(e.target.value)}
                    placeholder="Accepted file types (e.g. .pdf,.docx)"
                  />
                  <Input
                    type="number"
                    value={localMaxFileSize}
                    onChange={(e) => setLocalMaxFileSize(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Max file size (MB)"
                  />
                </div>
              )}

              {showSalaryConfig && (
                <div className="bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-virgilio-purple">
                    <Link2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Salary Configuration</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Currency</p>
                      <Select value={localSalaryConfig.currency} onValueChange={(v) => setLocalSalaryConfig(prev => ({ ...prev, currency: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['USD','EUR','GBP','CAD','AUD','CHF','JPY','INR','BRL','MXN','SGD','HKD','NZD','ZAR','AED','SAR'].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
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
                </div>
              )}

              {showLocationConfig && (
                <div className="bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-virgilio-purple">
                    <Link2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Location Configuration</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Sub-fields to include</p>
                    {([['city', 'City'], ['state', 'State / Province'], ['country', 'Country']] as const).map(([key, lbl]) => (
                      <div key={key} className="flex items-center gap-2">
                        <Checkbox
                          checked={localLocationConfig.fields.includes(key)}
                          onCheckedChange={(checked) => {
                            setLocalLocationConfig(prev => ({
                              fields: checked
                                ? [...prev.fields, key]
                                : prev.fields.filter(f => f !== key)
                            }))
                          }}
                        />
                        <span className="text-sm">{lbl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" onClick={handleSave} className="h-8">
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancel} className="h-8">
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-6 gap-3 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-medium">{field.field_label}</div>
                {field.field_type === 'salary' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-300 gap-1">
                      <DollarSign className="h-3 w-3" /> Salary
                    </Badge>
                    {(field.field_config as SalaryFieldConfig) && (
                      <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                        {(field.field_config as SalaryFieldConfig).currency} / {(field.field_config as SalaryFieldConfig).period}
                      </Badge>
                    )}
                  </div>
                )}
                {field.field_type === 'location' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-300 gap-1">
                      <MapPin className="h-3 w-3" /> Location
                    </Badge>
                    {(field.field_config as LocationFieldConfig) && (
                      <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                        {(field.field_config as LocationFieldConfig).fields?.map(f => f === 'city' ? 'City' : f === 'state' ? 'State' : 'Country').join(', ')}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              {field.field_type !== 'salary' && field.field_type !== 'location' && (
                <div>
                  <div className="text-sm text-muted-foreground capitalize">{field.field_type}</div>
                </div>
              )}
              {(field.field_type === 'salary' || field.field_type === 'location') && <div />}
              <div className="flex items-center">
                <div className="text-sm text-muted-foreground">
                  {field.is_required ? 'Required' : 'Optional'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleEdit} className="h-8" disabled={disabled}>
                  <Edit className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDelete(field.id)} title="Delete field" className="h-8" disabled={disabled}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
