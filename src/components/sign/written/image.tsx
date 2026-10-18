/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $applyNodeReplacement,
  $createRangeSelection,
  $getNodeByKey,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  DecoratorNode,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  PASTE_COMMAND,
  createCommand,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/integrations/supabase/client'
import { IconTip } from '@/components/ui/tooltip'
import { useSelect } from './nodes'

/**
 * Images in the offer editor (Gio Docs' image block, 2026-10-18). "/" Image
 * picks a file; pasting or dropping one works too. The picture is resized in
 * the browser (2000px on the long side at most) and stored with the
 * template's files (sign-files, {tenant}/templates/{template}/images/), which
 * only template admins can read; the PDF functions read it on their side.
 * Selected, it shows its alignment and Delete, and the corner handle resizes
 * it as a share of the text width (what the PDF uses).
 */

export type ImageAlign = 'left' | 'center' | 'right'
export type SerializedImageNode = Spread<{ path: string; w: number; h: number; width: number; align: ImageAlign }, SerializedLexicalNode>

const BUCKET = 'sign-files'
const MAX_SIDE = 2000
const MAX_INPUT = 15 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/* ---- Showing a stored image ------------------------------------------------ */

const urls = new Map<string, Promise<string>>()
/** While a picture uploads, the node shows the local copy under a "local:" path. */
const local = new Map<string, string>()

function imageUrl(path: string): Promise<string> {
  const mine = local.get(path)
  if (mine) return Promise.resolve(mine)
  let p = urls.get(path)
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.storage.from(BUCKET).download(path)
      if (error || !data) throw new Error('missing')
      return URL.createObjectURL(data)
    })()
    p.catch(() => urls.delete(path))
    urls.set(path, p)
  }
  return p
}

function ImageView({ nodeKey, path, w, h, width, align }: { nodeKey: NodeKey; path: string; w: number; h: number; width: number; align: ImageAlign }) {
  const [editor] = useLexicalComposerContext()
  const { selected, ref } = useSelect(nodeKey)
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ x: number; w: number; box: number } | null>(null)

  // Clicks on the bar and the handle are the image's own: the selection stays on it.
  useEffect(
    () =>
      editor.registerCommand(
        CLICK_COMMAND,
        (e: MouseEvent) => !!ref.current?.contains(e.target as Node) && !!(e.target as Element).closest('.gio-written-image-bar, .gio-written-image-handle'),
        COMMAND_PRIORITY_NORMAL,
      ),
    [editor, ref],
  )

  useEffect(() => {
    let live = true
    setFailed(false)
    imageUrl(path).then(
      (u) => live && setSrc(u),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [path])

  const update = (fn: (n: ImageNode) => void) =>
    editor.update(() => {
      const n = $getNodeByKey(nodeKey)
      if (n instanceof ImageNode) fn(n)
    })

  // The corner handle follows the pointer exactly (no transition); the share is saved on release.
  const down = (e: RPointerEvent<HTMLSpanElement>) => {
    const fig = ref.current
    const box = fig?.parentElement?.clientWidth
    if (!fig || !box) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, w: fig.getBoundingClientRect().width, box }
    setDrag(width)
  }
  const move = (e: RPointerEvent<HTMLSpanElement>) => {
    const s = start.current
    if (!s) return
    const grow = (e.clientX - s.x) * (align === 'center' ? 2 : align === 'right' ? -1 : 1)
    setDrag(Math.max(0.15, Math.min(1, (s.w + grow) / s.box)))
  }
  const up = () => {
    if (start.current && drag != null) {
      const share = Math.round(drag * 100) / 100
      update((n) => n.setLook({ width: share }))
    }
    start.current = null
    setDrag(null)
  }

  const share = drag ?? width
  return (
    <figure
      ref={ref}
      className="gio-written-image"
      contentEditable={false}
      data-selected={selected || undefined}
      data-align={align}
      style={{ width: `${share * 100}%` }}
    >
      {src && !failed ? (
        <img src={src} alt="" draggable={false} style={{ aspectRatio: w && h ? `${w} / ${h}` : undefined }} />
      ) : (
        <span className="gio-written-image-empty" style={{ aspectRatio: w && h ? `${w} / ${h}` : '5 / 3' }}>
          {failed ? 'Image not available' : ''}
        </span>
      )}
      {selected && (
        <>
          <span className="gio-written-image-bar" onMouseDown={(e) => e.preventDefault()}>
            {(
              [
                ['left', AlignLeft, 'Align left'],
                ['center', AlignCenter, 'Centre'],
                ['right', AlignRight, 'Align right'],
              ] as const
            ).map(([a, Icon, label]) => (
              <IconTip key={a} label={label}>
                <button type="button" className="gio-fbar-btn" aria-label={label} aria-pressed={align === a} onClick={() => update((n) => n.setLook({ align: a }))}>
                  <Icon className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
                </button>
              </IconTip>
            ))}
            <span aria-hidden className="mx-1 h-4 w-px bg-white/20" />
            <IconTip label="Delete image">
              <button type="button" className="gio-fbar-btn" aria-label="Delete image" onClick={() => update((n) => n.remove())}>
                <Trash2 className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
              </button>
            </IconTip>
          </span>
          <span
            className="gio-written-image-handle"
            data-side={align === 'right' ? 'left' : 'right'}
            role="slider"
            aria-label="Image width"
            aria-valuemin={15}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
            tabIndex={0}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
              e.preventDefault()
              const next = Math.max(0.15, Math.min(1, Math.round((width + (e.key === 'ArrowRight' ? 0.05 : -0.05)) * 100) / 100))
              update((n) => n.setLook({ width: next }))
            }}
          />
        </>
      )}
    </figure>
  )
}

