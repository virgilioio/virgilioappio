import { mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  type LexicalEditor,
  type LexicalNode,
  type ParagraphNode,
} from 'lexical'

import { $createColumnNode, $createColumnsNode, $isColumnNode, $isColumnsNode, $isGioIfNode, ColumnNode, ColumnsNode } from './nodes'

/**
 * Two columns (Gio Docs' columns, two only; 2026-10-18). "/" Two columns
 * puts a pair in place of the caret's empty line (or after its block), caret
 * in the left one. A column holds blocks: text, headings, lists, quotes,
 * callouts, tables and signature blocks, so two people can sign side by
 * side. Sections, page breaks and columns don't go inside a column: a
 * section's lines stay, a page break moves below the pair, and inner columns
 * are stacked. The block menu moves the pair as one, or stacks it.
 */

/** The block the caret's line belongs to: a top-level block, or a block inside a column. */
export function $lineBlock(node: LexicalNode): LexicalNode {
  let n: LexicalNode = node
  for (let p = n.getParent(); p && !$isRootNode(p) && !$isColumnNode(p); p = n.getParent()) n = p
  return n
}

/** Whether a node sits inside a column. */
export function $inColumn(node: LexicalNode | null): boolean {
  for (let n = node; n; n = n.getParent()) if ($isColumnNode(n)) return true
  return false
}

export function insertColumns(editor: LexicalEditor) {
  editor.update(() => {
    const cols = $createColumnsNode()
    const left = $createColumnNode().append($createParagraphNode())
    cols.append(left, $createColumnNode().append($createParagraphNode()))
    const sel = $getSelection()
    let top: LexicalNode | null = $isRangeSelection(sel) ? sel.anchor.getNode() : null
    while (top && top.getParent() && !$isRootNode(top.getParent())) top = top.getParent()
    if (top && $isParagraphNode(top) && top.getChildrenSize() === 0) top.replace(cols)
    else if (top && !$isRootNode(top)) top.insertAfter(cols)
    else $getRoot().append(cols)
    if (!cols.getNextSibling()) cols.insertAfter($createParagraphNode())
    ;(left.getFirstChild() as ParagraphNode | null)?.select()
  })
  editor.focus()
}

/** Puts both columns' blocks one after the other where the pair was. */
export function $stackColumns(cols: ColumnsNode) {
  for (const col of cols.getChildren()) {
    const kids = $isColumnNode(col) ? col.getChildren() : [col]
    for (const k of kids) cols.insertBefore(k)
  }
  cols.remove()
}

export function registerColumnRules(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerNodeTransform(ColumnsNode, (cols) => {
      // Columns only at the top level or in a section; anywhere else they're stacked.
      const parent = cols.getParent()
      if (parent && !$isRootNode(parent) && !$isGioIfNode(parent)) {
        $stackColumns(cols)
        return
      }
      // Exactly two columns: stray blocks join the last column, extra columns join the second.
      let columns = cols.getChildren().filter($isColumnNode)
      for (const child of cols.getChildren()) {
        if ($isColumnNode(child)) continue
        const last = columns.at(-1) ?? cols.append($createColumnNode()).getLastChild()
        if ($isColumnNode(last)) last.append(child)
      }
      columns = cols.getChildren().filter($isColumnNode)
      while (columns.length < 2) {
        const c = $createColumnNode().append($createParagraphNode())
        cols.append(c)
        columns.push(c)
      }
      for (const extra of columns.slice(2)) {
        columns[1].append(...extra.getChildren())
        extra.remove()
      }
    }),
    editor.registerNodeTransform(ColumnNode, (col) => {
      const parent = col.getParent()
      if (!$isColumnsNode(parent)) {
        for (const k of col.getChildren()) col.insertBefore(k)
        col.remove()
        return
      }
      for (const child of col.getChildren()) {
        if ($isGioIfNode(child)) {
          for (const k of child.getChildren()) child.insertBefore(k)
          child.remove()
        } else if (child.getType() === 'gio-page-break') {
          parent.insertAfter(child)
        }
      }
      if (col.getChildrenSize() === 0) col.append($createParagraphNode())
    }),
  )
}
