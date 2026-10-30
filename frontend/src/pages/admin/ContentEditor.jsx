import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import Html from '../../components/Html'
import Icon from '../../components/Icon'
import { showToast } from '../../components/Interactions'
import { ErrorState, Loading } from '../../components/States'
import MarkdownEditor from '../../components/admin/MarkdownEditor'
import MediaPicker, { MediaField, MediaThumb } from '../../components/admin/MediaPicker'
import {
  AdminHeader, Checkbox, FormNotice, Modal, SelectField, StatusBadge, TextArea, TextField, useConfirm, useUnsavedChanges,
} from '../../components/admin/ui'
import { useAuth } from '../../context/AuthContext'
import { EventPanel } from '../public/DetailPage'
import { TYPE_META } from '../../lib/format'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CATEGORY = { blog: 'blogs', event: 'events', meetup: 'meetups' }

function slugify(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
}

function timezones() {
  try {
    const list = Intl.supportedValuesOf('timeZone')
    return list.includes('UTC') ? list : ['UTC', ...list]
  } catch {
    return ['Asia/Kolkata', 'UTC']
  }
}

const EMPTY_EVENT = {
  starts_local: '', ends_local: '', timezone: 'Asia/Kolkata', location_name: '', address: '', is_online: false,
  online_url: '', registration_url: '', registration_info: '', event_status: 'scheduled',
}

function fromServer(item, type) {
  return {
    title: item?.title || '',
    slug: item?.slug || '',
    slugTouched: Boolean(item),
    summary: item?.summary || '',
    body_md: item?.body_md || '',
    status: item?.status || 'draft',
    cover: item?.cover || null,
    gallery: item?.gallery || [],
    event: type === 'blog' ? null : { ...EMPTY_EVENT, ...(item?.event_form || {}), ends_local: item?.event_form?.ends_local || '' },
  }
}

function validate(form, type, nextStatus) {
  const e = {}
  if (!form.title.trim()) e.title = 'A title is required.'
  if (form.slug && !SLUG_RE.test(form.slug)) e.slug = 'Use lowercase letters, numbers and single hyphens.'
  if (nextStatus === 'published' && form.body_md.trim().length < 20) e.body_md = 'Write at least a short body before publishing.'
  if (type !== 'blog') {
    const ev = form.event
    if (!ev.starts_local) e['event.starts_local'] = 'Start date and time are required.'
    if (ev.ends_local && ev.starts_local && ev.ends_local < ev.starts_local) e['event.ends_local'] = 'The end must be after the start.'
    for (const k of ['online_url', 'registration_url']) {
      if (ev[k] && !/^https?:\/\/\S+$/i.test(ev[k])) e[`event.${k}`] = 'Use a full URL starting with https://'
    }
  }
  return e
}

function PreviewModal({ form, type, onClose }) {
  const [html, setHtml] = useState(null)
  const meta = TYPE_META[type]
  useEffect(() => {
    api.post('/api/admin/markdown/preview', { markdown: form.body_md }).then((r) => setHtml(r.data.html)).catch(() => setHtml(''))
  }, [form.body_md])
  const ev = form.event?.starts_local
    ? {
        ...form.event,
        starts_at: new Date(form.event.starts_local).toISOString(),
        ends_at: form.event.ends_local ? new Date(form.event.ends_local).toISOString() : null,
      }
    : null
  return (
    <Modal title="Page preview" onClose={onClose}>
      <p className="notice notice-info" style={{ fontSize: '0.9rem' }}>Preview of the public page. Times are shown in your browser’s time zone here.</p>
      <article>
        <p className="eyebrow">{meta.label}</p>
        <h1 style={{ fontSize: '2.4rem' }}>{form.title || 'Untitled'}</h1>
        {form.summary && <p className="detail-summary">{form.summary}</p>}
        {form.cover && (
          <figure className="detail-cover" style={{ marginBottom: 'var(--space-5)' }}>
            <img src={form.cover.url} alt={form.cover.alt_text || ''} />
          </figure>
        )}
        <div className={`detail-layout${ev ? ' has-aside' : ''}`} style={{ paddingBottom: 0 }}>
          <div>{html === null ? <Loading /> : <Html html={html} />}</div>
          {ev && <EventPanel event={ev} title={`${meta.label} details`} />}
        </div>
      </article>
    </Modal>
  )
}

