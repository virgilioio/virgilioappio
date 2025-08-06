import { jsPDF } from 'jspdf'
import { Candidate } from '@/hooks/useCandidates'
import { getSkillColor, PastelColor } from '@/utils/skillColors'

// Skill color mapping for PDF (HSL values converted to RGB)
const skillColorMap: Record<PastelColor, { bg: [number, number, number], text: [number, number, number] }> = {
  'pastel-blue': { bg: [173, 216, 230], text: [37, 99, 235] },
  'pastel-purple': { bg: [221, 214, 254], text: [124, 58, 237] },
  'pastel-green': { bg: [187, 247, 208], text: [34, 197, 94] },
  'pastel-pink': { bg: [252, 231, 243], text: [236, 72, 153] },
  'pastel-yellow': { bg: [254, 240, 138], text: [202, 138, 4] },
  'pastel-orange': { bg: [255, 237, 213], text: [249, 115, 22] }
}

// Helper function to convert HTML to formatted plain text preserving structure
const stripHtml = (html: string): string => {
  // Create a temporary div to parse HTML
  const temp = document.createElement('div')
  temp.innerHTML = html
  
  // Convert common HTML elements to formatted text
  // Convert <li> elements to bullet points
  const listItems = temp.querySelectorAll('li')
  listItems.forEach(item => {
    const bullet = document.createTextNode('• ')
    item.insertBefore(bullet, item.firstChild)
  })
  
  // Convert <p> and <div> elements to add line breaks
  const paragraphs = temp.querySelectorAll('p, div')
  paragraphs.forEach(p => {
    p.appendChild(document.createTextNode('\n'))
  })
  
  // Convert <br> elements to line breaks
  const breaks = temp.querySelectorAll('br')
  breaks.forEach(br => {
    br.replaceWith(document.createTextNode('\n'))
  })
  
  // Get the text content
  const text = temp.textContent || temp.innerText || ''
  
  // Clean up extra whitespace but preserve line breaks
  return text
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
    .replace(/^\s+|\s+$/g, '') // Trim leading/trailing whitespace
}

// Helper function to draw a skill pill
const drawSkillPill = (pdf: jsPDF, skill: string, x: number, y: number): number => {
  const skillColor = getSkillColor(skill)
  const colors = skillColorMap[skillColor]
  
  // Set font to measure text width
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  const textWidth = pdf.getTextWidth(skill)
  
  // Pill dimensions (4 points height)
  const pillWidth = textWidth + 4
  const pillHeight = 4
  const borderRadius = 2
  
  // Draw rounded rectangle background
  pdf.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2])
  pdf.roundedRect(x, y - 3, pillWidth, pillHeight, borderRadius, borderRadius, 'F')
  
  // Draw text - centered horizontally and vertically
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2])
  const textX = x + (pillWidth / 2)
  const textY = y - 1 + (pillHeight / 4) // Adjust for vertical centering
  pdf.text(skill, textX, textY, { align: 'center' })
  
  // Reset text color
  pdf.setTextColor(0, 0, 0)
  
  return pillWidth + 3 // Return width plus spacing
}

interface GeneratePdfOptions {
  candidate: Candidate
  job?: any
  organization?: any
}

