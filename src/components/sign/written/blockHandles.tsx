import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { DraggableBlockPlugin_EXPERIMENTAL } from '@lexical/react/LexicalDraggableBlockPlugin'
import { $isHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode, type HeadingTagType } from '@lexical/rich-text'
import { $createListItemNode, $createListNode, $isListItemNode, $isListNode } from '@lexical/list'
import { $generateNodesFromSerializedNodes } from '@lexical/clipboard'
import { $isTableNode } from '@lexical/table'
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  type ElementNode,
  type LexicalNode,
  type SerializedLexicalNode,
} from 'lexical'

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { IconTip } from '@/components/ui/tooltip'
import { BLOCK_PREVIEWS, SLASH_IC, type Preview, type SlashIcon } from './slashMenu'
import { $newCallout, OPEN_CALLOUT_PICKER } from './callout'
import { $isCalloutNode, $isColumnsNode } from './nodes'
import { $stackColumns } from './columns'

/**
 * Gio Docs' block handles in the offer editor (2026-10-18): hovering a block
 * shows "+" (add a block below and open the "/" menu) and "⋮⋮" in the left
 * margin. Drag ⋮⋮ to move the block (a line shows where it lands); click it
 * for the block's menu: Turn into (with previews), Duplicate (⌘D), Move up,
 * Move down, Delete. Top-level blocks only: a conditional section moves as
 * one, with its text. The saved format doesn't change.
 */

type Kind = 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'quote' | 'callout' | 'table' | 'columns' | 'image' | 'divider' | 'sign' | 'section' | 'break' | 'other'
const NAME: Record<Kind, string> = {
  text: 'Text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bullet: 'Bulleted list',
  number: 'Numbered list',
  quote: 'Quote',
  callout: 'Callout',
  table: 'Table',
  columns: 'Two columns',
  image: 'Image',
  divider: 'Divider',
  sign: 'Signature block',
  section: 'Conditional section',
  break: 'Page break',
  other: 'Block',
}
const ICON: Record<Kind, SlashIcon> = {
  text: 'text',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  bullet: 'bullet',
  number: 'numbered',
  quote: 'quote',
  callout: 'callout',
  table: 'table',
  columns: 'columns',
  image: 'image',
  divider: 'divider',
  sign: 'sign',
  section: 'section',
  break: 'pageBreak',
  other: 'text',
}
/** What Turn into offers, in Docs' order. */
const TURN: { kind: Kind; preview: Preview }[] = [
  { kind: 'text', preview: BLOCK_PREVIEWS.text },
  { kind: 'h1', preview: BLOCK_PREVIEWS.h1 },
  { kind: 'h2', preview: BLOCK_PREVIEWS.h2 },
  { kind: 'h3', preview: BLOCK_PREVIEWS.h3 },
  { kind: 'bullet', preview: BLOCK_PREVIEWS.bullet },
  { kind: 'number', preview: BLOCK_PREVIEWS.numbered },
  { kind: 'quote', preview: BLOCK_PREVIEWS.quote },
  { kind: 'callout', preview: BLOCK_PREVIEWS.callout },
]
const TURNABLE = new Set<Kind>(TURN.map((t) => t.kind))

function $kindOf(n: LexicalNode | null): Kind {
  if (!n) return 'other'
  if ($isParagraphNode(n)) return 'text'
  if ($isHeadingNode(n)) return (['h1', 'h2', 'h3'].includes(n.getTag()) ? n.getTag() : 'h3') as Kind
  if ($isListNode(n)) return n.getListType() === 'number' ? 'number' : 'bullet'
  if ($isQuoteNode(n)) return 'quote'
  if ($isCalloutNode(n)) return 'callout'
  if ($isTableNode(n)) return 'table'
  if ($isColumnsNode(n)) return 'columns'
  if ($isHorizontalRuleNode(n)) return 'divider'
  const t = n.getType()
  if (t === 'gio-image') return 'image'
  return t === 'gio-sign' ? 'sign' : t === 'gio-if' ? 'section' : t === 'gio-page-break' ? 'break' : 'other'
}

/** The top-level block a node belongs to. */
function $topOf(n: LexicalNode | null): LexicalNode | null {
  let x = n
  while (x && x.getParent() && !$isRootNode(x.getParent())) x = x.getParent()
  return x && !$isRootNode(x) ? x : null
}

function $make(kind: Kind): ElementNode {
  if (kind === 'h1' || kind === 'h2' || kind === 'h3') return $createHeadingNode(kind as HeadingTagType)
  if (kind === 'quote') return $createQuoteNode()
  if (kind === 'callout') return $newCallout()
  return $createParagraphNode()
}

