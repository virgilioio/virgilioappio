import { createRoot } from 'react-dom/client'
import printCss from './dossierPrint.css?inline'
import { DossierPrintDocument, type DossierPrintProps } from './DossierPrintDocument'

/**
 * Renders the dossier document into an off-screen frame and hands it to the
 * browser's own print pipeline, so the output stays real, selectable text.
 */
export async function printDossier(data: DossierPrintProps, fileHint: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0;'
  document.body.appendChild(frame)

  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    throw new Error('The print view could not be opened.')
  }

  doc.open()
  doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
  doc.close()
  doc.title = fileHint

  // Font faces come from the host document; the layout comes from our own sheet.
  document.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]').forEach((node) => {
    doc.head.appendChild(node.cloneNode(true))
  })
  const style = doc.createElement('style')
  style.textContent = printCss
  doc.head.appendChild(style)

  const mount = doc.createElement('div')
  doc.body.appendChild(mount)
  const root = createRoot(mount)

  await new Promise<void>((resolve) => {
    root.render(<DossierPrintDocument data={data} onReady={resolve} />)
  })

  try {
    await doc.fonts?.ready
  } catch {
    // Printing with fallback metrics is better than not printing at all.
  }

  await new Promise((resolve) => setTimeout(resolve, 120))

  win.focus()
  win.print()

  setTimeout(() => {
    root.unmount()
    frame.remove()
  }, 1000)
}
