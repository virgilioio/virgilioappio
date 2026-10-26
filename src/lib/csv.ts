/**
 * One CSV cell: quoted, and text starting with = + - @ can't run as a spreadsheet
 * formula (a plain number such as a phone number is left as it is).
 */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/** Saves rows as "<name> - <today>.csv" (UTF-8 with a BOM, so Excel reads accents). */
export function downloadCsv(name: string, header: string[], rows: unknown[][]) {
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const base = name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Export'
  link.href = url
  link.download = `${base} - ${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
