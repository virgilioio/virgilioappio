import { jsPDF } from 'jspdf'
import { Candidate } from '@/hooks/useCandidates'
import { getSkillColor, PastelColor } from '@/utils/skillColors'
import { supabase } from '@/lib/supabaseClient'
import { withFetchTimeout } from '@/utils/timeout'
import PoppinsBoldFont from '@/assets/fonts/Poppins-Bold.ttf'
import LatoRegularFont from '@/assets/fonts/Lato-Regular.ttf'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import type { CandidateCertification } from '@/components/candidates/CandidateCertifications'

// Skill color mapping for PDF (HSL values converted to RGB)
const skillColorMap: Record<PastelColor, { bg: [number, number, number], text: [number, number, number] }> = {
  'pastel-blue': { bg: [173, 216, 230], text: [37, 99, 235] },
  'pastel-purple': { bg: [221, 214, 254], text: [124, 58, 237] },
  'pastel-green': { bg: [187, 247, 208], text: [34, 197, 94] },
  'pastel-pink': { bg: [252, 231, 243], text: [236, 72, 153] },
  'pastel-yellow': { bg: [254, 240, 138], text: [202, 138, 4] },
  'pastel-orange': { bg: [255, 237, 213], text: [249, 115, 22] }
}

// Enhanced HTML to formatted plain text converter
const stripHtml = (html: string): string => {
  if (!html || html.trim() === '') return ''
  try {
    const temp = document.createElement('div')
    temp.innerHTML = html
    const headings = temp.querySelectorAll('h1, h2, h3, h4, h5, h6')
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1))
      const prefix = level <= 2 ? '\n\n' : '\n'
      heading.insertBefore(document.createTextNode(prefix), heading.firstChild)
      heading.appendChild(document.createTextNode('\n'))
    })
    const orderedLists = temp.querySelectorAll('ol')
    orderedLists.forEach(list => {
      const items = list.querySelectorAll('li')
      items.forEach((item, index) => {
        item.insertBefore(document.createTextNode(`\n${index + 1}. `), item.firstChild)
      })
    })
    const unorderedLists = temp.querySelectorAll('ul')
    unorderedLists.forEach(list => {
      const items = list.querySelectorAll('li')
      items.forEach(item => {
        item.insertBefore(document.createTextNode('\n• '), item.firstChild)
      })
    })
    const strongElements = temp.querySelectorAll('strong, b')
    strongElements.forEach(element => {
      element.textContent = (element.textContent || '').toUpperCase()
    })
    const paragraphs = temp.querySelectorAll('p')
    paragraphs.forEach(p => p.appendChild(document.createTextNode('\n\n')))
    const breaks = temp.querySelectorAll('br')
    breaks.forEach(br => br.replaceWith(document.createTextNode('\n')))
    let text = temp.textContent || temp.innerText || ''
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/[ \t]*\n[ \t]*/g, '\n').trim()
    return text
  } catch {
    const temp = document.createElement('div')
    temp.innerHTML = html
    return (temp.textContent || temp.innerText || '').trim()
  }
}

// Helper function to draw a skill pill
const drawSkillPill = (pdf: jsPDF, skill: string, x: number, y: number, fontsLoaded = false): number => {
  const skillColor = getSkillColor(skill)
  const colors = skillColorMap[skillColor]
  pdf.setFontSize(7)
  pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
  const textWidth = pdf.getTextWidth(skill)
  const pillWidth = textWidth + 4
  const pillHeight = 4
  const borderRadius = 2
  pdf.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2])
  pdf.roundedRect(x, y - 3, pillWidth, pillHeight, borderRadius, borderRadius, 'F')
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2])
  pdf.text(skill, x + (pillWidth / 2), y - 1 + (pillHeight / 4), { align: 'center' })
  pdf.setTextColor(0, 0, 0)
  return pillWidth + 3
}

