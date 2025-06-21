
export interface TextCursorPosition {
  startOffset: number
  endOffset: number
}

export function saveTextCursorPosition(element: HTMLElement): TextCursorPosition | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  
  // Check if the selection is within our element
  if (!element.contains(range.commonAncestorContainer)) {
    return null
  }

  // Convert DOM position to text offset
  const startOffset = getTextOffset(element, range.startContainer, range.startOffset)
  const endOffset = getTextOffset(element, range.endContainer, range.endOffset)

  return {
    startOffset,
    endOffset
  }
}

export function restoreTextCursorPosition(element: HTMLElement, position: TextCursorPosition | null): void {
  if (!position) {
    return
  }

  try {
    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    const textNodes = getTextNodes(element)
    
    let currentOffset = 0
    let startNode: Node | null = null
    let endNode: Node | null = null
    let startNodeOffset = 0
    let endNodeOffset = 0

    // Find the start position
    for (const node of textNodes) {
      const nodeLength = node.textContent?.length || 0
      if (currentOffset + nodeLength >= position.startOffset && !startNode) {
        startNode = node
        startNodeOffset = position.startOffset - currentOffset
      }
      if (currentOffset + nodeLength >= position.endOffset && !endNode) {
        endNode = node
        endNodeOffset = position.endOffset - currentOffset
        break
      }
      currentOffset += nodeLength
    }

    // If we found valid nodes, set the selection
    if (startNode && endNode) {
      range.setStart(startNode, Math.min(startNodeOffset, startNode.textContent?.length || 0))
      range.setEnd(endNode, Math.min(endNodeOffset, endNode.textContent?.length || 0))
      
      selection.removeAllRanges()
      selection.addRange(range)
    }
  } catch (error) {
    console.warn('Failed to restore cursor position:', error)
    // Fallback: place cursor at the end
    placeCursorAtEnd(element)
  }
}

function getTextOffset(container: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT
  )

  let textOffset = 0
  let currentNode: Node | null

  while (currentNode = walker.nextNode()) {
    if (currentNode === node) {
      return textOffset + offset
    }
    textOffset += currentNode.textContent?.length || 0
  }

  return textOffset
}

function getTextNodes(element: HTMLElement): Node[] {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT
  )

  const textNodes: Node[] = []
  let node: Node | null

  while (node = walker.nextNode()) {
    textNodes.push(node)
  }

  return textNodes
}

function placeCursorAtEnd(element: HTMLElement): void {
  try {
    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.selectNodeContents(element)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  } catch (error) {
    console.warn('Failed to place cursor at end:', error)
  }
}

export function getTextContent(element: HTMLElement): string {
  return element.innerHTML
}
