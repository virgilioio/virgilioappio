import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

// Ensure mammoth is loaded
const ensureMammoth = async () => {
  if (typeof window !== 'undefined' && !(window as any).mammoth) {
    const mammoth = await import('mammoth/mammoth.browser')
    ;(window as any).mammoth = mammoth
  }
  return (window as any).mammoth
}

/**
 * Convert a DOCX file to PDF blob for inline viewing
 */
export async function convertDocxToPdf(file: File): Promise<Blob> {
  try {
    const mammoth = await ensureMammoth()
    
    // Convert DOCX to HTML
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    
    if (!result.value) {
      throw new Error('Failed to extract content from document')
    }

    // Create a temporary container for rendering
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '210mm' // A4 width
    container.style.padding = '20mm'
    container.style.backgroundColor = 'white'
    container.style.fontFamily = 'Arial, sans-serif'
    container.style.fontSize = '12px'
    container.style.lineHeight = '1.4'
    container.innerHTML = result.value

    document.body.appendChild(container)

    try {
      // Convert HTML to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: 'white',
        width: container.offsetWidth,
        height: container.offsetHeight
      })

      // Create PDF
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      
      const pdf = new jsPDF('p', 'mm', 'a4')
      let position = 0

      // Add first page
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      return pdf.output('blob')
    } finally {
      document.body.removeChild(container)
    }
  } catch (error) {
    console.error('Error converting document to PDF:', error)
    throw new Error('Failed to convert document to PDF')
  }
}

/**
 * Convert various document formats to PDF blob
 */
export async function convertDocumentToPdf(file: File): Promise<Blob> {
  const fileType = file.type.toLowerCase()
  const fileName = file.name.toLowerCase()

  // Handle DOCX files
  if (fileType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
    return convertDocxToPdf(file)
  }

  // For other formats, we could add more converters here
  // For now, throw an error for unsupported formats
  throw new Error(`Unsupported file format: ${fileType}`)
}