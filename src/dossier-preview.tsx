import { createRoot } from 'react-dom/client'
import printCss from './components/candidates/insights/dossier/dossierPrint.css?inline'
import { DossierPrintDocument } from './components/candidates/insights/dossier/DossierPrintDocument'

const style = document.createElement('style')
style.textContent = printCss + '.gio-page{margin:0 auto 24px;box-shadow:0 2px 12px rgba(0,0,0,.2)}'
document.head.appendChild(style)

const dim = (name: string, score: number | null, weight: number, n = 3) => ({
  name, score, weight,
  insight: `Assessment narrative for ${name}, written at the length Gio usually produces for this dimension.`,
  verdict: 'Core craft is strong, one must-have unresolved',
  matches: Array.from({ length: n }, (_, i) => `Evidence item ${i + 1} for ${name} — Work experience · 2 entries`),
  gaps: [`A gap for ${name} — Job description`],
})

const data = {
  analysis: {
    overall_score: 80,
    confidence: 'medium' as const,
    confidence_reason: 'Two sources missing.',
    profile_summary: 'Ten years in product design, the last six at senior or above, all of it B2B software with technical end users. She works as a senior IC inside a PM/EM/design trio — the same structure this team runs — and has owned three enterprise surfaces from discovery through ship: billing, onboarding, and an internal admin console.',
    executive_summary: 'Strongest signal: She is doing this exact job today, one stage smaller — same title, same IC track, same PM/EM/design trio. Biggest risk: Design-system ownership is required here and appears only as participation — which is what holds the score at 80.',
    dimensions: [dim('Skills Alignment', 60, 30, 4), dim('Experience Level', 90, 20), dim('Role & Title Fit', 92, 15), dim('Location Compatibility', 95, 10), dim('Salary Alignment', null, 10, 2), dim('Language & Communication', 88, 10), dim('Company Pedigree', 85, 5, 2)],
    validation_points: Array.from({ length: 4 }, (_, i) => ({ question: `Have you owned a design system end to end, or contributed to one somebody else owned? (${i + 1})`, reason: 'Resolving it is what lifts the must-have ceiling on this score.', priority: (i < 2 ? 'high' : 'medium') as 'high' | 'medium', suggested_stage: 'Onsite · Day 3' })),
    data_sources_used: ['Résumé'],
    data_sources_missing: [],
    detected_languages: { summary: 'Mixed', confidence: 'high' as const, sources: [{ label: 'Résumé', code: 'es', name: 'Spanish' }, { label: 'Portfolio', code: 'en', name: 'English' }] },
  },
  score: 80,
  candidateName: 'Lena Park',
  roleLine: 'Senior Product Designer at Mercado',
  jobTitle: 'Senior Product Designer',
  location: 'London, UK',
  contactItems: ['lena.park@example.com', '+44 7700 900461', 'linkedin.com/in/lenapark'],
  requiredSkills: ['Product design', 'End-to-end ownership', 'Prototyping', 'User research', 'Interaction design', 'Figma', 'Design system ownership'],
  candidateSkills: ['Product design', 'End-to-end ownership', 'Prototyping', 'User research', 'Interaction design', 'Figma', 'Service design', 'Design ops', 'Accessibility · WCAG 2.2', 'Workshop facilitation', 'Data-informed design', 'Motion'],
  workExperience: [
    { id: '1', job_title: 'Senior Product Designer', company_name: 'Mercado', location: 'London', start_date: '2021-02-01', end_date: null, is_current: true, description: 'Senior IC on the marketplace payouts and dispute surfaces. Led a three-designer pod through a platform replatform and ran the research programme behind the onboarding rebuild — 14 moderated sessions.' },
    { id: '2', job_title: 'Product Designer → Senior', company_name: 'Loop', location: 'London', start_date: '2018-01-01', end_date: '2021-01-01', is_current: false, description: 'Joined at 40 people, stayed through 300. Owned the billing and admin console end to end and was promoted to senior in year two. Contributed to the component library without owning it.' },
    { id: '3', job_title: 'Product Designer', company_name: 'Thicket', location: 'Manchester', start_date: '2015-01-01', end_date: '2018-01-01', is_current: false, description: 'First product role, working across a dev-tools client portfolio. Broad surface exposure, little depth of ownership.' },
  ] as never,
  education: [{ id: 'e1', degree_type: 'BA Graphic Design', institution_name: 'Central Saint Martins', end_date: '2015-06-01' }] as never,
  outputLanguageName: 'English',
  clientReady: new URLSearchParams(location.search).get('mode') === 'client',
  includeContact: true,
  preparedBy: 'Acme Talent',
  preparedOn: '18 September 2026',
}

createRoot(document.getElementById('root')!).render(<DossierPrintDocument data={data as never} />)
