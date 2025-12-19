import { Plus, X, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface ContactPhone {
  type: 'work' | 'mobile' | 'other'
  number: string
  raw_number?: string | null
}

interface ContactPhonesInputProps {
  value: ContactPhone[]
  onChange: (phones: ContactPhone[]) => void
  error?: string
}

export function ContactPhonesInput({ value, onChange, error }: ContactPhonesInputProps) {
  const addPhone = () => {
    onChange([...value, { type: 'mobile', number: '', raw_number: null }])
  }

  const removePhone = (index: number) => {
    if (value.length <= 1) return // Keep at least one row
    onChange(value.filter((_, i) => i !== index))
  }

  const updatePhone = (index: number, field: keyof ContactPhone, newValue: string) => {
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
          <Phone className="h-4 w-4 text-muted-foreground" />
          Phone Numbers
        </Label>
      </div>
      
      <div className="space-y-2">
        {value.map((phoneEntry, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                type="tel"
                value={phoneEntry.number}
                onChange={(e) => updatePhone(index, 'number', e.target.value)}
                placeholder="+1 (555) 123-4567"
                className={index === 0 ? 'border-primary/30' : ''}
              />
            </div>
            <Select
              value={phoneEntry.type}
              onValueChange={(val) => updatePhone(index, 'type', val)}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removePhone(index)}
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
        onClick={addPhone}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Phone
      </Button>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
