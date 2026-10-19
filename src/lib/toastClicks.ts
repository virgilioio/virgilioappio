/**
 * A toast's Undo stays usable while a sheet or dialog is open (2026-10-19):
 * a click on a toast isn't a click outside the sheet, so the sheet stays open.
 * (The toasts themselves take pointer events again in src/index.css.)
 */
export function keepOpenForToasts<E extends { target: EventTarget | null; preventDefault: () => void }>(
  e: E,
  next?: (e: E) => void,
) {
  if (e.target instanceof Element && e.target.closest('[data-sonner-toaster]')) e.preventDefault()
  next?.(e)
}
