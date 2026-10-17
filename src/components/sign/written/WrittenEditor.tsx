import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { HorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND, $isListNode } from '@lexical/list'
import { $setBlocksType } from '@lexical/selection'
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type TextFormatType,
} from 'lexical'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Search,
  SeparatorHorizontal,
  Strikethrough,
  Underline,
  Undo2,
  Split,
  type LucideIcon,
} from 'lucide-react'

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconTip } from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { UnsavedGuard } from '@/components/ui/unsaved-guard'
import { PdfPage } from '@/components/sign/PdfPage'
import { cn } from '@/lib/utils'
import { tagLabel, tagsFor, useOfferFormTags, type TplRole } from '@/lib/sign/templates'
import { BLOCK_LABEL, IF_LABEL, useWrittenPreview, type IfOp, type LexicalJson, type SignBlockKind, type TplWritten } from '@/lib/sign/written'
import type { SignKind } from '@/lib/sign/api'
import {
  $createGioIfNode,
  $createGioPageBreakNode,
  $createGioSignNode,
  $createSignTagNode,
  $isGioIfNode,
  GioIfNode,
  GioPageBreakNode,
  GioSignNode,
  SignTagNode,
  WrittenLabelsContext,
  registerWrittenRules,
  type WrittenLabels,
} from './nodes'

/**
 * Write a document in Gio (2026-10-17): text, headings, lists, the record's
 * values as tags, sections that print only when a value says so, and signing
 * blocks for each role. A stacked sheet over the template wizard; Done hands
 * the document back to the wizard, which saves it with the template.
 */

type Tag = { key: string; label: string; type: string }
type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'bullet' | 'number'

const THEME = {
  paragraph: 'gio-w-p',
  heading: { h1: 'gio-w-h1', h2: 'gio-w-h2', h3: 'gio-w-h3' },
  quote: 'gio-w-quote',
  list: { ul: 'gio-w-ul', ol: 'gio-w-ol', listitem: 'gio-w-li', nested: { listitem: 'gio-w-li-nested' } },
  text: { bold: 'gio-w-b', italic: 'gio-w-i', underline: 'gio-w-u', strikethrough: 'gio-w-s', underlineStrikethrough: 'gio-w-us' },
  hr: 'gio-w-hr',
}

/** The block a node sits in at the top level (the root's child). */
function $topBlock(node: LexicalNode): LexicalNode {
  let n: LexicalNode = node
  while (n.getParent() && !$isRootNode(n.getParent())) n = n.getParent()!
  return n
}

function $insertBlockAtTop(node: LexicalNode) {
  const sel = $getSelection()
  const root = $getRoot()
  const anchor = $isRangeSelection(sel) ? sel.anchor.getNode() : root.getLastChild()
  const top = anchor && !$isRootNode(anchor) ? $topBlock(anchor) : null
  // On an empty line the block takes its place, so blocks added one after
  // another sit next to each other (and share a row when they fit).
  if (top && $isParagraphNode(top) && top.getChildrenSize() === 0) {
    top.insertBefore(node)
    top.select()
    return
  }
  if (top) top.insertAfter(node)
  else root.append(node)
  const next = node.getNextSibling()
  if (!next) {
    const p = $createParagraphNode()
    node.insertAfter(p)
    p.select()
  } else if ($isElementNode(next)) next.selectStart()
}

/* ---- Toolbar state ------------------------------------------------------- */

interface ToolState {
  block: BlockType
  formats: Set<TextFormatType>
  align: ElementFormatType
  section: { nodeKey: NodeKey; key: string; op: IfOp; value: string } | null
}

