import { A, B, H2, LEGAL_ADDRESS, LegalPage, LegalTable, Mail, P, PRIVACY_EMAIL, UL } from '@/components/legal/LegalPage'

/**
 * Privacy Policy (2026-10-12). Written from what Gio ATS actually does; the
 * source and the list of product fixes it depends on are in the doc
 * "Gio ATS Privacy Policy and Terms (draft)". Change the text and the
 * effective date (LEGAL_EFFECTIVE) together.
 */
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      metaTitle="Privacy Policy · Gio ATS by Virgilio"
      description="How Virgilio collects, uses, shares and protects personal information in Gio ATS, and how to exercise your privacy rights."
      path="/privacy"
    >
      <P>
        Virgilio is a recruiting firm that hires sales and go-to-market talent for startups and scaleups. We run our
        searches in Gio ATS, our own recruiting software. This policy explains what personal information we hold about
        you, why, who we share it with, how long we keep it and how to exercise your rights.
      </P>

      <H2 id="who-we-are">1. Who we are</H2>
      <P>
        Virgilio Technologies LLC, a Delaware limited liability company, {LEGAL_ADDRESS} (&ldquo;Virgilio&rdquo;,
        &ldquo;we&rdquo;). We decide how your information is used, so we are its controller. Contact us about privacy
        at <Mail to={PRIVACY_EMAIL} />.
      </P>
      <P>
        Virgilio has no office in the European Union or the United Kingdom and handles personal data from there only
        occasionally, so it has not appointed a representative there.
      </P>

      <H2 id="who-this-covers">2. Who this policy covers</H2>
      <UL>
        <li><B>Candidates:</B> people who apply to a role, people we find and approach, and people others refer to us.</li>
        <li><B>Referees:</B> people a candidate names as a reference.</li>
        <li><B>Client contacts:</B> people at the companies we hire for.</li>
        <li><B>Our team:</B> Virgilio staff and contractors who sign in to Gio ATS.</li>
        <li><B>Visitors</B> to our careers pages, booking pages and shared links.</li>
      </UL>

      <H2 id="what-we-collect">3. What we collect and where it comes from</H2>
      <P>
        <B>From you.</B> Your name, email, phone, location, LinkedIn and other profile links, résumé, work history,
        education, skills, salary expectations, answers to application questions, messages you send us, and the times
        you book with us. Interviews may be transcribed and summarized if the meeting tool sends us a transcript.
      </P>
      <P>
        <B>From public professional sources and data providers.</B> To find people for a search, we look at
        professional profiles you have made public (for example on LinkedIn) and use data providers, currently
        Apollo.io and People Data Labs. They can give us your name, current role and company, past roles, location,
        and work email or phone. We refresh this from time to time so your profile stays current, and we keep a record
        of where each detail came from.
      </P>
      <P>
        <B>From others.</B> Job boards that forward applications to us (such as Talent.com), people who refer you,
        referees you name, and our clients&rsquo; feedback on your candidacy.
      </P>
      <P>
        <B>Equal opportunity questions.</B> Some application forms ask about gender, race or ethnicity, veteran status
        and disability. Answering is optional. Only a few administrators can see the answers, they are used for
        aggregate reporting only, and they never reach the people deciding on your application.
      </P>
      <P>
        <B>Referees.</B> Your name, contact details, company, title, your relationship to the candidate and your
        answers.
      </P>
      <P>
        <B>Our team.</B> Name, work email, title, photo, time zone, and, if you connect it, your Google account (see
        section 10).
      </P>
      <P>
        <B>Technical data.</B> Error reports when something breaks (with on-screen text and media hidden), and, on some
        public links, a hashed browser identifier to stop misuse.
      </P>

      <H2 id="why">4. Why we use it and our legal basis</H2>
      <LegalTable
        head={['What we do', 'Legal basis under GDPR']}
        rows={[
          ['Consider you for roles, contact you about them and run the interview process', 'Our legitimate interest in recruiting, and steps you ask for before a contract'],
          ['Find and approach people for a search using public sources and data providers', 'Our legitimate interest in recruiting, which we balance against your interests; you can object at any time'],
          ['Present your profile to a client for a specific role', 'Our legitimate interest; we tell you before or when we do'],
          ['Ask your referees about you, and keep their answers', 'Your request for a reference check and the referee’s agreement to answer'],
          ['Store optional equal opportunity answers', 'Your explicit consent, given by choosing to answer'],
          ['Run Gio ATS for our team, keep it secure and fix errors', 'Our legitimate interest, and our contract with team members'],
          ['Meet legal obligations and defend legal claims', 'Legal obligation; legitimate interest'],
        ]}
      />
      <P>We do not sell your information, and we do not use it for advertising.</P>

      <H2 id="ai">5. How we use AI</H2>
      <P>
        Gio ATS uses AI to read résumés, write profile summaries, extract skills, suggest how well a profile fits a
        role, draft interview scorecards from transcripts and draft emails. A person at Virgilio reviews these and makes
        every hiring decision. AI never rejects or advances a candidate on its own.
      </P>
      <P>
        Recruiters can also set simple rules that move or close an application automatically, for example when a
        candidate has not replied after several reminders. These rules never use AI scores, and you can ask a person
        to review any decision they make.
      </P>
      <P>
        When we message you through our candidate chat, some replies are written by an AI assistant on the
        recruiter&rsquo;s behalf. You can ask for a person at any time, and sensitive questions go to a person.
      </P>
      <P>
        We send this data to AI providers only to produce these results. Under their business terms they do not use it
        to train their models.
      </P>

      <H2 id="sharing">6. Who we share it with</H2>
      <UL>
        <li>
          <B>Clients</B>, when we put you forward for one of their roles: your profile, résumé, our assessment and, if
          you agreed, references.
        </li>
        <li><B>Service providers</B> that run Gio ATS for us under contract:</li>
      </UL>
      <LegalTable
        head={['Provider', 'What it does', 'Where']}
        rows={[
          ['Supabase', 'Database, sign-in, file storage, server functions', 'United States (Ohio)'],
          ['Lovable', 'Hosts the app; routes some AI requests', 'United States'],
          ['OpenAI', 'AI processing described in section 5', 'United States'],
          ['Google', 'Gmail, Google Calendar and Meet for our team; AI processing through Lovable', 'United States'],
          ['Apollo.io, People Data Labs', 'Professional profile and contact data', 'United States'],
          ['Resend', 'Sends and receives our email', 'United States'],
          ['Sentry', 'Error reports', 'United States'],
          ['Stripe', 'Billing for team accounts', 'United States'],
        ]}
      />
      <UL>
        <li>
          <B>Authorities</B>, when the law requires it, and a buyer if Virgilio is ever sold or merged, under this
          policy.
        </li>
      </UL>

      <H2 id="transfers">7. International transfers</H2>
      <P>
        Our systems are in the United States. When we move personal data out of the European Economic Area, the UK or
        Switzerland, we rely on the European Commission&rsquo;s Standard Contractual Clauses or the EU–US Data Privacy
        Framework where the provider is certified. Ask us for a copy of the safeguards.
      </P>

      <H2 id="retention">8. How long we keep it</H2>
      <UL>
        <li>
          <B>Candidate profiles:</B> 3 years after our last contact with you, then we delete them or ask if you want us
          to keep you in mind.
        </li>
        <li>
          <B>Reference answers and referee details:</B> 24 months after the reference check, or less if the check sets
          a shorter period. If you decline to be a referee, we delete your details after 30 days.
        </li>
        <li><B>Candidate chat:</B> deleted after the conversation closes, on the schedule set for our workspace.</li>
        <li><B>Team accounts:</B> while you work with us, then up to 12 months.</li>
        <li><B>Records we must keep by law:</B> as long as the law requires.</li>
      </UL>

      <H2 id="rights">9. Your rights</H2>
      <P>
        Wherever you live, you can ask us to show you the data we hold about you, correct it, delete it, or stop
        contacting you. Write to <Mail to={PRIVACY_EMAIL} />. We answer within one month and may ask you to confirm
        your identity.
      </P>
      <P>
        <B>In the EU, EEA, UK and Switzerland</B> you also have the right to restrict processing, to receive your data
        in a portable format, to object to processing based on our legitimate interests (including sourcing), to
        withdraw consent at any time, and to complain to your data protection authority.
      </P>
      <P>
        <B>In Mexico</B> you have the ARCO rights under the Federal Law on Protection of Personal Data Held by Private
        Parties: access, rectification, cancellation and opposition. Send your request to <Mail to={PRIVACY_EMAIL} />{' '}
        with your name, a way to reply, a copy of an ID and what you are asking for. We answer within 20 business days.
        You may also go to the federal data protection authority.
      </P>
      <P>
        <B>In US states with privacy laws</B> you have the rights your state grants. We do not sell or share personal
        information for targeted advertising.
      </P>
      <P>
        If we found you through a data provider, we tell you where your information came from when we first contact
        you, and no later than one month after we obtained it.
      </P>

      <H2 id="google">10. Google data</H2>
      <P>
        Team members can connect a Google account so Gio ATS can read and send email with candidates and schedule
        interviews. Gio ATS asks for permission to read, send and label Gmail messages and to read and create Google
        Calendar events. We use this only to show candidate conversations, send the emails you write, and book and
        update interviews. We do not use Google data for advertising or to train AI models, and people at Virgilio read
        it only with your permission, for security, or when the law requires it.
      </P>
      <P>
        Gio ATS&rsquo;s use and transfer of information received from Google APIs adheres to the{' '}
        <A href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</A>,
        including the Limited Use requirements. You can disconnect Google at any time in Gio ATS or in your Google
        account settings.
      </P>

      <H2 id="security">11. Security</H2>
      <P>
        Access to data is limited by role and enforced in the database. Files such as résumés are stored privately.
        Links we share with clients and referees use unguessable, expiring tokens. Google connection tokens are
        encrypted. No system is perfectly secure; if a breach affects you, we will tell you and the authorities as the
        law requires.
      </P>

      <H2 id="cookies">12. Cookies and browser storage</H2>
      <P>
        We use no advertising or analytics cookies. Gio ATS keeps your sign-in session, preferences and some cached
        data in your browser so it works and loads quickly; signing out clears the cached data. Public pages load fonts
        from Google Fonts, which receives your IP address.
      </P>

      <H2 id="children">13. Children</H2>
      <P>Our services are for people of working age. We do not knowingly collect data from anyone under 16.</P>

      <H2 id="changes">14. Changes</H2>
      <P>
        We will post changes here and update the effective date. If a change matters to you, we will tell you before
        it applies.
      </P>

      <H2 id="contact">15. Contact</H2>
      <P>
        Virgilio Technologies LLC, {LEGAL_ADDRESS}, <Mail to={PRIVACY_EMAIL} />. For how you may use Gio ATS, see our{' '}
        <A href="/terms">Terms of Use</A>.
      </P>
    </LegalPage>
  )
}
