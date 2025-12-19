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

// Brand color palette (RGB)
const colors = {
  // Primary purple gradient
  purpleDark: [111, 63, 245] as [number, number, number],    // #6F3FF5
  purpleMid: [139, 92, 246] as [number, number, number],     // #8B5CF6
  purpleLight: [167, 139, 250] as [number, number, number],  // #A78BFA
  lilacFrost: [215, 197, 251] as [number, number, number],   // #D7C5FB
  
  // Status colors
  cyan: [6, 182, 212] as [number, number, number],           // Active - cyan
  green: [34, 197, 94] as [number, number, number],          // Success/Hired
  amber: [245, 158, 11] as [number, number, number],         // Warning/Offers
  red: [239, 68, 68] as [number, number, number],            // Destructive/Rejected
  
  // Pastel backgrounds
  pastelPurple: [245, 243, 255] as [number, number, number],
  pastelCyan: [236, 254, 255] as [number, number, number],
  pastelGreen: [236, 253, 245] as [number, number, number],
  pastelAmber: [255, 251, 235] as [number, number, number],
  pastelRed: [254, 242, 242] as [number, number, number],
  
  // Neutrals
  text: [15, 18, 34] as [number, number, number],            // #0F1222
  textSecondary: [90, 96, 114] as [number, number, number],  // #5A6072
  border: [231, 232, 238] as [number, number, number],       // #E7E8EE
  white: [255, 255, 255] as [number, number, number],
  background: [250, 250, 252] as [number, number, number],
}

