import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  useEffect(() => {
    const title = 'Virgilio Privacy Policy'
    const description = 'Learn how Virgilio collects, uses, and protects your data. Google Sign-In only for account creation. No email/calendar access yet.'
    document.title = title

    const existingDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (existingDesc) {
      existingDesc.content = description
    } else {
      const m = document.createElement('meta')
      m.name = 'description'
      m.content = description
      document.head.appendChild(m)
    }

    const canonicalHref = `${window.location.origin}/privacy`
    let linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!linkEl) {
      linkEl = document.createElement('link')
      linkEl.rel = 'canonical'
      document.head.appendChild(linkEl)
    }
    linkEl.href = canonicalHref
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-layout-md py-layout-md border-b border-brand">
        <div className="layout-container">
          <h1 className="heading-xl text-primary">Virgilio Privacy Policy</h1>
          <p className="text-sm text-tertiary">Last updated {new Date().toLocaleDateString()}</p>
        </div>
      </header>
      <main className="layout-container px-layout-md py-layout-lg">
        <section className="prose max-w-none">
          <p>
            Virgilio helps recruiters manage hiring processes. We currently use Google Sign-In
            to create and access your account. At this time, we do not access your Gmail or Google
            Calendar; if we add these features in the future, we will request additional consent and
            update this policy.
          </p>
          <h2 className="heading-lg text-primary">Data We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Basic profile information (name, email) from Google to create your account.</li>
            <li>Workspace and usage data you provide in the app to manage recruiting workflows.</li>
          </ul>
          <h2 className="heading-lg text-primary mt-6">How We Use Data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Authenticate you and personalize your workspace.</li>
            <li>Operate core recruiting features and improve the product.</li>
          </ul>
          <h2 className="heading-lg text-primary mt-6">Your Choices</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You may request data access or deletion by contacting support.</li>
            <li>You may disconnect Google access at any time from your account settings.</li>
          </ul>
          <p className="mt-6 text-sm text-secondary">
            For terms governing your use of Virgilio, see our <Link to="/terms" className="underline underline-offset-2">Terms of Service</Link>.
          </p>
        </section>
      </main>
    </div>
  )
}
