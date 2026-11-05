import { Link } from 'react-router-dom'
import ContentCard from '../../components/ContentCard'
import Html from '../../components/Html'
import Icon from '../../components/Icon'
import PageSections from '../../components/PageSections'
import { CardSkeletons, EmptyState, ErrorState } from '../../components/States'
import { useApi, useDocumentTitle } from '../../hooks/useApi'
import { isExternal } from '../../lib/format'

const EXPLORE = [
  { to: '/meetups', label: 'Meetups', glyph: 'Weekly · open to all', text: 'Technical sessions and discussions for students, professionals and free software contributors.' },
  { to: '/events', label: 'Events', glyph: 'Workshops & camps', text: 'Software Freedom Day, Education Freedom Day, summer and winter camps, exhibitions and more.' },
  { to: '/blogs', label: 'Blogs', glyph: 'Stories & updates', text: 'Technical and community articles from the VGLUG community.' },
]

function ExploreSection() {
  return (
    <section className="section" aria-labelledby="explore-title">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-kicker" aria-hidden="true" />
            <h2 id="explore-title">Explore</h2>
          </div>
        </div>
        <div className="explore-grid">
          {EXPLORE.map((e) => (
            <Link key={e.to} to={e.to} className="explore-card">
              <span className="glyph">{e.glyph}</span>
              <div>
                <h3>{e.label}</h3>
                <p>{e.text}</p>
              </div>
              <span className="go" aria-hidden="true"><Icon name="arrow" /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function Latest({ type, title, href, query, emptyText, alt }) {
  const res = useApi(`/api/content?type=${type}&per_page=3${query || ''}`)
  return (
    <section className={`section${alt ? ' section-alt' : ''}`} aria-labelledby={`latest-${type}`}>
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-kicker" aria-hidden="true" />
            <h2 id={`latest-${type}`}>{title}</h2>
          </div>
          <Link to={href} className="text-link" style={{ marginTop: 0 }}>
            View all <Icon name="arrow" />
          </Link>
        </div>
        {res.loading ? (
          <CardSkeletons />
        ) : res.error ? (
          <ErrorState error={res.error} onRetry={res.reload} />
        ) : res.data.length === 0 ? (
          <EmptyState title={emptyText.title}>
            <p>{emptyText.body}</p>
          </EmptyState>
        ) : (
          <div className="content-grid">
            {res.data.map((item) => <ContentCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function CtaLink({ url, label, className }) {
  if (isExternal(url)) {
    return <a className={className} href={url} target="_blank" rel="noopener noreferrer">{label} <Icon name="external" /></a>
  }
  return <Link className={className} to={url}>{label} <Icon name="arrow" /></Link>
}

export default function HomePage() {
  const page = useApi('/api/pages/home')
  useDocumentTitle('Home')
  const data = page.data
  const sections = data?.sections || []
  const stats = sections[0]?.layout === 'stats' ? sections[0] : null
  const rest = stats ? sections.slice(1) : sections
  const split = rest.findIndex((s) => s.anchor === 'what-we-do')
  const before = split >= 0 ? rest.slice(0, split + 1) : rest
  const after = split >= 0 ? rest.slice(split + 1) : []

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-inner">
          <div>
            {page.loading ? (
              <div aria-hidden="true">
                <div className="skeleton" style={{ height: 18, width: 260, marginBottom: 24 }} />
                <div className="skeleton" style={{ height: 180, maxWidth: 640, marginBottom: 24 }} />
                <div className="skeleton" style={{ height: 80, maxWidth: 560 }} />
              </div>
            ) : (
              <>
                <p className="eyebrow">{data?.eyebrow || 'VGLUG Foundation'}</p>
                <h1 id="hero-title">{data?.title || 'Viluppuram GNU/Linux Users Group'}</h1>
                {data?.intro_html ? (
                  <Html html={data.intro_html} className="lead" />
                ) : (
                  <p className="lead">A non-profit Free and Open Source Software community.</p>
                )}
                <div className="hero-actions">
                  {data?.cta_url && <CtaLink url={data.cta_url} label={data.cta_label} className="btn btn-lg" />}
                  <Link to="/meetups" className="btn btn-outline btn-lg">Upcoming meetups</Link>
                </div>
              </>
            )}
          </div>
          <figure className="emblem" style={{ margin: 0 }}>
            <img src="/vglug-logo-512.png" alt="VGLUG Foundation logo" width="440" height="440" fetchPriority="high" />
          </figure>
        </div>
      </section>

      {stats && (
        <section className="stats-band" aria-labelledby="stats-title">
          <div className="container">
            <h2 id="stats-title" className="visually-hidden">{stats.heading || 'Our impact'}</h2>
            <div className="stats">
              {stats.items.map((it, i) => (
                <div className="stat" key={i}>
                  <div className="stat-value">{it.title}</div>
                  <p className="stat-label">{it.subtitle}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <PageSections sections={before} altStart={0} />
      <ExploreSection />
      <PageSections sections={after} altStart={0} />

      <Latest alt type="meetup" title="Upcoming meetups" href="/meetups" query="&when=upcoming"
        emptyText={{ title: 'No upcoming meetups announced yet', body: 'New community meetups will appear here as soon as they are published.' }} />
      <Latest type="event" title="Upcoming events" href="/events" query="&when=upcoming"
        emptyText={{ title: 'No upcoming events announced yet', body: 'Workshops, camps and celebrations will appear here when they are published.' }} />
      <Latest alt type="blog" title="Latest from the blog" href="/blogs"
        emptyText={{ title: 'No articles yet', body: 'Technical and community articles will appear here once published.' }} />
    </>
  )
}
