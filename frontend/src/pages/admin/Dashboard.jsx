import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { ErrorState, Loading } from '../../components/States'
import { AdminHeader, StatusBadge } from '../../components/admin/ui'
import { useApi } from '../../hooks/useApi'
import { TYPE_META } from '../../lib/format'

const PAGE_LABELS = { home: 'Home', about: 'About Us', join: 'Join Us', contact: 'Contact Us' }

export default function Dashboard() {
  const res = useApi('/api/admin/dashboard')
  const d = res.data

  return (
    <>
      <AdminHeader eyebrow="Overview" title="Dashboard" actions={
        <>
          <Link className="btn btn-outline" to="/admin/content/meetup/new"><Icon name="plus" /> New meetup</Link>
          <Link className="btn btn-outline" to="/admin/content/event/new"><Icon name="plus" /> New event</Link>
          <Link className="btn" to="/admin/content/blog/new"><Icon name="plus" /> New blog</Link>
        </>
      } />
      <div className="admin-body">
        {res.loading ? <Loading /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : (
          <>
            <div className="stat-grid">
              {['meetup', 'event', 'blog'].map((t) => {
                const c = d.content[t] || { draft: 0, published: 0, archived: 0 }
                return (
                  <Link className="stat-tile" key={t} to={`/admin/content/${t}`}>
                    <div className="k">{TYPE_META[t].plural}</div>
                    <div className="v">{c.published}</div>
                    <div className="d">published · {c.draft} draft · {c.archived} archived</div>
                  </Link>
                )
              })}
              <Link className="stat-tile" to="/admin/comments">
                <div className="k">Comments awaiting review</div>
                <div className="v">{d.pending_comments}</div>
                <div className="d">{d.pending_comments ? 'Review now →' : 'All caught up'}</div>
              </Link>
              <Link className="stat-tile" to="/admin/subscribers">
                <div className="k">Email subscribers</div>
                <div className="v">{d.subscribers.active || 0}</div>
                <div className="d">active · {d.subscribers.pending || 0} awaiting confirmation</div>
              </Link>
            </div>

            <div className="panel">
              <div className="panel-head"><h2>Site pages</h2><Link to="/admin/pages" className="btn btn-sm btn-outline">Manage pages</Link></div>
              <div className="panel-body">
                {d.pages.some((p) => p.status !== 'published') && (
                  <div className="notice notice-info">
                    <p>Initial page content was generated from VGLUG’s official information. Review each draft and publish it when it is ready.</p>
                  </div>
                )}
                <ul className="checklist">
                  {d.pages.map((p) => (
                    <li key={p.key}>
                      <span><strong>{PAGE_LABELS[p.key]}</strong> <span className="muted">— {p.title}</span></span>
                      <span style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <StatusBadge status={p.status} />
                        <Link className="btn btn-sm btn-outline" to={`/admin/pages/${p.key}`}>{p.status === 'published' ? 'Edit' : 'Review'}</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2>Email notifications</h2></div>
              <div className="panel-body">
                <dl className="kv">
                  <dt>Subscriptions</dt><dd>{d.email.subscriptions_enabled ? 'Enabled' : 'Disabled'}</dd>
                  <dt>Delivery</dt><dd>{d.email.backend}{d.email.ready ? '' : ' — not configured'}</dd>
                  <dt>Queue</dt><dd>{d.outbox.pending || 0} pending · {d.outbox.sent || 0} sent · {d.outbox.failed || 0} failed</dd>
                </dl>
                {!d.email.ready && (
                  <div className="notice notice-warning" style={{ marginTop: 'var(--space-4)' }}>
                    <p>Email delivery is not configured. Publishing still works; announcements are simply not sent. See the README for SMTP settings.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
