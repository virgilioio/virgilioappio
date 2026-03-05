import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/**
 * Renders processed HTML content to a PDF blob.
 * Creates a hidden container, captures it with html2canvas, then converts to PDF.
 */
export async function generateOfferPdf(htmlContent: string): Promise<Blob> {
  // Create a hidden container with A4-like width for rendering
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 794px;
    padding: 40px;
    background: white;
    color: black;
    font-family: 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.6;
  `
  container.innerHTML = htmlContent
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    const imgWidth = pdfWidth
    const imgHeight = (canvas.height * pdfWidth) / canvas.width

    // Handle multi-page content
    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pdfHeight

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft)
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight
    }

    return pdf.output('blob')
  } finally {
    document.body.removeChild(container)
  }
}