/** Turn a text block or list into another kind, keeping its words (each list item becomes its own block). */
function $turnInto(node: LexicalNode, kind: Kind) {
  const into = kind === 'bullet' || kind === 'number' ? kind : null
  if ($isListNode(node)) {
    if (into) {
      node.setListType(into)
      return
    }
    const items = node.getChildren().filter($isListItemNode)
    let last: LexicalNode = node
    for (const item of items) {
      const b = $make(kind)
      b.append(...item.getChildren().filter((c) => !$isListNode(c)))
      last.insertAfter(b)
      last = b
    }
    node.remove()
    return
  }
  if (!$isElementNode(node)) return
  if (into) {
    const list = $createListNode(into)
    const item = $createListItemNode()
    item.append(...node.getChildren())
    list.append(item)
    node.replace(list)
    return
  }
  node.replace($make(kind), true)
}

/** A copy of a block: its saved JSON, with its children, read back in as new nodes. */
function $duplicate(node: LexicalNode) {
  const ser = (n: LexicalNode): SerializedLexicalNode => {
    const j = n.exportJSON() as SerializedLexicalNode & { children?: SerializedLexicalNode[] }
    return $isElementNode(n) ? { ...j, children: n.getChildren().map(ser) } : j
  }
  const [copy] = $generateNodesFromSerializedNodes([ser(node)])
  if (copy) node.insertAfter(copy)
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

type Row = { label: string; icon: SlashIcon; hint?: string; danger?: boolean; checked?: boolean; preview?: Preview; run: () => void }

export function BlockHandles({ anchor }: { anchor: HTMLElement }) {
  const [editor] = useLexicalComposerContext()
  const menuRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'main' | 'turn'>('main')
  const [hover, setHover] = useState<number | null>(null)
  const [block, setBlock] = useState<{ key: string; kind: Kind; first: boolean; last: boolean } | null>(null)

  // The handle follows the pointer only while the menu is closed, so the menu stays with its block.
  const onElementChanged = useCallback((e: HTMLElement | null) => {
    if (!open) setEl(e)
  }, [open])
  const isOnMenu = useCallback((t: HTMLElement) => !!t.closest('.gio-block-gutter'), [])

  const withBlock = (fn: (n: LexicalNode) => void) =>
    editor.update(() => {
      const n = block ? $getNodeByKey(block.key) : null
      if (n) fn(n)
    })

  const openMenu = () => {
    if (!el) return
    // Pin the gutter where it is while the menu is open: the pointer leaving the page for the menu
    // would otherwise hide it (and the menu hangs off it).
    const g = menuRef.current
    if (g) g.style.setProperty('--gutter-t', g.style.transform)
    editor.read(() => {
      const n = $topOf($getNearestNodeFromDOMNode(el))
      if (!n) return
      setBlock({ key: n.getKey(), kind: $kindOf(n), first: !n.getPreviousSibling(), last: !n.getNextSibling() })
      setView('main')
      setHover(0)
      setOpen(true)
    })
  }
  const close = () => {
    setOpen(false)
    editor.focus()
  }

  // "+": a new line under the block, with the "/" menu open on it.
  const addBelow = () => {
    if (!el) return
    editor.update(() => {
      const n = $topOf($getNearestNodeFromDOMNode(el))
      if (!n) return
      const p = $createParagraphNode()
      n.insertAfter(p)
      p.select()
    })
    editor.update(() => {
      const sel = $getSelection()
      if ($isRangeSelection(sel)) sel.insertText('/')
    })
    editor.focus()
  }

  const rows: Row[] =
    view === 'turn' && block
      ? TURN.map((t) => ({
          label: NAME[t.kind],
          icon: ICON[t.kind],
          checked: block.kind === t.kind,
          preview: t.preview,
          run: () => {
            withBlock((n) => $turnInto(n, t.kind))
            close()
          },
        }))
      : block
        ? [
            ...(TURNABLE.has(block.kind) ? [{ label: 'Turn into', icon: ICON[block.kind], hint: '›', run: () => (setView('turn'), setHover(0)) }] : []),
            ...(block.kind === 'columns'
              ? [{ label: 'Remove columns', icon: 'text' as SlashIcon, hint: 'keeps the text', run: () => (withBlock((n) => $isColumnsNode(n) && $stackColumns(n)), close()) }]
              : []),
            ...(block.kind === 'callout'
              ? [{ label: 'Icon and colour', icon: 'callout' as SlashIcon, run: () => (close(), setTimeout(() => editor.dispatchCommand(OPEN_CALLOUT_PICKER, block.key), 0)) }]
              : []),
            { label: 'Duplicate', icon: 'duplicate', hint: isMac ? '⌘D' : 'Ctrl+D', run: () => (withBlock($duplicate), close()) },
            { label: 'Move up', icon: 'up', hint: block.first ? 'at top' : undefined, run: () => (withBlock((n) => n.getPreviousSibling()?.insertBefore(n)), close()) },
            { label: 'Move down', icon: 'down', hint: block.last ? 'at end' : undefined, run: () => (withBlock((n) => n.getNextSibling()?.insertAfter(n)), close()) },
            {
              label: 'Delete',
              icon: 'trash',
              danger: true,
              run: () => {
                withBlock((n) => {
                  n.remove()
                  if ($getRoot().getChildrenSize() === 0) $getRoot().append($createParagraphNode())
                })
                close()
              },
            },
          ]
        : []

  // Arrow keys move through the rows; Enter picks; ← (or Esc in Turn into) goes back.
  const onKey = (e: RKeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = rows.length
      setHover((h) => ((h ?? -1) + (e.key === 'ArrowDown' ? 1 : -1) + n) % n)
    } else if (e.key === 'Enter' && hover != null) {
      e.preventDefault()
      rows[hover]?.run()
    } else if (view === 'turn' && (e.key === 'ArrowLeft' || e.key === 'Escape')) {
      e.preventDefault()
      e.stopPropagation()
      setView('main')
      setHover(0)
    }
  }
  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open, view])

  const shown = hover != null ? rows[hover] : null
  const sep = (i: number) => view === 'main' && block && TURNABLE.has(block.kind) && i === 1

  return (
    <DraggableBlockPlugin_EXPERIMENTAL
      anchorElem={anchor}
      menuRef={menuRef}
      targetLineRef={lineRef}
      isOnMenu={isOnMenu}
      onElementChanged={onElementChanged}
      targetLineComponent={<div ref={lineRef} className="gio-drop-line" aria-hidden />}
      menuComponent={
        <div ref={menuRef} className="gio-block-gutter" data-open={open || undefined} data-table={el?.tagName === 'TABLE' || undefined}>
          <IconTip label="Add a block below">
            <button type="button" draggable={false} className="gio-gutter-btn h-6 w-6" aria-label="Add a block below" onClick={addBelow}>
              <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
              </svg>
            </button>
          </IconTip>
          <Popover open={open} onOpenChange={(o) => (o ? openMenu() : close())}>
            <PopoverAnchor asChild>
              <span>
                <IconTip label="Drag to move · click for options">
                  <button type="button" className="gio-gutter-btn h-6 w-[18px] cursor-grab active:cursor-grabbing" aria-label="Drag to move, or click for the block’s options" aria-haspopup="menu" aria-expanded={open} onClick={openMenu}>
                    <svg viewBox="0 0 10 16" width={10} height={16} aria-hidden fill="currentColor">
                      {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="2.5" cy={y} r="1.4" />, <circle key={`b${y}`} cx="7.5" cy={y} r="1.4" />])}
                    </svg>
                  </button>
                </IconTip>
              </span>
            </PopoverAnchor>
            <PopoverContent
              side="bottom"
              align="start"
              sideOffset={6}
              className="w-[248px] overflow-visible p-1"
              onOpenAutoFocus={(e) => {
                // Keys go to the menu's rows (the panel handles arrows and Enter).
                e.preventDefault()
                panelRef.current?.focus()
              }}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div ref={panelRef} tabIndex={-1} role="menu" aria-label={block ? NAME[block.kind] : 'Block'} className="outline-none" onKeyDown={onKey}>
                <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5">
                  {view === 'turn' && (
                    <button type="button" aria-label="Back" className="gio-pressable -ml-1 rounded px-1 text-text-tertiary hover:text-text-primary" onClick={() => (setView('main'), setHover(0))}>
                      ‹
                    </button>
                  )}
                  <p className="font-inter text-[11px] font-medium text-text-tertiary">{view === 'turn' ? 'Turn into' : block ? NAME[block.kind] : ''}</p>
                </div>
                {rows.map((r, i) => (
                  <div key={r.label}>
                    {(sep(i) || (view === 'main' && r.label === 'Move up') || r.danger) && <div className="mx-2 my-1 h-px bg-[#ECEBE6]" />}
                    <button
                      type="button"
                      role="menuitem"
                      data-active={hover === i || undefined}
                      className="gio-block-menu-row"
                      data-danger={r.danger || undefined}
                      onMouseEnter={() => setHover(i)}
                      onClick={r.run}
                    >
                      <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden className="shrink-0">
                        <path d={SLASH_IC[r.icon]} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="min-w-0 flex-1 truncate text-left">{r.label}</span>
                      {r.checked && (
                        <svg viewBox="0 0 24 24" width={14} height={14} aria-label="Current" className="shrink-0 text-virgilio-purple">
                          <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {r.hint && <span className="shrink-0 font-inter text-[11px] text-text-tertiary">{r.hint}</span>}
                    </button>
                  </div>
                ))}
              </div>
              {shown?.preview && (
                <div aria-hidden className="pointer-events-none absolute left-[calc(100%+8px)] top-0 hidden sm:block">
                  <div className="gio-slash-preview">
                    <div className="gio-slash-preview-page">
                      <span className="grid gap-[3px]">{shown.preview.draw()}</span>
                    </div>
                    <p className="px-0.5 pb-px pt-[7px] font-inter text-[11.5px] leading-[1.35] text-[#E7E5DF]">{shown.preview.what}</p>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      }
    />
  )
}

/** ⌘D (Ctrl+D) duplicates the block the caret is in, as in Gio Docs. */
export function DuplicateShortcut() {
  const [editor] = useLexicalComposerContext()
  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (e) => {
          if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'd') return false
          const sel = $getSelection()
          const top = $isRangeSelection(sel) ? $topOf(sel.anchor.getNode()) : null
          if (!top) return false
          e.preventDefault()
          $duplicate(top)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )
  return null
}

