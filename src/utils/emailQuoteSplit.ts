/**
 * Split an email body into the newest reply and its quoted history.
 * Gmail-style: only the freshest content is shown; the rest hides behind
 * a "…" toggle in the UI.
 *
 * Pure presentation helper — no backend, no data mutations.
 */

export interface SplitResult {
  main: string;
  quoted: string;
  hasQuote: boolean;
  isHtml: boolean;
}

const QUOTE_HEADER_RE =
  /^\s*(On\s.+?(wrote|escreveu|a écrit|schrieb|napisał|napisała|scrisse|escribió):|-{2,}\s*Original Message\s*-{2,}|From:\s.+)/i;

// Selectors that pinpoint the start of a quoted block, in priority order.
const QUOTE_SELECTORS = [
  '.gmail_quote_container',
  '.gmail_quote',
  '.gmail_attr',
  'blockquote[type="cite"]',
  '#divRtfBody',
  '#appendonsend',
  'div[id^="OLK_SRC_BODY_SECTION"]',
  'hr#stopSpelling',
  '.yahoo_quoted',
  '.protonmail_quote',
  'blockquote',
];

function findQuoteNode(root: Element): Element | null {
  for (const sel of QUOTE_SELECTORS) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  // Fallback: an element whose text starts with an "On … wrote:" header.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  while (node) {
    const text = (node.textContent || '').trim();
    if (text && QUOTE_HEADER_RE.test(text.split('\n')[0] || '')) {
      // Only accept if there's meaningful text BEFORE this node in the doc.
      const range = root.ownerDocument!.createRange();
      range.setStart(root, 0);
      range.setEndBefore(node);
      if ((range.toString() || '').replace(/\s+/g, '').length > 0) {
        return node;
      }
    }
    node = walker.nextNode() as Element | null;
  }
  return null;
}

function splitHtml(html: string): SplitResult {
  try {
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><body>${html}</body></html>`,
      'text/html',
    );
    const body = doc.body;
    const quoteNode = findQuoteNode(body);
    if (!quoteNode) {
      return { main: html, quoted: '', hasQuote: false, isHtml: true };
    }

    // Collect the quote node + all its following siblings, walking up
    // ancestors so nested wrappers still cut cleanly at document flow.
    const quotedFrag = doc.createElement('div');
    let cursor: Element | null = quoteNode;
    while (cursor && cursor !== body) {
      const parent: Element | null = cursor.parentElement;
      let sib: Element | null = cursor;
      while (sib) {
        const next: Element | null = sib.nextElementSibling;
        quotedFrag.appendChild(sib);
        sib = next;
      }
      cursor = parent && parent !== body ? parent : null;
    }

    const mainHtml = body.innerHTML;
    const quotedHtml = quotedFrag.innerHTML;

    const mainText = body.textContent?.replace(/\s+/g, '').trim() ?? '';
    const quotedText = quotedFrag.textContent?.replace(/\s+/g, '').trim() ?? '';

    if (!mainText || quotedText.length < 40) {
      return { main: html, quoted: '', hasQuote: false, isHtml: true };
    }

    return { main: mainHtml, quoted: quotedHtml, hasQuote: true, isHtml: true };
  } catch {
    return { main: html, quoted: '', hasQuote: false, isHtml: true };
  }
}

function splitText(text: string): SplitResult {
  const lines = text.split(/\r?\n/);
  let cutIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (QUOTE_HEADER_RE.test(line)) {
      cutIdx = i;
      break;
    }
    // Contiguous "> " block preceded by non-empty content.
    if (/^\s*>/.test(line)) {
      const hasPrior = lines.slice(0, i).some((l) => l.trim().length > 0);
      if (hasPrior) {
        cutIdx = i;
        break;
      }
    }
  }
  if (cutIdx <= 0) {
    return { main: text, quoted: '', hasQuote: false, isHtml: false };
  }
  const main = lines.slice(0, cutIdx).join('\n').replace(/\s+$/, '');
  const quoted = lines.slice(cutIdx).join('\n');
  if (!main.trim() || quoted.trim().length < 40) {
    return { main: text, quoted: '', hasQuote: false, isHtml: false };
  }
  return { main, quoted, hasQuote: true, isHtml: false };
}

export function splitEmailQuote(html?: string | null, text?: string | null): SplitResult {
  if (html && html.trim()) return splitHtml(html);
  if (text && text.trim()) return splitText(text);
  return { main: '', quoted: '', hasQuote: false, isHtml: false };
}
