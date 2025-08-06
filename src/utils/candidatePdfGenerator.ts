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
  
  // Pill dimensions (smaller to match platform)
  const pillWidth = textWidth + 6
  const pillHeight = 7
  const borderRadius = 3.5
  
  // Draw rounded rectangle background
  pdf.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2])
  pdf.roundedRect(x, y - 5, pillWidth, pillHeight, borderRadius, borderRadius, 'F')
  
  // Draw text
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2])
  pdf.text(skill, x + 3, y - 1.5)
  
  // Reset text color
  pdf.setTextColor(0, 0, 0)
  
  return pillWidth + 4 // Return width plus spacing
}

interface GeneratePdfOptions {
  candidate: Candidate
  job?: any
  organization?: any
}

export const generateCandidatePdf = async ({ candidate, job, organization }: GeneratePdfOptions) => {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.width
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin

  // Helper function to add text with line wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10) => {
    pdf.setFontSize(fontSize)
    const textLines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(textLines, x, y)
    return y + (textLines.length * (fontSize * 0.4))
  }

  // Add Virgilio logo (placeholder for now - you can replace with actual logo)
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('VIRGILIO', margin, yPosition)
  yPosition += 15

  // Add a line separator
  pdf.setLineWidth(0.5)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 20

  // Candidate Name as main title (H1)
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text(candidate.candidate_name || 'Unnamed Candidate', margin, yPosition)
  yPosition += 15

  // Job title if available
  if (job) {
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'normal')
    pdf.text(job.title, margin, yPosition)
    yPosition += 20
  } else {
    yPosition += 10
  }

  // Candidate Information Section
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('CANDIDATE INFORMATION', margin, yPosition)
  yPosition += 10

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

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
    yPosition += 15
  } else {
    yPosition += 10
  }

  // Skills Section
  if (candidate.skills && candidate.skills.length > 0) {
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('SKILLS', margin, yPosition)
    yPosition += 15

    // Draw skills as colored pills
    let currentX = margin
    let currentY = yPosition
    const maxWidth = contentWidth
    
    candidate.skills.forEach((skill) => {
      const skillWidth = drawSkillPill(pdf, skill, currentX, currentY)
      currentX += skillWidth
      
      // Check if we need to wrap to next line
      if (currentX > margin + maxWidth - 30) { // Leave some margin for next skill
        currentX = margin
        currentY += 12
      }
    })
    
    yPosition = currentY + 12
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

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PROFILE SUMMARY', margin, yPosition)
    yPosition += 10

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    // Strip HTML tags and format as plain text
    const cleanSummary = stripHtml(candidate.profile_summary)
    yPosition = addWrappedText(cleanSummary, margin, yPosition, contentWidth)
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