import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ColorSwatch {
  name: string
  variable: string
  description: string
}

const brandColors: ColorSwatch[] = [
  { name: 'Primary (Virgilio Purple)', variable: '--primary', description: 'Main brand color for CTAs and key elements' },
  { name: 'Primary Foreground', variable: '--primary-foreground', description: 'Text on primary backgrounds' },
  { name: 'Accent', variable: '--accent', description: 'Secondary emphasis color' },
  { name: 'Accent Foreground', variable: '--accent-foreground', description: 'Text on accent backgrounds' },
]

const semanticColors: ColorSwatch[] = [
  { name: 'Success', variable: '--success', description: 'Positive actions and states' },
  { name: 'Warning', variable: '--warning', description: 'Caution and pending states' },
  { name: 'Destructive', variable: '--destructive', description: 'Errors and destructive actions' },
  { name: 'Info', variable: '--info', description: 'Informational messages' },
]

const surfaceColors: ColorSwatch[] = [
  { name: 'Background', variable: '--background', description: 'Page background' },
  { name: 'Foreground', variable: '--foreground', description: 'Primary text color' },
  { name: 'Card', variable: '--card', description: 'Card backgrounds' },
  { name: 'Muted', variable: '--muted', description: 'Subtle backgrounds' },
  { name: 'Muted Foreground', variable: '--muted-foreground', description: 'Secondary text' },
  { name: 'Border', variable: '--border', description: 'Default borders' },
]

const pastelColors: ColorSwatch[] = [
  { name: 'Pastel Blue', variable: '--pastel-blue', description: 'Soft blue for badges' },
  { name: 'Pastel Purple', variable: '--pastel-purple', description: 'Soft purple for badges' },
  { name: 'Pastel Green', variable: '--pastel-green', description: 'Soft green for badges' },
  { name: 'Pastel Pink', variable: '--pastel-pink', description: 'Soft pink for badges' },
  { name: 'Pastel Yellow', variable: '--pastel-yellow', description: 'Soft yellow for badges' },
  { name: 'Pastel Orange', variable: '--pastel-orange', description: 'Soft orange for badges' },
]

function ColorSwatchGrid({ colors, title }: { colors: ColorSwatch[], title: string }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {colors.map((color) => (
          <div key={color.variable} className="space-y-2">
            <div 
              className="h-16 rounded-lg border shadow-sm"
              style={{ backgroundColor: `hsl(var(${color.variable}))` }}
            />
            <div className="space-y-0.5">
              <p className="text-xs font-medium truncate">{color.name}</p>
              <code className="text-[10px] text-muted-foreground block truncate">
                {color.variable}
              </code>
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
          Brand colors, semantic colors, and surface colors used throughout the application
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
