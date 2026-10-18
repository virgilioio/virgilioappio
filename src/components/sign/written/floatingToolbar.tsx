import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND, $isListNode } from '@lexical/list'
import { $setBlocksType } from '@lexical/selection'
import { mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  FOCUS_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type ElementFormatType,
  type LexicalNode,
  type TextFormatType,
} from 'lexical'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Brackets,
  Check,
  ChevronDown,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Underline,
  type LucideIcon,
} from 'lucide-react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { IconTip } from '@/components/ui/tooltip'
import { leave } from './slashMenu'
import { $newCallout } from './callout'
import { $isCalloutNode } from './nodes'

/**
 * Gio Docs' floating selection toolbar in the offer editor (2026-10-18),
 * replacing the fixed toolbar: select text and a dark bar grows in above it
 * (below when there's no room): the text style, bold / italic / underline,
 * lists (and indent / outdent inside one), alignment, and "Show only if…"
 * to make the selected lines a conditional section. It follows the
 * selection without animating and leaves when the selection collapses.
 * Undo and redo stay on ⌘Z / ⌘⇧Z.
 */

type Style = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'callout'
type Block = Style | 'bullet' | 'number'

const STYLES: { value: Style; label: string; className: string }[] = [
  { value: 'paragraph', label: 'Text', className: 'font-inter text-[13px]' },
  { value: 'h1', label: 'Heading 1', className: 'font-poppins text-[16px] font-semibold' },
  { value: 'h2', label: 'Heading 2', className: 'font-poppins text-[14px] font-semibold' },
  { value: 'h3', label: 'Heading 3', className: 'font-inter text-[13px] font-semibold' },
  { value: 'quote', label: 'Quote', className: 'font-inter text-[13px] italic text-text-secondary' },
  { value: 'callout', label: 'Callout', className: 'font-inter text-[13px]' },
]
const ALIGNS: { value: ElementFormatType; label: string; icon: LucideIcon }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Centre', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify },
]
const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

interface State {
  block: Block
  formats: Set<TextFormatType>
  align: ElementFormatType
}

function $readState(): State | null {
  const sel = $getSelection()
  if (!$isRangeSelection(sel) || sel.isCollapsed() || !sel.getTextContent().trim()) return null
  let block: Block = 'paragraph'
  let align: ElementFormatType = ''
  for (let n: LexicalNode | null = sel.anchor.getNode(); n; n = n.getParent()) {
    if ($isListNode(n)) block = n.getListType() === 'number' ? 'number' : 'bullet'
    else if ($isHeadingNode(n) && block === 'paragraph') block = n.getTag() as Block
    else if ($isQuoteNode(n) && block === 'paragraph') block = 'quote'
    else if ($isCalloutNode(n) && block === 'paragraph') block = 'callout'
    if ($isElementNode(n) && !$isRootNode(n) && !align && n.getFormatType()) align = n.getFormatType()
  }
  const formats = new Set<TextFormatType>((['bold', 'italic', 'underline'] as TextFormatType[]).filter((f) => sel.hasFormat(f)))
  return { block, formats, align: align || 'left' }
}

function Btn({ label, icon: Icon, active, onClick }: { label: string; icon: LucideIcon; active?: boolean; onClick: () => void }) {
  return (
    <IconTip label={label}>
      <button type="button" className="gio-fbar-btn" aria-label={label.split(' · ')[0]} aria-pressed={active ?? undefined} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
        <Icon className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
      </button>
    </IconTip>
  )
}

const divider = <span aria-hidden className="mx-1 h-4 w-px bg-white/20" />

