import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeHtmlForEditor } from '../htmlSanitizer'

describe('htmlSanitizer', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("XSS")</script>'
      const output = sanitizeHtml(input)
      
      expect(output).not.toContain('<script')
      expect(output).not.toContain('alert')
      expect(output).toContain('Hello')
    })

    it('should remove iframe tags', () => {
      const input = '<p>Content</p><iframe src="evil.com"></iframe>'
      const output = sanitizeHtml(input)
      
      expect(output).not.toContain('<iframe')
      expect(output).not.toContain('evil.com')
      expect(output).toContain('Content')
    })

    it('should allow safe HTML tags', () => {
      const input = '<p>Paragraph</p><strong>Bold</strong><em>Italic</em>'
      const output = sanitizeHtml(input)
      
      expect(output).toContain('<p>')
      expect(output).toContain('<strong>')
      expect(output).toContain('<em>')
      expect(output).toContain('Paragraph')
      expect(output).toContain('Bold')
      expect(output).toContain('Italic')
    })

    it('should allow table tags', () => {
      const input = '<table><tr><td>Cell</td></tr></table>'
      const output = sanitizeHtml(input)
      
      expect(output).toContain('<table>')
      expect(output).toContain('<tr>')
      expect(output).toContain('<td>')
      expect(output).toContain('Cell')
    })

    it('should remove event handlers', () => {
      const input = '<p onclick="alert(1)">Click me</p>'
      const output = sanitizeHtml(input)
      
      expect(output).not.toContain('onclick')
      expect(output).not.toContain('alert')
      expect(output).toContain('Click me')
    })

    it('should remove form and input tags', () => {
      const input = '<form><input type="text" /></form>'
      const output = sanitizeHtml(input)
      
      expect(output).not.toContain('<form')
      expect(output).not.toContain('<input')
    })
  })

  describe('sanitizeHtmlForEditor', () => {
    it('should sanitize HTML through sanitizeHtml first', () => {
      const input = '<p>Safe</p><script>alert("XSS")</script>'
      const output = sanitizeHtmlForEditor(input)
      
      expect(output).not.toContain('<script')
      expect(output).toContain('Safe')
    })

    it('should remove problematic data attributes', () => {
      const input = '<p data-slate-node="element" data-start="0">Text</p>'
      const output = sanitizeHtmlForEditor(input)
      
      expect(output).not.toContain('data-slate-node')
      expect(output).not.toContain('data-start')
      expect(output).toContain('Text')
    })

    it('should remove CSS variables from styles', () => {
      const input = '<p style="--tw-shadow: 0 1px 3px; color: blue;">Text</p>'
      const output = sanitizeHtmlForEditor(input)
      
      expect(output).not.toContain('--tw-shadow')
      expect(output).toContain('Text')
    })

    it('should remove contenteditable attributes', () => {
      const input = '<div contenteditable="true">Editable</div>'
      const output = sanitizeHtmlForEditor(input)
      
      expect(output).not.toContain('contenteditable')
      expect(output).toContain('Editable')
    })

    it('should return plain text fallback for invalid HTML', () => {
      const input = 'Plain text content'
      const output = sanitizeHtmlForEditor(input)
      
      expect(output).toContain('<p>')
      expect(output).toContain('Plain text content')
    })

    it('should handle empty input gracefully', () => {
      const output = sanitizeHtmlForEditor('')
      expect(output).toBe('')
    })
  })

  describe('XSS Protection - Paste Sanitization', () => {
    it('should strip script tags on paste', () => {
      const pastedContent = '<p>Normal content</p><script>alert("XSS")</script><p>More content</p>'
      const sanitized = sanitizeHtmlForEditor(pastedContent)
      
      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('alert')
      expect(sanitized).toContain('Normal content')
      expect(sanitized).toContain('More content')
    })

    it('should strip iframe tags on paste', () => {
      const pastedContent = '<div><iframe src="https://malicious.com"></iframe></div>'
      const sanitized = sanitizeHtmlForEditor(pastedContent)
      
      expect(sanitized).not.toContain('<iframe')
      expect(sanitized).not.toContain('malicious.com')
    })

    it('should strip multiple dangerous tags in one paste', () => {
      const pastedContent = `
        <p>Safe paragraph</p>
        <script>malicious()</script>
        <iframe src="evil.com"></iframe>
        <object data="bad.swf"></object>
        <embed src="virus.exe">
        <p>Another safe paragraph</p>
      `
      const sanitized = sanitizeHtmlForEditor(pastedContent)
      
      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('<iframe')
      expect(sanitized).not.toContain('<object')
      expect(sanitized).not.toContain('<embed')
      expect(sanitized).toContain('Safe paragraph')
      expect(sanitized).toContain('Another safe paragraph')
    })

    it('should remove all event handler attributes', () => {
      const pastedContent = `
        <div onclick="alert(1)">
          <p onmouseover="steal()">Text</p>
          <a href="#" onload="hack()">Link</a>
        </div>
      `
      const sanitized = sanitizeHtmlForEditor(pastedContent)
      
      expect(sanitized).not.toContain('onclick')
      expect(sanitized).not.toContain('onmouseover')
      expect(sanitized).not.toContain('onload')
      expect(sanitized).toContain('Text')
      expect(sanitized).toContain('Link')
    })
  })
})
