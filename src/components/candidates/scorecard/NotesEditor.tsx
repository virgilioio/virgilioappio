import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, IndentDecrease, IndentIncrease,
  Link as LinkIcon, Unlink, type LucideIcon,
} from 'lucide-react'

/**
 * Neutral Notion/Linear-style notes editor used by the scorecard Key takeaways field.
 * Stores HTML. The contentEditable is uncontrolled: innerHTML is only written when the
 * value changes from outside (initial load, Polish notes), never on each keystroke.
 */

const STYLES = `
.gne{position:relative;background:#fff;border:1px solid #E0DDD3;border-radius:8px;transition:border-color .15s,box-shadow .15s}
.gne:focus-within{border-color:#B9B6AC;box-shadow:0 0 0 3px rgba(31,34,48,.06)}
.gne-tb{display:flex;align-items:center;gap:2px;padding:6px 8px;border-bottom:1px solid #F1F0EC;background:#fff;flex-wrap:wrap;border-radius:8px 8px 0 0}
.gne-btn{width:28px;height:28px;border-radius:6px;border:0;background:transparent;color:#5A6072;display:inline-flex;align-items:center;justify-content:center;transition:background .12s,color .12s;cursor:pointer}
.gne-btn:not(:disabled):hover{background:#F5F4F0;color:#1F2230}
.gne-btn[data-active=true]{background:#EDEBE5;color:#1F2230}
.gne-btn:disabled{opacity:.35;cursor:default}
.gne-div{width:1px;height:16px;background:#ECEAE4;margin:0 5px}
.gne-ed{font-family:Inter,sans-serif;font-size:13.5px;line-height:1.6;color:#1F2230;padding:14px 16px 16px;min-height:132px;word-break:break-word;outline:none}
.gne-ed p{margin:0 0 6px}.gne-ed>:last-child{margin-bottom:0}
.gne-ed b,.gne-ed strong{font-weight:600}
.gne-ed a{color:#1F2230;text-decoration:underline;text-decoration-color:#B9B6AC;text-underline-offset:2px}
.gne-ed a:hover{text-decoration-color:#1F2230}
.gne-ed ul,.gne-ed ol{margin:2px 0 8px;padding-left:22px}
.gne-ed li{margin:2px 0;padding-left:2px}
.gne-ed li>ul,.gne-ed li>ol{margin:2px 0 4px}
.gne-ed ul{list-style:disc}.gne-ed ul ul{list-style:circle}.gne-ed ul ul ul{list-style:square}
.gne-ed ol{list-style:decimal}.gne-ed ol ol{list-style:lower-alpha}.gne-ed ol ol ol{list-style:lower-roman}
.gne-ed li::marker{color:#5A6072}
.gne-ed ol>li::marker{font-variant-numeric:tabular-nums;font-size:12.5px}
.gne-ph{position:absolute;left:16px;color:#8B8F9E;pointer-events:none;font-family:Inter,sans-serif;font-size:13.5px;line-height:1.6}
.gne-hint{display:flex;justify-content:flex-end;gap:10px;padding:0 12px 9px;font-family:Inter,sans-serif;font-size:11px;color:#8B8F9E;opacity:0;pointer-events:none;transition:opacity .15s}
.gne:focus-within .gne-hint{opacity:1}
.gne-kbd{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#5A6072;background:#F5F4F0;border:1px solid #E7E5DE;border-radius:4px;padding:0 4px;line-height:16px;margin-right:4px}
.gne-pop{position:absolute;top:42px;right:8px;z-index:5;background:#fff;border:1px solid #E0DDD3;border-radius:8px;padding:6px;box-shadow:0 8px 24px rgba(13,13,9,.10);display:flex;align-items:center;gap:6px}
.gne-pop input{border:0;outline:none;font-family:Inter,sans-serif;font-size:12.5px;width:220px;color:#1F2230;background:transparent}
.gne-apply{background:#1F2230;color:#fff;font-family:Inter,sans-serif;font-size:12px;font-weight:500;height:26px;padding:0 10px;border-radius:6px;border:0;cursor:pointer}
`

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