export const generateAnalyticsReport = async ({
  data,
  dateRange,
  jobTitle,
}: AnalyticsReportOptions): Promise<void> => {
  console.log('[Analytics PDF] Starting premium report generation...')
  
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.width
  const pageHeight = pdf.internal.pageSize.height
  const margin = 12
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
  const setHeading = (size: number = 11) => {
    pdf.setFontSize(size)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.text)
  }
  
  const setBody = (size: number = 8) => {
    pdf.setFontSize(size)
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
    pdf.setTextColor(...colors.text)
  }
  
  const setMuted = (size: number = 7) => {
    pdf.setFontSize(size)
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
    pdf.setTextColor(...colors.textSecondary)
  }

  // Helper: Draw gradient-like header with layered rectangles
  const drawGradientHeader = async () => {
    const headerHeight = 28
    
    // Create gradient effect with layered rectangles
    const steps = 12
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps
      const r = Math.round(colors.purpleDark[0] + (colors.purpleMid[0] - colors.purpleDark[0]) * ratio)
      const g = Math.round(colors.purpleDark[1] + (colors.purpleMid[1] - colors.purpleDark[1]) * ratio)
      const b = Math.round(colors.purpleDark[2] + (colors.purpleMid[2] - colors.purpleDark[2]) * ratio)
      pdf.setFillColor(r, g, b)
      const sliceWidth = contentWidth / steps
      pdf.rect(margin + (i * sliceWidth), yPosition, sliceWidth + 1, headerHeight, 'F')
    }
    
    // Subtle decorative element - top right corner pattern
    pdf.setFillColor(255, 255, 255, 0.1)
    pdf.circle(pageWidth - margin + 10, yPosition - 5, 20, 'F')
    
    // Logo
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
        const logoHeight = 16
        const logoWidth = (loadedImage.naturalWidth / loadedImage.naturalHeight) * logoHeight
        pdf.addImage(base64Logo, 'PNG', margin + 6, yPosition + 6, logoWidth, logoHeight)
      }
    } catch {
      // Fallback text logo
      pdf.setFontSize(12)
      pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
      pdf.setTextColor(...colors.white)
      pdf.text('GOGIO', margin + 6, yPosition + 16)
    }
    
    // Title - white text on gradient
    pdf.setFontSize(16)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...colors.white)
    const title = jobTitle ? `${jobTitle} Analytics` : 'Analytics Report'
    pdf.text(title, margin + 45, yPosition + 12)
    
    // Date range subtitle
    pdf.setFontSize(9)
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
    pdf.setTextColor(255, 255, 255, 0.9)
    const dateRangeText = `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`
    pdf.text(dateRangeText, margin + 45, yPosition + 20)
    
    // Generated timestamp - right aligned
    pdf.setFontSize(7)
    pdf.setTextColor(255, 255, 255, 0.7)
    pdf.text(`Generated: ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`, pageWidth - margin - 6, yPosition + 20, { align: 'right' })
    
    yPosition += headerHeight + 8
  }

  // Metric card with gradient background
  const drawMetricCard = (x: number, y: number, w: number, h: number, label: string, value: number, accent: [number, number, number], bgLight: [number, number, number]) => {
    // Card background with subtle gradient
    pdf.setFillColor(...bgLight)
    pdf.roundedRect(x, y, w, h, 3, 3, 'F')
    
    // Left accent bar
    pdf.setFillColor(...accent)
    pdf.roundedRect(x, y, 3, h, 1.5, 1.5, 'F')
    
    // Subtle inner shadow effect (darker line at top)
    pdf.setDrawColor(0, 0, 0, 0.05)
    pdf.setLineWidth(0.2)
    pdf.line(x + 3, y + 0.5, x + w - 3, y + 0.5)
    
    // Label
    pdf.setFontSize(7)
    pdf.setFont(fontsLoaded ? 'Lato' : 'helvetica', 'normal')
    pdf.setTextColor(...colors.textSecondary)
    pdf.text(label, x + 8, y + 8)
    
    // Value - large and bold
    pdf.setFontSize(16)
    pdf.setFont(fontsLoaded ? 'Poppins' : 'helvetica', 'bold')
    pdf.setTextColor(...accent)
    pdf.text(value.toLocaleString(), x + 8, y + h - 6)
    
    return h
  }

  // Draw a real pie chart
  const drawPieChart = (centerX: number, centerY: number, radius: number, statusData: typeof data.statusDistribution) => {
    if (statusData.length === 0) return
    
    const total = statusData.reduce((sum, s) => sum + s.value, 0)
    if (total === 0) return
    
    const statusColors: Record<string, [number, number, number]> = {
      'Active': colors.cyan,
      'Hired': colors.green,
      'Rejected': colors.red,
      'Offer': colors.amber,
      'Withdrawn': colors.textSecondary,
    }
    
    let startAngle = -Math.PI / 2 // Start from top
    
    statusData.forEach((status) => {
      const sliceAngle = (status.value / total) * 2 * Math.PI
      const endAngle = startAngle + sliceAngle
      const color = statusColors[status.name] || colors.textSecondary
      
      // Draw pie slice using path
      pdf.setFillColor(...color)
      
      // Draw arc segment
      const segments = Math.ceil(sliceAngle / 0.1) // More segments for smoother arc
      const points: [number, number][] = [[centerX, centerY]]
      
      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (sliceAngle * i / segments)
        points.push([
          centerX + radius * Math.cos(angle),
          centerY + radius * Math.sin(angle)
        ])
      }
      points.push([centerX, centerY])
      
      // Draw the slice
      pdf.setFillColor(...color)
      
      // Use lines to draw the slice
      if (points.length > 2) {
        pdf.moveTo(points[0][0], points[0][1])
        for (let i = 1; i < points.length; i++) {
          pdf.lineTo(points[i][0], points[i][1])
        }
        pdf.fill()
      }
      
      startAngle = endAngle
    })
    
    // White center circle for donut effect
    pdf.setFillColor(...colors.white)
    pdf.circle(centerX, centerY, radius * 0.55, 'F')
    
    // Center text
    setHeading(10)
    pdf.setTextColor(...colors.purpleDark)
    pdf.text(total.toString(), centerX, centerY + 1, { align: 'center' })
    setMuted(6)
    pdf.text('Total', centerX, centerY + 5, { align: 'center' })
  }

  // Recruitment funnel with styled bars
  const drawRecruitmentFunnel = (x: number, y: number, w: number) => {
    // Section header with accent
    pdf.setFillColor(...colors.lilacFrost)
    pdf.roundedRect(x, y, w, 5, 1, 1, 'F')
    setHeading(8)
    pdf.setTextColor(...colors.purpleDark)
    pdf.text('Recruitment Funnel', x + 3, y + 3.5)
    
    let cy = y + 10

    const stages = [
      { label: 'Applications', value: data.applications, color: colors.purpleDark, bg: colors.pastelPurple },
      { label: 'Active Candidates', value: data.activeCandidates, color: colors.cyan, bg: colors.pastelCyan },
      { label: 'Offers Extended', value: data.totalOffers, color: colors.amber, bg: colors.pastelAmber },
      { label: 'Hired', value: data.totalHires, color: colors.green, bg: colors.pastelGreen },
    ]

    const maxValue = Math.max(data.applications, 1)
    const barH = 12
    const labelW = 42

    stages.forEach((stage, idx) => {
      const barMaxW = w - labelW - 18
      const barW = Math.max((stage.value / maxValue) * barMaxW, 20)
      
      // Label
      setBody(7)
      pdf.setTextColor(...colors.text)
      pdf.text(stage.label, x, cy + 7)
      
      // Bar background
      pdf.setFillColor(...colors.border)
      pdf.roundedRect(x + labelW, cy, barMaxW, barH, 2, 2, 'F')
      
      // Filled bar with gradient effect
      pdf.setFillColor(...stage.bg)
      pdf.roundedRect(x + labelW, cy, barW, barH, 2, 2, 'F')
      
      // Accent border on left
      pdf.setFillColor(...stage.color)
      pdf.roundedRect(x + labelW, cy, 3, barH, 1.5, 1.5, 'F')
      
      // Value inside bar
      setHeading(9)
      pdf.setTextColor(...stage.color)
      pdf.text(stage.value.toLocaleString(), x + labelW + barW - 2, cy + 8, { align: 'right' })
      
      // Conversion arrow between stages
      if (idx < stages.length - 1) {
        const nextValue = stages[idx + 1].value
        const rate = stage.value > 0 ? ((nextValue / stage.value) * 100).toFixed(0) : '0'
        
        // Arrow
        const arrowX = x + labelW + 8
        const arrowY = cy + barH + 1
        
        pdf.setFillColor(...colors.textSecondary)
        // Simple down arrow
        pdf.triangle(arrowX, arrowY, arrowX + 2, arrowY + 3, arrowX - 2, arrowY + 3, 'F')
        
        setMuted(6)
        pdf.text(`${rate}%`, arrowX + 6, arrowY + 3)
      }
      
      cy += idx < stages.length - 1 ? barH + 8 : barH + 2
    })

    // Overall conversion box
    const boxY = cy + 4
    pdf.setFillColor(...colors.pastelPurple)
    pdf.roundedRect(x, boxY, w, 12, 2, 2, 'F')
    
    const overallRate = data.applications > 0 ? ((data.totalHires / data.applications) * 100).toFixed(1) : '0'
    setBody(7)
    pdf.setTextColor(...colors.textSecondary)
    pdf.text('Overall Conversion Rate:', x + 4, boxY + 7)
    setHeading(10)
    pdf.setTextColor(...colors.purpleDark)
    pdf.text(`${overallRate}%`, x + w - 4, boxY + 7.5, { align: 'right' })
    
    return cy - y + 20
  }

  // Status distribution section with pie chart
  const drawStatusSection = (x: number, y: number, w: number) => {
    if (data.statusDistribution.length === 0) return 0

    // Section header
    pdf.setFillColor(...colors.lilacFrost)
    pdf.roundedRect(x, y, w, 5, 1, 1, 'F')
    setHeading(8)
    pdf.setTextColor(...colors.purpleDark)
    pdf.text('Candidate Status', x + 3, y + 3.5)
    
    const chartY = y + 12
    const chartRadius = 22
    const chartCenterX = x + chartRadius + 8
    const chartCenterY = chartY + chartRadius
    
    // Draw pie chart
    drawPieChart(chartCenterX, chartCenterY, chartRadius, data.statusDistribution)
    
    // Legend to the right of pie
    const statusColors: Record<string, [number, number, number]> = {
      'Active': colors.cyan,
      'Hired': colors.green,
      'Rejected': colors.red,
      'Offer': colors.amber,
      'Withdrawn': colors.textSecondary,
    }
    
    const total = data.statusDistribution.reduce((sum, s) => sum + s.value, 0)
    const legendX = x + chartRadius * 2 + 20
    let legendY = chartY + 4
    
    data.statusDistribution.forEach((status) => {
      const color = statusColors[status.name] || colors.textSecondary
      const pct = total > 0 ? ((status.value / total) * 100).toFixed(0) : '0'
      
      // Color dot
      pdf.setFillColor(...color)
      pdf.circle(legendX, legendY, 2, 'F')
      
      // Label
      setBody(7)
      pdf.setTextColor(...colors.text)
      pdf.text(status.name, legendX + 5, legendY + 1.5)
      
      // Value and percentage
      setMuted(6)
      pdf.text(`${status.value} (${pct}%)`, legendX + 5, legendY + 6)
      
      legendY += 12
    })
    
    return chartRadius * 2 + 20
  }

  // Stage distribution horizontal bar chart
  const drawStageSection = (x: number, y: number, w: number) => {
    if (data.stageDistribution.length === 0) return 0

    // Section header
    pdf.setFillColor(...colors.lilacFrost)
    pdf.roundedRect(x, y, w, 5, 1, 1, 'F')
    setHeading(8)
    pdf.setTextColor(...colors.purpleDark)
    pdf.text('Stage Distribution', x + 3, y + 3.5)
    
    let cy = y + 10

    const maxCount = Math.max(...data.stageDistribution.map(s => s.count), 1)
    const barH = 8
    const labelW = 38
    const maxBarW = w - labelW - 14

    // Show top 5 stages
    data.stageDistribution.slice(0, 5).forEach((stage) => {
      const barW = Math.max((stage.count / maxCount) * maxBarW, 8)
      
      // Label - truncate if needed
      setBody(6)
      pdf.setTextColor(...colors.text)
      const truncName = stage.name.length > 14 ? stage.name.substring(0, 14) + '..' : stage.name
      pdf.text(truncName, x, cy + 5)
      
      // Bar background
      pdf.setFillColor(...colors.border)
      pdf.roundedRect(x + labelW, cy, maxBarW, barH, 2, 2, 'F')
      
      // Filled bar with purple gradient effect
      pdf.setFillColor(...colors.lilacFrost)
      pdf.roundedRect(x + labelW, cy, barW, barH, 2, 2, 'F')
      pdf.setFillColor(...colors.purpleDark)
      pdf.roundedRect(x + labelW, cy, 3, barH, 1.5, 1.5, 'F')
      
      // Count
      setHeading(7)
      pdf.setTextColor(...colors.purpleDark)
      pdf.text(stage.count.toString(), x + labelW + barW + 3, cy + 5.5)
      
      cy += barH + 4
    })
    
    return cy - y
  }

  // Quick stats summary
  const drawQuickStats = (x: number, y: number, w: number) => {
    // Section header
    pdf.setFillColor(...colors.lilacFrost)
    pdf.roundedRect(x, y, w, 5, 1, 1, 'F')
    setHeading(8)
    pdf.setTextColor(...colors.purpleDark)
    pdf.text('Quick Stats', x + 3, y + 3.5)
    
    let cy = y + 10

    const stats = [
      { label: 'Total Applications', value: data.applications },
      { label: 'Active in Pipeline', value: data.activeCandidates },
      { label: 'Offers Extended', value: data.totalOffers },
      { label: 'Successful Hires', value: data.totalHires },
      { label: 'Interviews Scheduled', value: data.scheduledInterviews },
    ]

    if (data.rejectedCandidates !== undefined) {
      stats.push({ label: 'Candidates Rejected', value: data.rejectedCandidates })
    }

    stats.forEach((stat, idx) => {
      // Alternating background
      if (idx % 2 === 0) {
        pdf.setFillColor(...colors.background)
        pdf.rect(x, cy - 2, w, 8, 'F')
      }
      
      setBody(7)
      pdf.setTextColor(...colors.textSecondary)
      pdf.text(stat.label, x + 2, cy + 3)
      
      setHeading(8)
      pdf.setTextColor(...colors.text)
      pdf.text(stat.value.toLocaleString(), x + w - 2, cy + 3, { align: 'right' })
      
      cy += 8
    })
    
    return cy - y + 2
  }

  // Premium footer
  const drawFooter = () => {
    const footerY = pageHeight - 12
    
    // Gradient footer bar
    const footerHeight = 8
    for (let i = 0; i < 8; i++) {
      const ratio = i / 8
      const alpha = 0.05 + (ratio * 0.15)
      pdf.setFillColor(111, 63, 245, alpha)
      pdf.rect(margin + (i * (contentWidth / 8)), footerY - 4, contentWidth / 8 + 1, footerHeight, 'F')
    }
    
    // Footer text
    setMuted(7)
    pdf.setTextColor(...colors.purpleDark)
    pdf.text('Generated by GoGio ATS', margin + 4, footerY + 1)
    
    pdf.setTextColor(...colors.textSecondary)
    pdf.text('Page 1 of 1', pageWidth - margin - 4, footerY + 1, { align: 'right' })
  }

  // ===== GENERATE REPORT =====
  
  // Header
  await drawGradientHeader()
  
  // Metric cards row - 6 cards
  const cardGap = 4
  const cardW = (contentWidth - (cardGap * 5)) / 6
  const cardH = 28
  
  const metrics = [
    { label: 'Applications', value: data.applications, color: colors.purpleDark, bg: colors.pastelPurple },
    { label: 'Active', value: data.activeCandidates, color: colors.cyan, bg: colors.pastelCyan },
    { label: 'Offers', value: data.totalOffers, color: colors.amber, bg: colors.pastelAmber },
    { label: 'Hired', value: data.totalHires, color: colors.green, bg: colors.pastelGreen },
    { label: 'Interviews', value: data.scheduledInterviews, color: colors.purpleMid, bg: colors.pastelPurple },
    { label: 'Rejected', value: data.rejectedCandidates ?? 0, color: colors.red, bg: colors.pastelRed },
  ]
  
  metrics.forEach((m, idx) => {
    drawMetricCard(margin + (idx * (cardW + cardGap)), yPosition, cardW, cardH, m.label, m.value, m.color, m.bg)
  })
  
  yPosition += cardH + 10

  // Two-column layout
  const colWidth = (contentWidth - 8) / 2
  const leftX = margin
  const rightX = margin + colWidth + 8
  const sectionStartY = yPosition

  // Left column: Funnel
  const funnelHeight = drawRecruitmentFunnel(leftX, sectionStartY, colWidth)
  
  // Left column: Quick Stats below funnel
  const statsY = sectionStartY + funnelHeight + 6
  drawQuickStats(leftX, statsY, colWidth)

  // Right column: Status Distribution (with pie)
  const statusHeight = drawStatusSection(rightX, sectionStartY, colWidth)
  
  // Right column: Stage Distribution below status
  const stageY = sectionStartY + statusHeight + 6
  drawStageSection(rightX, stageY, colWidth)

  // Footer
  drawFooter()

  // Save
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const filename = jobTitle 
    ? `${jobTitle.replace(/[^a-zA-Z0-9]/g, '-')}-analytics-${dateStr}.pdf`
    : `analytics-report-${dateStr}.pdf`

  pdf.save(filename)
  console.log('[Analytics PDF] Premium report generated successfully:', filename)
}
