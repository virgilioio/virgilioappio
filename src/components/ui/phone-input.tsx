import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+1', country: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+31', country: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+46', country: 'SE', flag: '🇸🇪', name: 'Sweden' },
  { code: '+47', country: 'NO', flag: '🇳🇴', name: 'Norway' },
  { code: '+45', country: 'DK', flag: '🇩🇰', name: 'Denmark' },
  { code: '+358', country: 'FI', flag: '🇫🇮', name: 'Finland' },
  { code: '+41', country: 'CH', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43', country: 'AT', flag: '🇦🇹', name: 'Austria' },
  { code: '+32', country: 'BE', flag: '🇧🇪', name: 'Belgium' },
  { code: '+351', country: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: '+353', country: 'IE', flag: '🇮🇪', name: 'Ireland' },
  { code: '+30', country: 'GR', flag: '🇬🇷', name: 'Greece' },
  { code: '+48', country: 'PL', flag: '🇵🇱', name: 'Poland' },
  { code: '+420', country: 'CZ', flag: '🇨🇿', name: 'Czech Republic' },
  { code: '+421', country: 'SK', flag: '🇸🇰', name: 'Slovakia' },
  { code: '+36', country: 'HU', flag: '🇭🇺', name: 'Hungary' },
  { code: '+40', country: 'RO', flag: '🇷🇴', name: 'Romania' },
  { code: '+359', country: 'BG', flag: '🇧🇬', name: 'Bulgaria' },
  { code: '+385', country: 'HR', flag: '🇭🇷', name: 'Croatia' },
  { code: '+386', country: 'SI', flag: '🇸🇮', name: 'Slovenia' },
  { code: '+372', country: 'EE', flag: '🇪🇪', name: 'Estonia' },
  { code: '+371', country: 'LV', flag: '🇱🇻', name: 'Latvia' },
  { code: '+370', country: 'LT', flag: '🇱🇹', name: 'Lithuania' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+64', country: 'NZ', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+81', country: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+82', country: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+60', country: 'MY', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+66', country: 'TH', flag: '🇹🇭', name: 'Thailand' },
  { code: '+84', country: 'VN', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+63', country: 'PH', flag: '🇵🇭', name: 'Philippines' },
  { code: '+62', country: 'ID', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: '+54', country: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: '+56', country: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', country: 'CO', flag: '🇨🇴', name: 'Colombia' },
  { code: '+51', country: 'PE', flag: '🇵🇪', name: 'Peru' },
  { code: '+58', country: 'VE', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+593', country: 'EC', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+591', country: 'BO', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+598', country: 'UY', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+595', country: 'PY', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+27', country: 'ZA', flag: '🇿🇦', name: 'South Africa' },
  { code: '+20', country: 'EG', flag: '🇪🇬', name: 'Egypt' },
  { code: '+234', country: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', country: 'KE', flag: '🇰🇪', name: 'Kenya' },
  { code: '+212', country: 'MA', flag: '🇲🇦', name: 'Morocco' },
  { code: '+216', country: 'TN', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+213', country: 'DZ', flag: '🇩🇿', name: 'Algeria' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+972', country: 'IL', flag: '🇮🇱', name: 'Israel' },
  { code: '+90', country: 'TR', flag: '🇹🇷', name: 'Turkey' },
]

interface PhoneInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
}

/**
 * Parses a phone value (ideally E.164) into country code and subscriber number.
 * Tries longest match first among known codes.
 */
function parsePhoneValue(phoneValue: string) {
  if (!phoneValue) return { countryCode: '+1', number: '' }

  // Clean the value first
  const cleaned = phoneValue.replace(/[^\d+]/g, '')
  if (!cleaned) return { countryCode: '+1', number: '' }

  const withPlus = cleaned.startsWith('+') ? cleaned : '+' + cleaned

  // Sort codes by length (longest first) for greedy matching
  const sortedCodes = [...new Set(COUNTRY_CODES.map(c => c.code))].sort((a, b) => b.length - a.length)

  for (const code of sortedCodes) {
    if (withPlus.startsWith(code)) {
      return {
        countryCode: code,
        number: withPlus.slice(code.length),
      }
    }
  }

  return { countryCode: '+1', number: withPlus.replace(/^\+/, '') }
}

export function PhoneInput({ 
  value = '', 
  onChange, 
  placeholder = 'Enter phone number',
  className,
  disabled,
  id
}: PhoneInputProps) {
  const parsed = parsePhoneValue(value)
  const [selectedCountryCode, setSelectedCountryCode] = useState(parsed.countryCode)
  const [phoneNumber, setPhoneNumber] = useState(parsed.number)

  // Sync internal state when value prop changes externally
  useEffect(() => {
    const newParsed = parsePhoneValue(value)
    setSelectedCountryCode(newParsed.countryCode)
    setPhoneNumber(newParsed.number)
  }, [value])

  const emitChange = (countryCode: string, subscriberNumber: string) => {
    // Strip all non-digit chars from subscriber number
    const cleanSubscriber = subscriberNumber.replace(/\D/g, '')
    if (!cleanSubscriber) {
      onChange?.('')
      return
    }
    // Emit clean E.164: +<code><subscriber> with no spaces
    onChange?.(`${countryCode}${cleanSubscriber}`)
  }

  const handleCountryCodeChange = (newCountryCode: string) => {
    setSelectedCountryCode(newCountryCode)
    emitChange(newCountryCode, phoneNumber)
  }

  const handlePhoneNumberChange = (newNumber: string) => {
    // Allow digits, spaces, dashes for typing comfort, but emit clean
    const displayNumber = newNumber.replace(/[^\d\s-]/g, '')
    setPhoneNumber(displayNumber)
    emitChange(selectedCountryCode, displayNumber)
  }

  const selectedCountry = COUNTRY_CODES.find(country => country.code === selectedCountryCode)

  return (
    <div className={cn("flex gap-2", className)}>
      <Select 
        value={selectedCountryCode} 
        onValueChange={handleCountryCodeChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-32">
          <SelectValue>
            {selectedCountry && (
              <div className="flex items-center gap-2">
                <span>{selectedCountry.flag}</span>
                <span className="text-sm">{selectedCountry.code}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((country, index) => (
            <SelectItem 
              key={`${country.country}-${country.code}-${index}`} 
              value={country.code}
            >
              <div className="flex items-center gap-2">
                <span>{country.flag}</span>
                <span>{country.code}</span>
                <span className="text-muted-foreground text-sm">{country.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Input
        id={id}
        type="tel"
        value={phoneNumber}
        onChange={(e) => handlePhoneNumberChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  )
}
