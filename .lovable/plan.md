

# Fix: Remove @lexical/* subpath packages from manualChunks

## Change

**File: `vite.config.ts`, line 39**

Replace:
```
editor: ['lexical', '@lexical/react', '@lexical/rich-text', '@lexical/list', '@lexical/link'],
```

With:
```
editor: ['lexical'],
```

One line change. This fixes the build error because `@lexical/react` and the other `@lexical/*` packages don't have root entry points.

