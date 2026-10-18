import { describe, expect, it } from 'vitest';
import { conditionHolds, layoutWritten, PAGE_H, writtenKeys, type BoxOp, type IconOp, type TextOp } from '../sign/writtenLayout';

// Every character is half the font size wide.
const measure = (text: string, _style: string, size: number) => text.length * size * 0.5;

const text = (t: string, format = 0) => ({ type: 'text', text: t, format });
const para = (...children: object[]) => ({ type: 'paragraph', children });
const doc = (...children: object[]) => ({ root: { type: 'root', children } });
const texts = (l: ReturnType<typeof layoutWritten>, page = 0) =>
  l.pages[page].ops.filter((o): o is TextOp => o.kind === 'text' && !o.text.startsWith('Page '));

describe('layoutWritten', () => {
  it('fills tags with the frozen values', () => {
    const l = layoutWritten(doc(para(text('Dear '), { type: 'placeholder', placeholderKey: 'name' }, text(','))), {
      values: { name: 'Priya Raman' },
      measure,
    });
    expect(texts(l).map((o) => o.text).join(' ')).toBe('Dear Priya Raman ,');
    // "Raman" and "," are one word: no space between them on the page.
    const raman = texts(l).find((o) => o.text === 'Raman')!;
    const comma = texts(l).find((o) => o.text === ',')!;
    expect(comma.x).toBeCloseTo(raman.x + measure('Raman', 'regular', 11));
  });

  it('prints a template preview with tag labels and every section', () => {
    const l = layoutWritten(
      doc({ type: 'gio-if', key: 'relocation_bonus', op: 'yes', children: [para({ type: 'placeholder', placeholderKey: 'base_salary' })] }),
      { values: {}, tags: { base_salary: 'Base salary' }, measure },
    );
    expect(texts(l).map((o) => o.text).join(' ')).toBe('[Base salary]');
  });

  it('highlights values for the send preview and shows empty ones as [Label]', () => {
    const content = doc(para({ type: 'placeholder', placeholderKey: 'name' }, text(' '), { type: 'placeholder', placeholderKey: 'bonus' }));
    const l = layoutWritten(content, { values: { name: 'Priya' }, highlight: { name: 'Name', bonus: 'Bonus' }, measure });
    expect(texts(l).map((o) => [o.text, o.color])).toEqual([['Priya', 'ink'], ['[Bonus]', 'muted']]);
    const marks = l.pages[0].ops.filter((o) => o.kind === 'line' && o.color === 'lilac');
    expect(marks).toHaveLength(1);
    // The PDF that is sent never carries the highlight.
    const plain = layoutWritten(content, { values: { name: 'Priya' }, measure });
    expect(plain.pages[0].ops.some((o) => o.kind === 'line' && o.color === 'lilac')).toBe(false);
  });

  it('shows a conditional section only when its condition holds', () => {
    const content = doc(para(text('Always')), { type: 'gio-if', key: 'relocation_bonus', op: 'yes', children: [para(text('Relocation'))] });
    const yes = layoutWritten(content, { values: { relocation_bonus: 'Yes' }, measure });
    const no = layoutWritten(content, { values: { relocation_bonus: 'No' }, measure });
    expect(texts(yes).map((o) => o.text)).toContain('Relocation');
    expect(texts(no).map((o) => o.text)).not.toContain('Relocation');
  });

  it('wraps at the margins and keeps bold runs', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const l = layoutWritten(doc(para(text(words, 1))), { values: {}, measure });
    const ops = texts(l);
    expect(new Set(ops.map((o) => o.y)).size).toBeGreaterThan(3);
    for (const o of ops) {
      expect(o.style).toBe('bold');
      expect(o.x + measure(o.text, 'bold', 11)).toBeLessThanOrEqual(612 - 72 + 0.01);
    }
  });

  it('flows onto new pages and numbers them', () => {
    const many = Array.from({ length: 80 }, (_, i) => para(text(`Clause ${i}`)));
    const l = layoutWritten(doc(...many), { values: {}, measure });
    expect(l.pages.length).toBeGreaterThan(1);
    const last = l.pages[l.pages.length - 1].ops.find((o) => o.kind === 'text' && o.text.startsWith('Page ')) as TextOp;
    expect(last.text).toBe(`Page ${l.pages.length} of ${l.pages.length}`);
    for (const p of l.pages) for (const o of p.ops) if (o.kind === 'text' && !o.text.startsWith('Page ')) expect(o.y).toBeLessThanOrEqual(PAGE_H - 72);
  });

  it('starts a new page at a page break', () => {
    const l = layoutWritten(doc(para(text('One')), { type: 'gio-page-break' }, para(text('Two'))), { values: {}, measure });
    expect(l.pages).toHaveLength(2);
    expect(texts(l, 1).map((o) => o.text)).toEqual(['Two']);
  });

  it('places signing blocks and reports them in % of the page', () => {
    const l = layoutWritten(
      doc(para(text('Signed:')), { type: 'gio-sign', roleId: 'r1', kind: 'signature' }, { type: 'gio-sign', roleId: 'r1', kind: 'date' }),
      { values: {}, roles: { r1: 'Candidate' }, measure },
    );
    expect(l.blocks).toHaveLength(2);
    const [sig, date] = l.blocks;
    expect(sig).toMatchObject({ role_id: 'r1', kind: 'signature', page: 0 });
    // Side by side on one row, bottoms aligned.
    expect(date.x).toBeGreaterThan(sig.x + sig.w);
    expect(date.y + date.h).toBeCloseTo(sig.y + sig.h, 2);
    expect(sig.x).toBeCloseTo((72 / 612) * 100, 2);
    expect(texts(l).map((o) => o.text)).toContain('Candidate \u00b7 Signature');
  });

  it('never splits a signing block across pages', () => {
    const filler = Array.from({ length: 37 }, (_, i) => para(text(`Line ${i}`)));
    const l = layoutWritten(doc(...filler, { type: 'gio-sign', roleId: 'r1', kind: 'signature' }), { values: {}, measure });
    const b = l.blocks[0];
    expect(b.y + b.h).toBeLessThanOrEqual(((PAGE_H - 72) / PAGE_H) * 100);
  });

  it('numbers lists and nests them', () => {
    const item = (t: string, ...rest: object[]) => ({ type: 'listitem', children: [text(t), ...rest] });
    const l = layoutWritten(
      doc({ type: 'list', listType: 'number', start: 1, children: [item('First'), item('Second'), { type: 'listitem', children: [{ type: 'list', listType: 'bullet', children: [item('Inner')] }] }] }),
      { values: {}, measure },
    );
    const all = texts(l).map((o) => o.text);
    expect(all).toEqual(['1.', 'First', '2.', 'Second', '•', 'Inner']);
    const inner = texts(l).find((o) => o.text === 'Inner')!;
    const first = texts(l).find((o) => o.text === 'First')!;
    expect(inner.x).toBeGreaterThan(first.x);
  });

  it('centres and justifies', () => {
    const center = layoutWritten(doc({ type: 'paragraph', format: 'center', children: [text('Hi')] }), { values: {}, measure });
    const hi = texts(center)[0];
    expect(hi.x + measure('Hi', 'regular', 11) / 2).toBeCloseTo(306, 1);
    const long = Array.from({ length: 40 }, () => 'aa').join(' ');
    const just = layoutWritten(doc({ type: 'paragraph', format: 'justify', children: [text(long)] }), { values: {}, measure });
    const firstLine = texts(just).filter((o) => o.y === texts(just)[0].y);
    const lastWord = firstLine[firstLine.length - 1];
    expect(lastWord.x + measure(lastWord.text, 'regular', 11)).toBeCloseTo(612 - 72, 1);
  });

  it('cuts a word longer than the line', () => {
    const l = layoutWritten(doc(para(text('x'.repeat(200)))), { values: {}, measure });
    const ops = texts(l);
    expect(ops.length).toBeGreaterThan(1);
    expect(ops.map((o) => o.text).join('')).toBe('x'.repeat(200));
  });

  it('keeps line breaks inside a value', () => {
    const l = layoutWritten(doc(para({ type: 'placeholder', placeholderKey: 'duties' })), { values: { duties: 'One\nTwo' }, measure });
    const [a, b] = texts(l);
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe('conditionHolds', () => {
  it('reads yes/no, filled/empty and equals', () => {
    expect(conditionHolds('yes', 'Yes')).toBe(true);
    expect(conditionHolds('yes', 'No')).toBe(false);
    expect(conditionHolds('no', '')).toBe(true);
    expect(conditionHolds('filled', ' ')).toBe(false);
    expect(conditionHolds('empty', null)).toBe(true);
    expect(conditionHolds('equals', 'Remote ', 'remote')).toBe(true);
    expect(conditionHolds('not_equals', 'Remote', 'Hybrid')).toBe(true);
  });
});

describe('writtenKeys', () => {
  it('lists tags and conditions', () => {
    const k = writtenKeys(doc(para({ type: 'placeholder', placeholderKey: 'name' }), { type: 'gio-if', key: 'bonus', op: 'filled', children: [para({ type: 'placeholder', placeholderKey: 'bonus' })] }));
    expect(k.tags.sort()).toEqual(['bonus', 'name']);
    expect(k.conditions).toEqual(['bonus']);
  });

  it('prints a tag in its format, falling back to the default wording', () => {
    const content = doc(para({ type: 'placeholder', placeholderKey: 'start_date', format: 'date_numeric' }, text(' / '), { type: 'placeholder', placeholderKey: 'job', format: 'date_numeric' }));
    const l = layoutWritten(content, { values: { start_date: 'October 26, 2026', 'start_date|date_numeric': '26/10/2026', job: 'Designer' }, measure });
    expect(texts(l).map((o) => o.text).join(' ')).toBe('26/10/2026 / Designer');
  });

  it('turns signer fields in the text into fields, with their required flag and label', () => {
    const content = doc(para(text('Bank account '), { type: 'gio-field', roleId: 'r1', fieldType: 'text', required: false, label: 'Bank account' }, text(' I agree '), { type: 'gio-field', roleId: 'r1', fieldType: 'checkbox', required: true }, { type: 'gio-field', roleId: 'r1', fieldType: 'signature' }));
    const l = layoutWritten(content, { values: {}, measure });
    expect(l.blocks.map((b) => [b.kind, b.required, b.label ?? null])).toEqual([
      ['text', false, 'Bank account'],
      ['checkbox', true, null],
    ]);
    const [field, box] = l.blocks;
    expect(field.page).toBe(0);
    expect(box.x).toBeGreaterThan(field.x + field.w);
    // The field sits on its line, inside the page.
    expect(field.y).toBeGreaterThan(0);
    expect(field.y + field.h).toBeLessThan(100);
  });

  it('keeps a "more than 0" section only for a positive figure', () => {
    expect(conditionHolds('gt0', 'MXN 12,000')).toBe(true);
    expect(conditionHolds('gt0', '$0 MXN')).toBe(false);
    expect(conditionHolds('gt0', '')).toBe(false);
  });

  it('prints an empty value as [Label] in red for the template editor', () => {
    const content = doc(para({ type: 'placeholder', placeholderKey: 'bonus' }));
    const l = layoutWritten(content, { values: {}, highlight: { bonus: 'Bonus' }, emptyInk: 'danger', measure });
    expect(texts(l)[0]).toMatchObject({ text: '[Bonus]', color: 'danger' });
  });

  describe('callouts', () => {
    const callout = (extra: object, ...children: object[]) => ({ type: 'gio-callout', icon: 'info', tone: 'yellow', children, ...extra });
    const boxes = (l: ReturnType<typeof layoutWritten>, page = 0) => l.pages[page].ops.filter((o): o is BoxOp => o.kind === 'box');

    it('draws the box under its text, with the icon beside the first line', () => {
      const l = layoutWritten(doc(para(text('Before')), callout({}, text('Notice period is 30 days'))), { values: {}, measure });
      const ops = l.pages[0].ops;
      const box = boxes(l)[0];
      const icon = ops.find((o): o is IconOp => o.kind === 'icon')!;
      const words = texts(l).filter((o) => o.text !== 'Before');
      expect(box).toMatchObject({ x: 72, w: 468, tone: 'yellow' });
      expect(icon).toMatchObject({ icon: 'info', tone: 'yellow', size: 12, x: 82 });
      // Under the text: the box comes before the callout's words, after the line above it.
      expect(ops.indexOf(box)).toBeLessThan(ops.indexOf(words[0]));
      expect(ops.indexOf(box)).toBeGreaterThan(ops.indexOf(texts(l)[0]));
      // Text sits after the icon and its gap, inside the padding.
      expect(words[0].x).toBe(72 + 10 + 12 + 8);
      expect(box.y).toBeLessThan(words[0].y - 11);
      expect(box.y + box.h).toBeGreaterThan(words[0].y);
    });

    it('drops the icon space with no icon, and falls back to neutral and the idea icon', () => {
      const none = layoutWritten(doc(callout({ icon: 'none' }, text('Plain'))), { values: {}, measure });
      expect(none.pages[0].ops.some((o) => o.kind === 'icon')).toBe(false);
      expect(texts(none)[0].x).toBe(82);
      const odd = layoutWritten(doc(callout({ icon: 'rocket', tone: 'teal' }, text('Odd'))), { values: {}, measure });
      expect(boxes(odd)[0].tone).toBe('neutral');
      expect(odd.pages[0].ops.find((o): o is IconOp => o.kind === 'icon')!.icon).toBe('idea');
    });

    it('fills tags inside a callout and keeps going in a box of its own on the next page', () => {
      const long = Array.from({ length: 400 }, (_, i) => 'word' + i).join(' ');
      const l = layoutWritten(doc(callout({}, text('Hi '), { type: 'placeholder', placeholderKey: 'name' }, text(' ' + long))), {
        values: { name: 'Priya' },
        measure,
      });
      expect(l.pages.length).toBeGreaterThan(1);
      expect(texts(l).some((o) => o.text === 'Priya')).toBe(true);
      const second = boxes(l, 1)[0];
      expect(l.pages[1].ops[0]).toBe(second);
      expect(second.y).toBe(72 - 10);
      expect(boxes(l, 0)[0].y + boxes(l, 0)[0].h).toBe(PAGE_H - 72 + 10);
      expect(writtenKeys(doc(callout({}, { type: 'placeholder', placeholderKey: 'name' }))).tags).toEqual(['name']);
    });

    it('prints inside a section only when the section does', () => {
      const sec = (v: string) =>
        layoutWritten(doc({ type: 'gio-if', key: 'remote', op: 'yes', children: [callout({}, text('Remote rules'))] }), { values: { remote: v }, measure });
      expect(boxes(sec('yes')).length).toBe(1);
      expect(boxes(sec('no')).length).toBe(0);
    });
  });
});
