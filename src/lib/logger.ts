/**
 * Minimal logging utility that only outputs in development mode.
 * In production, all logs are silent by default.
 * 
 * Usage:
 *   import { log } from '@/lib/logger'
 *   log.debug('Debug message', data)
 *   log.info('Info message')
 *   log.warn('Warning message')
 *   log.error('Error message', error)
 */

const isDev = import.meta.env.DEV

export const log = {
  debug: (...args: any[]) => {
    if (isDev) console.debug(...args)
  },
  info: (...args: any[]) => {
    if (isDev) console.info(...args)
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args)
  },
  error: (...args: any[]) => {
    if (isDev) console.error(...args)
  },
}
