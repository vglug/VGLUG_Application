import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ContentCard from '../../components/ContentCard'
import Icon from '../../components/Icon'
import { CardSkeletons, EmptyState, ErrorState } from '../../components/States'
import { qs } from '../../api/client'
import { useApi, useDocumentTitle } from '../../hooks/useApi'
import { TYPE_META } from '../../lib/format'

const INTROS = {
  meetup: {
    eyebrow: 'Explore / Meetups',
    lead: 'Open community meetups and technical learning sessions in Viluppuram for anyone interested in GNU/Linux and Free Software. Everyone is welcome.',
  },
  event: {
    eyebrow: 'Explore / Events',
    lead: 'Workshops, Software Freedom Day, camps, exhibitions and other community events organised by VGLUG.',
  },
  blog: {
    eyebrow: 'Explore / Blogs',
    lead: 'Technical and community articles from the VGLUG community.',
  },
}

export default function ListingPage({ type }) {
  const meta = TYPE_META[type]
  const isEvent = type !== 'blog'
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const q = params.get('q') || ''
  const when = isEvent ? params.get('when') || 'upcoming' : ''
  const [search, setSearch] = useState(q)
  useEffect(() => setSearch(q), [q])
  useDocumentTitle(meta.plural)

  const res = useApi(`/api/content${qs({ type, page, per_page: 12, q, when: when === 'all' ? '' : when })}`)

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const tabs = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
  ]

  return (
    <>
      <header className="page-header">
        <div className="container">
          <p className="eyebrow">{INTROS[type].eyebrow}</p>
          <h1>{meta.plural}</h1>
          <p className="lead">{INTROS[type].lead}</p>
        </div>
      </header>
      <section className="section">
        <div className="container">
          <div className="toolbar">
            <form className="search-box" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }) }}>
              <label htmlFor="list-search" className="visually-hidden">Search {meta.plural.toLowerCase()}</label>
              <input id="list-search" className="input" type="search" placeholder={`Search ${meta.plural.toLowerCase()}…`}
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="btn btn-icon" type="submit" aria-label="Search"><Icon name="search" /></button>
            </form>
            {isEvent && (
              <div className="tabs" role="tablist" aria-label="Filter by date">
                {tabs.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={when === t.key} onClick={() => update({ when: t.key === 'upcoming' ? '' : t.key })}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div aria-live="polite" aria-busy={res.loading}>
            {res.loading ? (
              <CardSkeletons count={6} />
            ) : res.error ? (
              <ErrorState error={res.error} onRetry={res.reload} />
            ) : res.data.length === 0 ? (
              <EmptyState title={q ? `No ${meta.plural.toLowerCase()} match “${q}”` : `No ${when === 'upcoming' ? 'upcoming ' : ''}${meta.plural.toLowerCase()} yet`}>
                <p>
                  {q ? 'Try a different search term.' : when === 'upcoming'
                    ? `New ${meta.plural.toLowerCase()} will be announced here. Check past ${meta.plural.toLowerCase()} or subscribe to email updates below.`
                    : 'Published items will appear here.'}
                </p>
                {q && <button className="btn btn-outline" onClick={() => update({ q: '' })}>Clear search</button>}
              </EmptyState>
            ) : (
              <>
                <p className="muted mono" style={{ fontSize: '0.85rem' }}>
                  Showing {res.data.length} of {res.meta.total}
                </p>
                <div className="content-grid">
                  {res.data.map((item) => <ContentCard key={item.id} item={item} headingLevel={2} />)}
                </div>
              </>
            )}
          </div>

          {res.meta?.pages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              <button className="btn btn-outline" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                <Icon name="arrowLeft" /> Previous
              </button>
              <span className="page-info">Page {page} of {res.meta.pages}</span>
              <button className="btn btn-outline" disabled={page >= res.meta.pages} onClick={() => update({ page: String(page + 1) })}>
                Next <Icon name="arrow" />
              </button>
            </nav>
          )}
        </div>
      </section>
    </>
  )
}
