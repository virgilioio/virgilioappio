import { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabaseClient'
import { withFetchTimeout } from '@/utils/timeout'
import { format } from 'date-fns'
import PoppinsBoldFont from '@/assets/fonts/Poppins-Bold.ttf'
import LatoRegularFont from '@/assets/fonts/Lato-Regular.ttf'

export interface AnalyticsReportData {
  applications: number
  activeCandidates: number
  totalOffers: number
  totalHires: number
  scheduledInterviews: number
  rejectedCandidates?: number
  statusDistribution: { name: string; value: number; color: string }[]
  stageDistribution: { name: string; count: number }[]
  trendData: { date: string; applications: number; active: number; hires: number; interviews: number }[]
}

export interface AnalyticsReportOptions {
  data: AnalyticsReportData
  dateRange: { startDate: Date; endDate: Date }
  jobTitle?: string
  organizationName?: string
}

// Color definitions (RGB values for PDF)
const colors = {
  primary: [124, 58, 237] as [number, number, number],      // Virgilio purple
  primaryLight: [237, 233, 254] as [number, number, number], // Light purple bg
  success: [34, 197, 94] as [number, number, number],        // Green
  successLight: [220, 252, 231] as [number, number, number],
  info: [59, 130, 246] as [number, number, number],          // Blue
  infoLight: [219, 234, 254] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],       // Amber/Gold
  warningLight: [254, 243, 199] as [number, number, number],
  destructive: [239, 68, 68] as [number, number, number],    // Red
  destructiveLight: [254, 226, 226] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],        // Slate
  text: [30, 41, 59] as [number, number, number],            // Dark text
  border: [226, 232, 240] as [number, number, number],       // Light border
  white: [255, 255, 255] as [number, number, number],
}

