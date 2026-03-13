import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CallToActionAction } from '@/hooks/useWhatsAppConfig'

interface CallToActionEditorProps {
  actions: CallToActionAction[]
  onChange: (actions: CallToActionAction[]) => void
}

const MAX_BUTTONS = 2
const MAX_TITLE_LENGTH = 20

export function CallToActionEditor({ actions, onChange }: CallToActionEditorProps) {
  const addButton = () => {
    if (actions.length < MAX_BUTTONS) {
      onChange([...actions, { type: 'URL', title: '', url: '' }])
    }
  }

  const removeButton = (index: number) => {
    if (actions.length > 1) {
      onChange(actions.filter((_, i) => i !== index))
    }
  }

  const updateAction = (index: number, updates: Partial<CallToActionAction>) => {
    const updated = [...actions]
    const current = { ...updated[index], ...updates }

    // When switching type, reset the value field
    if (updates.type && updates.type !== updated[index].type) {
      if (updates.type === 'URL') {
        current.url = ''
        current.phone = undefined
      } else {
        current.phone = ''
        current.url = undefined
      }
    }

    if (current.title) {
      current.title = current.title.slice(0, MAX_TITLE_LENGTH)
    }

    updated[index] = current
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Call-to-action buttons</Label>
        <span className="text-[10px] text-muted-foreground">{actions.length}/{MAX_BUTTONS} buttons</span>
      </div>

      <div className="space-y-3">
        {actions.map((action, i) => (
          <div key={i} className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Button {i + 1}
              </span>
              {actions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeButton(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-2">
              <Select
                value={action.type}
                onValueChange={(v) => updateAction(i, { type: v as 'URL' | 'PHONE_NUMBER' })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="URL">URL</SelectItem>
                  <SelectItem value="PHONE_NUMBER">Phone</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Button label"
                value={action.title}
                onChange={(e) => updateAction(i, { title: e.target.value })}
                maxLength={MAX_TITLE_LENGTH}
                className="h-8 text-xs"
              />
            </div>

            {action.type === 'URL' ? (
              <Input
                placeholder="https://example.com/apply"
                value={action.url || ''}
                onChange={(e) => updateAction(i, { url: e.target.value })}
                className="h-8 text-xs"
              />
            ) : (
              <Input
                placeholder="+1234567890"
                value={action.phone || ''}
                onChange={(e) => updateAction(i, { phone: e.target.value })}
                className="h-8 text-xs"
              />
            )}
          </div>
        ))}
      </div>

      {actions.length < MAX_BUTTONS && (
        <Button type="button" variant="outline" size="sm" onClick={addButton} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add button
        </Button>
      )}

      <p className="text-[10px] text-muted-foreground">
        URL buttons open a link; Phone buttons initiate a call.
      </p>
    </div>
  )
}
