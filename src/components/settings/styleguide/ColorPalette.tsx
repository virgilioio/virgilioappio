import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ColorSwatch {
  name: string
  variable: string
  hsl: string
  hex?: string
  description: string
}

const brandColors: ColorSwatch[] = [
  { name: 'Primary (Citron Noir)', variable: '--primary', hsl: '60 100% 4%', hex: '#0d0d09', description: 'Main brand color for CTAs' },
  { name: 'Primary Foreground', variable: '--primary-foreground', hsl: '0 0% 100%', hex: '#ffffff', description: 'Text on primary backgrounds' },
  { name: 'Accent (Lilac Frost)', variable: '--accent', hsl: '267 84% 87%', hex: '#d7c5fb', description: 'Secondary emphasis color' },
  { name: 'Accent Foreground', variable: '--accent-foreground', hsl: '267 100% 62%', hex: '#7e3eff', description: 'Text on accent backgrounds' },
  { name: 'Virgilio Purple', variable: '--virgilio-purple', hsl: '267 89% 60%', hex: '#6F3FF5', description: 'Brand purple for toggles, links' },
]

const semanticColors: ColorSwatch[] = [
  { name: 'Success', variable: '--success', hsl: '120 100% 88%', hex: '#d2ffc2', description: 'Positive actions and states' },
  { name: 'Success Foreground', variable: '--success-foreground', hsl: '120 100% 15%', description: 'Text on success backgrounds' },
  { name: 'Warning', variable: '--warning', hsl: '48 100% 60%', hex: '#ffd93d', description: 'Caution and pending states' },
  { name: 'Warning Foreground', variable: '--warning-foreground', hsl: '48 100% 15%', description: 'Text on warning backgrounds' },
  { name: 'Destructive', variable: '--destructive', hsl: '0 100% 88%', hex: '#ffc2c2', description: 'Errors and destructive actions' },
  { name: 'Destructive Foreground', variable: '--destructive-foreground', hsl: '0 100% 30%', description: 'Text on destructive backgrounds' },
  { name: 'Info', variable: '--info', hsl: '180 100% 88%', hex: '#c5f5fb', description: 'Informational messages' },
  { name: 'Info Foreground', variable: '--info-foreground', hsl: '180 100% 20%', description: 'Text on info backgrounds' },
]

const surfaceColors: ColorSwatch[] = [
  { name: 'Background', variable: '--background', hsl: '0 0% 100%', hex: '#ffffff', description: 'Page background' },
  { name: 'Foreground', variable: '--foreground', hsl: '0 0% 15%', description: 'Primary text color' },
  { name: 'Card', variable: '--card', hsl: '0 0% 100%', hex: '#ffffff', description: 'Card backgrounds' },
  { name: 'Muted', variable: '--muted', hsl: '210 17% 93%', hex: '#e9ecef', description: 'Subtle backgrounds' },
  { name: 'Muted Foreground', variable: '--muted-foreground', hsl: '0 0% 50%', description: 'Secondary text' },
  { name: 'Border', variable: '--border', hsl: '0 0% 88%', description: 'Default borders' },
]

const pastelColors: ColorSwatch[] = [
  { name: 'Pastel Blue', variable: '--pastel-blue', hsl: '219 92% 95%', description: 'Soft blue for badges' },
  { name: 'Pastel Purple', variable: '--pastel-purple', hsl: '270 100% 95%', description: 'Soft purple for badges' },
  { name: 'Pastel Green', variable: '--pastel-green', hsl: '120 100% 94%', description: 'Soft green for badges' },
  { name: 'Pastel Pink', variable: '--pastel-pink', hsl: '330 100% 95%', description: 'Soft pink for badges' },
  { name: 'Pastel Yellow', variable: '--pastel-yellow', hsl: '50 100% 94%', description: 'Soft yellow for badges' },
  { name: 'Pastel Orange', variable: '--pastel-orange', hsl: '25 100% 94%', description: 'Soft orange for badges' },
]

function ColorSwatchGrid({ colors, title }: { colors: ColorSwatch[], title: string }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {colors.map((color) => (
          <div key={color.variable} className="space-y-2">
            <div 
              className="h-16 rounded-lg border shadow-sm"
              style={{ backgroundColor: `hsl(var(${color.variable}))` }}
            />
            <div className="space-y-0.5">
              <p className="text-xs font-medium truncate">{color.name}</p>
              <div className="flex flex-col gap-0.5">
                <code className="text-[10px] text-muted-foreground block truncate">
                  {color.variable}
                </code>
                <code className="text-[10px] text-primary font-mono block">
                  hsl({color.hsl})
                </code>
                {color.hex && (
                  <code className="text-[10px] text-muted-foreground font-mono block">
                    {color.hex}
                  </code>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-2">
                {color.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ColorPalette() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Color Palette</CardTitle>
        <CardDescription>
          Brand colors, semantic colors, and surface colors used throughout the application. 
          All colors are defined as HSL values for consistency.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <ColorSwatchGrid colors={brandColors} title="Brand Colors" />
        <ColorSwatchGrid colors={semanticColors} title="Semantic Colors" />
        <ColorSwatchGrid colors={surfaceColors} title="Surface & Text Colors" />
        <ColorSwatchGrid colors={pastelColors} title="Pastel Colors (Badges)" />
      </CardContent>
    </Card>
  )
}
