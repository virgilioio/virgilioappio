import { Plus, X, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface ContactEmail {
  type: 'work' | 'personal' | 'other'
  email: string
  status?: string | null
}

interface ContactEmailsInputProps {
  value: ContactEmail[]
  onChange: (emails: ContactEmail[]) => void
  error?: string
}

export function ContactEmailsInput({ value, onChange, error }: ContactEmailsInputProps) {
  const addEmail = () => {
    onChange([...value, { type: 'work', email: '', status: null }])
  }

  const removeEmail = (index: number) => {
    if (value.length <= 1) return // Keep at least one row
    onChange(value.filter((_, i) => i !== index))
  }

  const updateEmail = (index: number, field: keyof ContactEmail, newValue: string) => {
    const updated = value.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: newValue }
      }
      return item
    })
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email Addresses
        </Label>
      </div>
      
      <div className="space-y-2">
        {value.map((emailEntry, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                type="email"
                value={emailEntry.email}
                onChange={(e) => updateEmail(index, 'email', e.target.value)}
                placeholder="email@example.com"
                className={index === 0 ? 'border-primary/30' : ''}
              />
            </div>
            <Select
              value={emailEntry.type}
              onValueChange={(val) => updateEmail(index, 'type', val)}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeEmail(index)}
              disabled={value.length <= 1}
              className="h-10 w-10 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addEmail}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Email
      </Button>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
