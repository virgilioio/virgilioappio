import path from 'path'
import { configDefaults, defineConfig } from 'vitest/config'

// Tests only. Kept apart from vite.config.ts so its dev-server plugins don't
// load under vitest. Agent tooling folders carry their own Node test runners.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    exclude: [...configDefaults.exclude, '.agents/**', '.claude/**'],
  },
})
