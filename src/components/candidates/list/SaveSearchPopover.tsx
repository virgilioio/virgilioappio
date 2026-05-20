import { useEffect, useRef, useState } from 'react'
import { Bookmark, RotateCcw, Users, Globe2, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/progress-system/Spinner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface SaveSearchPayload {
  name: string
  scope: 'mine' | 'team'
  alertOnNew: boolean
  pinned: boolean
}

interface SaveSearchPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactNode
  autoName: string
  existingNames: string[]
  resultsCount: number
  saving?: boolean
  onSave: (payload: SaveSearchPayload) => Promise<void> | void
}

export function SaveSearchPopover({
  open, onOpenChange, trigger, autoName, existingNames, resultsCount, saving, onSave,
}: SaveSearchPopoverProps) {
  const [name, setName] = useState(autoName)
  const [edited, setEdited] = useState(false)
  const [scope, setScope] = useState<'mine' | 'team'>('mine')
  const [alertOnNew, setAlertOnNew] = useState(false)
  const [pinned, setPinned] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset when popover opens
  useEffect(() => {
    if (open) {
      setName(autoName)
      setEdited(false)
      setScope('mine')
      setAlertOnNew(false)
      setPinned(false)
      // focus + select on next tick
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 30)
    }
  }, [open, autoName])

  const duplicate = name.trim().length > 0 && existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase())
  const canSave = name.trim().length > 0 && !duplicate && !saving

  const handleSubmit = async () => {
    if (!canSave) return
    await onSave({ name: name.trim(), scope, alertOnNew, pinned })
  }

  const handleAutoName = () => {
    setName(autoName)
    setEdited(false)
    inputRef.current?.focus()
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[320px] p-0"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            void handleSubmit()
          }
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-virgilio-purple/10 text-virgilio-purple">
            <Bookmark className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-poppins font-semibold text-[13.5px] tracking-[-0.01em] text-text-primary leading-tight">
              Save as search
            </div>
            <div className="font-inter text-[11.5px] text-text-tertiary mt-0.5">
              Pin this query to the left rail.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 -mr-1 -mt-1 rounded hover:bg-[#F1F0EC] text-text-tertiary"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 pb-3 space-y-3.5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
              Search name
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setEdited(true) }}
                className={cn(
                  'w-full h-8 rounded-md border bg-white px-2.5 pr-[78px] text-[13px] font-inter text-text-primary outline-none transition-colors',
                  duplicate ? 'border-destructive focus:ring-2 focus:ring-destructive/30' : 'border-virgilio-border focus:border-virgilio-purple focus:ring-2 focus:ring-virgilio-purple/30',
                )}
              />
              {edited && name !== autoName && (
                <button
                  type="button"
                  onClick={handleAutoName}
                  className="absolute right-1 top-1 inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10.5px] font-poppins font-medium text-virgilio-purple bg-virgilio-purple/8 hover:bg-virgilio-purple/14"
                  title="Reset to auto-generated name"
                >
                  <RotateCcw className="h-3 w-3" />
                  Auto-name
                </button>
              )}
            </div>
            {duplicate ? (
              <div className="text-[11px] text-destructive font-inter">
                You already have a search named "{name.trim()}".
              </div>
            ) : (
              <div className="text-[11px] text-text-tertiary font-inter">
                Generated from your active filters.
              </div>
            )}
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
              Save to
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <ScopeButton
                active={scope === 'mine'}
                onClick={() => setScope('mine')}
                icon={<Bookmark className="h-3 w-3" />}
                label="My searches"
              />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <ScopeButton
                        active={false}
                        disabled
                        icon={<Globe2 className="h-3 w-3" />}
                        label="Shared with team"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Coming soon</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Alerts toggle */}
          <div className="flex items-start gap-3 rounded-md bg-[#FAFAF7] px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="font-poppins font-medium text-[12.5px] text-text-primary leading-tight">
                Alert me on new matches
              </div>
              <div className="font-inter text-[11px] text-text-tertiary mt-0.5">
                Email weekly · in-app on every match
              </div>
            </div>
            <Switch checked={alertOnNew} onCheckedChange={setAlertOnNew} className="mt-0.5" />
          </div>

          {/* Pin checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-virgilio-border text-virgilio-purple focus:ring-virgilio-purple/30"
            />
            <span className="font-inter text-[12.5px] text-text-secondary">
              Pin to top of <span className="font-medium text-text-primary">My searches</span>
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="border-t border-virgilio-border px-4 py-2.5 flex items-center justify-between bg-white rounded-b-xl">
          <div className="font-inter text-[10.5px] text-text-tertiary flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[#F1F0EC] rounded font-mono">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-[#F1F0EC] rounded font-mono">↵</kbd>
            <span className="ml-1">to save</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!canSave}>
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner size={12} tone="cream" />
                  Saving…
                </span>
              ) : (
                'Save search'
              )}
            </Button>
          </div>
        </div>

        <div className="px-4 pb-3 text-[10.5px] font-inter text-text-tertiary flex items-center gap-1">
          <Users className="h-3 w-3" />
          {resultsCount.toLocaleString()} {resultsCount === 1 ? 'candidate' : 'candidates'} match right now
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ScopeButton({
  active, disabled, icon, label, onClick,
}: { active: boolean; disabled?: boolean; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-md border text-[12px] font-poppins font-medium transition-colors',
        active
          ? 'bg-[#EDE4FF] text-virgilio-purple border-transparent'
          : 'bg-white text-text-secondary border-virgilio-border hover:bg-[#FAFAF7]',
        disabled && 'opacity-50 cursor-not-allowed hover:bg-white',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
