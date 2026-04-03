import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CURRENCIES, CURRENCY_SYMBOLS } from '@/constants/currencies'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

const STORAGE_KEY = 'dashboard-currency-converter'

interface ConverterState {
  fromCurrency: string
  toCurrency: string
  amount: number
}

// Hardcoded fallback rates (USD base)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CHF: 0.88, CAD: 1.36,
  AUD: 1.53, CNY: 7.24, INR: 83.1, KRW: 1320, SGD: 1.34, HKD: 7.82,
  NOK: 10.6, SEK: 10.4, DKK: 6.87, PLN: 3.98, CZK: 23.2, HUF: 356,
  RUB: 92, BRL: 4.97, MXN: 17.1, ARS: 350, CLP: 940, COP: 3950,
  ZAR: 18.6, TRY: 30.2, ILS: 3.67, AED: 3.67, SAR: 3.75, EGP: 30.9,
  THB: 35.2, MYR: 4.72, IDR: 15600, PHP: 56.2, VND: 24400, NZD: 1.64,
}

const RATES_CACHE_KEY = 'currency-rates-cache'
const RATES_TTL = 1000 * 60 * 60 * 4 // 4 hours

function loadState(): ConverterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { fromCurrency: 'USD', toCurrency: 'EUR', amount: 100000 }
}

function saveState(state: ConverterState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

function loadCachedRates(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY)
    if (raw) {
      const { rates, ts } = JSON.parse(raw)
      if (Date.now() - ts < RATES_TTL) return rates
    }
  } catch {}
  return null
}

function saveCachedRates(rates: Record<string, number>) {
  try { localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, ts: Date.now() })) } catch {}
}

function formatAmount(n: number, currency: string): string {
  const decimals = ['JPY', 'KRW', 'VND', 'CLP', 'HUF', 'IDR'].includes(currency) ? 0 : 2
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n)
}

function CurrencyPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</span>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 text-xs font-semibold font-poppins rounded-md px-2 py-0.5 hover:bg-white/10 transition-colors">
            {value}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="end" side="bottom">
          <Command>
            <CommandInput placeholder="Search..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty>No currency found.</CommandEmpty>
              <CommandGroup>
                {CURRENCIES.map(c => (
                  <CommandItem
                    key={c.value}
                    value={c.value}
                    onSelect={(v) => {
                      onChange(v.toUpperCase())
                      setOpen(false)
                    }}
                    className="text-xs"
                  >
                    {c.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function CurrencyConverterWidget() {
  const [state, setState] = useState<ConverterState>(loadState)
  const [rates, setRates] = useState<Record<string, number>>(loadCachedRates() ?? FALLBACK_RATES)
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch rates on mount
  useEffect(() => {
    const cached = loadCachedRates()
    if (cached) {
      setRates(cached)
      return
    }
    // Use a free exchange rate API
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data?.rates) {
          setRates(data.rates)
          saveCachedRates(data.rates)
        }
      })
      .catch(() => {/* keep fallback */})
  }, [])

  // Persist state
  useEffect(() => { saveState(state) }, [state])

  const convert = useCallback((amount: number, from: string, to: string): number => {
    const fromRate = rates[from] ?? 1
    const toRate = rates[to] ?? 1
    return (amount / fromRate) * toRate
  }, [rates])

  const convertedAmount = convert(state.amount, state.fromCurrency, state.toCurrency)
  const exchangeRate = convert(1, state.fromCurrency, state.toCurrency)

  const handleSwap = () => {
    setState(prev => ({
      ...prev,
      fromCurrency: prev.toCurrency,
      toCurrency: prev.fromCurrency,
    }))
  }

  const startEditing = () => {
    setInputValue(state.amount.toString())
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const finishEditing = () => {
    const parsed = parseFloat(inputValue.replace(/,/g, ''))
    if (!isNaN(parsed) && parsed >= 0) {
      setState(prev => ({ ...prev, amount: parsed }))
    }
    setEditing(false)
  }

  const fromSymbol = CURRENCY_SYMBOLS[state.fromCurrency] ?? state.fromCurrency
  const toSymbol = CURRENCY_SYMBOLS[state.toCurrency] ?? state.toCurrency

  return (
    <Card className="overflow-hidden border-0 shadow-md bg-primary text-primary-foreground">
      <CardContent className="p-4 space-y-3">
        {/* From section */}
        <div className="space-y-1">
          <CurrencyPicker
            value={state.fromCurrency}
            onChange={(v) => setState(prev => ({ ...prev, fromCurrency: v }))}
            label="From"
          />
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onBlur={finishEditing}
              onKeyDown={e => e.key === 'Enter' && finishEditing()}
              className="w-full bg-transparent border-none outline-none font-poppins font-bold text-[1.6rem] leading-tight text-primary-foreground placeholder:text-primary-foreground/40"
              placeholder="0"
            />
          ) : (
            <button
              onClick={startEditing}
              className="w-full text-left font-poppins font-bold text-[1.6rem] leading-tight hover:opacity-80 transition-opacity cursor-text"
            >
              <span className="opacity-60 text-[1rem] mr-1">{fromSymbol}</span>
              {formatAmount(state.amount, state.fromCurrency)}
            </button>
          )}
        </div>

        {/* Swap + rate */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-primary-foreground/20" />
          <button
            onClick={handleSwap}
            className="flex items-center justify-center h-7 w-7 rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1 h-px bg-primary-foreground/20" />
        </div>

        {/* To section */}
        <div className="space-y-1">
          <CurrencyPicker
            value={state.toCurrency}
            onChange={(v) => setState(prev => ({ ...prev, toCurrency: v }))}
            label="To"
          />
          <div className="font-poppins font-bold text-[1.6rem] leading-tight">
            <span className="opacity-60 text-[1rem] mr-1">{toSymbol}</span>
            {formatAmount(convertedAmount, state.toCurrency)}
          </div>
        </div>

        {/* Exchange rate footer */}
        <p className="text-[10px] opacity-50 text-right">
          1 {state.fromCurrency} = {exchangeRate.toFixed(4)} {state.toCurrency}
        </p>
      </CardContent>
    </Card>
  )
}
