
export interface CursorPosition {
  startOffset: number
  endOffset: number
  startContainer: Node | null
  endContainer: Node | null
}

export function saveCursorPosition(element: HTMLElement): CursorPosition | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  
  // Check if the selection is within our element
  if (!element.contains(range.commonAncestorContainer)) {
    return null
  }

  return {
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    startContainer: range.startContainer,
    endContainer: range.endContainer
  }
}

export function restoreCursorPosition(element: HTMLElement, position: CursorPosition | null): void {
  if (!position || !position.startContainer || !position.endContainer) {
    return
  }

  try {
    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    
    // Ensure the nodes are still in the DOM and within our element
    if (element.contains(position.startContainer) && element.contains(position.endContainer)) {
      range.setStart(position.startContainer, Math.min(position.startOffset, position.startContainer.textContent?.length || 0))
      range.setEnd(position.endContainer, Math.min(position.endOffset, position.endContainer.textContent?.length || 0))
      
      selection.removeAllRanges()
      selection.addRange(range)
    }
  } catch (error) {
    // If restoration fails, just place cursor at the end
    console.warn('Failed to restore cursor position:', error)
    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.selectNodeContents(element)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }
}

export function getTextContent(element: HTMLElement): string {
  return element.innerHTML
}
