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
  primary: [124, 58, 237] as [number, number, number],
  primaryLight: [245, 243, 255] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  successLight: [236, 253, 245] as [number, number, number],
  info: [59, 130, 246] as [number, number, number],
  infoLight: [239, 246, 255] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  warningLight: [255, 251, 235] as [number, number, number],
  destructive: [239, 68, 68] as [number, number, number],
  destructiveLight: [254, 242, 242] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

export const generateAnalyticsReport = async ({
  data,
  dateRange,
  jobTitle,
}: AnalyticsReportOptions): Promise<void> => {
  console.log('[Analytics PDF] Starting report generation...')
  
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.width
  const pageHeight = pdf.internal.pageSize.height
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin

  // Load custom fonts
  const loadCustomFonts = async () => {
    try {
      const poppinsBoldResponse = await withFetchTimeout(fetch(PoppinsBoldFont), 5000)
      if (!poppinsBoldResponse.ok) throw new Error('Failed to fetch Poppins font')
      const poppinsBoldBuffer = await poppinsBoldResponse.arrayBuffer()
      const poppinsBoldBase64 = btoa(String.fromCharCode(...new Uint8Array(poppinsBoldBuffer)))
      
      const latoRegularResponse = await withFetchTimeout(fetch(LatoRegularFont), 5000)
      if (!latoRegularResponse.ok) throw new Error('Failed to fetch Lato font')
      const latoRegularBuffer = await latoRegularResponse.arrayBuffer()
      const latoRegularBase64 = btoa(String.fromCharCode(...new Uint8Array(latoRegularBuffer)))
      
      pdf.addFileToVFS('Poppins-Bold.ttf', poppinsBoldBase64)
      pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
      pdf.addFileToVFS('Lato-Regular.ttf', latoRegularBase64)
      pdf.addFont('Lato-Regular.ttf', 'Lato', 'normal')
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
    if (logoData?.file_url) logoUrl = logoData.file_url
  } catch (error) {
    console.warn('[Analytics PDF] Failed to fetch logo:', error)
  }

  // Typography helpers
  const setH1 = () => {
    pdf.setFontSize(14)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.text)
  }
  const setH2 = () => {
    pdf.setFontSize(9)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.text)
  }
  const setBody = () => {
    pdf.setFontSize(7)
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
    pdf.setTextColor(...colors.text)
  }
  const setSmall = () => {
    pdf.setFontSize(6)
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
    pdf.setTextColor(...colors.muted)
  }

  // Draw header
  const drawHeader = async () => {
    // Header background
    pdf.setFillColor(...colors.primaryLight)
    pdf.roundedRect(margin, yPosition, contentWidth, 22, 3, 3, 'F')
    pdf.setDrawColor(...colors.primary)
    pdf.setLineWidth(0.5)
    pdf.roundedRect(margin, yPosition, contentWidth, 22, 3, 3, 'S')
    
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
        const logoWidth = 14
        const logoHeight = (loadedImage.naturalHeight / loadedImage.naturalWidth) * logoWidth
        pdf.addImage(base64Logo, 'PNG', margin + 4, yPosition + 4, logoWidth, logoHeight)
      }
    } catch {
      pdf.setFontSize(8)
      pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
      pdf.setTextColor(...colors.primary)
      pdf.text('GOGIO', margin + 5, yPosition + 13)
    }
    
    // Title
    setH1()
    pdf.setTextColor(...colors.primary)
    const title = jobTitle ? `${jobTitle} - Analytics` : 'Analytics Report'
    pdf.text(title, margin + 22, yPosition + 10)
    
    // Date range
    setSmall()
    const dateRangeText = `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`
    pdf.text(dateRangeText, margin + 22, yPosition + 16)
    
    // Generated timestamp
    pdf.text(`Generated: ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`, pageWidth - margin - 45, yPosition + 16)
    
    yPosition += 28
  }

  // Compact metric card
  const drawMetricCard = (x: number, y: number, w: number, title: string, value: number, accent: [number, number, number], bg: [number, number, number]) => {
    const h = 20
    pdf.setFillColor(...bg)
    pdf.roundedRect(x, y, w, h, 2, 2, 'F')
    pdf.setFillColor(...accent)
    pdf.roundedRect(x, y, 2, h, 1, 1, 'F')
    
    setSmall()
    pdf.setTextColor(...colors.muted)
    pdf.text(title, x + 6, y + 7)
    
    pdf.setFontSize(11)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...accent)
    pdf.text(value.toLocaleString(), x + 6, y + 15)
    return h
  }

  // Compact funnel
  const drawFunnel = (x: number, y: number, w: number) => {
    setH2()
    pdf.text('Recruitment Funnel', x, y)
    let cy = y + 6

    const stages = [
      { label: 'Applications', value: data.applications, color: colors.primary, bg: colors.primaryLight },
      { label: 'Active', value: data.activeCandidates, color: colors.info, bg: colors.infoLight },
      { label: 'Offers', value: data.totalOffers, color: colors.warning, bg: colors.warningLight },
      { label: 'Hired', value: data.totalHires, color: colors.success, bg: colors.successLight },
    ]

    const maxValue = Math.max(data.applications, 1)
    const barH = 8
    const labelW = 28

    stages.forEach((stage, idx) => {
      const barW = Math.max((stage.value / maxValue) * (w - labelW - 20), 15)
      
      setSmall()
      pdf.setTextColor(...colors.text)
      pdf.text(stage.label, x, cy + 5)
      
      // Bar bg
      pdf.setFillColor(...colors.border)
      pdf.roundedRect(x + labelW, cy, w - labelW - 15, barH, 2, 2, 'F')
      
      // Bar fill
      pdf.setFillColor(...stage.bg)
      pdf.roundedRect(x + labelW, cy, barW, barH, 2, 2, 'F')
      
      // Accent
      pdf.setFillColor(...stage.color)
      pdf.roundedRect(x + labelW, cy, 2, barH, 1, 1, 'F')
      
      // Value
      pdf.setFontSize(7)
      pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
      pdf.setTextColor(...stage.color)
      pdf.text(stage.value.toLocaleString(), x + labelW + barW + 3, cy + 5.5)
      
      // Conversion arrow
      if (idx < stages.length - 1) {
        const next = stages[idx + 1].value
        const rate = stage.value > 0 ? ((next / stage.value) * 100).toFixed(0) : '0'
        setSmall()
        pdf.setTextColor(...colors.muted)
        pdf.text(`${rate}%`, x + labelW + 2, cy + barH + 4)
      }
      
      cy += idx < stages.length - 1 ? 14 : 10
    })

    // Overall rate
    const overallRate = data.applications > 0 ? ((data.totalHires / data.applications) * 100).toFixed(1) : '0'
    pdf.setDrawColor(...colors.border)
    pdf.setLineWidth(0.3)
    pdf.line(x, cy, x + w - 5, cy)
    cy += 5
    
    setSmall()
    pdf.setTextColor(...colors.muted)
    pdf.text('Overall:', x, cy)
    pdf.setFontSize(8)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.primary)
    pdf.text(`${overallRate}%`, x + 16, cy)
    
    return cy - y + 5
  }

  // Status distribution pie-like visualization
  const drawStatusDistribution = (x: number, y: number, w: number) => {
    if (data.statusDistribution.length === 0) return 0

    setH2()
    pdf.text('Status Distribution', x, y)
    let cy = y + 6

    const statusColors: Record<string, [number, number, number]> = {
      'Active': colors.primary,
      'Hired': colors.success,
      'Rejected': colors.destructive,
      'Offer': colors.warning,
      'Withdrawn': colors.muted,
    }

    const total = data.statusDistribution.reduce((sum, s) => sum + s.value, 0)
    
    // Stacked horizontal bar
    let barX = x
    const barW = w - 5
    const barH = 10
    
    data.statusDistribution.forEach((status) => {
      const segW = (status.value / total) * barW
      const color = statusColors[status.name] || colors.muted
      pdf.setFillColor(...color)
      pdf.rect(barX, cy, segW, barH, 'F')
      barX += segW
    })
    cy += barH + 4

    // Legend - 2 columns
    const colW = (w - 5) / 2
    let col = 0
    let legendY = cy
    
    data.statusDistribution.forEach((status, idx) => {
      const color = statusColors[status.name] || colors.muted
      const pct = total > 0 ? ((status.value / total) * 100).toFixed(0) : '0'
      const lx = x + (col * colW)
      
      pdf.setFillColor(...color)
      pdf.rect(lx, legendY, 4, 4, 'F')
      
      setSmall()
      pdf.setTextColor(...colors.text)
      pdf.text(`${status.name}: ${status.value} (${pct}%)`, lx + 6, legendY + 3)
      
      col++
      if (col >= 2) {
        col = 0
        legendY += 6
      }
    })
    
    return legendY - y + (col > 0 ? 8 : 2)
  }

  // Stage distribution
  const drawStageDistribution = (x: number, y: number, w: number) => {
    if (data.stageDistribution.length === 0) return 0

    setH2()
    pdf.text('Stage Distribution', x, y)
    let cy = y + 6

    const maxCount = Math.max(...data.stageDistribution.map(s => s.count), 1)
    const barH = 6
    const labelW = 35
    const maxBarW = w - labelW - 15

    data.stageDistribution.slice(0, 6).forEach((stage) => {
      const barW = (stage.count / maxCount) * maxBarW
      
      setSmall()
      pdf.setTextColor(...colors.text)
      const truncName = stage.name.length > 12 ? stage.name.substring(0, 12) + '..' : stage.name
      pdf.text(truncName, x, cy + 4)
      
      // Bar
      pdf.setFillColor(...colors.primaryLight)
      pdf.roundedRect(x + labelW, cy, maxBarW, barH, 1, 1, 'F')
      pdf.setFillColor(...colors.primary)
      pdf.roundedRect(x + labelW, cy, barW, barH, 1, 1, 'F')
      
      // Count
      pdf.setFontSize(6)
      pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
      pdf.setTextColor(...colors.primary)
      pdf.text(stage.count.toString(), x + labelW + barW + 2, cy + 4)
      
      cy += 9
    })
    
    return cy - y
  }

  // Summary stats box
  const drawSummaryBox = (x: number, y: number, w: number) => {
    setH2()
    pdf.text('Quick Stats', x, y)
    let cy = y + 6

    const stats = [
      { label: 'Total Applications', value: data.applications },
      { label: 'Active Pipeline', value: data.activeCandidates },
      { label: 'Offers Extended', value: data.totalOffers },
      { label: 'Hires Completed', value: data.totalHires },
      { label: 'Interviews Scheduled', value: data.scheduledInterviews },
    ]

    if (data.rejectedCandidates !== undefined) {
      stats.push({ label: 'Rejected', value: data.rejectedCandidates })
    }

    stats.forEach((stat) => {
      setSmall()
      pdf.setTextColor(...colors.muted)
      pdf.text(stat.label, x, cy)
      
      pdf.setFontSize(7)
      pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
      pdf.setTextColor(...colors.text)
      pdf.text(stat.value.toLocaleString(), x + w - 20, cy, { align: 'right' })
      
      cy += 7
    })
    
    return cy - y
  }

  // Footer
  const drawFooter = () => {
    const footerY = pageHeight - 10
    pdf.setDrawColor(...colors.border)
    pdf.setLineWidth(0.3)
    pdf.line(margin, footerY - 3, pageWidth - margin, footerY - 3)
    
    setSmall()
    pdf.text('Generated by GoGio ATS', margin, footerY)
    pdf.text('Page 1 of 1', pageWidth - margin - 18, footerY)
  }

  // ===== Generate Report =====
  await drawHeader()
  
  // Metric cards - 6 cards in one row
  const cardGap = 3
  const cardW = (contentWidth - (cardGap * 5)) / 6
  
  drawMetricCard(margin, yPosition, cardW, 'Applications', data.applications, colors.primary, colors.primaryLight)
  drawMetricCard(margin + (cardW + cardGap), yPosition, cardW, 'Active', data.activeCandidates, colors.info, colors.infoLight)
  drawMetricCard(margin + (cardW + cardGap) * 2, yPosition, cardW, 'Offers', data.totalOffers, colors.warning, colors.warningLight)
  drawMetricCard(margin + (cardW + cardGap) * 3, yPosition, cardW, 'Hired', data.totalHires, colors.success, colors.successLight)
  drawMetricCard(margin + (cardW + cardGap) * 4, yPosition, cardW, 'Interviews', data.scheduledInterviews, colors.warning, colors.warningLight)
  
  if (data.rejectedCandidates !== undefined) {
    drawMetricCard(margin + (cardW + cardGap) * 5, yPosition, cardW, 'Rejected', data.rejectedCandidates, colors.destructive, colors.destructiveLight)
  }
  
  yPosition += 26

  // Two-column layout for charts
  const colWidth = (contentWidth - 10) / 2
  const leftX = margin
  const rightX = margin + colWidth + 10

  // Left column: Funnel + Summary
  const funnelHeight = drawFunnel(leftX, yPosition, colWidth)
  const summaryY = yPosition + funnelHeight + 8
  drawSummaryBox(leftX, summaryY, colWidth)

  // Right column: Status + Stage distribution
  const statusHeight = drawStatusDistribution(rightX, yPosition, colWidth)
  const stageY = yPosition + statusHeight + 8
  drawStageDistribution(rightX, stageY, colWidth)

  drawFooter()

  // Generate filename and save
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const filename = jobTitle 
    ? `${jobTitle.replace(/[^a-zA-Z0-9]/g, '-')}-analytics-${dateStr}.pdf`
    : `analytics-report-${dateStr}.pdf`

  pdf.save(filename)
  console.log('[Analytics PDF] Report generated successfully:', filename)
}
