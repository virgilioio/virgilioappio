import { jsPDF } from 'jspdf'
import { Candidate } from '@/hooks/useCandidates'
import { getSkillColor, PastelColor } from '@/utils/skillColors'
import { supabase } from '@/lib/supabaseClient'
import { withFetchTimeout } from '@/utils/timeout'

// Skill color mapping for PDF (HSL values converted to RGB)
const skillColorMap: Record<PastelColor, { bg: [number, number, number], text: [number, number, number] }> = {
  'pastel-blue': { bg: [173, 216, 230], text: [37, 99, 235] },
  'pastel-purple': { bg: [221, 214, 254], text: [124, 58, 237] },
  'pastel-green': { bg: [187, 247, 208], text: [34, 197, 94] },
  'pastel-pink': { bg: [252, 231, 243], text: [236, 72, 153] },
  'pastel-yellow': { bg: [254, 240, 138], text: [202, 138, 4] },
  'pastel-orange': { bg: [255, 237, 213], text: [249, 115, 22] }
}

// Enhanced HTML to formatted plain text converter with comprehensive formatting support
const stripHtml = (html: string): string => {
  if (!html || html.trim() === '') return ''
  
  try {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div')
    temp.innerHTML = html
    
    // Process headings with proper spacing and formatting
    const headings = temp.querySelectorAll('h1, h2, h3, h4, h5, h6')
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1))
      const prefix = level <= 2 ? '\n\n' : '\n'
      const suffix = '\n'
      const marker = level === 1 ? '━'.repeat(20) + '\n' : level === 2 ? '─'.repeat(15) + '\n' : ''
      
      heading.insertBefore(document.createTextNode(prefix), heading.firstChild)
      heading.appendChild(document.createTextNode(suffix + marker))
    })
    
    // Process ordered lists with proper numbering and spacing
    const orderedLists = temp.querySelectorAll('ol')
    orderedLists.forEach(list => {
      const items = list.querySelectorAll('li')
      items.forEach((item, index) => {
        // Clear any existing bullet markers
        const existingBullets = item.querySelectorAll('*')
        existingBullets.forEach(el => {
          if (el.textContent?.trim().startsWith('•') || el.textContent?.trim().match(/^\d+\./)) {
            el.remove()
          }
        })
        
        const number = document.createTextNode(`\n${index + 1}. `)
        item.insertBefore(number, item.firstChild)
        // Removed extra line break after each item for tighter spacing
      })
      // Reduced spacing after list
    })
    
    // Process unordered lists with consistent bullet points and spacing
    const unorderedLists = temp.querySelectorAll('ul')
    unorderedLists.forEach(list => {
      const items = list.querySelectorAll('li')
      items.forEach(item => {
        // Check nesting level for proper indentation
        let nestingLevel = 0
        let parent = item.parentElement
        while (parent && parent !== list) {
          if (parent.tagName === 'UL' || parent.tagName === 'OL') nestingLevel++
          parent = parent.parentElement
        }
        
        const indent = '  '.repeat(nestingLevel)
        const bullet = document.createTextNode(`\n${indent}• `)
        item.insertBefore(bullet, item.firstChild)
        // Removed extra line break after each item for tighter spacing
      })
      // Reduced spacing after list
    })
    
    // Process standalone list items (not in ol/ul)
    const standaloneItems = temp.querySelectorAll('li')
    standaloneItems.forEach(item => {
      const parent = item.parentElement
      if (parent && !['UL', 'OL'].includes(parent.tagName)) {
        const bullet = document.createTextNode('\n• ')
        item.insertBefore(bullet, item.firstChild)
        item.appendChild(document.createTextNode('\n'))
      }
    })
    
    // Process emphasis tags
    const strongElements = temp.querySelectorAll('strong, b')
    strongElements.forEach(element => {
      const text = element.textContent || ''
      element.textContent = text.toUpperCase()
    })
    
    const emphasisElements = temp.querySelectorAll('em, i')
    emphasisElements.forEach(element => {
      const text = element.textContent || ''
      element.innerHTML = `*${text}*`
    })
    
    // Process paragraphs and divs with proper spacing
    const paragraphs = temp.querySelectorAll('p')
    paragraphs.forEach(p => {
      p.appendChild(document.createTextNode('\n\n'))
    })
    
    const divs = temp.querySelectorAll('div')
    divs.forEach(div => {
      // Only add line breaks to divs that don't contain block elements
      const hasBlockElements = div.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, li')
      if (!hasBlockElements) {
        div.appendChild(document.createTextNode('\n'))
      }
    })
    
    // Convert line breaks
    const breaks = temp.querySelectorAll('br')
    breaks.forEach(br => {
      br.replaceWith(document.createTextNode('\n'))
    })
    
    // Get the processed text content
    let text = temp.textContent || temp.innerText || ''
    
    // Clean up and normalize spacing
    text = text
      // Remove excessive whitespace but preserve intentional formatting
      .replace(/[ \t]+/g, ' ')
      // Normalize multiple line breaks (max 2 consecutive)
      .replace(/\n{3,}/g, '\n\n')
      // Clean up spaces around line breaks
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      // Remove trailing spaces at line ends
      .replace(/[ \t]+$/gm, '')
      // Trim overall content
      .trim()
    
    // Ensure consistent spacing after bullet points and numbered items
    text = text
      .replace(/^([ ]*[•▪▫‣⁃][ ]*)/gm, '$1')
      .replace(/^([ ]*\d+\.[ ]*)/gm, '$1')
    
    return text
    
  } catch (error) {
    console.warn('Error processing HTML content, falling back to plain text extraction:', error)
    // Fallback: extract plain text content
    const temp = document.createElement('div')
    temp.innerHTML = html
    return (temp.textContent || temp.innerText || '').trim()
  }
}

