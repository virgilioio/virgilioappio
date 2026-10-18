/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { X } from 'lucide-react'

import { tint, edge } from '@/components/sign/PdfPage'
import { BLOCK_LABEL, type IfOp, type SignBlockKind } from '@/lib/sign/written'
import type { ValueFormat } from '@/lib/sign/formats'
import {
  CALLOUT_ICONS,
  calloutIcon,
  calloutTone,
  type CalloutIcon,
  type CalloutTone,
} from '../../../../supabase/functions/_shared/sign/writtenLayout.ts'

/**
 * The written-document editor's own pieces (2026-10-17). Their JSON is what
 * the server lays out (_shared/sign/writtenLayout.ts), so the types and keys
 * here are a contract: "placeholder" { placeholderKey, format? }, "gio-if"
 * { key, op, value } around blocks, "gio-sign" { roleId, kind }, "gio-field"
 * { roleId, fieldType, required, label } inside the text, "gio-page-break",
 * "gio-callout" { icon, tone } around text, "gio-columns" around exactly two
 * "gio-column"s of blocks (columns.tsx keeps them in shape), "gio-image"
 * { path, w, h, width, align } (image.tsx).
 * Chips, fields and blocks are selected with a click (a 2px noir ring);
 * Delete or Backspace removes the selection.
 */

/** Signer fields that can sit inside the text (sign_save_template checks the same list). */
export type InlineFieldType = 'initials' | 'date' | 'name' | 'text' | 'checkbox'
export const INLINE_FIELD_LABEL: Record<InlineFieldType, string> = {
  initials: 'Initials',
  date: 'Date signed',
  name: 'Full name',
  text: 'Text',
  checkbox: 'Checkbox',
}

export interface WrittenLabels {
  tag: (key: string) => string
  role: (id: string) => { label: string; color: string } | null
}
export const WrittenLabelsContext = createContext<WrittenLabels>({ tag: (k) => k, role: () => null })

function useRemove(nodeKey: NodeKey) {
  const [editor] = useLexicalComposerContext()
  return () =>
    editor.update(() => {
      $getNodeByKey(nodeKey)?.remove()
    })
}