type Caret = { node: Node; offset: number } | null
const saveCaret = (): Caret => {
  const s = window.getSelection()
  return s && s.rangeCount ? { node: s.anchorNode!, offset: s.anchorOffset } : null
}
const restoreCaret = (c: Caret) => {
  if (!c || !c.node.isConnected) return
  const s = window.getSelection()!
  const r = document.createRange()
  r.setStart(c.node, Math.min(c.offset, c.node.nodeType === 3 ? (c.node as Text).length : c.node.childNodes.length))
  r.collapse(true)
  s.removeAllRanges(); s.addRange(r)
}
const placeCaretIn = (el: Node, atEnd = false) => {
  const s = window.getSelection()!
  const r = document.createRange()
  r.selectNodeContents(el); r.collapse(!atEnd)
  s.removeAllRanges(); s.addRange(r)
}

function closest(node: Node | null, sel: string, root: HTMLElement): HTMLElement | null {
  let n: Node | null = node
  while (n && n !== root) {
    if (n.nodeType === 1 && (n as HTMLElement).matches(sel)) return n as HTMLElement
    n = n.parentNode
  }
  return null
}
const isList = (n: Node | null): n is HTMLElement => !!n && n.nodeType === 1 && /^(UL|OL)$/.test((n as HTMLElement).tagName)
const ownText = (li: HTMLElement) =>
  Array.from(li.childNodes).filter((c) => !isList(c)).map((c) => c.textContent || '').join('').trim()

/** Top-level block (direct child of root) containing the caret; wraps stray text in <p>. */
function currentBlock(root: HTMLElement): HTMLElement | null {
  const s = window.getSelection()
  if (!s?.anchorNode || !root.contains(s.anchorNode)) return null
  let n: Node = s.anchorNode
  if (n === root) {
    n = root.childNodes[s.anchorOffset] || root.lastChild!
    if (!n) return null
  }
  while (n.parentNode && n.parentNode !== root) n = n.parentNode
  if (n.nodeType === 3 || (n.nodeType === 1 && !/^(P|DIV|UL|OL|H[1-6]|BLOCKQUOTE)$/.test((n as HTMLElement).tagName))) {
    const c = saveCaret()
    const p = document.createElement('p')
    root.insertBefore(p, n)
    // gather inline siblings
    while (p.nextSibling && (p.nextSibling.nodeType === 3 || !/^(P|DIV|UL|OL|H[1-6]|BLOCKQUOTE)$/.test((p.nextSibling as HTMLElement).tagName))) {
      p.appendChild(p.nextSibling)
    }
    restoreCaret(c)
    return p
  }
  return n as HTMLElement
}

function mergeAdjacent(list: HTMLElement) {
  const prev = list.previousElementSibling
  if (prev && prev.tagName === list.tagName) {
    while (list.firstChild) prev.appendChild(list.firstChild)
    list.remove(); list = prev as HTMLElement
  }
  const next = list.nextElementSibling
  if (next && next.tagName === list.tagName) {
    while (next.firstChild) list.appendChild(next.firstChild)
    next.remove()
  }
}

function blockToList(block: HTMLElement, tag: 'UL' | 'OL') {
  const c = saveCaret()
  const list = document.createElement(tag)
  const li = document.createElement('li')
  while (block.firstChild) li.appendChild(block.firstChild)
  list.appendChild(li)
  block.replaceWith(list)
  mergeAdjacent(list)
  if (c && c.node.isConnected && li.contains(c.node)) restoreCaret(c)
  else placeCaretIn(li)
}

function indent(li: HTMLElement) {
  const prev = li.previousElementSibling as HTMLElement | null
  if (!prev || prev.tagName !== 'LI') return
  const c = saveCaret()
  const parentTag = li.parentElement!.tagName
  let sub = Array.from(prev.children).reverse().find((e) => isList(e)) as HTMLElement | undefined
  if (!sub || prev.lastElementChild !== sub) {
    sub = document.createElement(parentTag)
    prev.appendChild(sub)
  }
  sub.appendChild(li)
  // keep own children lists after li
  restoreCaret(c)
}

