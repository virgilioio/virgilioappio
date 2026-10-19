import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconTip } from '@/components/ui/tooltip'

/**
 * One home per action.
 *
 * The hero rows carry identity, status and navigation only — every remaining
 * action that has no natural surface of its own lives in this menu. Items that
 * DO have a surface (the stage stepper, the Scorecards card, the references
 * card) appear here with a hint that points back at it, so the menu reads as a
 * shortcut rather than a rival copy of the same action.
 *
 * Built on the shared DropdownMenu, so it has the menus' look (Gio Docs' rows),
 * keyboard navigation and the grow-from-the-trigger motion.
 */

export interface ActionMenuItem {
  id: string
  label: string
  icon: LucideIcon
  /** Right-aligned pointer back to the surface that owns this action. */
  hint?: string
  danger?: boolean
  onClick?: () => void
  disabled?: boolean
}

export interface ActionMenuSection {
  /** Optional section header. */
  label?: string
  items: ActionMenuItem[]
}

interface ProfileActionMenuProps {
  sections: ActionMenuSection[]
  /** Square trigger size — matches the prev/next chevrons beside it. */
  size?: number
}

export function ProfileActionMenu({ sections, size = 32 }: ProfileActionMenuProps) {
  const visible = sections
    .map((s) => ({ ...s, items: s.items.filter(Boolean) }))
    .filter((s) => s.items.length > 0)

  if (!visible.length) return null

  return (
    <DropdownMenu modal={false}>
      <IconTip label="More actions">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More actions"
            className="gio-pressable inline-flex shrink-0 items-center justify-center rounded-lg border border-[#E7E8EE] bg-white text-[#5A6072] transition-colors hover:bg-[#F6F5F1] data-[state=open]:bg-[#F6F5F1]"
            style={{ height: size, width: size }}
          >
            <MoreHorizontal style={{ height: 15, width: 15 }} strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
      </IconTip>
      <DropdownMenuContent align="end" sideOffset={6} className="z-[90] w-[272px]">
        {visible.map((section, si) => (
          <div key={section.label || si}>
            {si > 0 && <DropdownMenuSeparator />}
            {section.label && <DropdownMenuLabel>{section.label}</DropdownMenuLabel>}
            {section.items.map((item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem
                  key={item.id}
                  disabled={item.disabled}
                  onSelect={() => item.onClick?.()}
                  className={item.danger ? 'text-destructive' : undefined}
                >
                  <Icon aria-hidden />
                  <span className="truncate">{item.label}</span>
                  {item.hint && <DropdownMenuShortcut>{item.hint}</DropdownMenuShortcut>}
                </DropdownMenuItem>
              )
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProfileActionMenu
