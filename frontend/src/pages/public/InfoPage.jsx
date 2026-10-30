import { Link } from 'react-router-dom'
import Html from '../../components/Html'
import Icon, { PLATFORM_LABELS, SocialIcon } from '../../components/Icon'
import PageSections from '../../components/PageSections'
import { EmptyState, ErrorState, Loading } from '../../components/States'
import { useSite } from '../../context/SiteContext'
import { useApi, useDocumentTitle } from '../../hooks/useApi'
import { isExternal } from '../../lib/format'

const FALLBACK_TITLES = { about: 'About Us', join: 'Join Us', contact: 'Contact Us' }

function ContactDetails() {
  const site = useSite()
  const f = site?.data?.footer
  if (!f) return null
  const items = [
    f.email && { icon: 'mail', label: 'Email', value: <a href={`mailto:${f.email}`}>{f.email}</a> },
    f.phone && { icon: 'phone', label: 'Coordinator', value: <a href={`tel:${f.phone.replace(/[^+\d]/g, '')}`}>{f.phone}</a> },
    f.address && { icon: 'pin', label: 'Address', value: f.address },
    f.registration_id && { icon: 'file', label: 'Registration', value: f.registration_id },
  ].filter(Boolean)

  return (
    <section className="section" aria-labelledby="contact-details">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-kicker" aria-hidden="true" />
            <h2 id="contact-details">Contact details</h2>
          </div>
        </div>
        {items.length || f.social_links?.length ? (
          <>
          <div className="contact-grid">
            {items.map((it) => (
              <div className="contact-item" key={it.label}>
                <div className="label"><Icon name={it.icon} />{it.label}</div>
                <div className="value">{it.value}</div>
              </div>
            ))}
          </div>
          {f.social_links?.length > 0 && (
            <ul className="contact-socials" aria-label="Social media">
              {f.social_links.map((sl) => (
                <li key={sl.id}>
                  <a href={sl.url} target="_blank" rel="noopener noreferrer">
                    <SocialIcon platform={sl.platform} /> {sl.label || PLATFORM_LABELS[sl.platform]}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          </>
        ) : (
          <EmptyState title="Contact details coming soon" glyph="[@]">
            <p>Official contact details will be published here shortly. Meanwhile, you are welcome to meet us at a community meetup.</p>
          </EmptyState>
        )}
      </div>
    </section>
  )
}

export default function InfoPage({ pageKey }) {
  const page = useApi(`/api/pages/${pageKey}`)
  useDocumentTitle(page.data?.title || FALLBACK_TITLES[pageKey])

  if (page.loading) {
    return <div className="container status-page"><Loading /></div>
  }
  if (page.error) {
    if (page.error.status === 404) {
      return (
        <>
          <div className="container status-page">
            <EmptyState title={`${FALLBACK_TITLES[pageKey]} — coming soon`} glyph="[~]">
              <p>This page is being prepared and will be available shortly.</p>
              <Link to="/" className="btn">Back to home</Link>
            </EmptyState>
          </div>
          {pageKey === 'contact' && <ContactDetails />}
        </>
      )
    }
    return <div className="container status-page"><ErrorState error={page.error} onRetry={page.reload} /></div>
  }

  const p = page.data
  const cta = p.cta_url ? (
    isExternal(p.cta_url) ? (
      <a className="btn btn-lg" href={p.cta_url} target="_blank" rel="noopener noreferrer">
        {p.cta_label} <Icon name="external" /><span className="visually-hidden"> (opens in a new tab)</span>
      </a>
    ) : (
      <Link className="btn btn-lg" to={p.cta_url}>{p.cta_label} <Icon name="arrow" /></Link>
    )
  ) : null

  return (
    <>
      <header className="page-header">
        <div className="container">
          {p.eyebrow && <p className="eyebrow">{p.eyebrow}</p>}
          <h1>{p.title}</h1>
          <Html html={p.intro_html} className="lead" />
          {cta && <div className="hero-actions">{cta}</div>}
        </div>
      </header>
      {pageKey === 'contact' && <ContactDetails />}
      <PageSections sections={p.sections} altStart={pageKey === 'contact' ? 0 : 1} />
      {cta && pageKey === 'join' && (
        <section className="section">
          <div className="container" style={{ textAlign: 'center' }}>
            <h2>Ready to take part?</h2>
            {cta}
          </div>
        </section>
      )}
    </>
  )
}