/** Click selects the node (Shift adds to the selection), through Lexical's own click handling. */
export function useSelect(nodeKey: NodeKey) {
  const [editor] = useLexicalComposerContext()
  const [selected, setSelected, clear] = useLexicalNodeSelection(nodeKey)
  const ref = useRef<HTMLElement | null>(null)
  useEffect(
    () =>
      editor.registerCommand(
        CLICK_COMMAND,
        (e: MouseEvent) => {
          const t = e.target as HTMLElement
          if (!ref.current || !ref.current.contains(t) || t.closest('button')) return false
          if (!e.shiftKey) clear()
          setSelected(true)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor, clear, setSelected],
  )
  return { selected, ref }
}

/* ---- Data tag ----------------------------------------------------------- */

export type SerializedSignTagNode = Spread<{ placeholderKey: string; format?: ValueFormat }, SerializedLexicalNode>

function TagChip({ k, nodeKey }: { k: string; nodeKey: NodeKey }) {
  const labels = useContext(WrittenLabelsContext)
  const { selected, ref } = useSelect(nodeKey)
  return (
    <span ref={ref} className="gio-written-tag" contentEditable={false} data-key={k} data-selected={selected || undefined}>
      {labels.tag(k)}
    </span>
  )
}

export class SignTagNode extends DecoratorNode<ReactNode> {
  __placeholderKey: string
  __format: ValueFormat | null

  static getType() {
    return 'placeholder'
  }
  static clone(node: SignTagNode) {
    return new SignTagNode(node.__placeholderKey, node.__format, node.__key)
  }
  constructor(placeholderKey: string, format: ValueFormat | null = null, key?: NodeKey) {
    super(key)
    this.__placeholderKey = placeholderKey
    this.__format = format
  }
  static importJSON(json: SerializedSignTagNode) {
    return $createSignTagNode(json.placeholderKey, typeof json.format === 'string' ? json.format : null)
  }
  exportJSON(): SerializedSignTagNode {
    // "format" is the print format (sign_format); left out when it's the default wording.
    return { type: 'placeholder', version: 1, placeholderKey: this.__placeholderKey, ...(this.__format ? { format: this.__format } : null) }
  }
  getFormat() {
    return this.getLatest().__format
  }
  setFormat(f: ValueFormat | null) {
    const w = this.getWritable()
    w.__format = f
    return w
  }
  createDOM() {
    const span = document.createElement('span')
    span.className = 'gio-written-tag-wrap'
    return span
  }
  updateDOM() {
    return false
  }
  isInline() {
    return true
  }
  getTextContent() {
    return `{{${this.__placeholderKey}}}`
  }
  getKeyName() {
    return this.__placeholderKey
  }
  decorate() {
    return <TagChip k={this.__placeholderKey} nodeKey={this.__key} />
  }
}

export const $createSignTagNode = (key: string, format: ValueFormat | null = null) => $applyNodeReplacement(new SignTagNode(key, format))
export const $isSignTagNode = (n: LexicalNode | null | undefined): n is SignTagNode => n instanceof SignTagNode

/* ---- Conditional section ------------------------------------------------ */

export type SerializedGioIfNode = Spread<{ key: string; op: IfOp; value: string }, SerializedElementNode>

export class GioIfNode extends ElementNode {
  __ifKey: string
  __op: IfOp
  __value: string

  static getType() {
    return 'gio-if'
  }
  static clone(node: GioIfNode) {
    return new GioIfNode(node.__ifKey, node.__op, node.__value, node.__key)
  }
  constructor(ifKey = '', op: IfOp = 'filled', value = '', key?: NodeKey) {
    super(key)
    this.__ifKey = ifKey
    this.__op = op
    this.__value = value
  }
  static importJSON(json: SerializedGioIfNode) {
    const node = $createGioIfNode(json.key, json.op, json.value)
    node.setFormat(json.format)
    node.setIndent(json.indent)
    node.setDirection(json.direction)
    return node
  }
  exportJSON(): SerializedGioIfNode {
    return { ...super.exportJSON(), type: 'gio-if', version: 1, key: this.__ifKey, op: this.__op, value: this.__value }
  }
  createDOM() {
    const div = document.createElement('div')
    div.className = 'gio-written-if'
    div.dataset.key = this.__ifKey
    return div
  }
  updateDOM(prev: GioIfNode, dom: HTMLElement) {
    if (prev.__ifKey !== this.__ifKey) dom.dataset.key = this.__ifKey
    return false
  }
  isShadowRoot() {
    return true
  }
  canBeEmpty() {
    return false
  }
  isInline() {
    return false
  }
  getCondition() {
    const self = this.getLatest()
    return { key: self.__ifKey, op: self.__op, value: self.__value }
  }
  setCondition(c: { key?: string; op?: IfOp; value?: string }) {
    const w = this.getWritable()
    if (c.key !== undefined) w.__ifKey = c.key
    if (c.op !== undefined) w.__op = c.op
    if (c.value !== undefined) w.__value = c.value
    return w
  }
}

export const $createGioIfNode = (key: string, op: IfOp, value = '') => $applyNodeReplacement(new GioIfNode(key, op, value))
export const $isGioIfNode = (n: LexicalNode | null | undefined): n is GioIfNode => n instanceof GioIfNode

/* ---- Callout -------------------------------------------------------------- */

export type SerializedCalloutNode = Spread<{ icon: CalloutIcon; tone: CalloutTone }, SerializedElementNode>

/** The icon's strokes as SVG markup (the same Lucide paths the PDF draws). */
export function calloutIconSvg(icon: CalloutIcon) {
  if (icon === 'none') return ''
  const paths = CALLOUT_ICONS[icon].paths.map((d) => `<path d="${d}"/>`).join('')
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

/**
 * Gio Docs' callout (2026-10-18): text in a tinted box with an icon. The
 * icon is a button (callout.tsx opens the icon and colour picker from it);
 * the text goes in the inner slot. Enter leaves the callout for a new line
 * below; Backspace at its start turns it back into text.
 */
export class CalloutNode extends ElementNode {
  __icon: CalloutIcon
  __tone: CalloutTone

  static getType() {
    return 'gio-callout'
  }
  static clone(node: CalloutNode) {
    return new CalloutNode(node.__icon, node.__tone, node.__key)
  }
  constructor(icon: CalloutIcon = 'idea', tone: CalloutTone = 'yellow', key?: NodeKey) {
    super(key)
    this.__icon = icon
    this.__tone = tone
  }
  static importJSON(json: SerializedCalloutNode) {
    const node = $createCalloutNode(calloutIcon(json.icon), calloutTone(json.tone))
    node.setFormat(json.format)
    node.setIndent(json.indent)
    node.setDirection(json.direction)
    return node
  }
  exportJSON(): SerializedCalloutNode {
    return { ...super.exportJSON(), type: 'gio-callout', version: 1, icon: this.__icon, tone: this.__tone }
  }
  createDOM() {
    const div = document.createElement('div')
    div.className = 'gio-written-callout'
    div.dataset.tone = this.__tone
    div.dataset.icon = this.__icon
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'gio-callout-icon'
    btn.contentEditable = 'false'
    btn.tabIndex = -1
    btn.setAttribute('aria-label', 'Callout icon and colour')
    btn.innerHTML = calloutIconSvg(this.__icon)
    const text = document.createElement('div')
    text.className = 'gio-callout-text'
    text.dataset.hintSlot = ''
    div.append(btn, text)
    return div
  }
  getDOMSlot(element: HTMLElement) {
    return super.getDOMSlot(element).withElement(element.querySelector<HTMLElement>('.gio-callout-text')!)
  }
  updateDOM(prev: CalloutNode, dom: HTMLElement) {
    if (prev.__tone !== this.__tone) dom.dataset.tone = this.__tone
    if (prev.__icon !== this.__icon) {
      dom.dataset.icon = this.__icon
      const btn = dom.querySelector('.gio-callout-icon')
      if (btn) btn.innerHTML = calloutIconSvg(this.__icon)
    }
    return false
  }
  isInline() {
    return false
  }
  canBeEmpty() {
    return true
  }
  insertNewAfter(_: RangeSelection, restoreSelection = true) {
    const p = $createParagraphNode()
    p.setDirection(this.getDirection())
    this.insertAfter(p, restoreSelection)
    return p
  }
  collapseAtStart() {
    const p = $createParagraphNode()
    this.getChildren().forEach((child) => p.append(child))
    this.replace(p)
    return true
  }
  getLook() {
    const self = this.getLatest()
    return { icon: self.__icon, tone: self.__tone }
  }
  setLook(s: { icon?: CalloutIcon; tone?: CalloutTone }) {
    const w = this.getWritable()
    if (s.icon) w.__icon = s.icon
    if (s.tone) w.__tone = s.tone
    return w
  }
}

export const $createCalloutNode = (icon: CalloutIcon = 'idea', tone: CalloutTone = 'yellow') => $applyNodeReplacement(new CalloutNode(icon, tone))
export const $isCalloutNode = (n: LexicalNode | null | undefined): n is CalloutNode => n instanceof CalloutNode

/* ---- Two columns ---------------------------------------------------------- */

/** Two columns side by side (Gio Docs' columns, two only). Its children are always two ColumnNodes. */
export class ColumnsNode extends ElementNode {
  static getType() {
    return 'gio-columns'
  }
  static clone(node: ColumnsNode) {
    return new ColumnsNode(node.__key)
  }
  static importJSON(json: SerializedElementNode) {
    return $createColumnsNode().updateFromJSON(json)
  }
  exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: 'gio-columns', version: 1 }
  }
  createDOM() {
    const div = document.createElement('div')
    div.className = 'gio-written-columns'
    return div
  }
  updateDOM() {
    return false
  }
  isInline() {
    return false
  }
  canBeEmpty() {
    return false
  }
  canIndent() {
    return false
  }
}

