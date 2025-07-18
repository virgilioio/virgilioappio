import { useState, useEffect, useMemo } from 'react'
import { convertCurrency, getCurrencySymbol } from '@/utils/currencyUtils'
import { Invoice } from '@/hooks/useInvoices'

interface ConversionCache {
  [key: string]: {
    convertedAmount: number
    exchangeRate: number
    timestamp: number
  }
}

// Cache for 5 minutes to reduce API calls
const CACHE_DURATION = 5 * 60 * 1000

export function useCurrencyConversion(
  invoices: Invoice[],
  targetCurrency: string,
  organizationId?: string
) {
  const [conversionResults, setConversionResults] = useState<{
    totalConverted: number
    showCurrencyIndicator: boolean
    isLoading: boolean
  }>({
    totalConverted: 0,
    showCurrencyIndicator: false,
    isLoading: true
  })

  const [currencySymbol, setCurrencySymbol] = useState<string>('$')
  const [conversionCache, setConversionCache] = useState<ConversionCache>({})

  // Fetch currency symbol
  useEffect(() => {
    getCurrencySymbol(targetCurrency).then(setCurrencySymbol)
  }, [targetCurrency])

  // Memoize invoice amounts and currencies to prevent unnecessary conversions
  const invoiceData = useMemo(() => {
    return invoices.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency || 'USD',
      totalPaid: invoice.total_paid,
      remainingAmount: invoice.remaining_amount,
      status: invoice.status
    }))
  }, [invoices])

  // Convert invoices with caching
  useEffect(() => {
    const convertInvoices = async () => {
      if (invoiceData.length === 0) {
        setConversionResults({
          totalConverted: 0,
          showCurrencyIndicator: false,
          isLoading: false
        })
        return
      }

      setConversionResults(prev => ({ ...prev, isLoading: true }))

      let totalConverted = 0
      let showIndicator = false
      const now = Date.now()

      try {
        for (const invoice of invoiceData) {
          const { amount, currency, totalPaid, remainingAmount, status } = invoice
          
          // Determine amount to convert based on invoice status
          let amountToConvert = amount
          if (status === 'paid') {
            amountToConvert = totalPaid || amount
          } else if (status === 'partial') {
            if (totalPaid) {
              amountToConvert = totalPaid
            } else if (remainingAmount) {
              amountToConvert = remainingAmount
            }
          }

          // Create cache key
          const cacheKey = `${currency}-${targetCurrency}-${amountToConvert}-${organizationId}`
          
          // Check cache first
          const cached = conversionCache[cacheKey]
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            totalConverted += cached.convertedAmount
            if (cached.exchangeRate !== 1.0) showIndicator = true
            continue
          }

          // Convert currency
          const conversion = await convertCurrency(
            amountToConvert,
            currency,
            targetCurrency,
            organizationId
          )

          totalConverted += conversion.convertedAmount
          if (conversion.exchangeRate !== 1.0) showIndicator = true

          // Update cache
          setConversionCache(prev => ({
            ...prev,
            [cacheKey]: {
              convertedAmount: conversion.convertedAmount,
              exchangeRate: conversion.exchangeRate,
              timestamp: now
            }
          }))
        }

        setConversionResults({
          totalConverted,
          showCurrencyIndicator: showIndicator,
          isLoading: false
        })
      } catch (error) {
        console.error('Error in currency conversion:', error)
        // Fallback to original amounts
        const fallbackTotal = invoiceData.reduce((sum, invoice) => {
          const { amount, totalPaid, remainingAmount, status } = invoice
          if (status === 'paid') {
            return sum + (totalPaid || amount)
          } else if (status === 'partial') {
            if (totalPaid) {
              return sum + totalPaid
            } else if (remainingAmount) {
              return sum + remainingAmount
            }
          }
          return sum + amount
        }, 0)

        setConversionResults({
          totalConverted: fallbackTotal,
          showCurrencyIndicator: false,
          isLoading: false
        })
      }
    }

    convertInvoices()
  }, [invoiceData, targetCurrency, organizationId, conversionCache])

  return {
    ...conversionResults,
    currencySymbol
  }
}