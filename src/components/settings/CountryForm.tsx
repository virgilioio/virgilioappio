
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { useCountries, Country } from '@/hooks/useCountries'

interface CountryFormProps {
  isOpen: boolean
  onClose: () => void
  country?: Country | null
}

export function CountryForm({ isOpen, onClose, country }: CountryFormProps) {
  const { createCountry, updateCountry } = useCountries()
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    is_active: true
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (country) {
      setFormData({
        name: country.name,
        code: country.code,
        is_active: country.is_active
      })
    } else {
      setFormData({
        name: '',
        code: '',
        is_active: true
      })
    }
  }, [country, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (country) {
        await updateCountry(country.id, formData)
      } else {
        await createCountry(formData)
      }
      onClose()
    } catch (error) {
      console.error('Error saving country:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {country ? 'Edit Country' : 'Add Country'}
          </DialogTitle>
          <DialogDescription>
            {country ? 'Update country information' : 'Add a new country to the system'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Country Name" required htmlFor="name">
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="e.g., United States"
              required
            />
          </FormField>

          <FormField label="Country Code" required htmlFor="code">
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => updateFormData('code', e.target.value.toUpperCase())}
              placeholder="e.g., US"
              maxLength={2}
              required
            />
          </FormField>

          <FormField label="Status" htmlFor="status">
            <Select 
              value={formData.is_active.toString()} 
              onValueChange={(value) => updateFormData('is_active', value === 'true')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : country ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
