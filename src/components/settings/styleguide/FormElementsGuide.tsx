import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function FormElementsGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Elements</CardTitle>
        <CardDescription>
          Input fields, selects, checkboxes, switches, and other form components
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Text Inputs */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Text Inputs</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Default Input</Label>
              <Input placeholder="Enter text..." />
            </div>
            <div className="space-y-2">
              <Label>With Value</Label>
              <Input defaultValue="Sample text" />
            </div>
            <div className="space-y-2">
              <Label>Disabled</Label>
              <Input placeholder="Disabled input" disabled />
            </div>
          </div>
        </div>

        {/* Select */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Select</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Default Select</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>With Selection</Label>
              <Select defaultValue="option2">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Disabled</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Disabled" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Textarea</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Textarea</Label>
              <Textarea placeholder="Enter longer text here..." />
            </div>
            <div className="space-y-2">
              <Label>Disabled Textarea</Label>
              <Textarea placeholder="Disabled" disabled />
            </div>
          </div>
        </div>

        {/* Checkboxes and Switches */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Checkboxes & Switches</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-sm font-medium">Checkboxes</p>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="check1" />
                  <Label htmlFor="check1" className="text-sm font-normal">Unchecked</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="check2" defaultChecked />
                  <Label htmlFor="check2" className="text-sm font-normal">Checked</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="check3" disabled />
                  <Label htmlFor="check3" className="text-sm font-normal text-muted-foreground">Disabled</Label>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium">Switches</p>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch id="switch1" />
                  <Label htmlFor="switch1" className="text-sm font-normal">Off</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="switch2" defaultChecked />
                  <Label htmlFor="switch2" className="text-sm font-normal">On</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="switch3" disabled />
                  <Label htmlFor="switch3" className="text-sm font-normal text-muted-foreground">Disabled</Label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
