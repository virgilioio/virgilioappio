import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Check, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StageConfiguration } from '@/hooks/useStageConfiguration'

interface BasicsTabProps {
  config: StageConfiguration
  onSave: (customName: string | null) => Promise<void>
  isSaving: boolean
}

type Duration = 15 | 30 | 45 | 60 | 90
type Format = 'video' | 'phone' | 'onsite'

const DURATIONS: Duration[] = [15, 30, 45, 60, 90]
const FORMATS: { key: Format; label: string }[] = [
  { key: 'video', label: 'Video call' },
  { key: 'phone', label: 'Phone' },
  { key: 'onsite', label: 'On-site' },
]

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  format,
}: {
  value: T
  options: T[]
  onChange: (v: T) => void
  format?: (v: T) => string
}) {
  return (
    <div
      className="flex w-full"
      style={{ background: '#F1F0EC', borderRadius: 8, padding: 2 }}
    >
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'flex-1 font-poppins font-medium transition-all',
              active ? 'text-[#1F2230]' : 'text-[#5A6072] hover:text-[#1F2230]'
            )}
            style={{
              fontSize: 12,
              padding: '6px 8px',
              borderRadius: 6,
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(13,13,9,0.06)' : 'none',
            }}
          >
            {format ? format(opt) : opt}
          </button>
        )
      })}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-poppins font-semibold mb-2.5"
      style={{ fontSize: 12.5, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase' }}
    >
      {children}
    </h3>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        padding: 18,
      }}
    >
      {children}
    </div>
  )
}

export function BasicsTab({ config, onSave, isSaving }: BasicsTabProps) {
  const [customName, setCustomName] = useState(config.customStageName || '')
  const [hasChanges, setHasChanges] = useState(false)
  const [duration, setDuration] = useState<Duration>(45)
  const [format, setFormat] = useState<Format>('video')
  const [slaEnabled, setSlaEnabled] = useState(true)
  const [slaDays, setSlaDays] = useState(5)
  const [instructions, setInstructions] = useState('')

  useEffect(() => {
    setHasChanges(customName.trim() !== (config.customStageName || ''))
  }, [customName, config.customStageName])

  const handleSave = async () => {
    await onSave(customName.trim() || null)
    setHasChanges(false)
  }

  return (
    <div className="space-y-6">
      {/* Stage information */}
      <section>
        <SectionTitle>Stage information</SectionTitle>
        <Card>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div
                className="font-poppins font-semibold mb-1"
                style={{ fontSize: 10.5, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                Default name
              </div>
              <div className="font-inter" style={{ fontSize: 13, fontWeight: 500, color: '#1F2230' }}>
                {config.stageName}
              </div>
            </div>
            <div>
              <div
                className="font-poppins font-semibold mb-1"
                style={{ fontSize: 10.5, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                Type
              </div>
              <Badge tone="blue" size="xs">
                {config.stageType.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          {config.stageDescription && (
            <>
              <div className="my-4" style={{ height: 1, background: '#F1F0EC' }} />
              <div
                className="font-poppins font-semibold mb-1"
                style={{ fontSize: 10.5, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                Description
              </div>
              <div className="font-inter" style={{ fontSize: 13, color: '#1F2230' }}>
                {config.stageDescription}
              </div>
            </>
          )}
        </Card>
      </section>

      {/* Custom stage name */}
      <section>
        <SectionTitle>Custom stage name</SectionTitle>
        <Card>
          <label
            className="block font-inter mb-1.5"
            style={{ fontSize: 12, fontWeight: 500, color: '#1F2230' }}
            htmlFor="custom-stage-name"
          >
            Stage name for this job
          </label>
          <Input
            id="custom-stage-name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={config.stageName}
            disabled={isSaving}
            style={{ borderColor: '#E0DDD3' }}
          />
          <p className="font-inter mt-1.5" style={{ fontSize: 12, color: '#8B8F9E' }}>
            Leave empty to use the default name "{config.stageName}".
          </p>
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomName('')
                setHasChanges(true)
              }}
              disabled={!customName || isSaving}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset to default
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || isSaving} size="sm">
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save changes
            </Button>
          </div>
        </Card>
      </section>

      {/* Additional settings */}
      <section>
        <SectionTitle>Additional settings</SectionTitle>
        <div
          style={{
            background: '#FAFAF7',
            border: '1.5px dashed #E0DDD3',
            borderRadius: 12,
            padding: '28px 20px',
            textAlign: 'center',
          }}
        >
          <p
            className="font-poppins font-medium"
            style={{ fontSize: 13.5, color: '#1F2230', margin: 0 }}
          >
            More configuration options coming soon
          </p>
          <p className="font-inter mt-1" style={{ fontSize: 12.5, color: '#8B8F9E', margin: '6px 0 0' }}>
            Stage instructions, duration estimates, and more.
          </p>
        </div>
      </section>
    </div>
  )
}
