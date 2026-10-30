import { Link } from 'react-router-dom'
import { isExternal } from '../lib/format'
import Html from './Html'
import Icon from './Icon'

function ItemLink({ url, children, className }) {
  if (!url) return null
  if (isExternal(url)) {
    return (
      <a href={url} className={className} target="_blank" rel="noopener noreferrer">
        {children}
        <span className="visually-hidden"> (opens in a new tab)</span>
      </a>
    )
  }
  return <Link to={url} className={className}>{children}</Link>
}

function SectionHead({ heading, id }) {
  if (!heading) return null
  return (
    <div className="section-head">
      <div>
        <span className="section-kicker" aria-hidden="true" />
        <h2 id={id}>{heading}</h2>
      </div>
    </div>
  )
}

function SectionBody({ section }) {
  const { layout, items } = section
  if (layout === 'stats') {
    return (
      <div className="stats">
        {items.map((it, i) => (
          <div className="stat" key={i}>
            <div className="stat-value">{it.title}</div>
            <p className="stat-label">{it.subtitle}</p>
            {it.body_html && <Html html={it.body_html} />}
          </div>
        ))}
      </div>
    )
  }
  if (layout === 'cards') {
    return (
      <div className="card-grid">
        {items.map((it, i) => (
          <article className="info-card" key={i}>
            <span className="num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <h3>{it.title}</h3>
            {it.subtitle && <div className="sub">{it.subtitle}</div>}
            <Html html={it.body_html} />
            <ItemLink url={it.url} className="text-link">Learn more <Icon name="arrow" /></ItemLink>
          </article>
        ))}
      </div>
    )
  }
  if (layout === 'features') {
    return (
      <div className="features">
        {items.map((it, i) => (
          <article className="feature" key={i}>
            <div className="feature-art" aria-hidden="true">
              <span className="feature-num">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div>
              {it.subtitle && <div className="sub">{it.subtitle}</div>}
              <h3>{it.title}</h3>
              <Html html={it.body_html} />
              <ItemLink url={it.url} className="text-link">Learn more <Icon name="arrow" /></ItemLink>
            </div>
          </article>
        ))}
      </div>
    )
  }
  if (layout === 'links') {
    return (
      <div className="link-row">
        {items.map((it, i) => {
          const content = (
            <>
              <span className="name">{it.title}{it.url && <Icon name={isExternal(it.url) ? 'external' : 'arrow'} />}</span>
              {it.subtitle && <span className="meta">{it.subtitle}</span>}
            </>
          )
          return it.url ? <ItemLink key={i} url={it.url}>{content}</ItemLink> : <div key={i}>{content}</div>
        })}
      </div>
    )
  }
  if (layout === 'list') {
    return (
      <ol className={`check-list${items.length > 5 ? ' two-col' : ''}`}>
        {items.map((it, i) => (
          <li key={i}>
            <span className="idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <strong>{it.title}</strong>
              {it.subtitle && <span className="muted">{it.subtitle}</span>}
              <Html html={it.body_html} />
            </div>
          </li>
        ))}
      </ol>
    )
  }
  if (layout === 'awards') {
    return (
      <ul className="awards">
        {items.map((it, i) => (
          <li className="award" key={i}>
            <div className="award-year">
              <span>{it.subtitle}</span>
              <Icon name="award" />
            </div>
            <h3>{it.title}</h3>
            <Html html={it.body_html} />
          </li>
        ))}
      </ul>
    )
  }
  return null
}

/** Renders admin-managed page sections. `altStart` decides which sections get the peach band. */
export default function PageSections({ sections, altStart = 1 }) {
  return sections.map((section, i) => {
    const id = section.anchor || `section-${section.id ?? i}`
    const headingId = `${id}-title`
    const alt = (i + altStart) % 2 === 0
    const labelled = section.heading ? headingId : undefined

    if (section.layout === 'callout') {
      return (
        <section className="section" key={section.id ?? i} id={id} aria-labelledby={labelled}>
          <div className="container">
            <div className="callout">
              {section.heading && <h2 id={headingId}>{section.heading}</h2>}
              <Html html={section.body_html} />
            </div>
          </div>
        </section>
      )
    }

    // Plain text sections use an editorial split: heading on the left, text on the right.
    if (section.layout === 'prose') {
      return (
        <section className={`section${alt ? ' section-alt' : ''}`} key={section.id ?? i} id={id} aria-labelledby={labelled}>
          <div className="container split">
            <SectionHead heading={section.heading} id={headingId} />
            <Html html={section.body_html} />
          </div>
        </section>
      )
    }

    return (
      <section className={`section${alt ? ' section-alt' : ''}`} key={section.id ?? i} id={id} aria-labelledby={labelled}>
        <div className="container">
          <SectionHead heading={section.heading} id={headingId} />
          {section.body_html && (
            <div className="section-body">
              <Html html={section.body_html} />
            </div>
          )}
          <SectionBody section={section} />
        </div>
      </section>
    )
  })
}
