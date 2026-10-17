import { describe, expect, it } from 'vitest';
import { autoSize, layoutText, wrapAt } from '../sign/wrap';

// Every character is half the font size wide.
const measure = (text: string, size: number) => text.length * size * 0.5;

describe('layoutText', () => {
  it('lays a short value out on one line at the automatic size', () => {
    const l = layoutText('Talent Acquisition Partner', 200, 14, measure);
    expect(l.lines).toEqual(['Talent Acquisition Partner']);
    expect(l.size).toBe(autoSize(14));
    expect(l.cut).toBe(false);
  });

  it('shrinks a one-line box before cutting, as before', () => {
    // 40 chars at 6pt = 120pt wide; the box is 100pt wide and one line high.
    const l = layoutText('A'.repeat(20) + ' ' + 'B'.repeat(19), 100, 12, measure);
    expect(l.size).toBe(6);
    expect(l.lines).toHaveLength(1);
    expect(l.lines[0].endsWith('…')).toBe(true);
    expect(l.cut).toBe(true);
  });

  it('wraps long text over the lines a tall box holds', () => {
    const text = 'Own full-cycle recruitment across assigned roles from intake to offer';
    const l = layoutText(text, 120, 60, measure);
    expect(l.lines.length).toBeGreaterThan(1);
    expect(l.cut).toBe(false);
    expect(l.lines.join(' ')).toBe(text);
    for (const line of l.lines) expect(measure(line, l.size)).toBeLessThanOrEqual(120);
    expect(l.lines.length * l.size * 1.2).toBeLessThanOrEqual(60.01);
  });

  it('keeps the line breaks the value has', () => {
    const l = layoutText('First duty\nSecond duty\n\nThird duty', 300, 80, measure);
    expect(l.lines).toEqual(['First duty', 'Second duty', '', 'Third duty']);
  });

  it('cuts with an ellipsis when even 6pt is too big', () => {
    const l = layoutText(Array.from({ length: 40 }, (_, i) => `word${i}`).join(' '), 60, 20, measure);
    expect(l.size).toBe(6);
    expect(l.cut).toBe(true);
    expect(l.lines.length).toBe(Math.floor(20 / 7.2));
    expect(l.lines[l.lines.length - 1].endsWith('…')).toBe(true);
  });

  it('respects a chosen size while it fits', () => {
    const l = layoutText('Short', 200, 30, measure, 14);
    expect(l.size).toBe(14);
  });

  it('breaks a word longer than the box', () => {
    expect(wrapAt('Supercalifragilistic', 6, 30, measure)).toEqual(['Supercalif', 'ragilistic']);
  });
});
