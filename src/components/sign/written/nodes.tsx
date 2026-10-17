/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react'
import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { X } from 'lucide-react'

import { tint, edge } from '@/components/sign/PdfPage'
import { BLOCK_LABEL, type IfOp, type SignBlockKind } from '@/lib/sign/written'

/**
 * The written-document editor's own pieces (2026-10-17). Their JSON is what
 * the server lays out (_shared/sign/writtenLayout.ts), so the types and keys
 * here are a contract: "placeholder" { placeholderKey }, "gio-if" { key, op,
 * value } around blocks, "gio-sign" { roleId, kind }, "gio-page-break".
 */

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

/* ---- Data tag ----------------------------------------------------------- */

export type SerializedSignTagNode = Spread<{ placeholderKey: string }, SerializedLexicalNode>

function TagChip({ k }: { k: string }) {
  const labels = useContext(WrittenLabelsContext)
  return (
    <span className="gio-written-tag" contentEditable={false} data-key={k}>
      {labels.tag(k)}
    </span>
  )
}

export class SignTagNode extends DecoratorNode<ReactNode> {
  __placeholderKey: string

  static getType() {
    return 'placeholder'
  }
  static clone(node: SignTagNode) {
    return new SignTagNode(node.__placeholderKey, node.__key)
  }
  constructor(placeholderKey: string, key?: NodeKey) {
    super(key)
    this.__placeholderKey = placeholderKey
  }
  static importJSON(json: SerializedSignTagNode) {
    return $createSignTagNode(json.placeholderKey)
  }
  exportJSON(): SerializedSignTagNode {
    return { type: 'placeholder', version: 1, placeholderKey: this.__placeholderKey }
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
    return <TagChip k={this.__placeholderKey} />
  }
}

export const $createSignTagNode = (key: string) => $applyNodeReplacement(new SignTagNode(key))
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

/* ---- Signing block ------------------------------------------------------ */

export type SerializedGioSignNode = Spread<{ roleId: string; kind: SignBlockKind }, SerializedLexicalNode>

function SignBlockView({ roleId, kind, nodeKey }: { roleId: string; kind: SignBlockKind; nodeKey: NodeKey }) {
  const labels = useContext(WrittenLabelsContext)
  const role = labels.role(roleId)
  const remove = useRemove(nodeKey)
  const color = role?.color ?? '#E4E3DD'
  const label = `${role?.label ?? 'Removed role'} · ${BLOCK_LABEL[kind]}`
  return (
    <div className="gio-written-sign" data-kind={kind} contentEditable={false}>
      <div
        className="gio-written-sign-box"
        style={{ background: tint(color, 0.28), borderColor: edge(color) }}
        data-missing={role ? undefined : true}
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
  decorate() {
    return <SignBlockView roleId={this.__roleId} kind={this.__kind} nodeKey={this.__key} />
  }
}

export const $createGioSignNode = (roleId: string, kind: SignBlockKind) => $applyNodeReplacement(new GioSignNode(roleId, kind))
export const $isGioSignNode = (n: LexicalNode | null | undefined): n is GioSignNode => n instanceof GioSignNode

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
  return () => {
    a()
    b()
  }
}