export default function ContentEditor() {
  const { type, id } = useParams()
  const isNew = id === 'new'
  const meta = TYPE_META[type]
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { handleAuthError } = useAuth()
  const [load, setLoad] = useState({ loading: !isNew, error: null })
  const [form, setForm] = useState(() => fromServer(null, type))
  const [saved, setSaved] = useState(() => JSON.stringify(fromServer(null, type)))
  const [server, setServer] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState({ error: null, success: null })
  const [busy, setBusy] = useState(false)
  const [galleryPicker, setGalleryPicker] = useState(false)
  const [preview, setPreview] = useState(false)
  const tzs = useMemo(timezones, [])

  useEffect(() => {
    if (isNew) return
    setLoad({ loading: true, error: null })
    api
      .get(`/api/admin/content/${type}/${id}`)
      .then((res) => {
        const f = fromServer(res.data, type)
        setForm(f)
        setSaved(JSON.stringify(f))
        setServer(res.data)
        setLoad({ loading: false, error: null })
      })
      .catch((err) => setLoad({ loading: false, error: err }))
  }, [type, id, isNew])

  const dirty = JSON.stringify(form) !== saved
  useUnsavedChanges(dirty && !busy)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setEvent = (patch) => setForm((f) => ({ ...f, event: { ...f.event, ...patch } }))
  const onTitle = (title) => set({ title, ...(form.slugTouched ? {} : { slug: slugify(title) }) })

  const save = async (nextStatus = form.status) => {
    const clientErrors = validate(form, type, nextStatus)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) {
      setNotice({ error: { message: 'Please correct the highlighted fields.' }, success: null })
      return
    }
    setBusy(true)
    setNotice({ error: null, success: null })
    const payload = {
      title: form.title,
      slug: form.slug,
      summary: form.summary,
      body_md: form.body_md,
      status: nextStatus,
      cover_media_id: form.cover?.id ?? null,
      gallery_ids: form.gallery.map((m) => m.id),
      event: type === 'blog' ? null : { ...form.event, ends_local: form.event.ends_local || null },
    }
    try {
      const res = isNew ? await api.post(`/api/admin/content/${type}`, payload) : await api.put(`/api/admin/content/${type}/${id}`, payload)
      const f = fromServer(res.data, type)
      setForm(f)
      setSaved(JSON.stringify(f))
      setServer(res.data)
      const verb = nextStatus === 'published' ? (form.status === 'published' ? 'Saved and still published' : 'Published') : nextStatus === 'archived' ? 'Archived' : 'Saved as draft'
      setNotice({ error: null, success: `${verb}.` })
      showToast(`${verb}.`)
      if (isNew) navigate(`/admin/content/${type}/${res.data.id}`, { replace: true })
    } catch (err) {
      handleAuthError(err)
      setErrors(err.fields || {})
      setNotice({ error: err, success: null })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Delete this ${meta.label.toLowerCase()}?`,
      message: 'This permanently deletes it with its likes, comments and any media used only here.',
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return
    try {
      await api.del(`/api/admin/content/${type}/${id}`)
      setSaved(JSON.stringify(form))
      showToast('Deleted.')
      navigate(`/admin/content/${type}`, { replace: true })
    } catch (err) {
      setNotice({ error: err, success: null })
    }
  }

  const moveGallery = (i, dir) => {
    const g = [...form.gallery]
    const j = i + dir
    if (j < 0 || j >= g.length) return
    ;[g[i], g[j]] = [g[j], g[i]]
    set({ gallery: g })
  }

  if (!meta) return <div className="admin-body"><ErrorState error={{ message: 'Unknown content type.' }} /></div>
  if (load.loading) return <div className="admin-body"><Loading /></div>
  if (load.error) return <div className="admin-body"><ErrorState error={load.error} /></div>

  const ev = form.event
  return (
    <>
      <AdminHeader
        eyebrow={<Link to={`/admin/content/${type}`} style={{ color: 'inherit' }}>{meta.plural}</Link>}
        title={isNew ? `New ${meta.label.toLowerCase()}` : form.title || 'Untitled'}
        actions={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setPreview(true)}><Icon name="eye" /> Preview</button>
            {server?.status === 'published' && (
              <a className="btn btn-outline" href={server.path} target="_blank" rel="noopener noreferrer"><Icon name="external" /> View live</a>
            )}
          </>
        }
      />
      <form className="admin-body" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        <FormNotice error={notice.error} success={notice.success} />
        <div className="editor-layout">
          <div>
            <div className="panel">
              <div className="panel-body">
                <TextField label="Title" required value={form.title} onChange={onTitle} error={errors.title} maxLength={200} />
                <TextField label="Slug" value={form.slug} onChange={(v) => set({ slug: v.toLowerCase(), slugTouched: true })} error={errors.slug}
                  hint={`Public URL: /${meta.path}/${server?.id ?? '…'}-${form.slug || slugify(form.title) || 'slug'}`} maxLength={200} />
                <TextArea label="Summary" value={form.summary} onChange={(v) => set({ summary: v })} error={errors.summary} maxLength={500}
                  hint={`Shown on cards and in announcement emails. ${form.summary.length}/500`} style={{ minHeight: 80 }} />
              </div>
            </div>
            <MarkdownEditor label="Body" required value={form.body_md} onChange={(v) => set({ body_md: v })} error={errors.body_md}
              mediaCategory={CATEGORY[type]} hint="Use the image button to insert uploaded images or videos." />
          </div>

          <div className="editor-side">
            <div className="panel">
              <div className="panel-head"><h2>Publishing</h2><StatusBadge status={form.status} /></div>
              <div className="panel-body">
                {server?.published_at && <p className="muted" style={{ fontSize: '0.88rem' }}>First published {new Date(server.published_at).toLocaleString()}</p>}
                {server?.announced_at && <p className="muted" style={{ fontSize: '0.88rem' }}>Subscribers were notified.</p>}
                {form.status !== 'published' && !server?.announced_at && (
                  <p className="muted" style={{ fontSize: '0.88rem' }}>Publishing notifies email subscribers once.</p>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><h2>Cover image</h2></div>
              <div className="panel-body">
                <MediaField label="Cover" media={form.cover} onChange={(m) => set({ cover: m })} category={CATEGORY[type]} error={errors.cover_media_id}
                  hint={form.cover && !form.cover.alt_text ? 'This image has no alt text. Add it in the media library.' : undefined} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>Gallery</h2>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setGalleryPicker(true)}><Icon name="plus" /> Add</button>
              </div>
              <div className="panel-body">
                {form.gallery.length === 0 ? <p className="muted" style={{ fontSize: '0.9rem' }}>Optional images and videos shown below the article.</p> : (
                  <div className="gallery-list">
                    {form.gallery.map((m, i) => (
                      <div className="g" key={m.id}>
                        <MediaThumb media={m} />
                        <div className="ctrls">
                          <button type="button" aria-label="Move earlier" onClick={() => moveGallery(i, -1)}><Icon name="arrowLeft" /></button>
                          <button type="button" aria-label="Move later" onClick={() => moveGallery(i, 1)}><Icon name="arrow" /></button>
                          <button type="button" aria-label="Remove from gallery" onClick={() => set({ gallery: form.gallery.filter((x) => x.id !== m.id) })}><Icon name="close" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {ev && (
          <div className="panel">
            <div className="panel-head"><h2>{meta.label} details</h2></div>
            <div className="panel-body form-grid two">
              <TextField label="Starts" type="datetime-local" required value={ev.starts_local} onChange={(v) => setEvent({ starts_local: v })} error={errors['event.starts_local']} />
              <TextField label="Ends" type="datetime-local" value={ev.ends_local} onChange={(v) => setEvent({ ends_local: v })} error={errors['event.ends_local']} />
              <SelectField label="Time zone" value={ev.timezone} onChange={(v) => setEvent({ timezone: v })} error={errors['event.timezone']}
                options={tzs.map((t) => ({ value: t, label: t }))} />
              <SelectField label="Status" value={ev.event_status} onChange={(v) => setEvent({ event_status: v })}
                options={[{ value: 'scheduled', label: 'Scheduled' }, { value: 'postponed', label: 'Postponed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'completed', label: 'Completed' }]} />
              <TextField label="Location name" value={ev.location_name} onChange={(v) => setEvent({ location_name: v })} maxLength={200} />
              <TextField label="Address" value={ev.address} onChange={(v) => setEvent({ address: v })} maxLength={500} />
              <div className="field span-2"><Checkbox label="This is (also) online" checked={ev.is_online} onChange={(v) => setEvent({ is_online: v })} /></div>
              {ev.is_online && (
                <TextField label="Online meeting link" type="url" className="span-2" value={ev.online_url} onChange={(v) => setEvent({ online_url: v })} error={errors['event.online_url']} placeholder="https://" />
              )}
              <TextField label="Registration link" type="url" value={ev.registration_url} onChange={(v) => setEvent({ registration_url: v })} error={errors['event.registration_url']}
                placeholder="https://" hint="Optional. Leave empty if registration is not required." />
              <TextArea label="Registration instructions" value={ev.registration_info} onChange={(v) => setEvent({ registration_info: v })} maxLength={1000} style={{ minHeight: 80 }} />
            </div>
          </div>
        )}

        <div className="save-bar">
          <span className={`status${dirty ? ' dirty' : ''}`}>
            {busy ? <><span className="spinner" aria-hidden="true" /> Saving…</> : dirty ? '● Unsaved changes' : 'All changes saved'}
          </span>
          <div className="buttons">
            {!isNew && <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}><Icon name="trash" /> Delete</button>}
            {form.status === 'published' ? (
              <>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => save('draft')}>Unpublish</button>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => save('archived')}>Archive</button>
                <button type="submit" className="btn" disabled={busy || !dirty}>Save changes</button>
              </>
            ) : (
              <>
                {form.status === 'archived' && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => save('draft')}>Move to drafts</button>}
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => save(form.status === 'archived' ? 'archived' : 'draft')}>
                  Save {form.status === 'archived' ? '' : 'draft'}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => save('published')}>Publish</button>
              </>
            )}
          </div>
        </div>
      </form>
      {galleryPicker && (
        <MediaPicker title="Add to gallery" category={CATEGORY[type]} multiple onClose={() => setGalleryPicker(false)}
          onSelect={(items) => {
            const existing = new Set(form.gallery.map((m) => m.id))
            set({ gallery: [...form.gallery, ...items.filter((m) => !existing.has(m.id))] })
            setGalleryPicker(false)
          }} />
      )}
      {preview && <PreviewModal form={form} type={type} onClose={() => setPreview(false)} />}
    </>
  )
}