/** One column: a run of blocks. Backspace and selection stay inside it (a shadow root). */
export class ColumnNode extends ElementNode {
  static getType() {
    return 'gio-column'
  }
  static clone(node: ColumnNode) {
    return new ColumnNode(node.__key)
  }
  static importJSON(json: SerializedElementNode) {
    return $createColumnNode().updateFromJSON(json)
  }
  exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: 'gio-column', version: 1 }
  }
  createDOM() {
    const div = document.createElement('div')
    div.className = 'gio-written-column'
    return div
  }
  updateDOM() {
    return false
  }
  isInline() {
    return false
  }
  isShadowRoot() {
    return true
  }
  canBeEmpty() {
    return false
  }
  canIndent() {
    return false
  }
}

export const $createColumnsNode = () => $applyNodeReplacement(new ColumnsNode())
export const $isColumnsNode = (n: LexicalNode | null | undefined): n is ColumnsNode => n instanceof ColumnsNode
export const $createColumnNode = () => $applyNodeReplacement(new ColumnNode())
export const $isColumnNode = (n: LexicalNode | null | undefined): n is ColumnNode => n instanceof ColumnNode

/* ---- Signing block ------------------------------------------------------ */

export type SerializedGioSignNode = Spread<{ roleId: string; kind: SignBlockKind }, SerializedLexicalNode>