export function FloatingToolbar({ onSection }: { onSection: () => void }) {
  const [editor] = useLexicalComposerContext()
  const [state, setState] = useState<State | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  // A menu of the bar (style, alignment) is open: focus has left the text, the bar stays.
  const [menu, setMenu] = useState(false)
  const focused = useRef(false)
  const menuRef = useRef(false)
  menuRef.current = menu
  const bar = useRef<HTMLDivElement | null>(null)

  const measure = useCallback(() => {
    const root = editor.getRootElement()
    const s = window.getSelection()
    if (!root || !s || s.rangeCount === 0 || s.isCollapsed || !root.contains(s.anchorNode)) return
    const r = s.getRangeAt(0).getBoundingClientRect()
    if (r.width || r.height) setRect(r)
  }, [editor])

  const refresh = useCallback(() => {
    const next = editor.getEditorState().read($readState)
    setState(next)
    if (next) measure()
    else setRect(null)
  }, [editor, measure])

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(() => focused.current && refresh()),
        editor.registerCommand(SELECTION_CHANGE_COMMAND, () => (focused.current && refresh(), false), COMMAND_PRIORITY_LOW),
        editor.registerCommand(FOCUS_COMMAND, () => ((focused.current = true), refresh(), false), COMMAND_PRIORITY_LOW),
        editor.registerCommand(
          BLUR_COMMAND,
          (e) => {
            // Moving into the bar (or one of its menus) keeps it.
            const to = (e as FocusEvent).relatedTarget as Node | null
            if (to && (bar.current?.contains(to) || (to as Element).closest?.('[role="menu"]'))) return false
            focused.current = false
            setTimeout(() => !focused.current && !menuRef.current && (setState(null), setRect(null)), 0)
            return false
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor, refresh],
  )
  // The page scrolls under a fixed bar: follow the selection.
  useEffect(() => {
    if (!state) return
    const scroller = editor.getRootElement()?.closest('.overflow-y-auto')
    scroller?.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      scroller?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [state, editor, measure])

  // Leaving: a copy shrinks and fades where the bar was.
  const shown = !!state && !!rect
  useLayoutEffect(() => {
    if (!shown) return
    const el = bar.current
    return () => {
      if (el?.isConnected) leave(el)
    }
  }, [shown])

  // Centre on the selection with the bar's real width (it changes with the style label and list buttons).
  const [width, setWidth] = useState(320)
  useLayoutEffect(() => {
    const w = bar.current?.offsetWidth
    if (w) setWidth(w)
  }, [state, rect])

  if (!state || !rect) return null

  const run = (fn: () => void) => {
    fn()
    editor.focus()
  }
  const setStyle = (b: Style) =>
    run(() => {
      if (state.block === 'bullet' || state.block === 'number') editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
      editor.update(() => {
        const sel = $getSelection()
        if ($isRangeSelection(sel)) $setBlocksType(sel, () => (b === 'paragraph' ? $createParagraphNode() : b === 'quote' ? $createQuoteNode() : b === 'callout' ? $newCallout() : $createHeadingNode(b)))
      })
    })
  const list = (t: 'bullet' | 'number') =>
    run(() => editor.dispatchCommand(state.block === t ? REMOVE_LIST_COMMAND : t === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined))
  const format = (f: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, f)
  const inList = state.block === 'bullet' || state.block === 'number'
  const style = STYLES.find((s) => s.value === state.block) ?? STYLES[0]
  const align = ALIGNS.find((a) => a.value === state.align) ?? ALIGNS[0]

  // Above the selection, or below it when there's no room; inside the sheet (its modal layer blocks clicks outside).
  const host = editor.getRootElement()?.closest<HTMLElement>('[role="dialog"]') ?? document.body
  const shift = host !== document.body && getComputedStyle(host).transform !== 'none' ? host.getBoundingClientRect() : { left: 0, top: 0 }
  const W = width
  const H = 34
  let top = rect.top - 8 - H
  const flipped = top < 8
  if (flipped) top = rect.bottom + 8
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, rect.left + rect.width / 2 - W / 2))

  const dropdown = (trigger: ReactNode, label: string, items: ReactNode) => (
    <DropdownMenu modal={false} onOpenChange={setMenu}>
      <IconTip label={label}>
        <DropdownMenuTrigger asChild onMouseDown={(e) => e.preventDefault()}>
          {trigger}
        </DropdownMenuTrigger>
      </IconTip>
      <DropdownMenuContent align="start" sideOffset={8} className="min-w-[168px]" onCloseAutoFocus={(e) => (e.preventDefault(), editor.focus())}>
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return createPortal(
    <div
      ref={bar}
      role="toolbar"
      aria-label="Formatting"
      className="gio-fbar"
      data-flipped={flipped || undefined}
      style={{ top: top - shift.top, left: left - shift.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {dropdown(
        <button type="button" className="gio-fbar-btn w-auto gap-1 px-2 font-inter text-[12.5px] font-medium" aria-label={`Text style: ${inList ? 'List' : style.label}`}>
          {inList ? (state.block === 'bullet' ? 'Bulleted list' : 'Numbered list') : style.label}
          <ChevronDown className="h-3 w-3 opacity-70" strokeWidth={2.2} aria-hidden />
        </button>,
        'Turn into',
        STYLES.map((s) => (
          <DropdownMenuItem key={s.value} onSelect={() => setStyle(s.value)}>
            <span className={s.className}>{s.label}</span>
            {!inList && s.value === state.block && <Check className="ml-auto h-3.5 w-3.5 text-virgilio-purple" strokeWidth={2.2} aria-label="Current" />}
          </DropdownMenuItem>
        )),
      )}
      {divider}
      <Btn label={`Bold · ${mod}B`} icon={Bold} active={state.formats.has('bold')} onClick={() => format('bold')} />
      <Btn label={`Italic · ${mod}I`} icon={Italic} active={state.formats.has('italic')} onClick={() => format('italic')} />
      <Btn label={`Underline · ${mod}U`} icon={Underline} active={state.formats.has('underline')} onClick={() => format('underline')} />
      {divider}
      <Btn label="Bulleted list" icon={List} active={state.block === 'bullet'} onClick={() => list('bullet')} />
      <Btn label="Numbered list" icon={ListOrdered} active={state.block === 'number'} onClick={() => list('number')} />
      {inList && (
        <>
          <Btn label="Indent" icon={IndentIncrease} onClick={() => run(() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined))} />
          <Btn label="Outdent" icon={IndentDecrease} onClick={() => run(() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined))} />
        </>
      )}
      {dropdown(
        <button type="button" className="gio-fbar-btn w-auto gap-0.5 px-1.5" aria-label={`Alignment: ${align.label}`}>
          <align.icon className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
          <ChevronDown className="h-3 w-3 opacity-70" strokeWidth={2.2} aria-hidden />
        </button>,
        'Alignment',
        ALIGNS.map((a) => (
          <DropdownMenuItem key={a.value} onSelect={() => run(() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, a.value))}>
            <a.icon className="h-4 w-4" strokeWidth={2} aria-hidden />
            {a.label}
            {a.value === state.align && <Check className="ml-auto h-3.5 w-3.5 text-virgilio-purple" strokeWidth={2.2} aria-label="Current" />}
          </DropdownMenuItem>
        )),
      )}
      {divider}
      <Btn label="Show only if… · makes these lines a conditional section" icon={Brackets} onClick={() => run(onSection)} />
    </div>,
    host,
  )
}
