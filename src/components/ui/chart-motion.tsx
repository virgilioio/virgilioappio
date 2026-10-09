import { Component, createRef, type CSSProperties, type ReactNode } from 'react'

/**
 * Motion & Feel §6 Charts (CLAUDE.md) for hand-built bar charts. Mark every bar with
 * `data-chart-bar={stableKey}` inside <ChartMotion id axis>:
 *   - first view this session: bars grow from their baseline, --stagger-chart apart
 *     (first 12 bars), over --dur-chart on --ease-in-out;
 *   - later data: each bar morphs from its old size and place to the new one (FLIP with
 *     transform only), new bars grow, removed bars shrink away as ghosts;
 *   - identical refetches do nothing; reduced motion and hidden tabs jump to the end.
 * The panel itself never fades or re-grows. `axis="x"` for horizontal bars (baseline on
 * the left), `axis="y"` for columns (baseline at the bottom).
 */

// UI-only session identifiers; never chart data.
const seenCharts = new Set<string>()
type Box = { rect: DOMRect; size: number; ghost: HTMLElement }
type Snapshot = Map<string, Box>
type Props = { id: string; axis?: 'x' | 'y'; className?: string; style?: CSSProperties; children: ReactNode }

function milliseconds(css: CSSStyleDeclaration, token: string, fallback: number) {
  const value = css.getPropertyValue(token).trim()
  const n = Number.parseFloat(value) * (value.endsWith('ms') ? 1 : 1000)
  return Number.isFinite(n) ? n : fallback
}
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export class ChartMotion extends Component<Props, Record<string, never>, Snapshot> {
  private root = createRef<HTMLDivElement>()
  private animations = new Set<Animation>()
  private ghosts = new Set<HTMLElement>()
  private observer: ResizeObserver | undefined
  private width = 0

  private get axis() {
    return this.props.axis ?? 'x'
  }
  private size(el: HTMLElement) {
    return this.axis === 'x' ? el.offsetWidth : el.offsetHeight
  }
  private finish = () => {
    for (const animation of this.animations) animation.finish()
  }
  private visibility = () => {
    if (document.hidden) this.finish()
  }

  override componentDidMount() {
    const root = this.root.current
    if (!root) return
    this.play(new Map())
    this.width = root.getBoundingClientRect().width
    // A resize is not a data change: end any motion rather than animate the reflow.
    this.observer = new ResizeObserver(() => {
      const width = root.getBoundingClientRect().width
      if (width !== this.width) {
        this.width = width
        this.finish()
      }
    })
    this.observer.observe(root)
    document.addEventListener('visibilitychange', this.visibility)
  }

  override getSnapshotBeforeUpdate(): Snapshot {
    const boxes: Snapshot = new Map()
    this.root.current?.querySelectorAll<HTMLElement>('[data-chart-bar]').forEach((bar) => {
      const id = bar.dataset.chartBar
      if (id) boxes.set(id, { rect: bar.getBoundingClientRect(), size: this.size(bar), ghost: bar.cloneNode(true) as HTMLElement })
    })
    return boxes
  }

  override componentDidUpdate(_props: Props, _state: Record<string, never>, before: Snapshot) {
    this.play(before)
  }

  private animate(element: HTMLElement, from: string, to: string, delay = 0, leaving = false) {
    const root = this.root.current
    if (!root) return
    const css = getComputedStyle(root)
    const animation = element.animate([{ transform: from }, { transform: to }], {
      duration: milliseconds(css, '--dur-chart', 320),
      delay,
      easing: css.getPropertyValue('--ease-in-out').trim() || 'ease-in-out',
      fill: 'both',
    })
    this.animations.add(animation)
    animation.onfinish = () => {
      this.animations.delete(animation)
      animation.cancel()
      if (leaving) {
        element.remove()
        this.ghosts.delete(element)
      }
    }
  }

  private play(before: Snapshot) {
    const root = this.root.current
    if (!root) return
    const bars = Array.from(root.querySelectorAll<HTMLElement>('[data-chart-bar]'))
    if (!bars.length && !before.size) return // empty or pending data doesn't claim the first view
    const first = !seenCharts.has(this.props.id)
    if (bars.length) seenCharts.add(this.props.id)
    const previousIds = Array.from(before.keys())
    const changed =
      bars.length !== before.size ||
      bars.some((bar, index) => {
        const old = before.get(bar.dataset.chartBar ?? '')
        return !old || old.size !== this.size(bar) || previousIds[index] !== bar.dataset.chartBar
      })
    if (before.size && !changed) return
    // Snapshot rects include any in-flight transform, so a new change retargets from there.
    for (const animation of this.animations) animation.cancel()
    this.animations.clear()
    for (const ghost of this.ghosts) ghost.remove()
    this.ghosts.clear()
    if (document.hidden || reducedMotion()) return
    if (!before.size && !first) return // a remount after the first view: no re-grow
    const stagger = milliseconds(getComputedStyle(root), '--stagger-chart', 30)
    const scale = this.axis === 'x' ? 'scaleX' : 'scaleY'
    const current = new Set<string>()
    bars.forEach((bar, index) => {
      const id = bar.dataset.chartBar
      if (!id) return
      current.add(id)
      const old = before.get(id)
      const next = bar.getBoundingClientRect()
      const size = this.size(bar)
      if (!old) {
        this.animate(bar, `${scale}(0)`, `${scale}(1)`, first && !before.size && index <= 12 ? index * stagger : 0)
        return
      }
      if (size <= 0) return
      // Align the baselines: left edge for horizontal bars, bottom edge for columns.
      const dx = old.rect.left - next.left
      const dy = this.axis === 'x' ? old.rect.top - next.top : old.rect.bottom - next.bottom
      const ratio = old.size / size
      if (Math.abs(ratio - 1) > 0.001 || Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        this.animate(bar, `translate(${dx}px, ${dy}px) ${scale}(${ratio})`, `translate(0px, 0px) ${scale}(1)`)
      }
    })
    const origin = root.getBoundingClientRect()
    for (const [id, { rect, ghost }] of before) {
      if (current.has(id)) continue
      ghost.removeAttribute('data-chart-bar')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.classList.add('gio-chart-ghost')
      Object.assign(ghost.style, {
        left: `${rect.left - origin.left}px`,
        top: `${rect.top - origin.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: 'none',
        transition: 'none',
      })
      root.appendChild(ghost)
      this.ghosts.add(ghost)
      this.animate(ghost, `${scale}(1)`, `${scale}(0)`, 0, true)
    }
  }

  override componentWillUnmount() {
    this.observer?.disconnect()
    document.removeEventListener('visibilitychange', this.visibility)
    for (const animation of this.animations) animation.cancel()
    for (const ghost of this.ghosts) ghost.remove()
  }

  override render() {
    return (
      <div ref={this.root} className={`gio-chart ${this.props.className ?? ''}`} style={this.props.style} data-axis={this.axis}>
        {this.props.children}
      </div>
    )
  }
}