function useToolState(editor: LexicalEditor) {
  const [s, setS] = useState<ToolState>({ block: 'paragraph', formats: new Set(), align: 'left', section: null })
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const sel = $getSelection()
          if (!$isRangeSelection(sel)) return
          const node = sel.anchor.getNode()
          let block: BlockType = 'paragraph'
          let align: ElementFormatType = 'left'
          let section: ToolState['section'] = null
          for (let n: LexicalNode | null = node; n; n = n.getParent()) {
            if ($isListNode(n)) block = n.getListType() === 'number' ? 'number' : 'bullet'
            else if ($isHeadingNode(n) && block === 'paragraph') block = n.getTag() as BlockType
            else if ($isQuoteNode(n) && block === 'paragraph') block = 'quote'
            if ($isElementNode(n) && !$isRootNode(n) && align === 'left' && n.getFormatType()) align = n.getFormatType()
            if ($isGioIfNode(n) && !section) section = { nodeKey: n.getKey(), ...n.getCondition() }
          }
          const formats = new Set<TextFormatType>((['bold', 'italic', 'underline', 'strikethrough'] as TextFormatType[]).filter((f) => sel.hasFormat(f)))
          setS({ block, formats, align: align || 'left', section })
        })
      }),
    [editor],
  )
  return s
}

function ToolButton({ label, icon: Icon, active, onClick, disabled }: { label: string; icon: LucideIcon; active?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <IconTip label={label}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        className={cn(active && 'bg-[#E7E5E0]')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
      >
        <Icon />
      </Button>
    </IconTip>
  )
}

const OPS_FOR = (t: Tag | undefined): IfOp[] => (t?.type === 'checkbox' ? ['yes', 'no'] : ['filled', 'empty', 'equals', 'not_equals'])

function Toolbar({ tags }: { tags: Tag[] }) {
  const [editor] = useLexicalComposerContext()
  const s = useToolState(editor)

  const setBlock = (b: BlockType) => {
    if (b === 'bullet') return editor.dispatchCommand(s.block === 'bullet' ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined)
    if (b === 'number') return editor.dispatchCommand(s.block === 'number' ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined)
    if (s.block === 'bullet' || s.block === 'number') editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      $setBlocksType(sel, () => (b === 'paragraph' ? $createParagraphNode() : b === 'quote' ? $createQuoteNode() : $createHeadingNode(b)))
    })
  }
  const format = (f: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, f)
  const align = (a: ElementFormatType) => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, a)
  const setCondition = (c: { key?: string; op?: IfOp; value?: string }) =>
    editor.update(() => {
      const n = s.section ? $getNodeByKey(s.section.nodeKey) : null
      if ($isGioIfNode(n)) n.setCondition(c)
    })
  const unwrap = () =>
    editor.update(() => {
      const n = s.section ? $getNodeByKey(s.section.nodeKey) : null
      if (!$isGioIfNode(n)) return
      for (const child of n.getChildren()) n.insertBefore(child)
      n.remove()
    })
  const sectionTag = tags.find((t) => t.key === s.section?.key)

  return (
    <div className="sticky top-0 z-10 border-b border-[#ECEBE6] bg-[#F6F5F1]/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5">
        <Select value={s.block === 'bullet' || s.block === 'number' ? 'paragraph' : s.block} onValueChange={(v) => setBlock(v as BlockType)}>
          <SelectTrigger className="h-8 w-[132px] text-[12.5px]" aria-label="Text style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">Normal text</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
            <SelectItem value="quote">Quote</SelectItem>
          </SelectContent>
        </Select>
        <span className="mx-1 h-5 w-px bg-[#E2E0D9]" aria-hidden />
        <ToolButton label="Bold" icon={Bold} active={s.formats.has('bold')} onClick={() => format('bold')} />
        <ToolButton label="Italic" icon={Italic} active={s.formats.has('italic')} onClick={() => format('italic')} />
        <ToolButton label="Underline" icon={Underline} active={s.formats.has('underline')} onClick={() => format('underline')} />
        <ToolButton label="Strikethrough" icon={Strikethrough} active={s.formats.has('strikethrough')} onClick={() => format('strikethrough')} />
        <span className="mx-1 h-5 w-px bg-[#E2E0D9]" aria-hidden />
        <ToolButton label="Align left" icon={AlignLeft} active={s.align === 'left' || s.align === 'start' || !s.align} onClick={() => align('left')} />
        <ToolButton label="Centre" icon={AlignCenter} active={s.align === 'center'} onClick={() => align('center')} />
        <ToolButton label="Align right" icon={AlignRight} active={s.align === 'right' || s.align === 'end'} onClick={() => align('right')} />
        <ToolButton label="Justify" icon={AlignJustify} active={s.align === 'justify'} onClick={() => align('justify')} />
        <span className="mx-1 h-5 w-px bg-[#E2E0D9]" aria-hidden />
        <ToolButton label="Bulleted list" icon={List} active={s.block === 'bullet'} onClick={() => setBlock('bullet')} />
        <ToolButton label="Numbered list" icon={ListOrdered} active={s.block === 'number'} onClick={() => setBlock('number')} />
        <ToolButton label="Line" icon={Minus} onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)} />
        <ToolButton label="Page break" icon={SeparatorHorizontal} onClick={() => editor.update(() => $insertBlockAtTop($createGioPageBreakNode()))} />
        <span className="mx-1 h-5 w-px bg-[#E2E0D9]" aria-hidden />
        <ToolButton label="Undo" icon={Undo2} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} />
        <ToolButton label="Redo" icon={Redo2} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} />
      </div>
      {s.section && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#ECEBE6] bg-[#FAFAF7] px-3 py-1.5 font-inter text-[12.5px] text-text-secondary">
          <Split className="h-3.5 w-3.5 text-[#92580A]" aria-hidden />
          <span>This section prints only if</span>
          <Select
            value={s.section.key || undefined}
            onValueChange={(key) => {
              const t = tags.find((x) => x.key === key)
              const ops = OPS_FOR(t)
              setCondition({ key, op: ops.includes(s.section!.op) ? s.section!.op : ops[0] })
            }}
          >
            <SelectTrigger className="h-8 w-[200px] text-[12.5px]" aria-label="Field the section depends on">
              <SelectValue placeholder="Pick a field" />
            </SelectTrigger>
            <SelectContent>
              {tags.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={s.section.op} onValueChange={(op) => setCondition({ op: op as IfOp })}>
            <SelectTrigger className="h-8 w-[130px] text-[12.5px]" aria-label="Condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS_FOR(sectionTag).map((op) => (
                <SelectItem key={op} value={op}>
                  {IF_LABEL[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(s.section.op === 'equals' || s.section.op === 'not_equals') && (
            <Input
              className="h-8 w-[160px] text-[12.5px]"
              aria-label="Value"
              placeholder="Value"
              value={s.section.value}
              maxLength={200}
              onChange={(e) => setCondition({ value: e.target.value })}
            />
          )}
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onMouseDown={(e) => e.preventDefault()} onClick={unwrap}>
            Remove section
          </Button>
        </div>
      )}
    </div>
  )
}