export interface GeneratePdfOptions {
  candidate: Candidate
  job?: any
  organization?: any
  includeContactDetails?: boolean
  workExperience?: CandidateWorkExperience[]
  education?: CandidateEducation[]
  certifications?: CandidateCertification[]
}

export const generateCandidatePdf = async ({
  candidate,
  job,
  organization,
  includeContactDetails = true,
  workExperience = [],
  education = [],
  certifications = [],
}: GeneratePdfOptions) => {
  try {
    console.log('[PDF] Starting PDF generation for:', candidate.candidate_name)

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height
    const margin = 36
    const contentWidth = pageWidth - (margin * 2)
    let yPosition = margin

    // Load custom fonts
    const loadCustomFonts = async () => {
      try {
        const poppinsResp = await withFetchTimeout(fetch(PoppinsBoldFont), 5000)
        if (!poppinsResp.ok) throw new Error('Poppins fetch failed')
        const poppinsBuf = await poppinsResp.arrayBuffer()
        const poppinsB64 = btoa(String.fromCharCode(...new Uint8Array(poppinsBuf)))

        const latoResp = await withFetchTimeout(fetch(LatoRegularFont), 5000)
        if (!latoResp.ok) throw new Error('Lato fetch failed')
        const latoBuf = await latoResp.arrayBuffer()
        const latoB64 = btoa(String.fromCharCode(...new Uint8Array(latoBuf)))

        pdf.addFileToVFS('Poppins-Bold.ttf', poppinsB64)
        pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
        pdf.addFileToVFS('Lato-Regular.ttf', latoB64)
        pdf.addFont('Lato-Regular.ttf', 'Lato', 'normal')
        return true
      } catch (error) {
        console.warn('[PDF] Font loading failed, using fallbacks:', error)
        return false
      }
    }

    const fontsLoaded = await loadCustomFonts()

    // Fetch logo
    let logoUrl = '/virgilio-logo.png'
    try {
      const logoPromise = supabase
        .from('platform_assets')
        .select('file_url')
        .eq('asset_type', 'logo')
        .eq('is_active', true)
        .single()
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      const { data } = await Promise.race([logoPromise, timeout]) as any
      if (data?.file_url) logoUrl = data.file_url
    } catch {
      // keep default
    }

    // Typography helpers
    const setH1 = () => { pdf.setFontSize(16); pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold') }
    const setH2 = () => { pdf.setFontSize(12); pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold') }
    const setH3 = () => { pdf.setFontSize(9); pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold') }
    const setBody = () => { pdf.setFontSize(8); pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal') }
    const setSmall = () => { pdf.setFontSize(7); pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal') }

    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 8, lineSpacing = 1.3) => {
      setBody()
      pdf.setFontSize(fontSize)
      const textLines = pdf.splitTextToSize(text, maxWidth)
      const lineHeight = fontSize * lineSpacing * 0.352778
      let currentY = y
      textLines.forEach((line: string) => {
        if (currentY > pageHeight - margin - 20) {
          pdf.addPage()
          currentY = margin
        }
        pdf.text(line, x, currentY)
        currentY += lineHeight
      })
      return currentY
    }

    const checkPageBreak = (space = 30) => {
      if (yPosition > pageHeight - margin - space) {
        pdf.addPage()
        yPosition = margin
        return true
      }
      return false
    }

    // ── LOGO ──
    try {
      const logoImg = new Image()
      logoImg.crossOrigin = 'anonymous'
      const loadedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), 5000)
        logoImg.onload = () => { clearTimeout(t); resolve(logoImg) }
        logoImg.onerror = (e) => { clearTimeout(t); reject(e) }
        logoImg.src = logoUrl.startsWith('http') ? logoUrl : `${window.location.origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`
      })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = loadedImage.naturalWidth
      canvas.height = loadedImage.naturalHeight
      ctx.drawImage(loadedImage, 0, 0)
      const logoWidth = 25
      const logoHeight = (loadedImage.naturalHeight / loadedImage.naturalWidth) * logoWidth
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, yPosition, logoWidth, logoHeight)
      yPosition += logoHeight + 8
    } catch {
      setH3()
      pdf.text('GOGIO', margin, yPosition)
      yPosition += 8
    }

    // ── SEPARATOR ──
    pdf.setLineWidth(0.3)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // ── CANDIDATE NAME (H1) ──
    setH1()
    pdf.text(candidate.candidate_name || 'Unnamed Candidate', margin, yPosition)
    yPosition += 7

    // ── Current title at company (H3) ──
    const currentTitle = candidate.current_job_title || candidate.role_current
    const currentCompany = candidate.company_current
    if (currentTitle || currentCompany) {
      setH3()
      const titleLine = [currentTitle, currentCompany].filter(Boolean).join(' at ')
      pdf.text(titleLine, margin, yPosition)
      yPosition += 5
    }

    // ── Enrichment metadata line ──
    const metaParts: string[] = []
    if (candidate.seniority_level) metaParts.push(candidate.seniority_level)
    if (candidate.functional_area) metaParts.push(candidate.functional_area)
    if (candidate.years_experience) metaParts.push(`${candidate.years_experience} yrs experience`)
    if (metaParts.length > 0) {
      setSmall()
      pdf.setTextColor(120, 120, 120)
      pdf.text(metaParts.join('  ·  '), margin, yPosition)
      pdf.setTextColor(0, 0, 0)
      yPosition += 5
    }

    yPosition += 4

    // ── CONTACT DETAILS (conditional) ──
    if (includeContactDetails) {
      checkPageBreak()
      const contactLines: string[] = []
      if (candidate.email) contactLines.push(`Email: ${candidate.email}`)
      if (candidate.phone) contactLines.push(`Phone: ${candidate.phone}`)
      const locationParts = [candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean)
      if (locationParts.length > 0) contactLines.push(`Location: ${locationParts.join(', ')}`)
      if (candidate.linkedin_url) contactLines.push(`LinkedIn: ${candidate.linkedin_url}`)

      if (contactLines.length > 0) {
        setSmall()
        contactLines.forEach(line => {
          pdf.text(line, margin, yPosition)
          yPosition += 4.5
        })
        yPosition += 4
      }
    }

    // ── SALARY (always shown if available) ──
    if (candidate.salary_amount) {
      setSmall()
      const currency = candidate.salary_currency || 'USD'
      const amount = candidate.salary_amount.toLocaleString()
      const period = candidate.salary_period || 'annually'
      pdf.text(`Salary Expectations: ${currency} ${amount} ${period}`, margin, yPosition)
      yPosition += 8
    }

    // ── SKILLS ──
    if (candidate.skills && candidate.skills.length > 0) {
      checkPageBreak(50)
      setH2()
      pdf.text('Skills', margin, yPosition)
      yPosition += 8

      let currentX = margin
      let currentY = yPosition
      candidate.skills.forEach((skill) => {
        if (currentY > pageHeight - margin - 30) {
          pdf.addPage()
          currentY = margin
          currentX = margin
        }
        const skillWidth = drawSkillPill(pdf, skill, currentX, currentY, fontsLoaded)
        currentX += skillWidth
        if (currentX > margin + contentWidth - 25) {
          currentX = margin
          currentY += 6
        }
      })
      yPosition = currentY + 12
    }

    // ── PROFILE SUMMARY ──
    if (candidate.profile_summary) {
      checkPageBreak(40)
      setH2()
      pdf.text('Profile Summary', margin, yPosition)
      yPosition += 8
      setBody()
      const cleanSummary = stripHtml(candidate.profile_summary)
      yPosition = addWrappedText(cleanSummary, margin, yPosition, contentWidth, 8, 1.3)
      yPosition += 10
    }

    // ── WORK EXPERIENCE ──
    if (workExperience.length > 0) {
      checkPageBreak(40)
      setH2()
      pdf.text('Work Experience', margin, yPosition)
      yPosition += 8

      workExperience.forEach((exp) => {
        checkPageBreak(25)

        // Title at Company
        setH3()
        const expTitle = [exp.job_title, exp.company_name].filter(Boolean).join(' at ')
        pdf.text(expTitle, margin, yPosition)
        yPosition += 5

        // Date range + duration
        setSmall()
        pdf.setTextColor(120, 120, 120)
        const dateParts: string[] = []
        const formatDate = (d?: string) => {
          if (!d) return ''
          return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        }
        if (exp.start_date) {
          dateParts.push(formatDate(exp.start_date))
          dateParts.push(exp.is_current ? 'Present' : (exp.end_date ? formatDate(exp.end_date) : ''))
        }
        const dateStr = dateParts.filter(Boolean).join(' – ')
        const durationStr = exp.duration_months
          ? `${Math.floor(exp.duration_months / 12)}y ${exp.duration_months % 12}m`
          : ''
        const timeLine = [dateStr, durationStr].filter(Boolean).join('  ·  ')
        if (timeLine) {
          pdf.text(timeLine, margin, yPosition)
          yPosition += 4
        }
        if (exp.location) {
          pdf.text(exp.location, margin, yPosition)
          yPosition += 4
        }
        pdf.setTextColor(0, 0, 0)

        // Description
        if (exp.description) {
          yPosition += 1
          setBody()
          const cleanDesc = stripHtml(exp.description)
          yPosition = addWrappedText(cleanDesc, margin, yPosition, contentWidth, 7.5, 1.25)
        }

        yPosition += 6
      })
    }

    // ── EDUCATION ──
    if (education.length > 0) {
      checkPageBreak(30)
      setH2()
      pdf.text('Education', margin, yPosition)
      yPosition += 8

      education.forEach((edu) => {
        checkPageBreak(20)
        setH3()
        const degreeLine = [edu.degree_type, edu.field_of_study].filter(Boolean).join(' in ')
        pdf.text(degreeLine || edu.institution_name, margin, yPosition)
        yPosition += 5

        setSmall()
        pdf.setTextColor(120, 120, 120)
        if (degreeLine) {
          pdf.text(edu.institution_name, margin, yPosition)
          yPosition += 4
        }
        const eduDateParts: string[] = []
        if (edu.start_date) eduDateParts.push(new Date(edu.start_date).getFullYear().toString())
        if (edu.end_date) eduDateParts.push(new Date(edu.end_date).getFullYear().toString())
        if (eduDateParts.length > 0) {
          pdf.text(eduDateParts.join(' – '), margin, yPosition)
          yPosition += 4
        }
        if (edu.grade) {
          pdf.text(`Grade: ${edu.grade}`, margin, yPosition)
          yPosition += 4
        }
        pdf.setTextColor(0, 0, 0)
        yPosition += 4
      })
    }

    // ── CERTIFICATIONS ──
    if (certifications.length > 0) {
      checkPageBreak(30)
      setH2()
      pdf.text('Certifications', margin, yPosition)
      yPosition += 8

      certifications.forEach((cert) => {
        checkPageBreak(15)
        setH3()
        pdf.text(cert.certification_name, margin, yPosition)
        yPosition += 5
        setSmall()
        pdf.setTextColor(120, 120, 120)
        const certMeta: string[] = []
        if (cert.issuing_organization) certMeta.push(cert.issuing_organization)
        if (cert.year_obtained) certMeta.push(cert.year_obtained.toString())
        if (certMeta.length > 0) {
          pdf.text(certMeta.join('  ·  '), margin, yPosition)
          yPosition += 4
        }
        pdf.setTextColor(0, 0, 0)
        yPosition += 4
      })
    }

    // ── FOOTER ──
    const pageCount = (pdf as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.text(
        `Generated by Virgilio - Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
    }

    const fileName = `${candidate.candidate_name?.replace(/\s+/g, '_') || 'candidate'}_profile.pdf`
    pdf.save(fileName)
    console.log('[PDF] PDF generation completed successfully')
  } catch (error) {
    console.error('[PDF] Failed to generate PDF:', error)
    throw error
  }
}
