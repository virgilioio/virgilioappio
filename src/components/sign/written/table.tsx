/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isListItemNode, $isListNode } from '@lexical/list'
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $findTableNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumnAtSelection,
  $createTableNodeWithDimensions,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  type TableNode,
} from '@lexical/table'
import { mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  KEY_TAB_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical'

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { $isColumnsNode } from './nodes'
import { $stackColumns } from './columns'
import { IconTip } from '@/components/ui/tooltip'

/**
 * Gio Docs' simple table in the offer editor (2026-10-18), on Lexical's own
 * table nodes: "/" Table makes 3 × 3 with a header row. Pointing at a cell
 * shows a pill over its column and beside its row; each opens that column's
 * or row's menu (insert either side, header row, delete). The bars at the
 * right edge and the bottom add a column or a row; Tab in the last cell adds
 * a row. Cells hold text, data tags and signer fields in the text only:
 * headings, lists and quotes become text, and signing blocks, page breaks
 * and dividers move out below the table, so every table prints simply.
 */

/** A 3 × 3 table with a header row, in place of the caret's empty line (or after its block), caret in the first cell. */
export function insertTable(editor: LexicalEditor) {
  editor.update(() => {
    const table = $createTableNodeWithDimensions(3, 3, { rows: true, columns: false })
    const sel = $getSelection()
    let top: LexicalNode | null = $isRangeSelection(sel) ? sel.anchor.getNode() : null
    while (top && top.getParent() && !$isRootNode(top.getParent())) top = top.getParent()
    if (top && $isParagraphNode(top) && top.getTextContentSize() === 0 && top.getChildrenSize() === 0) top.replace(table)
    else if (top && !$isRootNode(top)) top.insertAfter(table)
    else $getRoot().append(table)
    if (!table.getNextSibling()) table.insertAfter($createParagraphNode())
    const first = table.getFirstChild()
    if ($isTableRowNode(first)) (first.getFirstChild() as TableCellNode | null)?.selectStart()
  })
  editor.focus()
}

/** Whether a node sits inside a table cell. */
export function $inTableCell(node: LexicalNode | null): boolean {
  for (let n = node; n; n = n.getParent()) if ($isTableCellNode(n)) return true
  return false
}

/** Keeps cells to text: block kinds become paragraphs, blocks that can't sit in a line move below the table. */
export function registerTableRules(editor: LexicalEditor) {
  return editor.registerNodeTransform(TableCellNode, (cell) => {
    for (const child of cell.getChildren()) {
      if ($isParagraphNode(child)) continue
      if ($isColumnsNode(child)) {
        // Columns in a cell: their blocks, one after the other (and then made text, below).
        $stackColumns(child)
        continue
      }
      if ($isListNode(child)) {
        let last: LexicalNode = child
        for (const item of child.getChildren().filter($isListItemNode)) {
          const p = $createParagraphNode()
          p.append(...item.getChildren().filter((k) => !$isListNode(k)))
          last.insertAfter(p)
          last = p
        }
        child.remove()
      } else if ($isElementNode(child) && !child.isInline()) {
        const p = $createParagraphNode()
        p.append(...child.getChildren())
        child.replace(p)
      } else if ($isDecoratorNode(child) && !child.isInline()) {
        const table = $findTableNode(cell)
        if (table) table.insertAfter(child)
        else child.remove()
      } else {
        const p = $createParagraphNode()
        child.insertBefore(p)
        p.append(child)
      }
    }
    if (cell.getChildrenSize() === 0) cell.append($createParagraphNode())
  })
}

type Hover = { tableKey: string; row: number; col: number }
type Menu = { kind: 'row' | 'col'; index: number } | null

function tableEl(editor: LexicalEditor, key: string): HTMLTableElement | null {
  const el = editor.getElementByKey(key)
  return el instanceof HTMLTableElement ? el : (el?.querySelector('table') ?? null)
}

export function TableTools({ anchor }: { anchor: HTMLElement }) {
  const [editor] = useLexicalComposerContext()
  const [hover, setHover] = useState<Hover | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [, setTick] = useState(0)
  const [active, setActive] = useState(0)
  const menuRef = useRef<Menu>(null)
  menuRef.current = menu
  const panelRef = useRef<HTMLDivElement>(null)

  // Which cell: the one under the pointer, or the caret's when typing.
  const fromCellEl = (cellEl: Element) =>
    editor.read(() => {
      const node = $getNearestNodeFromDOMNode(cellEl)
      const cell = node && ($isTableCellNode(node) ? node : null)
      const table = cell ? $findTableNode(cell) : null
      if (!cell || !table) return null
      return { tableKey: table.getKey(), row: $getTableRowIndexFromTableCellNode(cell), col: $getTableColumnIndexFromTableCellNode(cell) }
    })

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (menuRef.current) return
      const t = e.target as Element
      if (t.closest?.('[data-table-tool]')) return
      const cellEl = t.closest?.('td, th')
      if (cellEl && editor.getRootElement()?.contains(cellEl)) {
        const h = fromCellEl(cellEl)
        setHover((prev) => (h && prev && prev.tableKey === h.tableKey && prev.row === h.row && prev.col === h.col ? prev : h))
      } else if (!t.closest?.('table')) setHover(null)
    }
    const leave = () => !menuRef.current && setHover(null)
    anchor.addEventListener('mousemove', move)
    anchor.addEventListener('mouseleave', leave)
    return () => {
      anchor.removeEventListener('mousemove', move)
      anchor.removeEventListener('mouseleave', leave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, editor])

  useEffect(
    () =>
      mergeRegister(
        // Redraw when the table changes; let go of a table that's gone.
        editor.registerUpdateListener(({ editorState }) => {
          setTick((n) => n + 1)
          setHover((h) => (h && !editorState.read(() => $isTableNode($getNodeByKey(h.tableKey))) ? null : h))
        }),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            const sel = $getSelection()
            if (!$isRangeSelection(sel) || menuRef.current) return false
            const cell = sel.anchor.getNode().getParents().find($isTableCellNode) ?? null
            const table = cell ? $findTableNode(cell) : null
            if (cell && table) setHover({ tableKey: table.getKey(), row: $getTableRowIndexFromTableCellNode(cell), col: $getTableColumnIndexFromTableCellNode(cell) })
            return false
          },
          COMMAND_PRIORITY_LOW,
        ),
        // Tab in the last cell adds a row (and moves into it).
        editor.registerCommand(
          KEY_TAB_COMMAND,
          (e) => {
            if (e.shiftKey) return false
            const sel = $getSelection()
            if (!$isRangeSelection(sel)) return false
            const cell = sel.anchor.getNode().getParents().find($isTableCellNode) ?? ($isTableCellNode(sel.anchor.getNode()) ? sel.anchor.getNode() : null)
            const row = cell?.getParent()
            const table = cell ? $findTableNode(cell) : null
            if (!cell || !$isTableRowNode(row) || !table || row !== table.getLastChild() || cell !== row.getLastChild()) return false
            e.preventDefault()
            $insertTableRowAtSelection(true)
            const added = table.getLastChild()
            if ($isTableRowNode(added)) (added.getFirstChild() as TableCellNode | null)?.selectStart()
            return true
          },
          // Ahead of Lexical's own Tab handler (high), which would leave the table.
          COMMAND_PRIORITY_CRITICAL,
        ),
      ),
    [editor],
  )

  // Runs an edit with the caret in a cell of the hovered table.
  const atCell = (row: number, col: number, fn: (table: TableNode) => void) =>
    editor.update(() => {
      if (!hover) return
      const table = $getNodeByKey(hover.tableKey)
      if (!$isTableNode(table)) return
      const r = table.getChildren()[row]
      const c = $isTableRowNode(r) ? r.getChildren()[col] : null
      if (!$isTableCellNode(c)) return
      c.selectStart()
      fn(table)
    })

  const close = () => {
    setMenu(null)
    setActive(0)
    editor.focus()
  }

  const counts = hover
    ? editor.getEditorState().read(() => {
        const t = $getNodeByKey(hover.tableKey)
        if (!$isTableNode(t)) return null
        const first = t.getFirstChild()
        const headerRow = $isTableRowNode(first) && (first.getChildren() as TableCellNode[]).every((c) => $isTableCellNode(c) && c.hasHeaderState(TableCellHeaderStates.ROW))
        return { rows: t.getChildrenSize(), cols: $isTableRowNode(first) ? first.getChildrenSize() : 0, headerRow }
      })
    : null

  const table = hover ? tableEl(editor, hover.tableKey) : null
  const cellEl = table?.rows[hover?.row ?? 0]?.cells[hover?.col ?? 0] ?? null
  if (!hover || !table || !cellEl || !counts) return null

  const base = anchor.getBoundingClientRect()
  const tr = table.getBoundingClientRect()
  const cr = cellEl.getBoundingClientRect()
  const x = (v: number) => v - base.left
  const y = (v: number) => v - base.top

  const removeTable = () =>
    editor.update(() => {
      const t = $getNodeByKey(hover.tableKey)
      if (!$isTableNode(t)) return
      const p = $createParagraphNode()
      t.replace(p)
      p.select()
    })

  type Row = { label: string; run: () => void; danger?: boolean; checked?: boolean }
  const rows: Row[] = !menu
    ? []
    : menu.kind === 'col'
      ? [
          { label: 'Insert column left', run: () => atCell(0, menu.index, () => $insertTableColumnAtSelection(false)) },
          { label: 'Insert column right', run: () => atCell(0, menu.index, () => $insertTableColumnAtSelection(true)) },
          {
            label: counts.cols > 1 ? 'Delete column' : 'Delete table',
            danger: true,
            run: () => (counts.cols > 1 ? atCell(0, menu.index, () => $deleteTableColumnAtSelection()) : removeTable()),
          },
        ]
      : [
          { label: 'Insert row above', run: () => atCell(menu.index, 0, () => $insertTableRowAtSelection(false)) },
          { label: 'Insert row below', run: () => atCell(menu.index, 0, () => $insertTableRowAtSelection(true)) },
          ...(menu.index === 0
            ? [
                {
                  label: 'Header row',
                  checked: counts.headerRow,
                  run: () =>
                    atCell(0, 0, (t) => {
                      const first = t.getFirstChild()
                      if (!$isTableRowNode(first)) return
                      for (const c of first.getChildren()) {
                        if ($isTableCellNode(c)) c.setHeaderStyles(counts.headerRow ? TableCellHeaderStates.NO_STATUS : TableCellHeaderStates.ROW, TableCellHeaderStates.ROW)
                      }
                    }),
                },
              ]
            : []),
          {
            label: counts.rows > 1 ? 'Delete row' : 'Delete table',
            danger: true,
            run: () => (counts.rows > 1 ? atCell(menu.index, 0, () => $deleteTableRowAtSelection()) : removeTable()),
          },
        ]

  const pick = (r: Row) => {
    r.run()
    close()
  }
  const onKey = (e: RKeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (rows[active]) pick(rows[active])
    }
  }

  const pill = (kind: 'row' | 'col', index: number, style: CSSProperties) => (
    <Popover open={menu?.kind === kind && menu.index === index} onOpenChange={(o) => (o ? (setMenu({ kind, index }), setActive(0)) : close())}>
      <PopoverAnchor asChild>
        <span className="absolute" style={style}>
          <IconTip label={kind === 'col' ? 'Column options' : 'Row options'} side={kind === 'col' ? 'top' : 'left'}>
            <button
              type="button"
              data-table-tool=""
              data-kind={kind}
              className="gio-table-pill"
              aria-label={kind === 'col' ? `Column ${index + 1} options` : `Row ${index + 1} options`}
              aria-haspopup="menu"
              aria-expanded={menu?.kind === kind && menu.index === index}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (setMenu({ kind, index }), setActive(0))}
            />
          </IconTip>
        </span>
      </PopoverAnchor>
      <PopoverContent
        side={kind === 'col' ? 'bottom' : 'right'}
        align="start"
        sideOffset={6}
        className="w-[200px] p-1"
        data-table-tool=""
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          panelRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div ref={panelRef} tabIndex={-1} role="menu" aria-label={kind === 'col' ? 'Column' : 'Row'} className="outline-none" onKeyDown={onKey}>
          <p className="px-2 pb-1 pt-1.5 font-inter text-[11px] font-medium text-text-tertiary">{kind === 'col' ? `Column ${index + 1}` : `Row ${index + 1}`}</p>
          {rows.map((r, i) => (
            <div key={r.label}>
              {r.danger && <div className="mx-2 my-1 h-px bg-[#ECEBE6]" />}
              <button type="button" role="menuitem" className="gio-block-menu-row" data-active={active === i || undefined} data-danger={r.danger || undefined} onMouseEnter={() => setActive(i)} onClick={() => pick(r)}>
                <span className="min-w-0 flex-1 truncate text-left">{r.label}</span>
                {r.checked && (
                  <svg viewBox="0 0 24 24" width={14} height={14} aria-label="On" className="shrink-0 text-virgilio-purple">
                    <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )

  const add = (kind: 'row' | 'col') =>
    kind === 'row'
      ? atCell(counts.rows - 1, 0, () => $insertTableRowAtSelection(true))
      : atCell(0, counts.cols - 1, () => $insertTableColumnAtSelection(true))

  return createPortal(
    <div data-table-tool="" className="gio-table-tools">
      {pill('col', hover.col, { left: x(cr.left) + 3, top: y(tr.top) - 16, width: cr.width - 6, height: 16 })}
      {pill('row', hover.row, { left: x(tr.left) - 16, top: y(cr.top) + 3, width: 16, height: cr.height - 6 })}
      <IconTip label="Add a column" side="right">
        <button type="button" data-table-tool="" className="gio-table-add absolute" aria-label="Add a column" style={{ left: x(tr.right) + 4, top: y(tr.top), width: 14, height: tr.height }} onMouseDown={(e) => e.preventDefault()} onClick={() => add('col')}>
          +
        </button>
      </IconTip>
      <IconTip label="Add a row">
        <button type="button" data-table-tool="" className="gio-table-add absolute" aria-label="Add a row" style={{ left: x(tr.left), top: y(tr.bottom) + 4, width: tr.width, height: 14 }} onMouseDown={(e) => e.preventDefault()} onClick={() => add('row')}>
          +
        </button>
      </IconTip>
    </div>,
    anchor,
  )
}

