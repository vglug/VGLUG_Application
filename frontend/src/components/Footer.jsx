import { useState } from 'react'
import { api } from '../api/client'
import { useSite } from '../context/SiteContext'
import { SmartLink } from './Header'
import Icon, { PLATFORM_LABELS, SocialIcon } from './Icon'

function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [prefs, setPrefs] = useState({ meetups: true, events: true, blogs: true })
  const [website, setWebsite] = useState('')
  const [state, setState] = useState({ status: 'idle', message: '' })

  const submit = async (e) => {
    e.preventDefault()
    setState({ status: 'busy', message: '' })
    try {
      const res = await api.post('/api/subscriptions', { email, ...prefs, website })
      setState({ status: 'done', message: res.data.message })
      setEmail('')
    } catch (err) {
      setState({ status: 'error', message: err.fields?.email || err.fields?.preferences || err.message })
    }
  }

  return (
    <form className="subscribe-form" onSubmit={submit} noValidate>
      <label htmlFor="subscribe-email" className="visually-hidden">Email address</label>
      <div className="row">
        <input
          id="subscribe-email"
          className="input"
          type="email"
          autoComplete="email"
          placeholder="you@example.org"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={state.status === 'error'}
          aria-describedby="subscribe-msg"
        />
        <button className="btn" type="submit" disabled={state.status === 'busy' || !email}>
          {state.status === 'busy' ? 'Sending…' : 'Sign up'}
        </button>
      </div>
      <fieldset className="prefs">
        <legend className="visually-hidden">Send me updates about</legend>
        {Object.keys(prefs).map((k) => (
          <label className="check" key={k}>
            <input type="checkbox" checked={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />
            {k[0].toUpperCase() + k.slice(1)}
          </label>
        ))}
      </fieldset>
      <div className="hp-field" aria-hidden="true">
        <label>
          Leave this empty
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      <p id="subscribe-msg" className={`msg${state.status === 'error' ? ' err' : ''}`} role="status" aria-live="polite">
        {state.message}
      </p>
    </form>
  )
}

/** Full-width email sign-up band shown above the footer when subscriptions are available. */
export function NewsletterBand() {
  const site = useSite()
  if (!site?.data?.features?.subscriptions) return null
  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <div className="container">
        <div>
          <h2 id="newsletter-title">Stay in the loop</h2>
          <p>Get an email when we announce new meetups, events and articles. No spam — unsubscribe any time.</p>
        </div>
        <SubscribeForm />
      </div>
    </section>
  )
}

export default function Footer() {
  const site = useSite()
  const footer = site?.data?.footer
  const links = site?.data?.footer_links || []
  const socials = footer?.social_links || []
  const year = new Date().getFullYear()
  const hasContact = footer?.email || footer?.phone || footer?.address || footer?.registration_id

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <img className="footer-logo" src="/vglug-logo-192.png" alt="" width="88" height="88" loading="lazy" />
            <h2>{footer?.short_name || 'VGLUG Foundation'}</h2>
            <p>{footer?.description || footer?.org_name || 'Viluppuram GNU/Linux Users Group'}</p>
          </div>

          {links.length > 0 && (
            <nav aria-label="Footer">
              <h2 className="footer-heading">Explore</h2>
              <ul className="footer-links">
                {links.map((l) => (
                  <li key={l.id}>
                    <SmartLink item={l}>{l.label}</SmartLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div>
            <h2 className="footer-heading">Connect</h2>
            {hasContact && (
              <ul className="footer-contact">
                {footer.phone && (
                  <li><Icon name="phone" /><a href={`tel:${footer.phone.replace(/[^+\d]/g, '')}`}>{footer.phone}</a></li>
                )}
                {footer.email && (
                  <li><Icon name="mail" /><a href={`mailto:${footer.email}`}>{footer.email}</a></li>
                )}
                {footer.address && (
                  <li><Icon name="pin" /><span style={{ whiteSpace: 'pre-line' }}>{footer.address}</span></li>
                )}
                {footer.registration_id && (
                  <li><Icon name="file" /><span>Registration: {footer.registration_id}</span></li>
                )}
              </ul>
            )}
            {socials.length > 0 && (
              <ul className="socials" aria-label="Social media">
                {socials.map((s) => {
                  const name = s.label || PLATFORM_LABELS[s.platform] || s.platform
                  return (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${name} (opens in a new tab)`} title={name}>
                        <SocialIcon platform={s.platform} />
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <h2 className="footer-heading">Support our work</h2>
            {footer?.donation_qr ? (
              <div className="donate">
                <img src={footer.donation_qr.url} alt={footer.donation_qr_alt || 'Donation QR code'} width="132" height="132" loading="lazy" />
                {footer.donation_text && <p>{footer.donation_text}</p>}
              </div>
            ) : (
              <ul className="footer-links">
                <li><SmartLink item={{ url: '/join' }}>Volunteer with us</SmartLink></li>
                <li><SmartLink item={{ url: '/meetups' }}>Attend a meetup</SmartLink></li>
                <li><SmartLink item={{ url: '/contact' }}>Get in touch</SmartLink></li>
              </ul>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {year} {footer?.copyright_text || 'Viluppuram GNU/Linux Users Group (VGLUG)'}</span>
          <span>Built with free software.</span>
        </div>
      </div>
    </footer>
  )
}
