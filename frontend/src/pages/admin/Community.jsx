import { useState } from 'react'
import { api, qs } from '../../api/client'
import Icon from '../../components/Icon'
import { showToast } from '../../components/Interactions'
import { EmptyState, ErrorState, Loading } from '../../components/States'
import { CATEGORY_OPTIONS, MediaThumb, Uploader } from '../../components/admin/MediaPicker'
import { AdminHeader, Modal, StatusBadge, TextField, useConfirm } from '../../components/admin/ui'
import { useApi } from '../../hooks/useApi'
import { TYPE_META, formatBytes, formatDate } from '../../lib/format'

function Pager({ meta, page, setPage }) {
  if (!meta || meta.pages <= 1) return null
  return (
    <div className="pagination">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span className="page-info">{page} / {meta.pages}</span>
      <button className="btn btn-outline btn-sm" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  )
}

export function CommentsAdmin() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const res = useApi(`/api/admin/comments${qs({ status, page })}`)
  const confirm = useConfirm()

  const moderate = async (c, next) => {
    try {
      await api.patch(`/api/admin/comments/${c.id}`, { status: next })
      showToast(next === 'approved' ? 'Comment approved and visible.' : next === 'rejected' ? 'Comment hidden.' : 'Moved back to pending.')
      res.reload()
    } catch (err) {
      showToast(err.message)
    }
  }
  const remove = async (c) => {
    if (!(await confirm({ title: 'Delete comment?', message: 'This permanently deletes the comment.', confirmLabel: 'Delete', danger: true }))) return
    try {
      await api.del(`/api/admin/comments/${c.id}`)
      showToast('Comment deleted.')
      res.reload()
    } catch (err) {
      showToast(err.message)
    }
  }

  return (
    <>
      <AdminHeader eyebrow="Community" title="Comments" />
      <div className="admin-body">
        <div className="filters">
          <div className="tabs" role="tablist" aria-label="Moderation status">
            {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setPage(1) }}>{l}</button>
            ))}
          </div>
        </div>
        {res.loading ? <Loading /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : res.data.length === 0 ? (
          <EmptyState title={status === 'pending' ? 'No comments awaiting review' : 'No comments here'} glyph="[✓]"><p>New visitor comments appear here for moderation.</p></EmptyState>
        ) : (
          <>
            {res.data.map((c) => (
              <article className="comment-card" key={c.id}>
                <div className="head">
                  <strong>{c.author_name}</strong>
                  <StatusBadge status={c.status} />
                  <span className="muted mono" style={{ fontSize: '0.8rem' }}>{formatDate(c.created_at)}</span>
                  <span className="muted">on {TYPE_META[c.content.type].label.toLowerCase()}{' '}
                    <a href={c.content.path} target="_blank" rel="noopener noreferrer">{c.content.title}</a>
                  </span>
                </div>
                <p className="body">{c.body}</p>
                <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                  {c.status !== 'approved' && <button className="btn btn-sm" onClick={() => moderate(c, 'approved')}><Icon name="check" /> Approve</button>}
                  {c.status !== 'rejected' && <button className="btn btn-outline btn-sm" onClick={() => moderate(c, 'rejected')}><Icon name="close" /> {c.status === 'approved' ? 'Hide' : 'Reject'}</button>}
                  {c.status !== 'pending' && <button className="btn btn-ghost btn-sm" onClick={() => moderate(c, 'pending')}>Back to pending</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(c)}><Icon name="trash" /> Delete</button>
                </div>
              </article>
            ))}
            <Pager meta={res.meta} page={page} setPage={setPage} />
          </>
        )}
      </div>
    </>
  )
}

function EditMedia({ media, onClose, onSaved }) {
  const [form, setForm] = useState({ alt_text: media.alt_text, caption: media.caption })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const save = async () => {
    setBusy(true)
    try {
      await api.patch(`/api/admin/media/${media.id}`, form)
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <Modal title="Edit media details" size="small" onClose={onClose} footer={
      <>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save} disabled={busy}>Save</button>
      </>
    }>
      <div className="media-chooser" style={{ marginBottom: 'var(--space-4)' }}><div className="preview"><MediaThumb media={media} /></div>
        <div className="mono muted" style={{ fontSize: '0.8rem' }}>{media.original_filename}<br />{media.mime_type} · {formatBytes(media.size_bytes)}{media.width ? ` · ${media.width}×${media.height}` : ''}</div>
      </div>
      {error && <p className="error">{error}</p>}
      <TextField label="Alt text" value={form.alt_text} onChange={(v) => setForm({ ...form, alt_text: v })} maxLength={300} hint="Describe the image for people using screen readers." />
      <TextField label="Caption" value={form.caption} onChange={(v) => setForm({ ...form, caption: v })} maxLength={500} />
      <TextField label="URL" value={media.url} readOnly onChange={() => {}} hint="Use in Markdown as ![alt](URL)." />
    </Modal>
  )
}

