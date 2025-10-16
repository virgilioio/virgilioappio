# Rich Text Editor Component

**Location:** `src/components/ui/rich-text-editor.tsx`  
**Purpose:** WYSIWYG HTML editor with formatting toolbar  
**Engine:** Native `contentEditable` with custom toolbar controls

---

## Overview

The RichTextEditor is a production-ready rich text editing component built on top of the browser's native `contentEditable` API. It provides a familiar word-processor experience with formatting buttons while maintaining security and stability.

### Key Features

- ✅ **XSS Protection**: All pasted content is sanitized via DOMPurify
- ✅ **Defensive Updates**: Equality checks and rAF debouncing prevent unnecessary DOM writes
- ✅ **Cursor Safety**: Try/catch guards around selection APIs prevent crashes
- ✅ **No Production Logs**: Verbose logs only in development mode
- ✅ **External Update Support**: Handles programmatic content updates gracefully

---

## Known Limitations of contentEditable

The editor is built on the browser's native `contentEditable` API, which has well-known quirks:

### 1. **Inconsistent Behavior Across Browsers**
- Different browsers generate different HTML for the same user actions
- Firefox, Chrome, Safari may produce `<b>` vs `<strong>`, `<i>` vs `<em>`
- **Mitigation**: We use `document.execCommand()` for consistency

### 2. **Fragile DOM State**
- The editor's internal state is stored in the DOM itself
- Direct DOM manipulation can break the editing experience
- **Mitigation**: All updates go through controlled update guards (see below)

### 3. **Selection/Cursor Management**
- Selection state is lost on blur or DOM updates
- Programmatic changes can reset cursor position
- **Mitigation**: We save/restore cursor position using `cursorUtils.ts`

### 4. **Copy/Paste Complexity**
- Pasted content can include malicious scripts or break formatting
- Different sources (Word, Google Docs) produce wildly different HTML
- **Mitigation**: All pastes go through `sanitizeHtmlForEditor()` before insertion

### 5. **Undo/Redo Reliability**
- Browser's native undo stack doesn't always align with React state
- Complex operations may not undo correctly
- **No current mitigation**: Consider custom undo stack for critical use cases

---

## Update Guards (How We Prevent Re-Render Loops)

### Problem
External updates (e.g., from parent component props) can trigger infinite loops:
1. Parent updates `value` prop → triggers useEffect
2. useEffect updates DOM → triggers `onInput`
3. `onInput` calls `onChange` → parent updates `value` again
4. Back to step 1 (infinite loop)

### Solution: Multi-Layer Defense

#### 1. **Equality Check** (Line ~280-285)
```typescript
// Skip DOM update if content hasn't actually changed
const sanitizedValue = sanitizeHtmlForEditor(value)
if (editorRef.current.innerHTML === sanitizedValue) {
  return // No-op
}
```

#### 2. **Update Flag Guard** (`isUpdatingRef`)
```typescript
if (isUpdatingRef.current) return // Already updating, skip
isUpdatingRef.current = true
// ... perform update ...
isUpdatingRef.current = false
```

#### 3. **requestAnimationFrame Debouncing**
```typescript
requestAnimationFrame(() => {
  editorRef.current.innerHTML = sanitizedValue
  requestAnimationFrame(() => {
    // Restore cursor after DOM settles
  })
})
```

**Why two rAFs?**
- First rAF: Ensures DOM write happens after current frame
- Second rAF: Cursor restoration waits for layout to complete

---

## Cursor Safety (Crash Prevention)

### Problem
Selection APIs (`window.getSelection()`, `Range`) can throw exceptions:
- When selection is outside the editor
- When DOM nodes are removed during selection
- When browser extensions interfere

### Solution: Try/Catch Everywhere

All selection operations are wrapped:

```typescript
try {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    // ... manipulate range ...
  }
} catch (error) {
  if (import.meta.env.DEV) {
    console.debug('Selection operation failed:', error)
  }
  // Fallback: append to end
}
```

**Locations with guards:**
- `handleCommand()` - Line ~76-95
- `insertTable()` - Line ~117-147
- `insertLink()` - Line ~153-186
- `handlePaste()` - Line ~215-251

---

## Paste Sanitization (XSS Prevention)

### Security Flow

1. **Clipboard Data Extraction**
   ```typescript
   const htmlData = clipboardData.getData('text/html')
   ```

2. **Route Through Sanitizer**
   ```typescript
   contentToInsert = sanitizeHtmlForEditor(htmlData)
   ```

3. **Sanitizer Removes Dangerous Tags**
   - `<script>` → Removed
   - `<iframe>` → Removed
   - `<object>`, `<embed>` → Removed
   - Event handlers (`onclick`, etc.) → Removed

4. **Insert Safe Content**
   ```typescript
   range.insertNode(safeNode)
   ```

### Unit Tests (src/utils/__tests__/htmlSanitizer.test.ts)