/* ---- Side panel ---------------------------------------------------------- */

function SidePanel({ tags, roles, problem, setProblem }: { tags: Tag[]; roles: TplRole[]; problem: string | null; setProblem: (s: string | null) => void }) {
  const [editor] = useLexicalComposerContext()
  const [q, setQ] = useState('')
  const shown = q.trim() ? tags.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase())) : tags
  const signing = roles.filter((r) => r.role !== 'cc')

  const insertTag = (key: string) =>
    editor.update(() => {
      const sel = $getSelection()
      const tag = $createSignTagNode(key)
      if ($isRangeSelection(sel)) sel.insertNodes([tag])
      else {
        const p = $createParagraphNode()
        p.append(tag)
        $getRoot().append(p)
      }
    })
  const insertBlock = (roleId: string, kind: SignBlockKind) => editor.update(() => $insertBlockAtTop($createGioSignNode(roleId, kind)))
  const addSection = () =>
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      for (let n: LexicalNode | null = sel.anchor.getNode(); n; n = n.getParent()) {
        if ($isGioIfNode(n)) {
          setProblem('Sections can’t go inside another section.')
          return
        }
      }
      const a = $topBlock(sel.anchor.getNode())
      const b = $topBlock(sel.focus.getNode())
      const first = a.isBefore(b) ? a : b
      const last = first === a ? b : a
      const blocks: LexicalNode[] = []
      for (let n: LexicalNode | null = first; n; n = n.getNextSibling()) {
        blocks.push(n)
        if (n === last) break
      }
      if (blocks.some((n) => n instanceof GioSignNode)) {
        setProblem('Signing blocks stay outside sections, so a signature always prints.')
        return
      }
      const pick = tags.find((t) => t.type === 'checkbox') ?? tags[0]
      const section = $createGioIfNode(pick?.key ?? '', OPS_FOR(pick)[0])
      first.insertBefore(section)
      for (const n of blocks) section.append(n)
      setProblem(null)
    })

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-[#ECEBE6] bg-[#FBFAF7] px-4 py-4" data-no-swipe>
      <section>
        <h3 className="font-poppins text-[13px] font-semibold text-text-primary">Fields</h3>
        <p className="mt-0.5 font-inter text-[11.5px] text-text-tertiary">Fill in from the record when it’s sent.</p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" aria-hidden />
          <Input className="h-8 pl-8 text-[12.5px]" placeholder="Find a field" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a field" />
        </div>
        <ul className="mt-2 flex max-h-[260px] flex-col gap-0.5 overflow-y-auto">
          {shown.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                className="gio-pressable flex w-full items-center rounded-md px-2 py-1.5 text-left font-inter text-[12.5px] text-text-primary hover:bg-[#F1F0EC]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertTag(t.key)}
              >
                <span className="gio-written-tag pointer-events-none truncate">{t.label}</span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="px-2 py-1.5 font-inter text-[12px] text-text-tertiary">No field matches “{q.trim()}”.</li>}
        </ul>
      </section>

      <section>
        <h3 className="font-poppins text-[13px] font-semibold text-text-primary">Signing blocks</h3>
        <p className="mt-0.5 font-inter text-[11.5px] text-text-tertiary">Where each person signs. Next to each other when they fit.</p>
        <div className="mt-2 flex flex-col gap-3">
          {signing.map((r) => (
            <div key={r.id}>
              <p className="flex items-center gap-1.5 font-inter text-[12px] font-medium text-text-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} aria-hidden />
                <span className="truncate">{r.label || 'Unnamed role'}</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(Object.keys(BLOCK_LABEL) as SignBlockKind[]).map((k) => (
                  <Button key={k} type="button" variant="secondary" size="xs" onMouseDown={(e) => e.preventDefault()} onClick={() => insertBlock(r.id, k)}>
                    {BLOCK_LABEL[k]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-poppins text-[13px] font-semibold text-text-primary">Sections</h3>
        <p className="mt-0.5 font-inter text-[11.5px] text-text-tertiary">Text that prints only when a field says so, like a relocation clause.</p>
        <Button type="button" variant="secondary" size="sm" className="mt-2" icon={Split} onMouseDown={(e) => e.preventDefault()} onClick={addSection}>
          Make a section
        </Button>
        <p className="gio-field-message mt-1 min-h-[18px] font-inter text-[12px] text-virgilio-error" role={problem ? 'alert' : undefined}>
          {problem}
        </p>
      </section>
    </aside>
  )
}

function Rules() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => registerWrittenRules(editor), [editor])
  return null
}

/** Shows each section's condition above it, in words. */
function SectionLabels({ label }: { label: (key: string, op: IfOp, value: string) => string }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    const paint = () =>
      editor.getEditorState().read(() => {
        const walk = (n: LexicalNode) => {
          if ($isGioIfNode(n)) {
            const el = editor.getElementByKey(n.getKey())
            const c = n.getCondition()
            if (el) el.dataset.label = label(c.key, c.op, c.value)
          }
          if ($isElementNode(n)) n.getChildren().forEach(walk)
        }
        walk($getRoot())
      })
    paint()
    return editor.registerUpdateListener(paint)
  }, [editor, label])
  return null
}

/* ---- Sheet --------------------------------------------------------------- */

export function WrittenEditor({
  open,
  doc,
  kind,
  formId,
  roles,
  onDone,
  onClose,
}: {
  open: boolean
  doc: TplWritten | null
  kind: SignKind
  formId: string | null
  roles: TplRole[]
  onDone: (doc: TplWritten) => void
  onClose: () => void
}) {
  const [name, setName] = useState(doc?.name ?? '')
  const [content, setContent] = useState<LexicalJson | null>(doc?.content ?? null)
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (open && doc) {
      setName(doc.name)
      setContent(doc.content)
      setDirty(false)
      setAsking(false)
      setTab('write')
      setProblem(null)
    }
  }, [open, doc])

  const formTags = useOfferFormTags(kind === 'candidate' ? formId : null)
  const tags = useMemo<Tag[]>(() => {
    const std = tagsFor(kind).map(([key, label]) => ({ key, label, type: 'text' }))
    const seen = new Set(std.map((t) => t.key))
    return [...std, ...(formTags.data ?? []).filter((t) => !seen.has(t.key)).map((t) => ({ key: t.key, label: t.label, type: t.type }))]
  }, [kind, formTags.data])
  const labels = useMemo<WrittenLabels>(
    () => ({
      tag: (k) => tags.find((t) => t.key === k)?.label ?? tagLabel(kind, k),
      role: (id) => {
        const r = roles.find((x) => x.id === id && x.role !== 'cc')
        return r ? { label: r.label || 'Unnamed role', color: r.color } : null
      },
    }),
    [tags, roles, kind],
  )
  const sectionLabel = useCallback(
    (key: string, op: IfOp, value: string) =>
      key ? `Only if ${labels.tag(key)} ${IF_LABEL[op]}${op === 'equals' || op === 'not_equals' ? ` “${value}”` : ''}` : 'Only if… (pick a field above)',
    [labels],
  )

  const previewInput = useMemo(
    () =>
      tab === 'preview' && content
        ? {
            name: name.trim() || 'Untitled document',
            content,
            tags: Object.fromEntries(tags.map((t) => [t.key, t.label])),
            roles: Object.fromEntries(roles.map((r) => [r.id, r.label || 'Signer'])),
          }
        : null,
    [tab, content, name, tags, roles],
  )
  const preview = useWrittenPreview(previewInput)

  const requestClose = () => (dirty ? setAsking(true) : onClose())
  const done = () => {
    if (!doc || !content) return
    if (!name.trim()) {
      setProblem('Name the document')
      return
    }
    onDone({ ...doc, name: name.trim().slice(0, 200), content })
  }

  const initialConfig = useMemo(
    () => ({
      namespace: 'gio-written',
      theme: THEME,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, HorizontalRuleNode, SignTagNode, GioIfNode, GioSignNode, GioPageBreakNode],
      editorState: doc ? JSON.stringify(doc.content) : undefined,
      onError: (e: Error) => console.error('written editor', e),
    }),
    [doc],
  )

  let body: ReactNode = null
  if (tab === 'preview') {
    body = (
      <div className="flex-1 overflow-y-auto bg-[#EDEBE5] px-6 py-6" data-no-swipe>
        {preview.isLoading ? (
          <div className="mx-auto flex w-[612px] max-w-full flex-col gap-4">
            <Skeleton className="w-full rounded-md" style={{ aspectRatio: '612 / 792' }} />
          </div>
        ) : preview.isError ? (
          <div className="mx-auto max-w-md rounded-xl border border-[#E7E8EE] bg-white p-5 text-center">
            <p className="font-inter text-[13px] text-text-primary">{(preview.error as Error)?.message || 'The preview couldn’t be made.'}</p>
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void preview.refetch()}>
              Retry
            </Button>
          </div>
        ) : preview.data ? (
          <div className="mx-auto flex w-[612px] max-w-full flex-col gap-4" aria-label="Preview of the document">
            {Array.from({ length: preview.data.page_count }, (_, i) => (
              <div key={i}>
                <PdfPage doc={preview.data!} index={i} width={612} />
                <p className="mt-1.5 text-right font-inter text-[11px] tabular-nums text-text-tertiary">
                  {i + 1} / {preview.data!.page_count}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && requestClose()}>
      <SheetContent
        side="right"
        className="w-full p-0 bg-[#F6F5F1] border-l border-virgilio-border sm:max-w-[1180px]"
        onEscapeKeyDown={(e) => {
          if (asking) e.preventDefault()
        }}
      >
        <WrittenLabelsContext.Provider value={labels}>
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-end gap-4 px-6 pb-3 pt-1 sm:px-8">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-poppins font-semibold uppercase tracking-[0.14em] text-virgilio-purple">Written document</p>
                <SheetTitle className="sr-only">{name || 'Written document'}</SheetTitle>
                <SheetDescription className="sr-only">Write the document, add fields, sections and signing blocks, then preview the PDF.</SheetDescription>
                <Input
                  value={name}
                  maxLength={200}
                  aria-label="Document name"
                  placeholder="e.g. Offer letter"
                  className="mt-2 h-10 max-w-[480px] font-poppins text-[17px] font-semibold"
                  onChange={(e) => {
                    setName(e.target.value)
                    setDirty(true)
                  }}
                />
              </div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'write' | 'preview')}>
                <TabsList>
                  <TabsTrigger value="write">Write</TabsTrigger>
                  <TabsTrigger value="preview">Preview PDF</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <LexicalComposer key={doc?.id ?? 'none'} initialConfig={initialConfig}>
              <div className={cn('flex min-h-0 flex-1 border-t border-[#ECEBE6]', tab !== 'write' && 'hidden')}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Toolbar tags={tags} />
                  <div className="flex-1 overflow-y-auto bg-[#EDEBE5] px-4 py-6 sm:px-8" data-no-swipe>
                    <div className="gio-written-paper mx-auto">
                      <RichTextPlugin
                        contentEditable={<ContentEditable className="gio-written-root" aria-label="Document text" />}
                        placeholder={<p className="gio-written-placeholder">Start writing. Add fields, sections and signing blocks from the right.</p>}
                        ErrorBoundary={LexicalErrorBoundary}
                      />
                    </div>
                  </div>
                </div>
                <SidePanel tags={tags} roles={roles} problem={problem} setProblem={setProblem} />
              </div>
              <HistoryPlugin />
              <ListPlugin />
              <HorizontalRulePlugin />
              <Rules />
              <SectionLabels label={sectionLabel} />
              <OnChangePlugin
                ignoreSelectionChange
                onChange={(state) => {
                  setContent(state.toJSON() as unknown as LexicalJson)
                  setDirty(true)
                }}
              />
            </LexicalComposer>
            {body}

            <div className="relative border-t border-virgilio-border bg-[#F6F5F1]/95 px-6 py-4 backdrop-blur sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <Button type="button" variant="ghost" onClick={requestClose}>
                  Cancel
                </Button>
                <p className="hidden min-w-0 truncate text-[12px] text-text-tertiary lg:block">
                  {problem ?? 'Saved with the template. The PDF is made with each record’s values when it’s sent.'}
                </p>
                <Button type="button" onClick={done}>
                  Done
                </Button>
              </div>
              <UnsavedGuard
                open={asking}
                onKeep={() => setAsking(false)}
                onDiscard={() => {
                  setAsking(false)
                  onClose()
                }}
              />
            </div>
          </div>
        </WrittenLabelsContext.Provider>
      </SheetContent>
    </Sheet>
  )
}
