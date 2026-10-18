import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { HorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalTypeaheadMenuPlugin, useBasicTypeaheadTriggerMatch } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { $setBlocksType } from '@lexical/selection'
import { mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $setSelection,
  KEY_ESCAPE_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from 'lexical'
import {
  Brackets,
  Database,
  Info,
  Lock,
  PenLine,
  Trash2,
  TriangleAlert,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PdfPage } from '@/components/sign/PdfPage'
import { cn } from '@/lib/utils'
import { OFFER_CATEGORIES, formatKind, formatSample, offerCategory, type ValueFormat } from '@/lib/sign/formats'
import { tagLabel, type FieldType, type TplDraft } from '@/lib/sign/templates'
import { useWrittenTags, type Tag } from './writtenTags'
import { BLOCK_LABEL, IF_LABEL, useWrittenPreview, type IfOp, type LexicalJson, type TplWritten } from '@/lib/sign/written'
import { conditionHolds } from '../../../../supabase/functions/_shared/sign/writtenLayout.ts'
import {
  $createGioFieldNode,
  $createGioIfNode,
  $createGioPageBreakNode,
  $createGioSignNode,
  $createSignTagNode,
  $isGioFieldNode,
  $isGioIfNode,
  $isGioSignNode,
  $isSignTagNode,
  CalloutNode,
  GioFieldNode,
  GioIfNode,
  GioPageBreakNode,
  GioSignNode,
  INLINE_FIELD_LABEL,
  SignTagNode,
  WrittenLabelsContext,
  registerWrittenRules,
  type InlineFieldType,
  type WrittenLabels,
} from '@/components/sign/written/nodes'
import { DocTitle, EmptyLineHints, TypingShortcuts } from '@/components/sign/written/typing'
import { BlockHandles, DuplicateShortcut } from '@/components/sign/written/blockHandles'
import { FloatingToolbar } from '@/components/sign/written/floatingToolbar'
import { $newCallout, CalloutPicker } from '@/components/sign/written/callout'
import { $inTableCell, TableTools, insertTable, registerTableRules } from '@/components/sign/written/table'
import { FieldList } from './FieldList'
import { BLOCK_PREVIEWS, SlashItem, SlashPanel, fieldPreview, rememberPick, signPreview, signerFieldPreview, slashRows, type Preview, type SlashIcon } from '@/components/sign/written/slashMenu'
import { FieldSummary, FormatPicker, PanelHead } from './FieldPanel'
import { FIELD_ICON } from './fieldIcons'

/**
 * Write in Gio, on the Document step (§3.2, 2026-10-17): the field list on
 * the left, the page in the middle with its toolbar and "/" menu, and the
 * Summary or the selection's settings on the right. Preview draws the PDF
 * with the latest offer on the form (or [Labels] when there isn't one).
 */

export interface Sample {
  firstName: string | null
  values: Record<string, string | null>
}

const THEME = {
  paragraph: 'gio-w-p',
  heading: { h1: 'gio-w-h1', h2: 'gio-w-h2', h3: 'gio-w-h3' },
  quote: 'gio-w-quote',
  list: { ul: 'gio-w-ul', ol: 'gio-w-ol', listitem: 'gio-w-li', nested: { listitem: 'gio-w-li-nested' } },
  text: { bold: 'gio-w-b', italic: 'gio-w-i', underline: 'gio-w-u', strikethrough: 'gio-w-s', underlineStrikethrough: 'gio-w-us' },
  hr: 'gio-w-hr',
  table: 'gio-w-table',
  tableRow: 'gio-w-tr',
  tableCell: 'gio-w-td',
  tableCellHeader: 'gio-w-th',
  tableSelection: 'gio-w-table-selecting',
  tableCellSelected: 'gio-w-td-selected',
}
const NODES = [HeadingNode, QuoteNode, ListNode, ListItemNode, HorizontalRuleNode, SignTagNode, GioIfNode, GioSignNode, GioFieldNode, GioPageBreakNode, CalloutNode, TableNode, TableRowNode, TableCellNode]
const WRITTEN_SIGNER_TYPES = ['signature', 'initials', 'date', 'name', 'text', 'checkbox'] as const

/* ---- Inserting ----------------------------------------------------------- */

function $topBlock(node: LexicalNode): LexicalNode {
  let n: LexicalNode = node
  while (n.getParent() && !$isRootNode(n.getParent())) n = n.getParent()!
  return n
}

/** A block (signing block, page break) after the caret's paragraph, or in place of an empty one. */
function $insertBlock(node: LexicalNode) {
  const sel = $getSelection()
  const root = $getRoot()
  const anchor = $isRangeSelection(sel) ? sel.anchor.getNode() : $isNodeSelection(sel) ? sel.getNodes()[0] ?? null : root.getLastChild()
  const top = anchor && !$isRootNode(anchor) ? $topBlock(anchor) : null
  if (top && $isParagraphNode(top) && top.getChildrenSize() === 0) {
    top.insertBefore(node)
    top.select()
    return
  }
  if (top) top.insertAfter(node)
  else root.append(node)
  const next = node.getNextSibling()
  if (!next || !$isElementNode(next) || $isGioIfNode(next)) {
    const p = $createParagraphNode()
    node.insertAfter(p)
    p.select()
  } else next.selectStart()
}

/** An inline chip at the caret (after a selected chip, or at the end when there's no caret). */
function $insertInline(node: LexicalNode) {
  const sel = $getSelection()
  if ($isRangeSelection(sel)) {
    sel.insertNodes([node])
    return
  }
  const after = $isNodeSelection(sel) ? sel.getNodes().at(-1) : null
  if (after && !$isElementNode(after) && after.isInline()) {
    after.insertAfter(node)
    node.selectNext()
    return
  }
  const p = $createParagraphNode()
  p.append(node)
  if (after) $topBlock(after).insertAfter(p)
  else $getRoot().append(p)
  node.selectNext()
}

/** Wraps the caret's paragraphs in a conditional section. Returns a problem, or null. */
function $wrapInSection(pick: Tag | undefined): string | null {
  const sel = $getSelection()
  if (!$isRangeSelection(sel)) return 'Click in the text you want to make conditional first.'
  for (let n: LexicalNode | null = sel.anchor.getNode(); n; n = n.getParent()) {
    if ($isGioIfNode(n)) return 'Sections can’t go inside another section.'
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
  if (blocks.some((n) => $isGioSignNode(n))) return 'Signing blocks stay outside sections, so a signature always prints.'
  const section = $createGioIfNode(pick?.key ?? '', opsFor(pick)[0])
  first.insertBefore(section)
  for (const n of blocks) section.append(n)
  return null
}

const isAmount = (t: Tag | undefined) => !!t && (t.type === 'salary' || t.type === 'number')
/** The rules a section can use, by the field it depends on. Money and numbers start with "is more than 0". */
function opsFor(t: Tag | undefined): IfOp[] {
  if (t?.type === 'checkbox') return ['yes', 'no']
  if (isAmount(t)) return ['gt0', 'filled', 'empty', 'equals', 'not_equals']
  return ['filled', 'empty', 'equals', 'not_equals']
}
/** A new section depends on the form's first money or number field, else a yes/no, else anything. */
const sectionPick = (tags: Tag[]) => tags.find((t) => t.tag && isAmount(t)) ?? tags.find((t) => t.type === 'checkbox') ?? tags.find((t) => t.tag) ?? tags[0]

function insertSigner(editor: LexicalEditor, roleId: string, type: FieldType) {
  editor.update(() => {
    if (type === 'signature') {
      // A signature block: a line to sign on, with the date beside it.
      $insertBlock($createGioSignNode(roleId, 'signature'))
      const sel = $getSelection()
      const p = $isRangeSelection(sel) ? $topBlock(sel.anchor.getNode()) : null
      const date = $createGioSignNode(roleId, 'date')
      const sig = p?.getPreviousSibling()
      if (sig && $isGioSignNode(sig)) sig.insertAfter(date)
      return
    }
    if (type === 'email' || type === 'data') return
    $insertInline($createGioFieldNode(roleId, type as InlineFieldType, type !== 'text' && type !== 'checkbox', ''))
  })
  editor.focus()
}

/* ---- "/" menu ------------------------------------------------------------- */

function SlashMenu({ items }: { items: SlashItem[] }) {
  const [editor] = useLexicalComposerContext()
  const [query, setQuery] = useState<string | null>(null)
  const trigger = useBasicTypeaheadTriggerMatch('/', { minLength: 0, maxLength: 40 })
  // In a table cell the menu offers what fits in a line: data tags and signer fields.
  const [inCell, setInCell] = useState(false)
  const rows = useMemo(() => slashRows(inCell ? items.filter((i) => i.opts.inline) : items, query ?? ''), [items, query, inCell])
  const close = () => editor.dispatchCommand(KEY_ESCAPE_COMMAND, new KeyboardEvent('keydown', { key: 'Escape' }))

  return (
    <LexicalTypeaheadMenuPlugin
      options={rows}
      triggerFn={trigger}
      onQueryChange={setQuery}
      // While the menu is open, Esc closes the menu, not the sheet (wizard-sheet honours data-escape-local).
      onOpen={() => {
        editor.getRootElement()?.setAttribute('data-escape-local', '')
        setInCell(editor.getEditorState().read(() => {
          const sel = $getSelection()
          return $isRangeSelection(sel) && $inTableCell(sel.anchor.getNode())
        }))
      }}
      onClose={() => editor.getRootElement()?.removeAttribute('data-escape-local')}
      onSelectOption={(option, textNode: TextNode | null, closeMenu) => {
        editor.update(() => {
          if (textNode) {
            textNode.selectPrevious()
            textNode.remove()
          }
        })
        rememberPick(option.key.replace(/^s:/, ''))
        option.run()
        closeMenu()
      }}
      menuRenderFn={(anchor, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchor.current ? (
          <SlashPanel
            anchor={anchor.current}
            host={editor.getRootElement()?.closest<HTMLElement>('[role="dialog"]') ?? document.body}
            rows={rows}
            active={selectedIndex}
            query={query ?? ''}
            onHover={setHighlightedIndex}
            onPick={selectOptionAndCleanUp}
            onClose={close}
          />
        ) : null
      }
    />
  )
}

/* ---- Selection ------------------------------------------------------------ */

type WSel =
  | { type: 'tag'; nodeKey: string; key: string; format: ValueFormat | null }
  | { type: 'field'; nodeKey: string; roleId: string; fieldType: InlineFieldType; required: boolean; label: string }
  | { type: 'sign'; nodeKey: string; roleId: string; kind: string }
  | { type: 'section'; nodeKey: string; key: string; op: IfOp; value: string }
  | null

function useWrittenSelection(editor: LexicalEditor) {
  const [sel, setSel] = useState<WSel>(null)
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) =>
        editorState.read(() => {
          const s = $getSelection()
          let next: WSel = null
          if ($isNodeSelection(s) && s.getNodes().length === 1) {
            const n = s.getNodes()[0]
            if ($isSignTagNode(n)) next = { type: 'tag', nodeKey: n.getKey(), key: n.getKeyName(), format: n.getFormat() }
            else if ($isGioFieldNode(n)) next = { type: 'field', nodeKey: n.getKey(), ...n.getField() }
            else if ($isGioSignNode(n)) next = { type: 'sign', nodeKey: n.getKey(), roleId: n.getRoleId(), kind: n.getKind() }
          } else if ($isRangeSelection(s)) {
            for (let n: LexicalNode | null = s.anchor.getNode(); n; n = n.getParent()) {
              if ($isGioIfNode(n)) {
                next = { type: 'section', nodeKey: n.getKey(), ...n.getCondition() }
                break
              }
            }
          }
          setSel((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
        }),
      ),
    [editor],
  )
  return sel
}

const FIELD_NOTE: Record<InlineFieldType, string> = {
  initials: 'They add their initials here when they sign.',
  date: 'Filled in for them with the day they sign.',
  name: 'Filled in with their name; they can correct it before signing.',
  text: 'They type a short answer here, on the line.',
  checkbox: 'They tick it if it applies.',
}

function SelectionPanel({
  sel,
  d,
  tags,
  sample,
  onClose,
}: {
  sel: NonNullable<WSel>
  d: TplDraft
  tags: Tag[]
  sample: Sample | null
  onClose: () => void
}) {
  const [editor] = useLexicalComposerContext()
  const people = d.roles.filter((r) => r.role !== 'cc')
  const edit = (fn: (n: LexicalNode) => void) =>
    editor.update(() => {
      const n = $getNodeByKey(sel.nodeKey)
      if (n) fn(n)
    })
  const remove = () => {
    edit((n) => n.remove())
    onClose()
  }
  const roleSelect = (value: string, label: string, onChange: (v: string) => void) => (
    <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9" aria-label={label}>
          <SelectValue placeholder="Pick a role" />
        </SelectTrigger>
        <SelectContent>
          {people.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.color }} />
                {r.label || 'Unnamed role'}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
  const note = (text: ReactNode, tone: 'info' | 'warn' = 'info') => (
    <p className="gio-send-note" data-tone={tone}>
      {tone === 'warn' ? <TriangleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden /> : <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />}
      <span>{text}</span>
    </p>
  )
  const removeButton = (label: string) => (
    <div>
      <Button variant="ghost" size="sm" icon={Trash2} className="text-virgilio-error" onClick={remove}>
        {label}
      </Button>
    </div>
  )

  if (sel.type === 'tag') {
    const t = tags.find((x) => x.key === sel.key)
    const fk = formatKind(sel.key, t?.type)
    return (
      <>
        <PanelHead icon={Database} title={t?.label ?? tagLabel(d.kind, sel.key)} sub={t?.tag ? `From the offer · ${offerCategory(t.tag)}` : 'Filled by Gio when the agreement is sent'} onClose={onClose} />
        {fk && (
          <FormatPicker
            fieldKey={sel.key}
            kind={fk}
            value={sel.format}
            onChange={(v) => edit((n) => $isSignTagNode(n) && n.setFormat(v))}
            config={t?.tag?.config}
            formId={d.kind === 'candidate' ? d.offer_form_id : null}
          />
        )}
        <div className="flex items-center justify-between gap-3 font-inter text-[12.5px]">
          <span className="text-text-primary">Signer can edit</span>
          <span className="inline-flex items-center gap-1 text-text-tertiary">
            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
            No · locked
          </span>
        </div>
        {t?.tag && !t.tag.required && note('Optional on the form, so it prints nothing when the offer leaves it empty.')}
        {removeButton('Remove from document')}
      </>
    )
  }

  if (sel.type === 'field') {
    const Icon = FIELD_ICON[sel.fieldType]
    return (
      <>
        <PanelHead icon={Icon} title={INLINE_FIELD_LABEL[sel.fieldType]} onClose={onClose} />
        {roleSelect(sel.roleId, 'Assigned to', (v) => edit((n) => $isGioFieldNode(n) && n.setField({ roleId: v })))}
        {note(FIELD_NOTE[sel.fieldType])}
        {(sel.fieldType === 'text' || sel.fieldType === 'checkbox') && (
          <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
            What it asks for
            <Input
              defaultValue={sel.label}
              maxLength={80}
              placeholder={sel.fieldType === 'text' ? 'e.g. Bank account' : 'e.g. I agree to the terms'}
              className="h-9"
              onChange={(e) => edit((n) => $isGioFieldNode(n) && n.setField({ label: e.target.value }))}
            />
          </label>
        )}
        {sel.fieldType !== 'date' && (
          <label className="flex items-center justify-between gap-3 font-inter text-[12.5px] text-text-primary">
            Required
            <Switch checked={sel.required} onCheckedChange={(v) => edit((n) => $isGioFieldNode(n) && n.setField({ required: v }))} aria-label="Required" />
          </label>
        )}
        {removeButton('Remove field')}
      </>
    )
  }

  if (sel.type === 'sign') {
    const role = people.find((r) => r.id === sel.roleId)
    return (
      <>
        <PanelHead icon={PenLine} title={BLOCK_LABEL[sel.kind as keyof typeof BLOCK_LABEL] ?? 'Signing block'} onClose={onClose} />
        {roleSelect(sel.roleId, 'Signs', (v) => edit((n) => $isGioSignNode(n) && n.setRoleId(v)))}
        {note(`Where ${role?.label || 'this person'} signs. Signing blocks stay outside conditional sections, so a signature always prints.`)}
        {removeButton('Remove')}
      </>
    )
  }

  // Conditional section
  const t = tags.find((x) => x.key === sel.key)
  const ops = opsFor(t)
  const setCond = (c: { key?: string; op?: IfOp; value?: string }) => edit((n) => $isGioIfNode(n) && n.setCondition(c))
  const shows = sample && sel.key ? conditionHolds(sel.op, sample.values[sel.key], sel.value) : null
  return (
    <>
      <PanelHead icon={Brackets} title="Conditional section" onClose={onClose} />
      <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
        Show only if
        <Select
          value={sel.key || undefined}
          onValueChange={(key) => {
            const next = opsFor(tags.find((x) => x.key === key))
            setCond({ key, op: next.includes(sel.op) ? sel.op : next[0] })
          }}
        >
          <SelectTrigger className="h-9" aria-label="Field the section depends on">
            <SelectValue placeholder="Pick a field" />
          </SelectTrigger>
          <SelectContent>
            {tags.map((x) => (
              <SelectItem key={x.key} value={x.key}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 font-inter text-[12.5px] font-medium text-text-primary">
        Rule
        <Select value={sel.op} onValueChange={(op) => setCond({ op: op as IfOp })}>
          <SelectTrigger className="h-9" aria-label="Rule">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ops.map((op) => (
              <SelectItem key={op} value={op}>
                {IF_LABEL[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {(sel.op === 'equals' || sel.op === 'not_equals') && (
        <Input className="h-9" aria-label="Value" placeholder="Value" defaultValue={sel.value} maxLength={200} onChange={(e) => setCond({ value: e.target.value })} />
      )}
      {shows != null && (
        <div className="flex items-center justify-between gap-3 font-inter text-[12.5px]">
          <span className="text-text-primary">For {sample?.firstName ? `${sample.firstName}’s` : 'the latest'} offer</span>
          <span className={cn('font-medium', shows ? 'text-[#16704A]' : 'text-text-tertiary')}>{shows ? 'Shown' : 'Hidden'}</span>
        </div>
      )}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            edit((n) => {
              if (!$isGioIfNode(n)) return
              for (const child of n.getChildren()) n.insertBefore(child)
              n.remove()
            })
            onClose()
          }}
        >
          Keep text, remove condition
        </Button>
      </div>
    </>
  )
}

/* ---- Plugins ---------------------------------------------------------------- */

function EditorRef({ to }: { to: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    to.current = editor
    return mergeRegister(registerWrittenRules(editor), registerTableRules(editor))
  }, [editor, to])
  return null
}

/** Shows each section's rule above it, in words ("Only if Bonus is more than 0"). */
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

/* ---- The pane ---------------------------------------------------------------- */

export function WrittenPane({
  d,
  set,
  doc,
  preview,
  sample,
}: {
  /** The template as it will be saved (effectiveDraft). */
  d: TplDraft
  set: (fn: (d: TplDraft) => TplDraft) => void
  doc: TplWritten
  preview: boolean
  sample: Sample | null
}) {
  const editorRef = useRef<LexicalEditor | null>(null)
  // The page, where the block handles sit (Gio Docs' gutter, in its left margin).
  const [paper, setPaper] = useState<HTMLDivElement | null>(null)
  const people = d.roles.filter((r) => r.role !== 'cc')
  const [who, setWho] = useState(people[0]?.id ?? null)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (!people.some((p) => p.id === who)) setWho(people[0]?.id ?? null)
  }, [people, who])
  const tags = useWrittenTags(d)

  const labels = useMemo<WrittenLabels>(
    () => ({
      tag: (k) => tags.find((t) => t.key === k)?.label ?? tagLabel(d.kind, k),
      role: (id) => {
        const r = d.roles.find((x) => x.id === id && x.role !== 'cc')
        return r ? { label: r.label || 'Unnamed role', color: r.color } : null
      },
    }),
    [tags, d.roles, d.kind],
  )
  const sectionLabel = useCallback(
    (key: string, op: IfOp, value: string) =>
      key ? `Only if ${labels.tag(key)} ${IF_LABEL[op]}${op === 'equals' || op === 'not_equals' ? ` “${value}”` : ''}` : 'Only if… (pick a field on the right)',
    [labels],
  )

  const run = (fn: (editor: LexicalEditor) => void) => {
    const editor = editorRef.current
    if (!editor) return
    fn(editor)
  }
  const insertTag = (key: string) =>
    run((editor) => {
      editor.update(() => $insertInline($createSignTagNode(key)))
      editor.focus()
    })
  const addSection = () =>
    run((editor) => {
      let p: string | null = null
      editor.update(() => {
        p = $wrapInSection(sectionPick(tags))
      })
      setProblem(p)
      editor.focus()
    })

  // The "/" menu, Gio Docs' sections: basic blocks, signing, the form's fields by category, the values every template has, then advanced.
  const items = useMemo(() => {
    const out: SlashItem[] = []
    const block = (key: string, label: string, icon: SlashIcon, make: () => ElementNode, md: string, preview: Preview, kw: string) =>
      out.push(
        new SlashItem(key, label, 'Basic blocks', icon, () =>
          run((e) => {
            e.update(() => {
              const sel = $getSelection()
              if ($isRangeSelection(sel)) $setBlocksType(sel, make)
            })
            e.focus()
          }),
        { md, preview, kw },
        ),
      )
    block('text', 'Text', 'text', () => $createParagraphNode(), '', BLOCK_PREVIEWS.text, 'text paragraph plain body')
    block('h1', 'Heading 1', 'h1', () => $createHeadingNode('h1'), '#', BLOCK_PREVIEWS.h1, 'h1 heading title')
    block('h2', 'Heading 2', 'h2', () => $createHeadingNode('h2'), '##', BLOCK_PREVIEWS.h2, 'h2 heading subheading')
    block('h3', 'Heading 3', 'h3', () => $createHeadingNode('h3'), '###', BLOCK_PREVIEWS.h3, 'h3 heading')
    out.push(new SlashItem('bullet', 'Bulleted list', 'Basic blocks', 'bullet', () => run((e) => (e.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined), e.focus())), { md: '-', kw: 'bullet list ul', preview: BLOCK_PREVIEWS.bullet }))
    out.push(new SlashItem('numbered', 'Numbered list', 'Basic blocks', 'numbered', () => run((e) => (e.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined), e.focus())), { md: '1.', kw: 'number list ol', preview: BLOCK_PREVIEWS.numbered }))
    block('quote', 'Quote', 'quote', () => $createQuoteNode(), '>', BLOCK_PREVIEWS.quote, 'quote blockquote')
    block('callout', 'Callout', 'callout', () => $newCallout(), '!>', BLOCK_PREVIEWS.callout, 'callout note tip info warning box highlight')
    out.push(new SlashItem('table', 'Table', 'Basic blocks', 'table', () => run((e) => insertTable(e)), { kw: 'table grid rows columns', preview: BLOCK_PREVIEWS.table }))
    out.push(new SlashItem('divider', 'Divider', 'Basic blocks', 'divider', () => run((e) => (e.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined), e.focus())), { md: '---', kw: 'divider line rule hr', preview: BLOCK_PREVIEWS.divider }))

    for (const r of people) {
      out.push(new SlashItem(`sign-${r.id}`, `${r.label || 'Unnamed role'} · Signature block`, 'Signing', 'sign', () => run((e) => insertSigner(e, r.id, 'signature')), { color: r.color, kw: 'signature sign', preview: signPreview(r.label, r.color) }))
    }
    const whoR = people.find((r) => r.id === who)
    if (whoR) {
      const fields: [InlineFieldType, SlashIcon][] = [['initials', 'initials'], ['date', 'date'], ['name', 'name'], ['text', 'input'], ['checkbox', 'checkbox']]
      for (const [t, ic] of fields) {
        out.push(new SlashItem(`field-${t}`, `${INLINE_FIELD_LABEL[t]} · ${whoR.label || 'Signer'}`, 'Signing', ic, () => run((e) => insertSigner(e, whoR.id, t)), { kw: 'signer field', preview: signerFieldPreview(whoR.label, whoR.color, INLINE_FIELD_LABEL[t], FIELD_NOTE[t]), inline: true }))
      }
    }

    const sample = (t: Tag) => {
      const k = formatKind(t.key, t.type)
      return k ? formatSample(k, null, t.tag?.config) : null
    }
    const form = tags.filter((t) => t.tag)
    for (const c of OFFER_CATEGORIES) {
      for (const t of form.filter((x) => offerCategory(x.tag!) === c)) {
        out.push(new SlashItem(`tag-${t.key}`, t.label, c, 'field', () => insertTag(t.key), { kw: 'offer field', preview: fieldPreview(t.label, sample(t), 'Filled in from the offer when it’s sent.'), inline: true }))
      }
    }
    for (const t of tags.filter((x) => !x.tag)) {
      out.push(new SlashItem(`tag-${t.key}`, t.label, 'Always available', 'field', () => insertTag(t.key), { kw: 'field', preview: fieldPreview(t.label, sample(t), 'Filled in by Gio when the agreement is sent.'), inline: true }))
    }

    out.push(new SlashItem('section', 'Conditional section', 'Advanced', 'section', addSection, { kw: 'condition if only', preview: BLOCK_PREVIEWS.section }))
    out.push(new SlashItem('break', 'Page break', 'Advanced', 'pageBreak', () => run((e) => e.update(() => $insertBlock($createGioPageBreakNode()))), { kw: 'page new', preview: BLOCK_PREVIEWS.pageBreak }))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, who, people.map((r) => `${r.id}:${r.label}:${r.color}`).join('|')])

  const initialConfig = useMemo(
    () => ({
      namespace: 'gio-written',
      theme: THEME,
      nodes: NODES,
      editorState: JSON.stringify(doc.content),
      onError: (e: Error) => console.error('written editor', e),
    }),
    // The editor owns the text from here; it reports changes through OnChangePlugin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc.id],
  )

  // Preview: the sample offer's values (formatted ones too), or [Labels] when there's no offer to use.
  const previewInput = useMemo(() => {
    if (!preview) return null
    const byKey = Object.fromEntries(tags.map((t) => [t.key, t.label]))
    return {
      name: doc.name.trim() || 'Untitled document',
      content: doc.content,
      roles: Object.fromEntries(d.roles.map((r) => [r.id, r.label || 'Signer'])),
      ...(sample ? { values: sample.values, highlight: byKey, empty: 'red' as const } : { tags: byKey }),
    }
  }, [preview, doc.name, doc.content, d.roles, tags, sample])
  const pdf = useWrittenPreview(previewInput)

  return (
    <WrittenLabelsContext.Provider value={labels}>
      <LexicalComposer key={doc.id} initialConfig={initialConfig}>
        <div className="grid h-full min-h-0 grid-cols-[210px_minmax(0,1fr)_240px] border-t border-virgilio-border min-[1200px]:grid-cols-[230px_minmax(0,1fr)_280px]">
          <FieldList
            d={d}
            set={set}
            mode="written"
            who={who}
            setWho={setWho}
            signerTypes={[...WRITTEN_SIGNER_TYPES]}
            onTile={(type, key) => (type === 'data' ? key && insertTag(key) : who && run((e) => insertSigner(e, who, type)))}
            onBlock={addSection}
          />

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className={cn('flex min-h-0 flex-1 flex-col', preview && 'hidden')}>
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#ECEAE2] px-6 py-8" data-no-swipe>
                <div ref={setPaper} className="gio-written-paper mx-auto">
                  <DocTitle value={doc.name} onChange={(name) => set((x) => ({ ...x, written: x.written.map((w) => (w.id === doc.id ? { ...w, name } : w)) }))} />
                  <RichTextPlugin
                    contentEditable={<ContentEditable className="gio-written-root" aria-label="Document text" aria-multiline="true" role="textbox" />}
                    placeholder={null}
                    ErrorBoundary={LexicalErrorBoundary}
                  />
                </div>
              </div>
              <p className="gio-field-message min-h-[18px] border-t border-virgilio-border bg-white px-3 py-1 font-inter text-[12px] text-virgilio-error" role={problem ? 'alert' : undefined}>
                {problem}
              </p>
            </div>
            {preview && (
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#ECEAE2] px-6 py-8" data-no-swipe aria-label="Preview of the document">
                {pdf.isError ? (
                  <div className="mx-auto max-w-md rounded-xl border border-[#E7E8EE] bg-white p-5 text-center">
                    <p className="font-inter text-[13px] text-text-primary">{(pdf.error as Error)?.message || 'The preview couldn’t be made.'}</p>
                    <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void pdf.refetch()}>
                      Retry
                    </Button>
                  </div>
                ) : pdf.data ? (
                  <div className="mx-auto flex w-[720px] max-w-full flex-col gap-4">
                    {Array.from({ length: pdf.data.page_count }, (_, i) => (
                      <div key={i}>
                        <PdfPage doc={pdf.data!} index={i} width={720} />
                        <p className="mt-1.5 text-right font-inter text-[11px] tabular-nums text-text-tertiary">
                          {i + 1} / {pdf.data!.page_count}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mx-auto w-[720px] max-w-full">
                    <Skeleton className="w-full rounded-md" style={{ aspectRatio: '612 / 792' }} />
                  </div>
                )}
              </div>
            )}
          </div>

          <RightPanel d={d} tags={tags} sample={sample} />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <HorizontalRulePlugin />
        <TablePlugin hasCellMerge={false} hasCellBackgroundColor={false} />
        <EditorRef to={editorRef} />
        <SectionLabels label={sectionLabel} />
        <SlashMenu items={items} />
        <TypingShortcuts />
        {!preview && <FloatingToolbar onSection={addSection} />}
        {!preview && <CalloutPicker />}
        {paper && !preview && <TableTools anchor={paper} />}
        {paper && !preview && <BlockHandles anchor={paper} />}
        <DuplicateShortcut />
        <EmptyLineHints />
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(state) => {
            const content = state.toJSON() as unknown as LexicalJson
            setProblem(null)
            set((x) => ({ ...x, written: x.written.map((w) => (w.id === doc.id ? { ...w, content } : w)) }))
          }}
        />
      </LexicalComposer>
    </WrittenLabelsContext.Provider>
  )
}

function RightPanel({ d, tags, sample }: { d: TplDraft; tags: Tag[]; sample: Sample | null }) {
  const [editor] = useLexicalComposerContext()
  const sel = useWrittenSelection(editor)
  // A closed section panel stays closed until the caret moves to another one.
  const [closed, setClosed] = useState<string | null>(null)
  const shown = sel && !(sel.type === 'section' && closed === sel.nodeKey) ? sel : null
  const close = () => {
    if (sel?.type === 'section') setClosed(sel.nodeKey)
    else editor.update(() => $setSelection(null))
  }
  return (
    <aside aria-label="Field settings" className="flex min-h-0 flex-col overflow-y-auto border-l border-virgilio-border bg-white">
      <div key={shown ? `${shown.type}-${shown.nodeKey}` : 'summary'} className="gio-swap-in flex flex-col gap-3.5 p-4">
        {shown ? <SelectionPanel sel={shown} d={d} tags={tags} sample={sample} onClose={close} /> : <FieldSummary d={d} />}
      </div>
    </aside>
  )
}