export const generateCandidatePdf = async ({ candidate, job, organization }: GeneratePdfOptions) => {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.width
  const margin = 36 // 0.5 inch margins (72 points per inch * 0.5 = 36 points) - standard spacing
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin

  // Typography helper functions with improved hierarchy
  // Note: jsPDF has limitations with custom fonts, using Helvetica as fallback for Poppins/Lato
  const setH1Style = () => {
    pdf.setFontSize(18) // H1: Poppins Bold 18pt
    pdf.setFont('helvetica', 'bold') // Fallback for Poppins Bold (700)
  }

  const setH2Style = () => {
    pdf.setFontSize(14) // H2: Poppins SemiBold 14pt  
    pdf.setFont('helvetica', 'bold') // Fallback for Poppins SemiBold (600)
  }

  const setH3Style = () => {
    pdf.setFontSize(11) // H3: Poppins Medium 11pt
    pdf.setFont('helvetica', 'normal') // Fallback for Poppins Medium (500)
  }

  const setBodyStyle = () => {
    pdf.setFontSize(10) // Body: Lato Regular 10pt
    pdf.setFont('helvetica', 'normal') // Fallback for Lato Regular (400)
  }

  const setContactStyle = () => {
    pdf.setFontSize(9) // Contact/Secondary: Lato Regular 9pt
    pdf.setFont('helvetica', 'normal') // Fallback for Lato Regular (400)
  }

  // Helper function to add text with line wrapping and improved line spacing
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10, lineSpacing = 1.3) => {
    pdf.setFontSize(fontSize)
    const textLines = pdf.splitTextToSize(text, maxWidth)
    const lineHeight = fontSize * lineSpacing * 0.352778 // Convert to points (1 pt = 0.352778 mm)
    
    let currentY = y
    textLines.forEach((line: string, index: number) => {
      // Check if we need a new page
      if (currentY > pdf.internal.pageSize.height - margin - 20) {
        pdf.addPage()
        currentY = margin
      }
      pdf.text(line, x, currentY)
      currentY += lineHeight
    })
    
    return currentY
  }

  // Helper function to check if we need a new page and add one if necessary
  const checkPageBreak = (additionalSpace = 30) => {
    if (yPosition > pdf.internal.pageSize.height - margin - additionalSpace) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  // Add Virgilio logo at the top left
  try {
    // Load the logo image and convert to base64 for jsPDF
    const response = await fetch('/virgilio-logo.png')
    const blob = await response.blob()
    
    // Convert blob to base64
    const base64Logo = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    
    // Create an image to get dimensions
    const logoImg = new Image()
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve
      logoImg.onerror = reject
      logoImg.src = base64Logo
    })
    
    // Add logo to PDF (scaled appropriately)
    const logoWidth = 25
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth
    pdf.addImage(base64Logo, 'PNG', margin, yPosition, logoWidth, logoHeight)
    yPosition += logoHeight + 8
  } catch (error) {
    console.error('Failed to load logo:', error)
    // Fallback to text if logo fails to load
    setH3Style()
    pdf.text('VIRGILIO', margin, yPosition)
    yPosition += 8
  }

  // Add a subtle line separator
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 10 // Reduced spacing

  // Candidate Name as main title (H1)
  setH1Style()
  pdf.text(candidate.candidate_name || 'Unnamed Candidate', margin, yPosition)
  yPosition += 12 // 8-12pt spacing below H1

  // Job title if available (H3)
  if (job) {
    setH3Style()
    pdf.text(job.title, margin, yPosition)
    yPosition += 8 // 3-5pt spacing below H3 + some extra
  }

  yPosition += 8 // Additional spacing before next section

  // Check for page break before candidate information
  checkPageBreak()

  // Candidate Information Section (H2)
  setH2Style()
  pdf.text('CANDIDATE INFORMATION', margin, yPosition)
  yPosition += 8 // 6-8pt spacing below H2

  setContactStyle() // 9pt for contact/secondary details

  // Location
  const locationParts = [candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean)
  if (locationParts.length > 0) {
    pdf.text(`Location: ${locationParts.join(', ')}`, margin, yPosition)
    yPosition += 6
  }

  // Salary Expectations
  if (candidate.salary_amount) {
    const currency = candidate.salary_currency || 'USD'
    const amount = candidate.salary_amount.toLocaleString()
    const period = candidate.salary_period || 'annually'
    pdf.text(`Salary Expectations: ${currency} ${amount} ${period}`, margin, yPosition)
    yPosition += 6
  }

  if (candidate.linkedin_url) {
    pdf.text(`LinkedIn: ${candidate.linkedin_url}`, margin, yPosition)
    yPosition += 12
  } else {
    yPosition += 8
  }

  // Skills Section
  if (candidate.skills && candidate.skills.length > 0) {
    // Check for page break before skills section
    checkPageBreak(50) // More space needed for skills section
    
    setH2Style()
    pdf.text('SKILLS', margin, yPosition)
    yPosition += 8 // 6-8pt spacing below H2

    // Draw skills as colored pills
    let currentX = margin
    let currentY = yPosition
    const maxWidth = contentWidth
    
    candidate.skills.forEach((skill) => {
      // Check if we need a page break for each skill row
      if (currentY > pdf.internal.pageSize.height - margin - 30) {
        pdf.addPage()
        currentY = margin
        currentX = margin
      }
      
      const skillWidth = drawSkillPill(pdf, skill, currentX, currentY)
      currentX += skillWidth
      
      // Check if we need to wrap to next line
      if (currentX > margin + maxWidth - 25) { // Leave some margin for next skill
        currentX = margin
        currentY += 6
      }
    })
    
    yPosition = currentY + 12 // Extra spacing after skills section
  }

  // Work Experience Section - placeholder for future implementation
  // Note: work_experience is not currently in the Candidate type

  // Education Section - placeholder for future implementation  
  // Note: education is not currently in the Candidate type

  // Profile Summary Section
  if (candidate.profile_summary) {
    // Check for page break before profile summary
    checkPageBreak(40) // Need space for section header and some content

    setH2Style()
    pdf.text('PROFILE SUMMARY', margin, yPosition)
    yPosition += 8 // 6-8pt spacing below H2

    setBodyStyle()
    // Strip HTML tags and format as plain text with improved line spacing
    const cleanSummary = stripHtml(candidate.profile_summary)
    yPosition = addWrappedText(cleanSummary, margin, yPosition, contentWidth, 10, 1.3)
    yPosition += 10
  }

  // Footer
  const pageCount = (pdf as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(
      `Generated by Virgilio - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      (pdf as any).internal.pageSize.height - 10,
      { align: 'center' }
    )
  }

  // Save the PDF
  const fileName = `${candidate.candidate_name?.replace(/\s+/g, '_') || 'candidate'}_profile.pdf`
  pdf.save(fileName)
}