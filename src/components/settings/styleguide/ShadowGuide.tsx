import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const shadows = [
  { name: 'shadow-xs', label: 'Extra Small' },
  { name: 'shadow-sm', label: 'Small' },
  { name: 'shadow', label: 'Default' },
  { name: 'shadow-md', label: 'Medium' },
  { name: 'shadow-lg', label: 'Large' },
  { name: 'shadow-xl', label: 'Extra Large' },
  { name: 'shadow-2xl', label: '2XL' },
]

const customShadows = [
  { name: 'shadow-button', label: 'Button', description: 'Subtle shadow for buttons' },
  { name: 'shadow-card', label: 'Card', description: 'Default card shadow' },
  { name: 'shadow-elevated', label: 'Elevated', description: 'For elevated UI elements' },
  { name: 'shadow-dropdown', label: 'Dropdown', description: 'Dropdown menus and popovers' },
]

const borderRadii = [
  { name: 'rounded-none', label: '0px' },
  { name: 'rounded-sm', label: '2px' },
  { name: 'rounded', label: '4px' },
  { name: 'rounded-md', label: '6px' },
  { name: 'rounded-lg', label: '8px' },
  { name: 'rounded-xl', label: '12px' },
  { name: 'rounded-2xl', label: '16px' },
  { name: 'rounded-full', label: '9999px' },
]

export function ShadowGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shadows & Borders</CardTitle>
        <CardDescription>
          Shadow system and border radius options for depth and visual hierarchy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Standard Shadows */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Standard Shadows</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {shadows.map(({ name, label }) => (
              <div key={name} className="text-center">
                <div 
                  className={`h-16 w-full rounded-lg bg-card border ${name} mb-2`}
                />
                <p className="text-xs font-medium">{label}</p>
                <code className="text-[10px] text-muted-foreground">{name}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Shadows */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Custom Shadows</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {customShadows.map(({ name, label, description }) => (
              <div key={name} className="text-center">
                <div 
                  className={`h-16 w-full rounded-lg bg-card border ${name} mb-2`}
                />
                <p className="text-xs font-medium">{label}</p>
                <code className="text-[10px] text-muted-foreground block">{name}</code>
                <p className="text-[10px] text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Border Radius */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Border Radius</h4>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
            {borderRadii.map(({ name, label }) => (
              <div key={name} className="text-center">
                <div 
                  className={`h-12 w-full bg-primary ${name} mb-2`}
                />
                <p className="text-xs font-medium">{label}</p>
                <code className="text-[10px] text-muted-foreground">{name}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Spacing Scale Preview */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Spacing Scale</h4>
          <div className="space-y-2">
            {[1, 2, 3, 4, 6, 8, 12, 16].map((space) => (
              <div key={space} className="flex items-center gap-4">
                <code className="text-xs text-muted-foreground w-12">p-{space}</code>
                <div className="flex-1 h-8 bg-muted/50 rounded">
                  <div 
                    className="h-full bg-primary/20 rounded"
                    style={{ width: `${space * 4}px`, minWidth: '4px' }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16">{space * 4}px</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