function SignBlockView({ roleId, kind, nodeKey }: { roleId: string; kind: SignBlockKind; nodeKey: NodeKey }) {
  const labels = useContext(WrittenLabelsContext)
  const role = labels.role(roleId)
  const remove = useRemove(nodeKey)
  const { selected, ref } = useSelect(nodeKey)
  const color = role?.color ?? '#E4E3DD'
  const label = `${role?.label ?? 'Removed role'} · ${BLOCK_LABEL[kind]}`
  return (
    <div className="gio-written-sign" data-kind={kind} contentEditable={false}>
      <div
        className="gio-written-sign-box"
        style={{ background: tint(color, 0.28), borderColor: edge(color) }}
        data-missing={role ? undefined : true}
        data-selected={selected || undefined}
        ref={ref as React.Ref<HTMLDivElement>}
      >
        <span className="truncate">{label}</span>
        <button type="button" className="gio-written-x" aria-label={`Remove ${label}`} onClick={remove}>
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export class GioSignNode extends DecoratorNode<ReactNode> {
  __roleId: string
  __kind: SignBlockKind

  static getType() {
    return 'gio-sign'
  }
  static clone(node: GioSignNode) {
    return new GioSignNode(node.__roleId, node.__kind, node.__key)
  }
  constructor(roleId: string, kind: SignBlockKind = 'signature', key?: NodeKey) {
    super(key)
    this.__roleId = roleId
    this.__kind = kind
  }
  static importJSON(json: SerializedGioSignNode) {
    return $createGioSignNode(json.roleId, json.kind ?? 'signature')
  }
  exportJSON(): SerializedGioSignNode {
    return { type: 'gio-sign', version: 1, roleId: this.__roleId, kind: this.__kind }
  }
  createDOM() {
    const div = document.createElement('div')
    div.className = 'gio-written-block-wrap'
    return div
  }
  updateDOM() {
    return false
  }
  isInline() {
    return false
  }
  getTextContent() {
    return '\n'
  }
  getRoleId() {
    return this.getLatest().__roleId
  }
  getKind() {
    return this.getLatest().__kind
  }
  setRoleId(id: string) {
    const w = this.getWritable()
    w.__roleId = id
    return w
  }
  decorate() {
    return <SignBlockView roleId={this.__roleId} kind={this.__kind} nodeKey={this.__key} />
  }
}

export const $createGioSignNode = (roleId: string, kind: SignBlockKind) => $applyNodeReplacement(new GioSignNode(roleId, kind))
export const $isGioSignNode = (n: LexicalNode | null | undefined): n is GioSignNode => n instanceof GioSignNode

/* ---- Signer field inside the text --------------------------------------- */

export type SerializedGioFieldNode = Spread<{ roleId: string; fieldType: InlineFieldType; required: boolean; label: string }, SerializedLexicalNode>

function FieldChip({ roleId, fieldType, nodeKey }: { roleId: string; fieldType: InlineFieldType; nodeKey: NodeKey }) {
  const labels = useContext(WrittenLabelsContext)
  const role = labels.role(roleId)
  const { selected, ref } = useSelect(nodeKey)
  const color = role?.color ?? '#E4E3DD'
  return (
    <span
      ref={ref}
      className="gio-written-field"
      contentEditable={false}
      data-type={fieldType}
      data-missing={role ? undefined : true}
      data-selected={selected || undefined}
      style={{ background: tint(color, 0.45), borderColor: edge(color) }}
    >
      {fieldType === 'checkbox' && <span className="gio-written-field-box" aria-hidden />}
      {role?.label ?? 'Removed role'} · {INLINE_FIELD_LABEL[fieldType]}
    </span>
  )
}

export class GioFieldNode extends DecoratorNode<ReactNode> {
  __roleId: string
  __fieldType: InlineFieldType
  __required: boolean
  __label: string

  static getType() {
    return 'gio-field'
  }
  static clone(node: GioFieldNode) {
    return new GioFieldNode(node.__roleId, node.__fieldType, node.__required, node.__label, node.__key)
  }
  constructor(roleId: string, fieldType: InlineFieldType = 'text', required = true, label = '', key?: NodeKey) {
    super(key)
    this.__roleId = roleId
    this.__fieldType = fieldType
    this.__required = required
    this.__label = label
  }
  static importJSON(json: SerializedGioFieldNode) {
    return $createGioFieldNode(json.roleId, json.fieldType, json.required !== false, json.label ?? '')
  }
  exportJSON(): SerializedGioFieldNode {
    return { type: 'gio-field', version: 1, roleId: this.__roleId, fieldType: this.__fieldType, required: this.__required, label: this.__label }
  }
  createDOM() {
    const span = document.createElement('span')
    span.className = 'gio-written-tag-wrap'
    return span
  }
  updateDOM() {
    return false
  }
  isInline() {
    return true
  }
  getTextContent() {
    return ` [${INLINE_FIELD_LABEL[this.__fieldType]}] `
  }
  getField() {
    const s = this.getLatest()
    return { roleId: s.__roleId, fieldType: s.__fieldType, required: s.__required, label: s.__label }
  }
  setField(p: { roleId?: string; required?: boolean; label?: string }) {
    const w = this.getWritable()
    if (p.roleId !== undefined) w.__roleId = p.roleId
    if (p.required !== undefined) w.__required = p.required
    if (p.label !== undefined) w.__label = p.label
    return w
  }
  decorate() {
    return <FieldChip roleId={this.__roleId} fieldType={this.__fieldType} nodeKey={this.__key} />
  }
}

export const $createGioFieldNode = (roleId: string, fieldType: InlineFieldType, required = true, label = '') =>
  $applyNodeReplacement(new GioFieldNode(roleId, fieldType, required, label))
export const $isGioFieldNode = (n: LexicalNode | null | undefined): n is GioFieldNode => n instanceof GioFieldNode

/* ---- Page break --------------------------------------------------------- */

function PageBreakView({ nodeKey }: { nodeKey: NodeKey }) {
  const remove = useRemove(nodeKey)
  return (
    <div className="gio-written-break" contentEditable={false}>
      <span>Page break</span>
      <button type="button" className="gio-written-x" aria-label="Remove page break" onClick={remove}>
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

export class GioPageBreakNode extends DecoratorNode<ReactNode> {
  static getType() {
    return 'gio-page-break'
  }
  static clone(node: GioPageBreakNode) {
    return new GioPageBreakNode(node.__key)
  }
  static importJSON() {
    return $createGioPageBreakNode()
  }
  exportJSON(): SerializedLexicalNode {
    return { type: 'gio-page-break', version: 1 }
  }
  createDOM() {
    const div = document.createElement('div')
    div.className = 'gio-written-block-wrap'
    return div
  }
  updateDOM() {
    return false
  }
  isInline() {
    return false
  }
  getTextContent() {
    return '\n'
  }
  decorate() {
    return <PageBreakView nodeKey={this.__key} />
  }
}

export const $createGioPageBreakNode = () => $applyNodeReplacement(new GioPageBreakNode())

/** Signing blocks never sit inside a section (it might not print), and sections don't nest. */
export function registerWrittenRules(editor: LexicalEditor) {
  const outOfSection = (node: LexicalNode) => {
    let p = node.getParent()
    while (p && !$isGioIfNode(p)) p = p.getParent()
    return p
  }
  const a = editor.registerNodeTransform(GioSignNode, (node) => {
    const section = outOfSection(node)
    if (section) section.insertAfter(node)
  })
  const b = editor.registerNodeTransform(GioIfNode, (node) => {
    const outer = outOfSection(node)
    if (outer) {
      for (const child of node.getChildren()) node.insertBefore(child)
      node.remove()
    }
  })
  // Delete or Backspace removes selected chips, fields and blocks.
  const removeSelected = (e: KeyboardEvent | null) => {
    const sel = $getSelection()
    if (!$isNodeSelection(sel)) return false
    e?.preventDefault()
    sel.getNodes().forEach((n) => n.remove())
    return true
  }
  const c = editor.registerCommand(KEY_DELETE_COMMAND, removeSelected, COMMAND_PRIORITY_LOW)
  const d = editor.registerCommand(KEY_BACKSPACE_COMMAND, removeSelected, COMMAND_PRIORITY_LOW)
  return () => {
    a()
    b()
    c()
    d()
  }
}
