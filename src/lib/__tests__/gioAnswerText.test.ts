import { describe, expect, it } from 'vitest'
import { gioAnswerPlainText } from '../gioAnswerText'

describe('gioAnswerPlainText', () => {
  it('drops the Markdown and keeps headings, bullets and dividers readable', () => {
    const md = [
      'Head of Marketing – Executive Pipeline Snapshot  ',
      '',
      '---',
      '',
      '### 1) Overall funnel',
      '',
      '- Applications: **28**  ',
      '- Rejected: 1 (reason logged: _Cleanup_)',
      '  - Amanda Benoist (Partner Marketing Lead @ Gigs) – $245k/yr',
    ].join('\n')
    expect(gioAnswerPlainText(md)).toBe(
      [
        'Head of Marketing – Executive Pipeline Snapshot',
        '',
        '1) Overall funnel',
        '',
        '• Applications: 28',
        '• Rejected: 1 (reason logged: Cleanup)',
        '  ◦ Amanda Benoist (Partner Marketing Lead @ Gigs) – $245k/yr',
      ].join('\n'),
    )
  })

  it('keeps words with underscores and stars that are not emphasis', () => {
    expect(gioAnswerPlainText('snake_case_name and 5 * 3 = 15')).toBe('snake_case_name and 5 * 3 = 15')
  })

  it('writes links with their address and tables as rows', () => {
    expect(gioAnswerPlainText('See [the job](https://x.y/j).')).toBe('See the job (https://x.y/j).')
    expect(gioAnswerPlainText('| Stage | Count |\n| --- | ---: |\n| Review | 8 |')).toBe('Stage  ·  Count\nReview  ·  8')
  })

  it('numbers stay numbers and blank runs collapse', () => {
    expect(gioAnswerPlainText('1. First\n2. Second\n\n\n\nEnd')).toBe('1. First\n2. Second\n\nEnd')
  })
})