/* ---- The node ------------------------------------------------------------- */

export class ImageNode extends DecoratorNode<ReactNode> {
  __path: string
  __w: number
  __h: number
  __width: number
  __align: ImageAlign

  static getType() {
    return 'gio-image'
  }
  static clone(node: ImageNode) {
    return new ImageNode(node.__path, node.__w, node.__h, node.__width, node.__align, node.__key)
  }
  constructor(path = '', w = 0, h = 0, width = 1, align: ImageAlign = 'center', key?: NodeKey) {
    super(key)
    this.__path = path
    this.__w = w
    this.__h = h
    this.__width = width
    this.__align = align
  }
  static importJSON(json: SerializedImageNode) {
    const align: ImageAlign = json.align === 'left' || json.align === 'right' ? json.align : 'center'
    return $createImageNode(String(json.path ?? ''), Number(json.w) || 0, Number(json.h) || 0, Math.max(0.1, Math.min(1, Number(json.width) || 1)), align)
  }
  exportJSON(): SerializedImageNode {
    return { type: 'gio-image', version: 1, path: this.__path, w: this.__w, h: this.__h, width: this.__width, align: this.__align }
  }
  createDOM() {
    const div = document.createElement('div')
    div.className = 'gio-written-image-wrap'
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
  setLook(s: { path?: string; width?: number; align?: ImageAlign }) {
    const n = this.getWritable()
    if (s.path !== undefined) n.__path = s.path
    if (s.width !== undefined) n.__width = s.width
    if (s.align !== undefined) n.__align = s.align
    return n
  }
  decorate() {
    return <ImageView nodeKey={this.__key} path={this.__path} w={this.__w} h={this.__h} width={this.__width} align={this.__align} />
  }
}

export const $createImageNode = (path: string, w: number, h: number, width = 1, align: ImageAlign = 'center') =>
  $applyNodeReplacement(new ImageNode(path, w, h, width, align))
export const $isImageNode = (n: LexicalNode | null | undefined): n is ImageNode => n instanceof ImageNode

/* ---- Adding pictures -------------------------------------------------------- */

/** Pictures to add where the caret is. */
export const INSERT_IMAGE_FILES = createCommand<File[]>('INSERT_IMAGE_FILES')

class ImageProblem extends Error {}

/** PNG or JPEG, 2000px on the long side at most; anything else becomes a PNG. */
async function prepare(file: File): Promise<{ blob: Blob; w: number; h: number; ext: 'png' | 'jpg' }> {
  if (!TYPES.includes(file.type)) throw new ImageProblem(`${file.name || 'That file'} isn’t a PNG, JPEG, WebP or GIF image.`)
  if (file.size > MAX_INPUT) throw new ImageProblem(`${file.name || 'That image'} is over 15 MB.`)
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) throw new ImageProblem(`${file.name || 'That image'} couldn’t be read.`)
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const jpeg = file.type === 'image/jpeg'
  if (scale === 1 && (jpeg || file.type === 'image/png') && file.size <= 5 * 1024 * 1024) {
    bmp.close()
    return { blob: file, w, h, ext: jpeg ? 'jpg' : 'png' }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, jpeg ? 'image/jpeg' : 'image/png', 0.9))
  if (!blob) throw new ImageProblem(`${file.name || 'That image'} couldn’t be prepared.`)
  return { blob, w, h, ext: jpeg ? 'jpg' : 'png' }
}