function outdent(li: HTMLElement, root: HTMLElement) {
  const c = saveCaret()
  const list = li.parentElement!
  const parentLi = list.parentElement
  if (parentLi && parentLi.tagName === 'LI') {
    // following siblings become nested list under li
    const followers: Element[] = []
    let n = li.nextElementSibling
    while (n) { followers.push(n); n = n.nextElementSibling }
    if (followers.length) {
      const sub = document.createElement(list.tagName)
      followers.forEach((f) => sub.appendChild(f))
      li.appendChild(sub)
    }
    parentLi.after(li)
    if (!list.children.length) list.remove()
  } else {
    // top level → paragraph, splitting list
    const p = document.createElement('p')
    const nested: Node[] = []
    Array.from(li.childNodes).forEach((ch) => (isList(ch) ? nested.push(ch) : p.appendChild(ch)))
    const after = document.createElement(list.tagName)
    nested.forEach((nl) => Array.from(nl.childNodes).forEach((x) => after.appendChild(x)))
    let n = li.nextElementSibling
    while (n) { const nx = n.nextElementSibling; after.appendChild(n); n = nx }
    list.after(p)
    if (after.children.length) p.after(after)
    li.remove()
    if (!list.children.length) list.remove()
    if (!p.firstChild) p.appendChild(document.createElement('br'))
    if (c && c.node.isConnected && p.contains(c.node)) restoreCaret(c)
    else placeCaretIn(p)
    void root
    return
  }
  if (c && c.node.isConnected) restoreCaret(c); else placeCaretIn(li)
}

