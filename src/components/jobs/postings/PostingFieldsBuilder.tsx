
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useApplicationFields } from '@/hooks/useApplicationFields'
import { useJobPostingFields, FieldType, PostingField } from '@/hooks/useJobPostingFields'
import { FormField } from '@/components/ui/form-field'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

interface PostingFieldsBuilderProps {
  postingId: string
  readOnly?: boolean
}

export function PostingFieldsBuilder({ postingId, readOnly }: PostingFieldsBuilderProps) {
  const { fields: libraryFields, isLoading: loadingLibrary } = useApplicationFields()
  const {
    fields,
    isLoading,
    refetch,
    addCustomField,
    addFieldFromLibrary,
    updateField,
    deleteField,
    moveField
  } = useJobPostingFields(postingId)

  // Add Custom Field form
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [required, setRequired] = useState(false)

  const handleAddCustom = async () => {
    if (!label.trim()) return
    await addCustomField({ field_label: label.trim(), field_type: type, is_required: required })
    setLabel('')
    setType('text')
    setRequired(false)
    await refetch()
  }

  const availableLibraryFields = useMemo(() => libraryFields, [libraryFields])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Field</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Label">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Portfolio URL"
                disabled={readOnly}
              />
            </FormField>
            <FormField label="Type">
              <Select value={type} onValueChange={(v: FieldType) => setType(v)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['text','number','email','url','textarea','select','checkbox','date','file'] as FieldType[]).map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Required">
              <div className="flex items-center h-10">
                <Checkbox checked={required} onCheckedChange={(c) => setRequired(!!c)} disabled={readOnly} />
                <span className="ml-2 text-sm text-muted-foreground">Applicants must fill this field</span>
              </div>
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAddCustom} disabled={readOnly || !label.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Add Custom Field
            </Button>
          </div>

          <div className="border-t border-border/40 pt-4">
            <p className="text-sm font-medium mb-2">Add from Library</p>
            {loadingLibrary ? (
              <p className="text-sm text-muted-foreground">Loading library...</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {availableLibraryFields.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await addFieldFromLibrary(f)
                      await refetch()
                    }}
                    disabled={readOnly}
                    className="justify-start"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="font-medium mr-2">{f.field_label}</span>
                    <span className="text-xs text-muted-foreground">({f.field_type})</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Form Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading fields...</p>
          ) : fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No fields yet. Add from library or create a custom field.</p>
          ) : (
            fields.map((f, idx) => (
              <div key={f.id} className="p-3 border border-border/40 rounded-brand">
                <div className="grid md:grid-cols-6 gap-3 items-end">
                  <FormField label="Label" className="md:col-span-2">
                    <Input
                      value={f.field_label}
                      onChange={(e) => updateField(f.id, { field_label: e.target.value })}
                      disabled={readOnly}
                    />
                  </FormField>
                  <FormField label="Type">
                    <Select
                      value={f.field_type}
                      onValueChange={(v: FieldType) => updateField(f.id, { field_type: v })}
                      disabled={readOnly}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['text','number','email','url','textarea','select','checkbox','date','file'] as FieldType[]).map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Required">
                    <div className="flex items-center h-10">
                      <Checkbox
                        checked={f.is_required}
                        onCheckedChange={(c) => updateField(f.id, { is_required: !!c })}
                        disabled={readOnly}
                      />
                      <span className="ml-2 text-sm text-muted-foreground">Required</span>
                    </div>
                  </FormField>
                  <div className="flex items-center gap-2 md:justify-end">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveField(f.id, 'up')}
                      disabled={readOnly || idx === 0}
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveField(f.id, 'down')}
                      disabled={readOnly || idx === fields.length - 1}
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        await deleteField(f.id)
                        await refetch()
                      }}
                      disabled={readOnly}
                      title="Delete field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
