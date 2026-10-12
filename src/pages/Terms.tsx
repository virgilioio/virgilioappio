import { A, B, H2, LEGAL_ADDRESS, LegalPage, Mail, P, PRIVACY_EMAIL, SUPPORT_EMAIL, UL } from '@/components/legal/LegalPage'

/**
 * Terms of Use (2026-10-12). Source: the doc "Gio ATS Privacy Policy and
 * Terms (draft)". Change the text and the effective date together.
 */
export default function Terms() {
  return (
    <LegalPage
      title="Terms of Use"
      metaTitle="Terms of Use · Gio ATS by Virgilio"
      description="The terms for using Gio ATS, Virgilio's recruiting software: careers pages, applications, booking, references and shared links."
      path="/terms"
    >
      <P>
        These terms apply when you use Gio ATS, the recruiting software of Virgilio Technologies LLC, {LEGAL_ADDRESS}{' '}
        (&ldquo;Virgilio&rdquo;, &ldquo;we&rdquo;). That includes our careers pages and job applications, interview
        booking pages, candidate chat, reference requests and the candidate and pipeline links we share with clients.
        By using any of them you agree to these terms. Our <A href="/privacy">Privacy Policy</A> explains how we handle
        personal information.
      </P>
      <P>
        If you have a signed agreement with Virgilio (a client services agreement or an independent contractor
        agreement), that agreement wins where it differs from these terms.
      </P>

      <H2 id="applying">1. Applying and booking</H2>
      <UL>
        <li>Give accurate information about yourself, and only submit a résumé or details that are yours.</li>
        <li>Applying does not guarantee an interview or an offer. Hiring decisions belong to Virgilio and our clients.</li>
        <li>You let us store, use and share what you submit to consider you for roles, as described in the Privacy Policy.</li>
        <li>Some roles are filled for clients. We tell you who the employer is before we share your profile with them.</li>
      </UL>

      <H2 id="references">2. References</H2>
      <P>
        If you name referees, you confirm they agreed to be contacted. If you answer as a referee, answer honestly and
        only about what you know first-hand. You can decline at any time.
      </P>

      <H2 id="client-links">3. Links we share with clients</H2>
      <P>
        Candidate profiles, pipelines and reports we share with you contain personal information given to us in
        confidence. Use them only to evaluate candidates for the role we are working on together. Do not forward,
        download in bulk, copy into other systems or contact candidates outside the process without our agreement.
        Links expire, and we can revoke them at any time.
      </P>

      <H2 id="team">4. Our team</H2>
      <P>If you sign in to Gio ATS as a Virgilio employee or contractor:</P>
      <UL>
        <li>Keep your account to yourself, and use a strong password or Google sign-in.</li>
        <li>Use candidate, client and referee data only for Virgilio&rsquo;s work, and keep it confidential during and after your work with us.</li>
        <li>Do not export data or copy it into personal tools without approval.</li>
        <li>
          When you collect profiles (including with the Gio browser extension), collect only professional information
          relevant to a search, and respect the terms of the sites you collect from.
        </li>
        <li>Review AI output before you rely on it. AI suggestions can be wrong and never replace your judgment.</li>
        <li>
          When you connect Google, Gio ATS acts on your behalf with the permissions you grant. Disconnect it when you
          stop working with us.
        </li>
      </UL>

      <H2 id="not-allowed">5. Things nobody may do</H2>
      <UL>
        <li>Break the law or anyone&rsquo;s rights, including privacy and anti-discrimination laws.</li>
        <li>Try to reach data or accounts that are not yours, probe for weaknesses, or get around limits or security.</li>
        <li>Scrape, overload or reverse-engineer Gio ATS.</li>
        <li>Upload malware, or content that is unlawful, harassing or misleading.</li>
        <li>Pose as someone else.</li>
      </UL>

      <H2 id="ownership">6. Ownership</H2>
      <P>
        Gio ATS, its design and its code belong to Virgilio. You keep ownership of what you submit, and give us the
        rights we need to use it as these terms and the Privacy Policy describe.
      </P>

      <H2 id="ai">7. AI features</H2>
      <P>
        Some content in Gio ATS is produced by AI, including summaries, fit suggestions, draft scorecards, draft emails
        and some chat replies. It may contain mistakes. People at Virgilio make the decisions.
      </P>

      <H2 id="availability">8. Availability</H2>
      <P>
        We work to keep Gio ATS available and secure, but we provide it as it is, without promises that it will always
        be available or error-free. We may change or stop any feature.
      </P>

      <H2 id="liability">9. Liability</H2>
      <P>
        To the extent the law allows, Virgilio is not liable for indirect or consequential losses, or for lost profits,
        data or opportunities, from using Gio ATS. Nothing in these terms limits liability that cannot be limited by
        law, or rights you have as a consumer where you live.
      </P>

      <H2 id="suspension">10. Suspension</H2>
      <P>We may suspend access or revoke a link if these terms are broken or to protect candidates, clients or our systems.</P>

      <H2 id="law">11. Law and disputes</H2>
      <P>
        These terms are governed by the laws of the State of Delaware, USA. Disputes go to the state or federal courts
        in Delaware, unless the law where you live gives you the right to bring them at home.
      </P>

      <H2 id="changes">12. Changes and contact</H2>
      <P>
        We will post changes here and update the effective date. Questions: <Mail to={SUPPORT_EMAIL} />. Privacy
        questions: <Mail to={PRIVACY_EMAIL} />. <B>Virgilio Technologies LLC</B>, {LEGAL_ADDRESS}.
      </P>
    </LegalPage>
  )
}