// Helper function to draw a skill pill
const drawSkillPill = (pdf: jsPDF, skill: string, x: number, y: number, fontsLoaded = false): number => {
  const skillColor = getSkillColor(skill)
  const colors = skillColorMap[skillColor]
  
  // Set font to measure text width
  pdf.setFontSize(7)
  pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
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
  try {
    console.log('[PDF] Starting PDF generation for:', candidate.candidate_name)
    
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const margin = 36 // 0.5 inch margins (72 points per inch * 0.5 = 36 points) - standard spacing
    const contentWidth = pageWidth - (margin * 2)
    let yPosition = margin

    // Load custom fonts using TTF format for jsPDF compatibility
    const loadCustomFonts = async () => {
      try {
        console.log('[PDF] Loading custom fonts...')
        // Use CDN TTF fonts that work with jsPDF
        const poppinsBoldResponse = await withFetchTimeout(
          fetch('https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLGT9Z1xlFd2JQEk.ttf'),
          5000
        )
        const poppinsBoldBuffer = await poppinsBoldResponse.arrayBuffer()
        const poppinsBoldBase64 = btoa(String.fromCharCode(...new Uint8Array(poppinsBoldBuffer)))
        
        const latoRegularResponse = await withFetchTimeout(
          fetch('https://fonts.gstatic.com/s/lato/v24/S6uNw4ZXOJXAKKYAKSwPRhE.ttf'),
          5000
        )
        const latoRegularBuffer = await latoRegularResponse.arrayBuffer()
        const latoRegularBase64 = btoa(String.fromCharCode(...new Uint8Array(latoRegularBuffer)))
        
        // Add fonts to jsPDF
        pdf.addFileToVFS('Poppins-Bold.ttf', poppinsBoldBase64)
        pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
        
        pdf.addFileToVFS('Lato-Regular.ttf', latoRegularBase64)
        pdf.addFont('Lato-Regular.ttf', 'Lato', 'normal')
        
        console.log('[PDF] Custom fonts loaded successfully')
        return true
      } catch (error) {
        console.warn('[PDF] Failed to load custom fonts, using fallbacks:', error)
        return false
      }
    }

    const fontsLoaded = await loadCustomFonts()

    // Fetch current active logo from platform assets with timeout
    let logoUrl = '/virgilio-logo.png' // Default fallback
    try {
      console.log('[PDF] Fetching organization logo...')
      
      // Add 3-second timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Logo fetch timeout')), 3000)
      )
      
      const logoPromise = supabase
        .from('platform_assets')
        .select('file_url')
        .eq('asset_type', 'logo')
        .eq('is_active', true)
        .single()
      
      const { data, error } = await Promise.race([logoPromise, timeoutPromise]) as any

      if (data && !error && data.file_url) {
        console.log('[PDF] Custom logo found:', data.file_url)
        logoUrl = data.file_url
      } else {
        console.log('[PDF] No custom logo found, using default')
      }
    } catch (error) {
      console.warn('[PDF] Failed to fetch logo, using default:', error)
      // Keep default logo
    }

  // Typography helper functions with specified font sizes
  const setH1Style = () => {
    pdf.setFontSize(16) // H1: Candidate name
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
  }

  const setH2Style = () => {
    pdf.setFontSize(12) // H2: Section headers
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
  }

  const setH3Style = () => {
    pdf.setFontSize(9) // H3: Job title
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
  }

  const setBodyStyle = () => {
    pdf.setFontSize(8) // Body text
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
  }

  const setContactStyle = () => {
    pdf.setFontSize(7) // Contact details
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
  }

  // Helper function to add text with line wrapping and improved line spacing
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10, lineSpacing = 1.3) => {
    // Apply body style to ensure proper font
    setBodyStyle()
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

  // Add logo at the top left - non-blocking
  let logoAdded = false
  try {
    console.log('[PDF] Loading logo image:', logoUrl)
    
    // Create image element and load logo
    const logoImg = new Image()
    logoImg.crossOrigin = 'anonymous'
    
    const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Logo loading timed out after 5 seconds'))
      }, 5000)
      
      logoImg.onload = () => {
        clearTimeout(timeout)
        resolve(logoImg)
      }
      logoImg.onerror = (e) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to load logo: ${e}`))
      }
      
      // Handle both absolute and relative URLs
      const imageSrc = logoUrl.startsWith('http') 
        ? logoUrl 
        : `${window.location.origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`
      
      console.log('[PDF] Attempting to load logo from:', imageSrc)
      logoImg.src = imageSrc
    })
    
    const loadedImage = await imageLoaded
    
    // Create canvas to convert image to base64
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }
    
    // Set canvas size to match image
    canvas.width = loadedImage.naturalWidth
    canvas.height = loadedImage.naturalHeight
    
    // Draw image to canvas
    ctx.drawImage(loadedImage, 0, 0)
    
    // Convert canvas to base64
    const base64Logo = canvas.toDataURL('image/png')
    
    // Add logo to PDF (scaled appropriately)
    const logoWidth = 25
    const logoHeight = (loadedImage.naturalHeight / loadedImage.naturalWidth) * logoWidth
    pdf.addImage(base64Logo, 'PNG', margin, yPosition, logoWidth, logoHeight)
    yPosition += logoHeight + 8
    
    logoAdded = true
    console.log('[PDF] Logo successfully added to PDF')
    
  } catch (error) {
    console.warn('[PDF] Failed to load logo, using text fallback:', error)
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
  yPosition += 8 // Reduced spacing between name and job title

  // Job title if available (H3)
  if (job) {
    setH3Style()
    pdf.text(job.title, margin, yPosition)
    yPosition += 6 // Reduced spacing after job title
  }

  yPosition += 8 // Additional spacing before next section

  // Check for page break before candidate information
  checkPageBreak()

  // Candidate Information Section (H2)
  setH2Style()
  pdf.text('Candidate Information', margin, yPosition)
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
    pdf.text('Skills', margin, yPosition)
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
      
      const skillWidth = drawSkillPill(pdf, skill, currentX, currentY, fontsLoaded)
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
    pdf.text('Profile Summary', margin, yPosition)
    yPosition += 8 // 6-8pt spacing below H2

    setBodyStyle()
    // Strip HTML tags and format as plain text with improved line spacing
    const cleanSummary = stripHtml(candidate.profile_summary)
    yPosition = addWrappedText(cleanSummary, margin, yPosition, contentWidth, 8, 1.3)
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
  console.log('[PDF] Saving PDF as:', fileName)
  pdf.save(fileName)
  console.log('[PDF] PDF generation completed successfully')
  
  } catch (error) {
    console.error('[PDF] Failed to generate PDF:', error)
    if (error instanceof Error) {
      console.error('[PDF] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    }
    throw error // Re-throw to allow caller to handle
  }
}