export function MediaLibrary() {
  const [filter, setFilter] = useState({ category: '', kind: '', page: 1 })
  const [uploadCategory, setUploadCategory] = useState('blogs')
  const list = useApi(`/api/admin/media${qs({ category: filter.category, kind: filter.kind, page: filter.page, per_page: 24 })}`)
  const status = useApi('/api/admin/media/status')
  const [editing, setEditing] = useState(null)
  const confirm = useConfirm()

  const refresh = () => { list.reload(); status.reload() }

  const remove = async (m) => {
    if (!(await confirm({ title: 'Delete this file?', message: `“${m.original_filename}” will be removed from the server permanently.`, confirmLabel: 'Delete', danger: true }))) return
    try {
      await api.del(`/api/admin/media/${m.id}`)
      showToast('File deleted.')
      refresh()
    } catch (err) {
      if (err.code === 'in_use') {
        const where = (err.fields.references || []).map((r) => `${r.title} (${r.usage})`).join(', ')
        await confirm({ title: 'File is in use', message: `Remove it from these places first: ${where}.`, confirmLabel: 'OK' })
      } else showToast(err.message)
    }
  }

  const cleanup = async () => {
    const s = status.data
    if (!(await confirm({ title: 'Remove unused files?', message: `${s.orphans.files} file(s) (${formatBytes(s.orphans.bytes)}) are not used by any content, page or footer and are older than an hour. Delete them?`, confirmLabel: 'Delete unused files', danger: true }))) return
    try {
      const res = await api.post('/api/admin/media/cleanup')
      showToast(`Removed ${res.data.removed} file(s), freed ${formatBytes(res.data.freed_bytes)}.`)
      refresh()
    } catch (err) {
      showToast(err.message)
    }
  }

  const s = status.data
  return (
    <>
      <AdminHeader eyebrow="Content" title="Media library" />
      <div className="admin-body">
        {s && (
          <div className="panel">
            <div className="panel-head">
              <h2>Local storage</h2>
              <span className={`badge ${s.writable ? 'badge-active' : 'badge-failed'}`}>{s.writable ? 'writable' : 'not writable'}</span>
            </div>
            <div className="panel-body">
              <dl className="kv" style={{ marginBottom: 'var(--space-4)' }}>
                <dt>Files</dt><dd>{s.total_files} · {formatBytes(s.total_bytes)}</dd>
                {s.disk && <><dt>Disk</dt><dd>{formatBytes(s.disk.free_bytes)} free of {formatBytes(s.disk.total_bytes)}</dd></>}
                <dt>Folders</dt><dd>{s.categories.length ? s.categories.map((c) => `${c.category}: ${c.files} (${formatBytes(c.bytes)})`).join(' · ') : '—'}</dd>
                <dt>Unused</dt><dd>{s.orphans.files} file(s) · {formatBytes(s.orphans.bytes)}</dd>
              </dl>
              {s.disk && <div className="bar" role="img" aria-label={`Disk ${Math.round((s.disk.used_bytes / s.disk.total_bytes) * 100)}% used`}><span style={{ width: `${(s.disk.used_bytes / s.disk.total_bytes) * 100}%` }} /></div>}
              {s.orphans.files > 0 && (
                <button className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-4)' }} onClick={cleanup}><Icon name="trash" /> Clean up unused files</button>
              )}
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-head"><h2>Upload</h2>
            <label className="check" style={{ fontWeight: 600 }}>Folder
              <select className="select" style={{ width: 'auto', minHeight: 36 }} value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <div className="panel-body"><Uploader category={uploadCategory} onUploaded={(items) => { showToast(`Uploaded ${items.length} file(s).`); refresh() }} /></div>
        </div>

        <div className="filters">
          <div className="field">
            <label htmlFor="ml-cat">Folder</label>
            <select id="ml-cat" className="select" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value, page: 1 })}>
              <option value="">All folders</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ml-kind">Type</label>
            <select id="ml-kind" className="select" value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value, page: 1 })}>
              <option value="">Images and videos</option><option value="image">Images</option><option value="video">Videos</option>
            </select>
          </div>
        </div>
        {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.data.length === 0 ? (
          <EmptyState title="No files" glyph="[img]"><p>Upload images and videos above.</p></EmptyState>
        ) : (
          <>
            <div className="media-grid">
              {list.data.map((m) => (
                <div className="media-tile" key={m.id}>
                  <div className="thumb"><MediaThumb media={m} /></div>
                  <div className="meta">
                    <span className="name" title={m.original_filename}>{m.original_filename}</span>
                    <span className="sub">{m.category} · {formatBytes(m.size_bytes)}</span>
                    <span className="sub">{m.reference_count ? `used ${m.reference_count}×` : 'unused'}{!m.alt_text && m.kind === 'image' ? ' · no alt' : ''}</span>
                  </div>
                  <div className="tile-actions">
                    <button type="button" onClick={() => setEditing(m)} aria-label={`Edit ${m.original_filename}`}>Edit</button>
                    <button type="button" onClick={() => remove(m)} aria-label={`Delete ${m.original_filename}`}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <Pager meta={list.meta} page={filter.page} setPage={(p) => setFilter({ ...filter, page: p })} />
          </>
        )}
      </div>
      {editing && <EditMedia media={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); showToast('Saved.') }} />}
    </>
  )
}

