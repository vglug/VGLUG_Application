import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, qs } from '../../api/client'
import Icon from '../../components/Icon'
import { showToast } from '../../components/Interactions'
import { EmptyState, ErrorState, Loading } from '../../components/States'
import { AdminHeader, StatusBadge, useConfirm } from '../../components/admin/ui'
import { useApi } from '../../hooks/useApi'
import { TYPE_META, eventRange, formatDate } from '../../lib/format'

export default function ContentList() {
  const { type } = useParams()
  const meta = TYPE_META[type]
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const q = params.get('q') || ''
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState(q)
  const res = useApi(meta ? `/api/admin/content/${type}${qs({ status, q, page })}` : null)
  const confirm = useConfirm()

  if (!meta) return <div className="admin-body"><EmptyState title="Unknown content type" /></div>

  const set = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const remove = async (item) => {
    const ok = await confirm({
      title: `Delete “${item.title}”?`,
      message: 'This permanently deletes the item, its likes and comments, and any media used only by it. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return
    try {
      await api.del(`/api/admin/content/${type}/${item.id}`)
      showToast(`Deleted “${item.title}”`)
      res.reload()
    } catch (err) {
      showToast(err.message)
    }
  }

  return (
    <>
      <AdminHeader eyebrow="Content" title={meta.plural} actions={
        <Link className="btn" to={`/admin/content/${type}/new`}><Icon name="plus" /> New {meta.label.toLowerCase()}</Link>
      } />
      <div className="admin-body">
        <div className="filters">
          <form className="search-box" role="search" onSubmit={(e) => { e.preventDefault(); set({ q: search.trim() }) }}>
            <label htmlFor="admin-q" className="visually-hidden">Search</label>
            <input id="admin-q" className="input" type="search" placeholder="Search title or slug…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn btn-icon" aria-label="Search"><Icon name="search" /></button>
          </form>
          <div className="tabs" role="tablist" aria-label="Filter by status">
            {[['', 'All'], ['draft', 'Drafts'], ['published', 'Published'], ['archived', 'Archived']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={status === k} onClick={() => set({ status: k })}>{l}</button>
            ))}
          </div>
        </div>

        {res.loading ? <Loading /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : res.data.length === 0 ? (
          <EmptyState title={q || status ? 'Nothing matches these filters' : `No ${meta.plural.toLowerCase()} yet`}>
            <p>Create the first one to get started.</p>
            <Link className="btn" to={`/admin/content/${type}/new`}>New {meta.label.toLowerCase()}</Link>
          </EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Status</th>
                    <th scope="col">{type === 'blog' ? 'Published' : 'When'}</th>
                    <th scope="col">Engagement</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {res.data.map((item) => (
                    <tr key={item.id}>
                      <td className="title-cell">
                        <Link to={`/admin/content/${type}/${item.id}`}>{item.title}</Link>
                        <div className="sub">/{meta.path}/{item.id}-{item.slug}</div>
                      </td>
                      <td><StatusBadge status={item.status} /></td>
                      <td className="sub">{item.event ? eventRange(item.event) : formatDate(item.published_at) || '—'}</td>
                      <td className="sub">
                        ♥ {item.like_count} · {item.comment_count} comments
                        {item.pending_comments > 0 && <> · <Link to="/admin/comments">{item.pending_comments} pending</Link></>}
                      </td>
                      <td>
                        <div className="row-actions">
                          {item.status === 'published' && (
                            <a className="btn btn-ghost btn-sm" href={item.path} target="_blank" rel="noopener noreferrer" aria-label={`View “${item.title}” on the site`}>
                              <Icon name="eye" />
                            </a>
                          )}
                          <Link className="btn btn-outline btn-sm" to={`/admin/content/${type}/${item.id}`}><Icon name="edit" /> Edit</Link>
                          <button className="btn btn-ghost btn-sm" onClick={() => remove(item)} aria-label={`Delete “${item.title}”`}><Icon name="trash" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {res.meta.pages > 1 && (
              <div className="pagination">
                <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Previous</button>
                <span className="page-info">{page} / {res.meta.pages}</span>
                <button className="btn btn-outline btn-sm" disabled={page >= res.meta.pages} onClick={() => set({ page: String(page + 1) })}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