✅ **Verifies:**
- Script tags are stripped
- Iframe tags are stripped
- Event handlers are removed
- Multiple dangerous tags handled
- Safe content is preserved

**Run tests:**
```bash
npm test htmlSanitizer
```

---

## How to Add New Toolbar Buttons (Without Breaking Selection)

### ❌ Wrong Way (Will Break Cursor)
```typescript
// DON'T DO THIS - Directly manipulating DOM
<Button onClick={() => {
  editorRef.current.innerHTML += '<hr />'
}}>
  Add Line
</Button>
```

**Why this breaks:**
- No cursor position saved
- No update guards
- No sanitization

### ✅ Correct Way (Follow Existing Patterns)

1. **Save cursor before operation:**
   ```typescript
   cursorPositionRef.current = saveTextCursorPosition(editorRef.current)
   ```

2. **Use Selection API with try/catch:**
   ```typescript
   try {
     const selection = window.getSelection()
     if (selection && selection.rangeCount > 0) {
       // ... insert content ...
     }
   } catch (error) {
     // Fallback
   }
   ```

3. **Restore cursor with rAF:**
   ```typescript
   requestAnimationFrame(() => {
     try {
       restoreTextCursorPosition(editorRef.current, cursorPositionRef.current)
     } catch (error) {
       // Ignore restoration failures
     }
   })
   ```

4. **Update content through `updateContent()`:**
   ```typescript
   updateContent(editorRef.current.innerHTML)
   ```

### Example: Add Horizontal Rule Button

```typescript
const insertHorizontalRule = useCallback(() => {
  if (!editorRef.current) return
  
  editorRef.current.focus()
  cursorPositionRef.current = saveTextCursorPosition(editorRef.current)
  
  const hrHTML = '<hr style="margin: 16px 0; border: 1px solid #e0e0e0;" />'
  
  try {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const hr = document.createElement('hr')
      hr.style.margin = '16px 0'
      hr.style.border = '1px solid #e0e0e0'
      
      range.insertNode(hr)
      range.setStartAfter(hr)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      editorRef.current.innerHTML += hrHTML
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug('Failed to insert HR:', error)
    }
    editorRef.current.innerHTML += hrHTML
  }
  
  updateContent(editorRef.current.innerHTML)
}, [updateContent])

// In toolbar:
<Button onClick={insertHorizontalRule}>
  <Minus className="h-3.5 w-3.5" />
</Button>
```

---

## Logging Policy

**Production:** ZERO logs (silent operation)  
**Development:** `console.debug()` for diagnostics

### What's Logged (Dev Only)

- Value changes in useEffect
- Sanitization operations
- Cursor restoration failures
- Selection API errors

### What's NOT Logged

- Every keystroke
- Every content change
- Successful operations
- User data

**Implementation:**
```typescript
if (import.meta.env.DEV) {
  console.debug('Debug info', { data })
}
```

---

## Common Issues & Troubleshooting

### Issue: Cursor Jumps to End After Typing

**Cause:** External updates firing during user input  
**Fix:** Ensure parent component doesn't update `value` on every keystroke

```typescript
// ❌ BAD - Updates on every change
const [content, setContent] = useState('')
<RichTextEditor value={content} onChange={setContent} />

// ✅ GOOD - Debounce or only update on blur
const [content, setContent] = useState('')
const debouncedUpdate = useDebouncedCallback(setContent, 500)
<RichTextEditor value={content} onChange={debouncedUpdate} />
```

### Issue: Content Disappears on Paste

**Cause:** Overly aggressive sanitization  
**Fix:** Check sanitizer config in `htmlSanitizer.ts` - you may need to allow additional tags

### Issue: Formatting Lost on External Update

**Cause:** Parent passing plain text instead of HTML  
**Fix:** Ensure parent stores and passes HTML, not plain text

```typescript
// ❌ BAD
const [content, setContent] = useState('Plain text')

// ✅ GOOD
const [content, setContent] = useState('<p>Plain text</p>')
```

---

## References

- **Cursor Utils:** `src/lib/cursorUtils.ts`
- **Sanitizer:** `src/utils/htmlSanitizer.ts`
- **Unit Tests:** `src/utils/__tests__/htmlSanitizer.test.ts`
- **DOMPurify Docs:** https://github.com/cure53/DOMPurify

---

## Future Improvements (Not Implemented)

- [ ] Custom undo/redo stack (bypass browser limitations)
- [ ] Markdown support (paste markdown → convert to HTML)
- [ ] Image uploads (currently images are stripped)
- [ ] Collaborative editing (CRDTs for real-time)
- [ ] Accessibility audit (ARIA roles, keyboard nav)
- [ ] Performance profiling (large documents >10k words)

---

**Last Updated:** 2025-01-15  
**Maintainer:** Platform Team  
**Status:** Production-Ready (with known limitations)
