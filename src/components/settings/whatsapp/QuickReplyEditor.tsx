import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { QuickReplyAction } from '@/hooks/useWhatsAppConfig'

interface QuickReplyEditorProps {
  actions: QuickReplyAction[]
  onChange: (actions: QuickReplyAction[]) => void
}

const MAX_BUTTONS = 3
const MAX_TITLE_LENGTH = 20

export function QuickReplyEditor({ actions, onChange }: QuickReplyEditorProps) {
  const addButton = () => {
    if (actions.length < MAX_BUTTONS) {
      onChange([...actions, { title: '' }])
    }
  }

  const removeButton = (index: number) => {
    if (actions.length > 1) {
      onChange(actions.filter((_, i) => i !== index))
    }
  }

  const updateTitle = (index: number, title: string) => {
    const updated = [...actions]
    updated[index] = { title: title.slice(0, MAX_TITLE_LENGTH) }
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Quick reply buttons</Label>
        <span className="text-[10px] text-muted-foreground">{actions.length}/{MAX_BUTTONS} buttons</span>
      </div>

      <div className="space-y-2">
        {actions.map((action, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder={`Button ${i + 1} label`}
              value={action.title}
              onChange={(e) => updateTitle(i, e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              className="h-8 text-xs"
            />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {action.title.length}/{MAX_TITLE_LENGTH}
            </span>
            {actions.length > 1 && (
              <button
                type="button"
                onClick={() => removeButton(i)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
        Recipients will see these as tap-to-reply buttons below your message.
      </p>
    </div>
  )
}