/** Opens the file picker for "/" Image. */
export function pickImages(editor: LexicalEditor) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = TYPES.join(',')
  input.multiple = true
  input.onchange = () => {
    const files = [...(input.files ?? [])]
    if (files.length) editor.dispatchCommand(INSERT_IMAGE_FILES, files)
  }
  input.click()
}

const imageFiles = (dt: DataTransfer | null) => [...(dt?.files ?? [])].filter((f) => f.type.startsWith('image/'))

/**
 * Adds pictures from "/" Image, paste and drop. `$insert` puts a block where
 * the caret is (WrittenPane's, so an image lands inside a column too).
 */
export function ImagePlugin({ tenantId, templateId, $insert }: { tenantId: string | null; templateId: string; $insert: (node: LexicalNode) => void }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    const add = (files: File[]) => {
      if (!tenantId) {
        toast.error('Couldn’t add the image. Reload the page and try again.')
        return
      }
      for (const file of files) {
        void (async () => {
          let key: string | null = null
          let temp: string | null = null
          try {
            const img = await prepare(file)
            temp = `local:${crypto.randomUUID()}`
            local.set(temp, URL.createObjectURL(img.blob))
            editor.update(() => {
              const node = $createImageNode(temp!, img.w, img.h, img.w < 300 ? Math.max(0.15, img.w / 600) : 1)
              $insert(node)
              key = node.getKey()
            })
            const path = `${tenantId}/templates/${templateId}/images/${crypto.randomUUID()}.${img.ext}`
            const { error } = await supabase.storage.from(BUCKET).upload(path, img.blob, { contentType: img.ext === 'jpg' ? 'image/jpeg' : 'image/png', upsert: false })
            if (error) throw new ImageProblem(`Couldn’t upload ${file.name || 'the image'}. Try again.`)
            urls.set(path, Promise.resolve(local.get(temp)!))
            editor.update(() => {
              const n = key ? $getNodeByKey(key) : null
              if (n instanceof ImageNode) n.setLook({ path })
            })
          } catch (err) {
            if (key) editor.update(() => $getNodeByKey(key!)?.remove())
            toast.error(err instanceof ImageProblem ? err.message : `Couldn’t add ${file.name || 'the image'}. Try again.`)
          } finally {
            if (temp) local.delete(temp)
          }
        })()
      }
    }
    return mergeRegister(
      editor.registerCommand(
        INSERT_IMAGE_FILES,
        (files) => {
          add(files)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        PASTE_COMMAND,
        (e) => {
          const files = e instanceof ClipboardEvent ? imageFiles(e.clipboardData) : []
          if (!files.length) return false
          e.preventDefault()
          add(files)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        DRAGOVER_COMMAND,
        (e) => {
          if (!e.dataTransfer?.types.includes('Files')) return false
          e.preventDefault()
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (e) => {
          const files = imageFiles(e.dataTransfer)
          if (!files.length) return false
          e.preventDefault()
          // Where it was dropped.
          const range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
          if (range) {
            editor.update(() => {
              const sel = $createRangeSelection()
              sel.applyDOMRange(range)
              $setSelection(sel)
            })
          }
          add(files)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor, tenantId, templateId, $insert])
  return null
}