export function Subscribers() {
  const [filter, setFilter] = useState({ status: '', q: '', page: 1 })
  const [search, setSearch] = useState('')
  const res = useApi(`/api/admin/subscribers${qs(filter)}`)
  const dash = useApi('/api/admin/dashboard')
  const confirm = useConfirm()
  const [processing, setProcessing] = useState(false)

  const act = async (s, action) => {
    try {
      if (action === 'delete') {
        if (!(await confirm({ title: 'Delete subscriber?', message: `${s.email} and their pending emails will be removed.`, confirmLabel: 'Delete', danger: true }))) return
        await api.del(`/api/admin/subscribers/${s.id}`)
      } else {
        await api.patch(`/api/admin/subscribers/${s.id}`, { status: action })
      }
      showToast('Subscriber updated.')
      res.reload()
    } catch (err) {
      showToast(err.message)
    }
  }

  const processQueue = async () => {
    setProcessing(true)
    try {
      const r = await api.post('/api/admin/email/process')
      showToast(r.data.skipped ? `Not sent: ${r.data.skipped}` : `Sent ${r.data.sent}, failed ${r.data.failed}.`)
      dash.reload()
    } catch (err) {
      showToast(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const outbox = dash.data?.outbox || {}
  return (
    <>
      <AdminHeader eyebrow="Community" title="Email subscribers" />
      <div className="admin-body">
        {dash.data && (
          <div className="panel">
            <div className="panel-head">
              <h2>Delivery queue</h2>
              <button className="btn btn-outline btn-sm" onClick={processQueue} disabled={processing}><Icon name="refresh" /> {processing ? 'Sending…' : 'Send due emails now'}</button>
            </div>
            <div className="panel-body">
              <p style={{ margin: 0 }}>
                {outbox.pending || 0} pending · {outbox.sent || 0} sent · {outbox.failed || 0} failed — backend: <span className="mono">{dash.data.email.backend}</span>
                {!dash.data.email.ready && ' (not configured)'}
              </p>
              <p className="muted" style={{ margin: 'var(--space-2) 0 0', fontSize: '0.9rem' }}>The background worker (<span className="mono">flask email-worker</span>) sends queued emails automatically.</p>
            </div>
          </div>
        )}
        <div className="filters">
          <form className="search-box" role="search" onSubmit={(e) => { e.preventDefault(); setFilter({ ...filter, q: search.trim(), page: 1 }) }}>
            <label htmlFor="sub-q" className="visually-hidden">Search email</label>
            <input id="sub-q" className="input" type="search" placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn btn-icon" aria-label="Search"><Icon name="search" /></button>
          </form>
          <div className="tabs" role="tablist" aria-label="Status">
            {[['', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['unsubscribed', 'Unsubscribed']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={filter.status === k} onClick={() => setFilter({ ...filter, status: k, page: 1 })}>{l}</button>
            ))}
          </div>
        </div>
        {res.loading ? <Loading /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : res.data.length === 0 ? (
          <EmptyState title="No subscribers" glyph="[@]"><p>Visitors can subscribe from the site footer.</p></EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Updates</th><th scope="col">Joined</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {res.data.map((s) => (
                    <tr key={s.id}>
                      <td style={{ overflowWrap: 'anywhere' }}>{s.email}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td className="sub">{[s.wants_meetups && 'meetups', s.wants_events && 'events', s.wants_blogs && 'blogs'].filter(Boolean).join(', ')}</td>
                      <td className="sub">{formatDate(s.created_at)}</td>
                      <td>
                        <div className="row-actions">
                          {s.status === 'active' && <button className="btn btn-outline btn-sm" onClick={() => act(s, 'unsubscribed')}>Unsubscribe</button>}
                          {s.status === 'unsubscribed' && s.confirmed_at && <button className="btn btn-outline btn-sm" onClick={() => act(s, 'active')}>Reactivate</button>}
                          <button className="btn btn-ghost btn-sm" onClick={() => act(s, 'delete')} aria-label={`Delete ${s.email}`}><Icon name="trash" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager meta={res.meta} page={filter.page} setPage={(p) => setFilter({ ...filter, page: p })} />
          </>
        )}
      </div>
    </>
  )
}
