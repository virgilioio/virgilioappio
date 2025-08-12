import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Terms() {
  useEffect(() => {
    const title = 'Virgilio Terms of Service'
    const description = 'Review the Virgilio Terms of Service covering account use, eligibility, and acceptable use. Google Sign-In only at this time.'
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

    const canonicalHref = `${window.location.origin}/terms`
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
          <h1 className="heading-xl text-primary">Virgilio Terms of Service</h1>
          <p className="text-sm text-tertiary">Last updated {new Date().toLocaleDateString()}</p>
        </div>
      </header>
      <main className="layout-container px-layout-md py-layout-lg">
        <section className="prose max-w-none">
          <h2 className="heading-lg text-primary">1. Overview</h2>
          <p>
            These Terms govern your use of Virgilio. By accessing or using the app, you agree to be bound by them.
          </p>
          <h2 className="heading-lg text-primary mt-4">2. Accounts and Access</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must provide accurate information and keep your account secure.</li>
            <li>Sign-in is currently provided via Google Sign-In; we do not access Gmail or Calendar yet.</li>
          </ul>
          <h2 className="heading-lg text-primary mt-4">3. Acceptable Use</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Do not misuse the service, disrupt others, or attempt unauthorized access.</li>
            <li>Comply with all applicable laws and third‑party terms.</li>
          </ul>
          <h2 className="heading-lg text-primary mt-4">4. Privacy</h2>
          <p>
            Please review our <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link> to understand how we handle your data.
          </p>
          <h2 className="heading-lg text-primary mt-4">5. Changes</h2>
          <p>
            We may update these Terms. Continued use constitutes acceptance of any changes.
          </p>
          <h2 className="heading-lg text-primary mt-4">6. Contact</h2>
          <p>
            Questions? Contact our support team.
          </p>
        </section>
      </main>
    </div>
  )
}
