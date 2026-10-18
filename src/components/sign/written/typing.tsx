import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode, type HeadingTagType } from '@lexical/rich-text'
import { $createListItemNode, $createListNode, $isListItemNode } from '@lexical/list'
import { $setBlocksType } from '@lexical/selection'
import { mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  FOCUS_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  TextNode,
  type ElementNode,
  type LexicalNode,
} from 'lexical'

/**
 * Gio Docs typing in the offer editor (2026-10-18, Allan: "the same DNA").
 * Markdown at the start of a line turns it into a block, Backspace at the
 * start of a heading or quote turns it back into text, and the empty line
 * you're on says what you can do. Nothing here animates (typing never does).
 */

/** "#", "##", "###", "-", "*", "1.", "1)" or ">" and a space, at the start of a line. */
const SHORTCUT = /^(#{1,3}|[-*]|1[.)]|>) $/

function $convert(p: ElementNode, mark: string) {
  if (mark.startsWith('#')) {
    const h = $createHeadingNode(`h${mark.length}` as HeadingTagType)
    p.replace(h, true)
    return h
  }
  if (mark === '>') {
    const q = $createQuoteNode()
    p.replace(q, true)
    return q
  }
  const list = $createListNode(mark === '-' || mark === '*' ? 'bullet' : 'number')
  const item = $createListItemNode()
  item.append(...p.getChildren())
  list.append(item)
  p.replace(list)
  return item
}

export function TypingShortcuts() {
  const [editor] = useLexicalComposerContext()
  useEffect(
    () =>
      mergeRegister(
        editor.registerNodeTransform(TextNode, (node) => {
          const p = node.getParent()
          if (!$isParagraphNode(p) || p.getFirstChild() !== node) return
          const sel = $getSelection()
          if (!$isRangeSelection(sel) || !sel.isCollapsed() || sel.anchor.key !== node.getKey()) return
          const text = node.getTextContent()
          const head = text.slice(0, sel.anchor.offset)
          // "---" on a line of its own becomes a divider.
          if (text === '---' && head === '---' && p.getChildrenSize() === 1) {
            const hr = $createHorizontalRuleNode()
            p.replace(hr)
            const next = $createParagraphNode()
            hr.insertAfter(next)
            next.select()
            return
          }
          const m = SHORTCUT.exec(head)
          if (!m) return
          const rest = text.slice(head.length)
          const block = $convert(p, m[1])
          if (rest) {
            node.setTextContent(rest)
            node.select(0, 0)
          } else {
            node.remove()
            block.select(0, 0)
          }
        }),
        // Backspace at the very start of a heading or quote makes it plain text again.
        editor.registerCommand(
          KEY_BACKSPACE_COMMAND,
          (e) => {
            const sel = $getSelection()
            if (!$isRangeSelection(sel) || !sel.isCollapsed() || sel.anchor.offset !== 0) return false
            const at = sel.anchor.getNode()
            const block = $isElementNode(at) && !at.isInline() ? at : at.getParent()
            if (!block || !($isHeadingNode(block) || $isQuoteNode(block))) return false
            if (block !== at && block.getFirstChild() !== at) return false
            e?.preventDefault()
            $setBlocksType(sel, () => $createParagraphNode())
            return true
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor],
  )
  return null
}

const EMPTY_HINT = 'Write, or type / for fields and blocks'

/** The top-level block (or list item) the caret is in. */
function $lineOf(node: LexicalNode): LexicalNode | null {
  for (let n: LexicalNode | null = node; n; n = n.getParent()) {
    const parent = n.getParent()
    if ($isListItemNode(n)) return n
    if (parent && ($isRootNode(parent) || parent.getType() === 'gio-if') && $isElementNode(n)) return n
  }
  return null
}

/**
 * Docs' empty-line hints: the empty line you're on says "Write, or type /";
 * an empty heading or list item always shows what it is.
 */
export function EmptyLineHints() {
  const [editor] = useLexicalComposerContext()
  const focused = useRef(false)
  useEffect(() => {
    const paint = () =>
      editor.getEditorState().read(() => {
        const root = editor.getRootElement()
        if (!root) return
        root.querySelectorAll('[data-hint]').forEach((el) => el.removeAttribute('data-hint'))
        const mark = (n: LexicalNode, hint: string) => editor.getElementByKey(n.getKey())?.setAttribute('data-hint', hint)
        const walk = (n: LexicalNode) => {
          if ($isElementNode(n) && n.getTextContentSize() === 0 && n.getChildrenSize() === 0) {
            if ($isHeadingNode(n)) mark(n, `Heading ${n.getTag().slice(1)}`)
            else if ($isListItemNode(n)) mark(n, 'List')
            else if ($isQuoteNode(n)) mark(n, 'Quote')
          }
          if ($isElementNode(n)) n.getChildren().forEach(walk)
        }
        walk($getRoot())
        // A blank document says it on its first line, even before you click in.
        const root0 = $getRoot()
        const only = root0.getFirstChild()
        if (root0.getChildrenSize() === 1 && $isParagraphNode(only) && only.getChildrenSize() === 0) mark(only, EMPTY_HINT)
        const sel = $getSelection()
        if (!focused.current || !$isRangeSelection(sel) || !sel.isCollapsed()) return
        const line = $lineOf(sel.anchor.getNode())
        if (line && $isParagraphNode(line) && line.getChildrenSize() === 0) mark(line, EMPTY_HINT)
      })
    return mergeRegister(
      editor.registerUpdateListener(paint),
      editor.registerCommand(FOCUS_COMMAND, () => ((focused.current = true), paint(), false), COMMAND_PRIORITY_LOW),
      editor.registerCommand(BLUR_COMMAND, () => ((focused.current = false), paint(), false), COMMAND_PRIORITY_LOW),
    )
  }, [editor])
  return null
}

/**
 * The document's title, Docs-style: big, borderless, grows with its text.
 * Enter, Tab or ↓ at the end goes into the text; ↑ on the first line of the
 * text comes back here. It's the document's name (in lists and file names),
 * not printed on the page.
 */
export function DocTitle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editor] = useLexicalComposerContext()
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const intoText = () => {
    editor.update(() => $getRoot().selectStart())
    editor.focus()
  }
  // ↑ at the start of the text comes back to the title.
  useEffect(
    () =>
      editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (e) => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false
        const first = $getRoot().getFirstDescendant()
        const atStart = sel.anchor.offset === 0 && (!first || sel.anchor.key === first.getKey() || sel.anchor.getNode() === $getRoot().getFirstChild())
        if (!atStart) return false
        e?.preventDefault()
        const el = ref.current
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
        return true
      },
      COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      maxLength={200}
      placeholder="Untitled document"
      aria-label="Document name"
      aria-invalid={!value.trim() || undefined}
      className="gio-written-title"
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ''))}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        const el = e.currentTarget
        const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
        if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey) || (e.key === 'ArrowDown' && atEnd)) {
          e.preventDefault()
          intoText()
        }
      }}
    />
  )
}
