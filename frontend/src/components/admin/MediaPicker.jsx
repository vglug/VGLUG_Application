import { useRef, useState } from 'react'
import { api, qs } from '../../api/client'
import { useApi } from '../../hooks/useApi'
import { formatBytes } from '../../lib/format'
import Icon from '../Icon'
import { ErrorState, Loading } from '../States'
import { Modal } from './ui'

export const CATEGORY_OPTIONS = [
  { value: 'blogs', label: 'Blogs' },
  { value: 'events', label: 'Events' },
  { value: 'meetups', label: 'Meetups' },
  { value: 'join-us', label: 'Join Us' },
  { value: 'pages', label: 'Pages' },
  { value: 'footer', label: 'Footer' },
]

export const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm'

export function Uploader({ category, onUploaded, kind }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [over, setOver] = useState(false)
  const [alt, setAlt] = useState('')
  const input = useRef(null)

  const upload = async (files) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    const uploaded = []
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      form.append('category', category)
      form.append('alt_text', alt)
      try {
        const res = await api.upload('/api/admin/media', form)
        uploaded.push(res.data)
      } catch (err) {
        setError(`${file.name}: ${err.message}`)
      }
    }
    setBusy(false)
    setAlt('')
    if (input.current) input.current.value = ''
    if (uploaded.length) onUploaded(uploaded)
  }

  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); upload(Array.from(e.dataTransfer.files)) }}
    >
      <p style={{ marginBottom: 'var(--space-3)' }}>
        <strong>Drop files here</strong> or choose them. JPEG, PNG, GIF, WebP images and MP4/WebM videos.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="visually-hidden" htmlFor="upload-alt">Alternative text for the uploaded file</label>
        <input id="upload-alt" className="input" style={{ maxWidth: 320 }} placeholder="Alt text (describe the image)" value={alt} onChange={(e) => setAlt(e.target.value)} />
        <label className="btn" style={{ cursor: busy ? 'progress' : 'pointer' }}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="upload" />}
          {busy ? 'Uploading…' : 'Choose files'}
          <input ref={input} type="file" multiple accept={kind === 'image' ? 'image/jpeg,image/png,image/gif,image/webp' : ACCEPT}
            className="visually-hidden" disabled={busy} onChange={(e) => upload(Array.from(e.target.files))} />
        </label>
      </div>
      {error && <p className="error" role="alert" style={{ color: 'var(--danger)', marginTop: 'var(--space-3)' }}>{error}</p>}
    </div>
  )
}

export function MediaThumb({ media }) {
  if (!media) return <Icon name="image" />
  if (media.kind === 'video') return <Icon name="video" />
  return <img src={media.thumb_url} alt={media.alt_text || ''} loading="lazy" />
}

/** Modal library browser: pick one (or several) existing files or upload new ones. */
export default function MediaPicker({ title = 'Choose media', category = 'blogs', kind, multiple = false, onSelect, onClose }) {
  const [filter, setFilter] = useState({ category: '', page: 1 })
  const list = useApi(`/api/admin/media${qs({ category: filter.category, kind, page: filter.page, per_page: 24 })}`)
  const [selected, setSelected] = useState([])

  const onUploaded = (items) => {
    if (!multiple) {
      onSelect(items[0])
      return
    }
    setSelected((s) => [...s, ...items])
    list.reload()
  }

  const toggle = (m) => {
    if (!multiple) {
      onSelect(m)
      return
    }
    setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : [...s, m]))
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={multiple && (
        <>
          <span className="muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>{selected.length} selected</span>
          <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
          <button className="btn" type="button" disabled={!selected.length} onClick={() => onSelect(selected)}>Add selected</button>
        </>
      )}
    >
      <Uploader category={category} kind={kind} onUploaded={onUploaded} />
      <div className="filters">
        <div className="field">
          <label htmlFor="mp-cat">Folder</label>
          <select id="mp-cat" className="select" value={filter.category} onChange={(e) => setFilter({ category: e.target.value, page: 1 })}>
            <option value="">All folders</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
      {list.loading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : (
        <>
          {list.data.length === 0 && <p className="muted">No files yet. Upload one above.</p>}
          <div className="media-grid">
            {list.data.map((m) => {
              const isSel = selected.some((x) => x.id === m.id)
              return (
                <div className={`media-tile${isSel ? ' selected' : ''}`} key={m.id}>
                  <div className="thumb"><MediaThumb media={m} /></div>
                  <div className="meta">
                    <span className="name" title={m.original_filename}>{m.original_filename}</span>
                    <span className="sub">{m.kind} · {formatBytes(m.size_bytes)}</span>
                  </div>
                  <button type="button" className="pick" aria-pressed={multiple ? isSel : undefined} onClick={() => toggle(m)}
                    aria-label={`${multiple ? (isSel ? 'Deselect' : 'Select') : 'Choose'} ${m.original_filename}`} />
                  {isSel && <span className="check-mark" aria-hidden="true"><Icon name="check" /></span>}
                </div>
              )
            })}
          </div>
          {list.meta?.pages > 1 && (
            <div className="pagination" style={{ marginTop: 'var(--space-4)' }}>
              <button className="btn btn-outline btn-sm" disabled={filter.page <= 1} onClick={() => setFilter({ ...filter, page: filter.page - 1 })}>Previous</button>
              <span className="page-info">{filter.page} / {list.meta.pages}</span>
              <button className="btn btn-outline btn-sm" disabled={filter.page >= list.meta.pages} onClick={() => setFilter({ ...filter, page: filter.page + 1 })}>Next</button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

/** Single-image field with preview, used for covers and the donation QR code. */
export function MediaField({ label, media, onChange, category, hint, error, variant }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="media-chooser">
        <div className={`preview${variant === 'qr' ? ' qr' : ''}`}>{media ? <MediaThumb media={media} /> : <Icon name={variant === 'qr' ? 'qr' : 'image'} />}</div>
        <div className="buttons">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
            <Icon name="image" /> {media ? 'Replace' : 'Choose image'}
          </button>
          {media && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
              <Icon name="close" /> Remove
            </button>
          )}
        </div>
      </div>
      {hint && <p className="hint">{hint}</p>}
      {error && <p className="error">{error}</p>}
      {open && (
        <MediaPicker title={`Choose ${label.toLowerCase()}`} category={category} kind="image"
          onClose={() => setOpen(false)} onSelect={(m) => { onChange(m); setOpen(false) }} />
      )}
    </div>
  )
}
