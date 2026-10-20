/** Esc belongs to an open menu, popover or dialog before it clears a selection. */
export function floatingLayerOpen(): boolean {
  return !!document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"]')
}
