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

// Helper function to strip HTML tags and convert to plain text
const stripHtml = (html: string): string => {
  // Create a temporary div to parse HTML
  const temp = document.createElement('div')
  temp.innerHTML = html
  
  // Replace common HTML elements with appropriate spacing/formatting
  const text = temp.textContent || temp.innerText || ''
  
  // Clean up extra whitespace and normalize line breaks
  return text
    .replace(/\s+/g, ' ')
    .trim()
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
  const setH1Style = () => {
    pdf.setFontSize(18) // H1: 18pt
    pdf.setFont('helvetica', 'bold') // Fallback for Poppins Bold (700)
  }

  const setH2Style = () => {
    pdf.setFontSize(14) // H2: 14pt  
    pdf.setFont('helvetica', 'bold') // Fallback for Poppins SemiBold (600)
  }

  const setH3Style = () => {
    pdf.setFontSize(11) // H3: 11pt
    pdf.setFont('helvetica', 'normal') // Fallback for Poppins Medium (500)
  }

  const setBodyStyle = () => {
    pdf.setFontSize(10) // Body: 10pt
    pdf.setFont('helvetica', 'normal') // Fallback for Lato Regular (400)
  }

  const setContactStyle = () => {
    pdf.setFontSize(9) // Contact/Secondary: 9pt
    pdf.setFont('helvetica', 'normal') // Fallback for Lato Regular (400)
  }

  // Helper function to add text with line wrapping and improved line spacing
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10, lineSpacing = 1.3) => {
    pdf.setFontSize(fontSize)
    const textLines = pdf.splitTextToSize(text, maxWidth)
    const lineHeight = fontSize * lineSpacing * 0.352778 // Convert to points (1 pt = 0.352778 mm)
    
    textLines.forEach((line: string, index: number) => {
      pdf.text(line, x, y + (index * lineHeight))
    })
    
    return y + (textLines.length * lineHeight)
  }

  // Add Virgilio logo (placeholder for now - you can replace with actual logo)
  setH3Style()
  pdf.text('VIRGILIO', margin, yPosition)
  yPosition += 15

  // Add a line separator
  pdf.setLineWidth(0.5)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 20

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
    setH2Style()
    pdf.text('SKILLS', margin, yPosition)
    yPosition += 8 // 6-8pt spacing below H2

    // Draw skills as colored pills
    let currentX = margin
    let currentY = yPosition
    const maxWidth = contentWidth
    
    candidate.skills.forEach((skill) => {
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
    if (yPosition > 250) {
      pdf.addPage()
      yPosition = margin
    }

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