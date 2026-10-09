/**
 * Motion & Feel §10 + §14 (CLAUDE.md): text cut by an ellipsis or a line clamp shows
 * its full value in a tooltip — only while it is actually cut, never on fully visible
 * text. One document-level listener instead of a Tooltip on every truncated span.
 * Timing follows the Tooltip primitive: opens after 400ms with the gio-tip grow-in;
 * while one is open, or within 400ms of it closing, the next opens at once with no
 * animation. Mouse only. Elements with an explicit `title` keep their own, as do
 * controls that carry an aria-label (they have an IconTip).
 */
import { motionToken } from '@/lib/motion'

const GAP = 6
let tip: HTMLDivElement | null = null
let target: HTMLElement | null = null
let timer = 0
let visible = false
let hiddenAt = 0

function isCut(el: HTMLElement) {
  const style = getComputedStyle(el)
  const clamp = (style as CSSStyleDeclaration & { webkitLineClamp?: string }).webkitLineClamp
  const clamped = !!clamp && clamp !== 'none'
  if (style.textOverflow !== 'ellipsis' && !clamped) return null
  return clamped ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1
}

function ensureTip() {
  if (tip?.isConnected) return tip
  tip = document.createElement('div')
  tip.setAttribute('role', 'tooltip')
  tip.className =
    'gio-autotip gio-tip z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md'
  tip.hidden = true
  document.body.appendChild(tip)
  return tip
}

function place(el: HTMLElement, node: HTMLDivElement) {
  const rect = el.getBoundingClientRect()
  const box = node.getBoundingClientRect()
  const above = rect.top - box.height - GAP >= 8
  const top = above ? rect.top - box.height - GAP : rect.bottom + GAP
  const left = Math.min(Math.max(8, rect.left - 8), window.innerWidth - box.width - 8)
  node.style.top = `${Math.round(top)}px`
  node.style.left = `${Math.round(left)}px`
  node.style.transformOrigin = `${Math.round(rect.left - left + 8)}px ${above ? '100%' : '0%'}`
}

function show(el: HTMLElement, text: string, instant: boolean) {
  const node = ensureTip()
  node.textContent = text
  node.hidden = false
  node.style.top = '-9999px'
  node.style.left = '0px'
  place(el, node)
  node.setAttribute('data-state', instant ? 'instant-open' : 'delayed-open')
  visible = true
}

function hide() {
  window.clearTimeout(timer)
  timer = 0
  target = null
  if (!visible || !tip) return
  visible = false
  hiddenAt = performance.now()
  tip.hidden = true
  tip.removeAttribute('data-state')
}

function cutTarget(start: EventTarget | null) {
  let el = start instanceof HTMLElement ? start : null
  // The cut element is usually the target or one of its two nearest ancestors.
  for (let i = 0; el && i < 3; i++, el = el.parentElement) {
    const cut = isCut(el)
    if (cut === null) continue
    if (el.hasAttribute('title') || el.closest('[title]')) return null
    if (el.closest("button, a, [role='button']")?.hasAttribute('aria-label')) return null
    const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    return cut && text ? { el, text } : null
  }
  return null
}

function onPointerOver(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  const found = cutTarget(event.target)
  if (!found) {
    if (target && !(event.target instanceof Node && target.contains(event.target))) hide()
    return
  }
  if (found.el === target) return
  const skip = motionToken('--delay-tooltip', 400)
  const instant = visible || performance.now() - hiddenAt < skip
  hide()
  target = found.el
  if (instant) {
    show(found.el, found.text, true)
    return
  }
  timer = window.setTimeout(() => {
    if (target === found.el && found.el.isConnected) show(found.el, found.text, false)
  }, skip)
}

function onPointerOut(event: PointerEvent) {
  if (!target) return
  const next = event.relatedTarget
  if (next instanceof Node && target.contains(next)) return
  hide()
}

export function installAutoTitle() {
  if (typeof document === 'undefined') return () => {}
  const dismiss = () => hide()
  document.addEventListener('pointerover', onPointerOver, { passive: true })
  document.addEventListener('pointerout', onPointerOut, { passive: true })
  document.addEventListener('pointerdown', dismiss, { capture: true, passive: true })
  document.addEventListener('keydown', dismiss, { capture: true })
  window.addEventListener('scroll', dismiss, { capture: true, passive: true })
  window.addEventListener('blur', dismiss)
  return () => {
    hide()
    document.removeEventListener('pointerover', onPointerOver)
    document.removeEventListener('pointerout', onPointerOut)
    document.removeEventListener('pointerdown', dismiss, { capture: true })
    document.removeEventListener('keydown', dismiss, { capture: true })
    window.removeEventListener('scroll', dismiss, { capture: true })
    window.removeEventListener('blur', dismiss)
    tip?.remove()
    tip = null
  }
}