export const generateAnalyticsReport = async ({
  data,
  dateRange,
  jobTitle,
  organizationName
}: AnalyticsReportOptions): Promise<void> => {
  console.log('[Analytics PDF] Starting report generation...')
  
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.width
  const pageHeight = pdf.internal.pageSize.height
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin

  // Load custom fonts
  const loadCustomFonts = async () => {
    try {
      console.log('[Analytics PDF] Loading custom fonts...')
      
      const poppinsBoldResponse = await withFetchTimeout(
        fetch(PoppinsBoldFont),
        5000
      )
      
      if (!poppinsBoldResponse.ok) throw new Error('Failed to fetch Poppins font')
      
      const poppinsBoldBuffer = await poppinsBoldResponse.arrayBuffer()
      const poppinsBoldBase64 = btoa(String.fromCharCode(...new Uint8Array(poppinsBoldBuffer)))
      
      const latoRegularResponse = await withFetchTimeout(
        fetch(LatoRegularFont),
        5000
      )
      
      if (!latoRegularResponse.ok) throw new Error('Failed to fetch Lato font')
      
      const latoRegularBuffer = await latoRegularResponse.arrayBuffer()
      const latoRegularBase64 = btoa(String.fromCharCode(...new Uint8Array(latoRegularBuffer)))
      
      pdf.addFileToVFS('Poppins-Bold.ttf', poppinsBoldBase64)
      pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
      
      pdf.addFileToVFS('Lato-Regular.ttf', latoRegularBase64)
      pdf.addFont('Lato-Regular.ttf', 'Lato', 'normal')
      
      console.log('[Analytics PDF] Custom fonts loaded successfully')
      return true
    } catch (error) {
      console.warn('[Analytics PDF] Failed to load custom fonts:', error)
      return false
    }
  }

  const fontsLoaded = await loadCustomFonts()

  // Fetch logo
  let logoUrl = '/virgilio-logo.png'
  try {
    const { data: logoData } = await supabase
      .from('platform_assets')
      .select('file_url')
      .eq('asset_type', 'logo')
      .eq('is_active', true)
      .single()

    if (logoData?.file_url) {
      logoUrl = logoData.file_url
    }
  } catch (error) {
    console.warn('[Analytics PDF] Failed to fetch logo:', error)
  }

  // Typography helpers
  const setH1 = () => {
    pdf.setFontSize(20)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.text)
  }

  const setH2 = () => {
    pdf.setFontSize(14)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.text)
  }

  const setH3 = () => {
    pdf.setFontSize(11)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.text)
  }

  const setBody = () => {
    pdf.setFontSize(10)
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
    pdf.setTextColor(...colors.text)
  }

  const setSmall = () => {
    pdf.setFontSize(8)
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
    pdf.setTextColor(...colors.muted)
  }

  // Helper to draw rounded rectangle
  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, fill: [number, number, number], stroke?: [number, number, number]) => {
    pdf.setFillColor(...fill)
    if (stroke) {
      pdf.setDrawColor(...stroke)
      pdf.setLineWidth(0.5)
      pdf.roundedRect(x, y, w, h, r, r, 'FD')
    } else {
      pdf.roundedRect(x, y, w, h, r, r, 'F')
    }
  }

  // Draw header with gradient-like background
  const drawHeader = async () => {
    // Purple gradient header background
    drawRoundedRect(margin, yPosition, contentWidth, 35, 4, colors.primaryLight, colors.primary)
    
    // Try to add logo
    try {
      const logoImg = new Image()
      logoImg.crossOrigin = 'anonymous'
      
      const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Logo timeout')), 3000)
        logoImg.onload = () => { clearTimeout(timeout); resolve(logoImg) }
        logoImg.onerror = () => { clearTimeout(timeout); reject(new Error('Logo load failed')) }
        logoImg.src = logoUrl.startsWith('http') ? logoUrl : `${window.location.origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`
      })
      
      const loadedImage = await imageLoaded
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        canvas.width = loadedImage.naturalWidth
        canvas.height = loadedImage.naturalHeight
        ctx.drawImage(loadedImage, 0, 0)
        const base64Logo = canvas.toDataURL('image/png')
        
        const logoWidth = 22
        const logoHeight = (loadedImage.naturalHeight / loadedImage.naturalWidth) * logoWidth
        pdf.addImage(base64Logo, 'PNG', margin + 6, yPosition + 6, logoWidth, logoHeight)
      }
    } catch (error) {
      // Fallback text logo
      pdf.setFontSize(12)
      pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
      pdf.setTextColor(...colors.primary)
      pdf.text('GOGIO', margin + 8, yPosition + 18)
    }
    
    // Report title
    setH1()
    pdf.setTextColor(...colors.primary)
    const title = jobTitle ? `${jobTitle} - Analytics Report` : 'Analytics Report'
    pdf.text(title, margin + 35, yPosition + 15)
    
    // Date range subtitle
    setSmall()
    const dateRangeText = `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`
    pdf.text(dateRangeText, margin + 35, yPosition + 24)
    
    // Generated timestamp
    pdf.text(`Generated: ${format(new Date(), 'MMM d, yyyy \'at\' h:mm a')}`, pageWidth - margin - 55, yPosition + 24)
    
    yPosition += 45
  }

  // Draw metric card
  const drawMetricCard = (
    x: number, 
    y: number, 
    width: number, 
    title: string, 
    value: number, 
    bgColor: [number, number, number], 
    accentColor: [number, number, number]
  ) => {
    const height = 35
    
    // Card background
    drawRoundedRect(x, y, width, height, 4, bgColor, colors.border)
    
    // Left accent bar
    pdf.setFillColor(...accentColor)
    pdf.roundedRect(x, y, 4, height, 2, 2, 'F')
    
    // Title
    setSmall()
    pdf.setTextColor(...colors.muted)
    pdf.text(title, x + 10, y + 12)
    
    // Value
    pdf.setFontSize(18)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...accentColor)
    pdf.text(value.toLocaleString(), x + 10, y + 27)
    
    return height
  }

  // Draw funnel section
  const drawFunnel = () => {
    setH2()
    pdf.text('Recruitment Funnel', margin, yPosition)
    yPosition += 10

    const stages = [
      { label: 'Applications', value: data.applications, color: colors.primary, bgColor: colors.primaryLight },
      { label: 'Active Candidates', value: data.activeCandidates, color: colors.info, bgColor: colors.infoLight },
      { label: 'Offers', value: data.totalOffers, color: colors.warning, bgColor: colors.warningLight },
      { label: 'Hired', value: data.totalHires, color: colors.success, bgColor: colors.successLight },
    ]

    const maxValue = Math.max(data.applications, 1)
    const barHeight = 14
    const spacing = 20

    stages.forEach((stage, index) => {
      const barWidth = Math.max((stage.value / maxValue) * (contentWidth - 80), 30)
      
      // Stage label
      setBody()
      pdf.setTextColor(...colors.text)
      pdf.text(stage.label, margin, yPosition + 9)
      
      // Bar background
      pdf.setFillColor(...colors.border)
      pdf.roundedRect(margin + 65, yPosition, contentWidth - 80, barHeight, 3, 3, 'F')
      
      // Filled bar
      pdf.setFillColor(...stage.bgColor)
      pdf.roundedRect(margin + 65, yPosition, barWidth, barHeight, 3, 3, 'F')
      
      // Accent border
      pdf.setFillColor(...stage.color)
      pdf.roundedRect(margin + 65, yPosition, 3, barHeight, 1, 1, 'F')
      
      // Value
      pdf.setFontSize(10)
      pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
      pdf.setTextColor(...stage.color)
      pdf.text(stage.value.toLocaleString(), margin + 70 + barWidth, yPosition + 10)
      
      // Conversion rate (if not last item)
      if (index < stages.length - 1) {
        const nextValue = stages[index + 1].value
        const rate = stage.value > 0 ? ((nextValue / stage.value) * 100).toFixed(1) : '0'
        setSmall()
        pdf.text(`↓ ${rate}%`, margin + 80, yPosition + barHeight + 6)
      }
      
      yPosition += spacing
    })

    // Overall conversion rate
    const overallRate = data.applications > 0 
      ? ((data.totalHires / data.applications) * 100).toFixed(1) 
      : '0'
    
    pdf.setDrawColor(...colors.border)
    pdf.setLineWidth(0.5)
    pdf.line(margin, yPosition, margin + contentWidth, yPosition)
    yPosition += 8
    
    setBody()
    pdf.setTextColor(...colors.muted)
    pdf.text('Overall Conversion Rate (Applications → Hired):', margin, yPosition)
    
    pdf.setFontSize(14)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.primary)
    pdf.text(`${overallRate}%`, margin + 90, yPosition)
    
    yPosition += 15
  }

  // Draw status distribution
  const drawStatusDistribution = () => {
    if (data.statusDistribution.length === 0) return

    setH2()
    pdf.text('Candidate Status Distribution', margin, yPosition)
    yPosition += 10

    const statusColors: Record<string, [number, number, number]> = {
      'Active': colors.primary,
      'Hired': colors.success,
      'Rejected': colors.destructive,
      'Offer': colors.warning,
      'Withdrawn': colors.muted,
    }

    const total = data.statusDistribution.reduce((sum, s) => sum + s.value, 0)
    const barStartX = margin + 60
    const barWidth = contentWidth - 70
    let currentX = barStartX

    // Draw stacked bar
    data.statusDistribution.forEach((status) => {
      const width = (status.value / total) * barWidth
      const color = statusColors[status.name] || colors.muted
      pdf.setFillColor(...color)
      pdf.rect(currentX, yPosition, width, 12, 'F')
      currentX += width
    })

    yPosition += 18

    // Legend
    let legendX = margin
    data.statusDistribution.forEach((status) => {
      const color = statusColors[status.name] || colors.muted
      const percentage = total > 0 ? ((status.value / total) * 100).toFixed(1) : '0'
      
      pdf.setFillColor(...color)
      pdf.rect(legendX, yPosition, 8, 8, 'F')
      
      setSmall()
      pdf.text(`${status.name}: ${status.value} (${percentage}%)`, legendX + 11, yPosition + 6)
      
      legendX += 50
      if (legendX > pageWidth - margin - 50) {
        legendX = margin
        yPosition += 12
      }
    })

    yPosition += 20
  }

  // Draw stage distribution
  const drawStageDistribution = () => {
    if (data.stageDistribution.length === 0) return

    setH2()
    pdf.text('Stage Distribution', margin, yPosition)
    yPosition += 10

    const maxCount = Math.max(...data.stageDistribution.map(s => s.count), 1)
    const barHeight = 10
    const maxBarWidth = contentWidth - 100

    data.stageDistribution.slice(0, 8).forEach((stage) => {
      const barWidth = (stage.count / maxCount) * maxBarWidth
      
      // Stage name
      setSmall()
      pdf.setTextColor(...colors.text)
      const truncatedName = stage.name.length > 15 ? stage.name.substring(0, 15) + '...' : stage.name
      pdf.text(truncatedName, margin, yPosition + 7)
      
      // Bar
      pdf.setFillColor(...colors.primaryLight)
      pdf.roundedRect(margin + 50, yPosition, maxBarWidth, barHeight, 2, 2, 'F')
      
      pdf.setFillColor(...colors.primary)
      pdf.roundedRect(margin + 50, yPosition, barWidth, barHeight, 2, 2, 'F')
      
      // Count
      pdf.setFontSize(9)
      pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
      pdf.setTextColor(...colors.primary)
      pdf.text(stage.count.toString(), margin + 55 + barWidth, yPosition + 7)
      
      yPosition += 14
    })

    yPosition += 10
  }

  // Draw footer
  const drawFooter = () => {
    const footerY = pageHeight - 15
    
    pdf.setDrawColor(...colors.border)
    pdf.setLineWidth(0.5)
    pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5)
    
    setSmall()
    pdf.text('Generated by GoGio ATS', margin, footerY)
    pdf.text(`Page 1`, pageWidth - margin - 15, footerY)
  }

  // Generate the report
  await drawHeader()
  
  // Metric cards row
  const cardWidth = (contentWidth - 15) / 4
  const cardY = yPosition
  
  drawMetricCard(margin, cardY, cardWidth, 'Applications', data.applications, colors.primaryLight, colors.primary)
  drawMetricCard(margin + cardWidth + 5, cardY, cardWidth, 'Active', data.activeCandidates, colors.infoLight, colors.info)
  drawMetricCard(margin + (cardWidth + 5) * 2, cardY, cardWidth, 'Offers', data.totalOffers, colors.warningLight, colors.warning)
  drawMetricCard(margin + (cardWidth + 5) * 3, cardY, cardWidth, 'Hired', data.totalHires, colors.successLight, colors.success)
  
  yPosition = cardY + 45

  // Second row of cards
  if (data.scheduledInterviews !== undefined || data.rejectedCandidates !== undefined) {
    const card2Width = (contentWidth - 5) / 2
    
    if (data.scheduledInterviews !== undefined) {
      drawMetricCard(margin, yPosition, card2Width, 'Scheduled Interviews', data.scheduledInterviews, colors.warningLight, colors.warning)
    }
    
    if (data.rejectedCandidates !== undefined) {
      drawMetricCard(margin + card2Width + 5, yPosition, card2Width, 'Rejected', data.rejectedCandidates, colors.destructiveLight, colors.destructive)
    }
    
    yPosition += 45
  }

  drawFunnel()
  
  // Check if we need a new page
  if (yPosition > pageHeight - 80) {
    pdf.addPage()
    yPosition = margin
  }
  
  drawStatusDistribution()
  
  if (yPosition > pageHeight - 80) {
    pdf.addPage()
    yPosition = margin
  }
  
  drawStageDistribution()
  
  drawFooter()

  // Generate filename
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const filename = jobTitle 
    ? `${jobTitle.replace(/[^a-zA-Z0-9]/g, '-')}-analytics-${dateStr}.pdf`
    : `analytics-report-${dateStr}.pdf`

  // Download the PDF
  pdf.save(filename)
  console.log('[Analytics PDF] Report generated successfully:', filename)
}
