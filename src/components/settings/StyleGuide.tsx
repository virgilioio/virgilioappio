import React from 'react'
import { ColorPalette } from './styleguide/ColorPalette'
import { TypographyGuide } from './styleguide/TypographyGuide'
import { ButtonGuide } from './styleguide/ButtonGuide'
import { FormElementsGuide } from './styleguide/FormElementsGuide'
import { CardGuide } from './styleguide/CardGuide'
import { BadgeGuide } from './styleguide/BadgeGuide'
import { TabsGuide } from './styleguide/TabsGuide'
import { ShadowGuide } from './styleguide/ShadowGuide'
import { SkeletonGuide } from './styleguide/SkeletonGuide'
import { DateTimePickerGuide } from './styleguide/DateTimePickerGuide'
import { CurrencySelectGuide } from './styleguide/CurrencySelectGuide'
import { ScrollArea } from '@/components/ui/scroll-area'

export function StyleGuide() {
  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
      <div className="space-y-6 pr-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-heading font-semibold">
            Style Guide<span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground">
            A living reference of the design system used throughout the platform. 
            All components shown here reflect the actual UI elements in use.
          </p>
        </div>

        <ColorPalette />
        <TypographyGuide />
        <ButtonGuide />
        <FormElementsGuide />
        <CardGuide />
        <BadgeGuide />
        <TabsGuide />
        <DateTimePickerGuide />
        <CurrencySelectGuide />
        <SkeletonGuide />
        <ShadowGuide />
      </div>
    </ScrollArea>
  )
}
