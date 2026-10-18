/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNearestNodeFromDOMNode, $getNodeByKey, COMMAND_PRIORITY_LOW, SKIP_DOM_SELECTION_TAG, createCommand, type NodeKey } from 'lexical'
import { Ban } from 'lucide-react'

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { IconTip } from '@/components/ui/tooltip'
import {
  CALLOUT_ICONS,
  CALLOUT_TONES,
  calloutIcon,
  calloutTone,
  type CalloutIcon,
  type CalloutTone,
} from '../../../../supabase/functions/_shared/sign/writtenLayout.ts'
import { $createCalloutNode, $isCalloutNode } from './nodes'

/**
 * The callout's icon and colour picker (2026-10-18). Clicking a callout's
 * icon (or Icon and colour in its block menu, the way back when it has no
 * icon) opens it: four icons or none, and five colours. The text colour
 * never changes. The last pick is remembered on this device
 * (as in Gio Docs), so the next callout starts the same way.
 */

type Look = { icon: CalloutIcon; tone: CalloutTone }
const KEY = 'gio.sign.callout.last'
const ICON_ORDER: CalloutIcon[] = ['idea', 'info', 'warning', 'check', 'none']
const TONE_ORDER: CalloutTone[] = ['neutral', 'yellow', 'green', 'blue', 'red']

function lastLook(): Look {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Look>
    return { icon: calloutIcon(v.icon), tone: v.tone ? calloutTone(v.tone) : 'yellow' }
  } catch {
    return { icon: 'idea', tone: 'yellow' }
  }
}

function remember(patch: Partial<Look>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...lastLook(), ...patch }))
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

/** Opens the picker for the callout with this key. */
export const OPEN_CALLOUT_PICKER = createCommand<NodeKey>('OPEN_CALLOUT_PICKER')

/** A new callout in the last icon and colour picked. */
export function $newCallout() {
  const l = lastLook()
  return $createCalloutNode(l.icon, l.tone)
}

function IconGlyph({ icon }: { icon: Exclude<CalloutIcon, 'none'> }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {CALLOUT_ICONS[icon].paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

export function CalloutPicker() {
  const [editor] = useLexicalComposerContext()
  const [at, setAt] = useState<{ key: NodeKey; el: HTMLElement } | null>(null)
  const [look, setLook] = useState<Look | null>(null)

  useEffect(
    () =>
      editor.registerRootListener((root, prev) => {
        const down = (e: MouseEvent) => {
          // The icon is a button inside the text: keep the caret where it is.
          if ((e.target as Element).closest?.('.gio-callout-icon')) e.preventDefault()
        }
        const click = (e: MouseEvent) => {
          const btn = (e.target as Element).closest?.<HTMLElement>('.gio-callout-icon')
          if (!btn || !editor.isEditable()) return
          e.preventDefault()
          editor.read(() => {
            const node = $getNearestNodeFromDOMNode(btn)
            if (!$isCalloutNode(node)) return
            setLook(node.getLook())
            setAt({ key: node.getKey(), el: btn })
          })
        }
        prev?.removeEventListener('mousedown', down)
        prev?.removeEventListener('click', click)
        root?.addEventListener('mousedown', down)
        root?.addEventListener('click', click)
      }),
    [editor],
  )

  useEffect(
    () =>
      editor.registerCommand(
        OPEN_CALLOUT_PICKER,
        (key) => {
          const node = editor.getEditorState().read(() => $getNodeByKey(key))
          const dom = editor.getElementByKey(key)
          if (!$isCalloutNode(node) || !dom) return false
          const btn = dom.querySelector<HTMLElement>(':scope > .gio-callout-icon')
          setLook(editor.getEditorState().read(() => node.getLook()))
          // With no icon the picker opens from the callout's corner.
          setAt({ key, el: btn && btn.offsetWidth ? btn : dom })
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )

  // The callout went away (deleted, undone): close.
  useEffect(() => {
    if (!at) return
    return editor.registerUpdateListener(({ editorState }) =>
      editorState.read(() => {
        const node = $getNodeByKey(at.key)
        if ($isCalloutNode(node)) setLook(node.getLook())
        else setAt(null)
      }),
    )
  }, [editor, at])

  const apply = (patch: Partial<Look>) => {
    if (!at) return
    // Leave the caret alone: moving it would take focus out of the picker and close it.
    editor.update(
      () => {
        const node = $getNodeByKey(at.key)
        if ($isCalloutNode(node)) node.setLook(patch)
      },
      { tag: SKIP_DOM_SELECTION_TAG },
    )
    remember(patch)
  }
  const anchor = useMemo(() => ({ current: at?.el ?? null }), [at])

  return (
    <Popover open={!!at} onOpenChange={(o) => !o && setAt(null)}>
      {at && <PopoverAnchor virtualRef={anchor as { current: HTMLElement }} />}
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-auto p-2"
        aria-label="Callout icon and colour"
        onOpenAutoFocus={(e) => {
          // Focus the panel, not the first option (a ring on it would read as the pick); Tab reaches the options.
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus()
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          editor.focus()
        }}
      >
        {look && (
          <div className="grid gap-1.5">
            <p className="px-0.5 font-inter text-[11px] font-medium text-text-tertiary">Icon</p>
            <div className="flex gap-1" role="group" aria-label="Icon">
              {ICON_ORDER.map((i) => (
                <IconTip key={i} side="top" label={i === 'none' ? 'No icon' : CALLOUT_ICONS[i].label}>
                  <button
                    type="button"
                    className="gio-callout-opt"
                    aria-label={i === 'none' ? 'No icon' : CALLOUT_ICONS[i].label}
                    aria-pressed={look.icon === i}
                    style={{ color: i === 'none' ? undefined : CALLOUT_TONES[look.tone].ink }}
                    onClick={() => apply({ icon: i })}
                  >
                    {i === 'none' ? <Ban className="h-4 w-4" strokeWidth={2} aria-hidden /> : <IconGlyph icon={i} />}
                  </button>
                </IconTip>
              ))}
            </div>
            <p className="mt-1 px-0.5 font-inter text-[11px] font-medium text-text-tertiary">Colour</p>
            <div className="flex gap-1" role="group" aria-label="Colour">
              {TONE_ORDER.map((t) => (
                <IconTip key={t} label={CALLOUT_TONES[t].label}>
                  <button type="button" className="gio-callout-opt" aria-label={CALLOUT_TONES[t].label} aria-pressed={look.tone === t} onClick={() => apply({ tone: t })}>
                    <span className="gio-callout-swatch" style={{ background: CALLOUT_TONES[t].bg, boxShadow: `inset 0 0 0 1px ${CALLOUT_TONES[t].ring}` }} />
                  </button>
                </IconTip>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
