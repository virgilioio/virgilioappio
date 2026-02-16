import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencySelect } from '@/components/ui/currency-select'

export function CurrencySelectGuide() {
  const [defaultValue, setDefaultValue] = useState('')
  const [preselectedValue, setPreselectedValue] = useState('USD')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currency Select</CardTitle>
        <CardDescription>
          A searchable currency combobox used across all forms that require currency selection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Default (no selection)</h4>
          <div className="max-w-xs">
            <CurrencySelect value={defaultValue} onChange={setDefaultValue} />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Pre-selected (USD)</h4>
          <div className="max-w-xs">
            <CurrencySelect value={preselectedValue} onChange={setPreselectedValue} />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Disabled</h4>
          <div className="max-w-xs">
            <CurrencySelect value="EUR" onChange={() => {}} disabled />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
