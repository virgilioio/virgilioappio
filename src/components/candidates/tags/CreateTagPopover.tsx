import { useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { menuPanel } from '@/lib/menu-classes'
import { Button } from '@/components/ui/button'
import { TAG_COLOR_PRESETS, tagColorClasses, useTagMutations } from '@/hooks/useTags'
import { toast } from '@/hooks/use-toast'

export function CreateTagPopover({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(TAG_COLOR_PRESETS[0])
  const { createTag } = useTagMutations()

  async function submit() {
    const n = name.trim()
    if (!n) return
    try {
      await createTag.mutateAsync({ name: n, color })
      toast({ title: `Tag "${n}" created` })
      setName('')
      setColor(TAG_COLOR_PRESETS[0])
      setOpen(false)
    } catch (e: any) {
      toast({ title: "Couldn't create tag", description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={cn(menuPanel, 'w-[260px] p-3')}>
        <div className="text-[12.5px] font-poppins font-medium text-text-primary mb-2">New tag</div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          placeholder="Tag name…"
          className="w-full h-8 px-2 rounded-md border border-virgilio-border text-[12.5px] font-inter outline-none focus:ring-2 focus:ring-virgilio-purple/30"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TAG_COLOR_PRESETS.map(c => {
            const cls = tagColorClasses(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={cn(
                  'h-5 w-5 rounded-full inline-flex items-center justify-center transition',
                  cls.dot,
                  color === c ? 'ring-2 ring-offset-1 ring-virgilio-purple' : 'opacity-80 hover:opacity-100',
                )}
              />
            )
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={submit} disabled={!name.trim() || createTag.isPending}>
            Create
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