function caretAtStart(li: HTMLElement) {
  const s = window.getSelection()
  if (!s || !s.isCollapsed || !s.rangeCount) return false
  const r = document.createRange()
  r.setStart(li, 0)
  r.setEnd(s.anchorNode!, s.anchorOffset)
  return r.toString() === ''
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

const BTN: Array<{ key: string; icon: LucideIcon; title: string } | '|'> = [
  { key: 'bold', icon: Bold, title: 'Bold ⌘B' },
  { key: 'italic', icon: Italic, title: 'Italic ⌘I' },
  { key: 'underline', icon: Underline, title: 'Underline ⌘U' },
  { key: 'strikeThrough', icon: Strikethrough, title: 'Strikethrough ⌘⇧X' },
  '|',
  { key: 'ul', icon: List, title: 'Bulleted list ⌘⇧8 · or type *' },
  { key: 'ol', icon: ListOrdered, title: 'Numbered list ⌘⇧7 · or type 1.' },
  { key: 'outdent', icon: IndentDecrease, title: 'Outdent ⇧Tab' },
  { key: 'indent', icon: IndentIncrease, title: 'Indent Tab' },
  '|',
  { key: 'link', icon: LinkIcon, title: 'Link ⌘K' },
]

export function NotesEditor({ value, onChange, placeholder = 'Share your key takeaways and observations…' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef<string | null>(null)
  const savedRange = useRef<Range | null>(null)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [empty, setEmpty] = useState(true)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [editingLink, setEditingLink] = useState<HTMLAnchorElement | null>(null)

  const refreshEmpty = useCallback(() => {
    const el = ref.current
    if (!el) return
    setEmpty(!el.querySelector('li') && !(el.textContent || '').trim())
  }, [])

  // Sync external value only when it differs from what we last emitted.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value !== last.current) {
      el.innerHTML = value || ''
      last.current = value
      refreshEmpty()
    }
  }, [value, refreshEmpty])

  const emit = useCallback(() => {
    const el = ref.current
    if (!el) return
    const html = el.innerHTML === '<br>' || el.innerHTML === '<p><br></p>' ? '' : el.innerHTML
    last.current = html
    onChange(html)
    refreshEmpty()
  }, [onChange, refreshEmpty])

  const updateActive = useCallback(() => {
    const el = ref.current
    const s = window.getSelection()
    if (!el || !s?.anchorNode || !el.contains(s.anchorNode)) return
    const li = closest(s.anchorNode, 'li', el)
    const listTag = li?.parentElement?.tagName
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      ul: listTag === 'UL',
      ol: listTag === 'OL',
      link: !!closest(s.anchorNode, 'a', el),
      inLi: !!li,
      nested: !!li && li.parentElement?.parentElement?.tagName === 'LI',
    })
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateActive)
    return () => document.removeEventListener('selectionchange', updateActive)
  }, [updateActive])

  useEffect(() => {
    try { document.execCommand('defaultParagraphSeparator', false, 'p') } catch { /* noop */ }
  }, [])

  const toggleList = (tag: 'UL' | 'OL') => {
    const el = ref.current!
    const s = window.getSelection()
    if (!s?.anchorNode || !el.contains(s.anchorNode)) { el.focus(); return }
    const li = closest(s.anchorNode, 'li', el)
    if (li) {
      const list = li.parentElement!
      if (list.tagName === tag) {
        // back to paragraph: outdent to top then convert
        let cur = li
        while (cur.parentElement?.parentElement?.tagName === 'LI') outdent(cur, el)
        outdent(cur, el)
      } else {
        const c = saveCaret()
        const nl = document.createElement(tag)
        while (list.firstChild) nl.appendChild(list.firstChild)
        list.replaceWith(nl)
        restoreCaret(c)
      }
    } else if (!s.isCollapsed && s.toString().includes('\n')) {
      document.execCommand(tag === 'UL' ? 'insertUnorderedList' : 'insertOrderedList')
    } else {
      const b = currentBlock(el)
      if (b) blockToList(b, tag)
      else {
        const p = document.createElement('p'); p.appendChild(document.createElement('br'))
        el.appendChild(p); blockToList(p, tag)
      }
    }
    emit(); updateActive()
  }

  const openLink = () => {
    const el = ref.current!
    const s = window.getSelection()
    if (s?.rangeCount && el.contains(s.anchorNode)) savedRange.current = s.getRangeAt(0).cloneRange()
    else { savedRange.current = null }
    const a = s?.anchorNode ? (closest(s.anchorNode, 'a', el) as HTMLAnchorElement | null) : null
    setEditingLink(a)
    setLinkUrl(a?.getAttribute('href') || '')
    setLinkOpen(true)
  }

  const closeLink = () => {
    setLinkOpen(false)
    const el = ref.current!
    el.focus()
    if (savedRange.current) { const s = window.getSelection()!; s.removeAllRanges(); s.addRange(savedRange.current) }
  }

  const unlink = () => {
    if (editingLink) {
      const parent = editingLink.parentNode!
      while (editingLink.firstChild) parent.insertBefore(editingLink.firstChild, editingLink)
      editingLink.remove()
    }
    setLinkOpen(false); ref.current?.focus(); emit()
  }

  const applyLink = () => {
    const el = ref.current!
    el.focus()
    const s = window.getSelection()!
    if (savedRange.current) { s.removeAllRanges(); s.addRange(savedRange.current) }
    let url = linkUrl.trim()
    if (!url) { unlink(); return }
    if (!/^(https?:|mailto:)/i.test(url)) url = `https://${url}`
    if (editingLink) editingLink.setAttribute('href', url)
    else if (!savedRange.current || s.isCollapsed) {
      if (!savedRange.current) placeCaretIn(el, true)
      const r = s.getRangeAt(0)
      const a = document.createElement('a'); a.href = url; a.textContent = url
      const sp = document.createTextNode(' ')
      r.insertNode(sp); r.insertNode(a)
      const nr = document.createRange(); nr.setStartAfter(sp); nr.collapse(true)
      s.removeAllRanges(); s.addRange(nr)
    } else document.execCommand('createLink', false, url)
    el.querySelectorAll('a').forEach((a) => { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer') })
    setLinkOpen(false); emit()
  }

  const run = (key: string) => {
    ref.current?.focus()
    const el = ref.current!
    const s = window.getSelection()
    const li = s?.anchorNode ? closest(s.anchorNode, 'li', el) : null
    switch (key) {
      case 'ul': return toggleList('UL')
      case 'ol': return toggleList('OL')
      case 'indent': if (li) { indent(li); emit() } return
      case 'outdent': if (li && li.parentElement?.parentElement?.tagName === 'LI') { outdent(li, el); emit() } return
      case 'link': return openLink()
      default: document.execCommand(key); emit(); updateActive()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current!
    const s = window.getSelection()
    const mod = e.metaKey || e.ctrlKey
    const li = s?.anchorNode ? closest(s.anchorNode, 'li', el) : null
    const k = e.key.toLowerCase()

    if (mod && k === 'k') { e.preventDefault(); openLink(); return }
    if (mod && e.shiftKey && k === 'x') { e.preventDefault(); run('strikeThrough'); return }
    if (mod && e.shiftKey && (e.code === 'Digit8' || k === '*')) { e.preventDefault(); toggleList('UL'); return }
    if (mod && e.shiftKey && (e.code === 'Digit7' || k === '&')) { e.preventDefault(); toggleList('OL'); return }

    if (e.key === 'Tab' && li) {
      e.preventDefault()
      if (e.shiftKey) outdent(li, el); else indent(li)
      emit(); return
    }
    if (e.key === 'Enter' && !e.shiftKey && li && ownText(li) === '') {
      e.preventDefault(); outdent(li, el); emit(); return
    }
    if (e.key === 'Backspace' && li && caretAtStart(li)) {
      e.preventDefault(); outdent(li, el); emit(); return
    }
    if (e.key === ' ' && !li && s?.isCollapsed && s.anchorNode) {
      const block = currentBlock(el)
      if (!block || block.tagName !== 'P' && block.tagName !== 'DIV') return
      const r = document.createRange()
      r.setStart(block, 0); r.setEnd(s.anchorNode, s.anchorOffset)
      const before = r.toString()
      const tag = before === '*' || before === '-' ? 'UL' : /^1[.)]$/.test(before) ? 'OL' : null
      if (tag) {
        e.preventDefault()
        r.deleteContents()
        if (!(block.textContent || '').length && !block.querySelector('br')) block.appendChild(document.createElement('br'))
        blockToList(block, tag)
        emit()
      }
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    const s = window.getSelection()
    if (s && !s.isCollapsed && /^(https?:\/\/|www\.)\S+$/i.test(text.trim())) {
      const url = /^https?:/i.test(text.trim()) ? text.trim() : `https://${text.trim()}`
      document.execCommand('createLink', false, url)
    } else {
      document.execCommand('insertText', false, text)
    }
    emit()
  }

  return (
    <div className="gne">
      <style>{STYLES}</style>
      <div className="gne-tb" role="toolbar" aria-label="Formatting">
        {BTN.map((b, i) => {
          if (b === '|') return <span key={`d${i}`} className="gne-div" />
          const on = !!active[b.key]
          const disabled = (b.key === 'indent' && !active.inLi) || (b.key === 'outdent' && !active.nested)
          const Icon = b.icon
          return (
            <button
              key={b.key}
              type="button"
              className="gne-btn"
              title={b.title}
              aria-label={b.title}
              aria-pressed={on}
              data-active={on}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(b.key)}
            >
              <Icon size={14} strokeWidth={on ? 2.1 : 1.75} />
            </button>
          )
        })}
      </div>

      {linkOpen && (
        <div className="gne-pop">
          <LinkIcon size={13} color="#8B8F9E" />
          <input
            autoFocus
            value={linkUrl}
            placeholder="Paste or type a link…"
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeLink() }
            }}
          />
          {editingLink && (
            <button type="button" className="gne-btn" title="Remove link" aria-label="Remove link" onMouseDown={(e) => e.preventDefault()} onClick={unlink}>
              <Unlink size={13} />
            </button>
          )}
          <button type="button" className="gne-apply" onMouseDown={(e) => e.preventDefault()} onClick={applyLink}>Apply</button>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {empty && <div className="gne-ph" style={{ top: 14 }}>{placeholder}</div>}
        <div
          ref={ref}
          className="gne-ed"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          role="textbox"
          aria-multiline="true"
          aria-label="Key takeaways"
          onInput={emit}
          onBlur={emit}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
      </div>

      <div className="gne-hint" aria-hidden="true">
        <span><span className="gne-kbd">*</span>bullets</span>
        <span><span className="gne-kbd">1.</span>numbered</span>
        <span><span className="gne-kbd">Tab</span>nest</span>
        <span><span className="gne-kbd">{isMac ? '⌘K' : 'Ctrl+K'}</span>link</span>
      </div>
    </div>
  )
}
