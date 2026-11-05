import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import Icon from '../../components/Icon'
import { showToast } from '../../components/Interactions'
import { ErrorState, Loading } from '../../components/States'
import MarkdownEditor from '../../components/admin/MarkdownEditor'
import {
  AdminHeader, Checkbox, FormNotice, SelectField, StatusBadge, TextArea, TextField, useConfirm, useUnsavedChanges,
} from '../../components/admin/ui'
import { useApi } from '../../hooks/useApi'
import { formatDate } from '../../lib/format'

const PAGE_INFO = {
  home: { label: 'Home', path: '/', hint: 'Hero text, impact, initiatives and recognitions on the home page. Latest content is added automatically.' },
  about: { label: 'About Us', path: '/about', hint: 'History, vision, mission, objectives, philosophy and awards.' },
  join: { label: 'Join Us', path: '/join', hint: 'Eligibility, participation opportunities, benefits, joining instructions and contact. Add an application link with the button fields.' },
  contact: { label: 'Contact Us', path: '/contact', hint: 'Contact details themselves are edited in Footer settings and shown on this page automatically.' },
}

const LAYOUTS = [
  { value: 'prose', label: 'Text (Markdown)' },
  { value: 'cards', label: 'Cards grid' },
  { value: 'list', label: 'Numbered list' },
  { value: 'stats', label: 'Statistics' },
  { value: 'awards', label: 'Awards (subtitle = year)' },
  { value: 'callout', label: 'Highlighted callout' },
  { value: 'features', label: 'Programme blocks (alternating)' },
  { value: 'links', label: 'Link row (partners, channels)' },
]

export function PagesList() {
  const res = useApi('/api/admin/pages')
  return (
    <>
      <AdminHeader eyebrow="Content" title="Pages" />
      <div className="admin-body">
        {res.loading ? <Loading /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Page</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {res.data.map((p) => (
                  <tr key={p.key}>
                    <td className="title-cell">
                      <Link to={`/admin/pages/${p.key}`}>{PAGE_INFO[p.key].label}</Link>
                      <div className="sub">{PAGE_INFO[p.key].path} · {p.title}</div>
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="sub">{formatDate(p.updated_at) || '—'}</td>
                    <td><div className="row-actions"><Link className="btn btn-outline btn-sm" to={`/admin/pages/${p.key}`}><Icon name="edit" /> Edit</Link></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

const toForm = (p) => ({
  title: p.title,
  eyebrow: p.eyebrow,
  intro_md: p.intro_md,
  cta_label: p.cta_label,
  cta_url: p.cta_url,
  status: p.status,
  sections: p.sections.map((s, i) => ({
    _key: `${s.id ?? 'n'}-${i}`,
    anchor: s.anchor,
    layout: s.layout,
    heading: s.heading,
    body_md: s.body_md,
    is_visible: s.is_visible,
    items: s.items.map((it) => ({ title: it.title, subtitle: it.subtitle, body_md: it.body_md, url: it.url || '' })),
  })),
})

const strip = (form) => ({ ...form, sections: form.sections.map(({ _key, ...s }) => s) })

function move(list, i, dir) {
  const next = [...list]
  const j = i + dir
  if (j < 0 || j >= next.length) return list
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function SectionEditor({ section, index, count, onChange, onMove, onRemove, errors, pageKey }) {
  const [open, setOpen] = useState(false)
  const hasItems = section.layout !== 'prose' && section.layout !== 'callout'
  const setItem = (i, patch) => onChange({ items: section.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })
  return (
    <div className="section-editor">
      <div className="head">
        <span className="idx">{String(index + 1).padStart(2, '0')}</span>
        <span className="ttl">{section.heading || <em className="muted">Untitled section</em>}</span>
        <span className="badge">{LAYOUTS.find((l) => l.value === section.layout)?.label}</span>
        {!section.is_visible && <span className="badge badge-draft">hidden</span>}
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Move section up" disabled={index === 0} onClick={() => onMove(-1)}><Icon name="up" /></button>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Move section down" disabled={index === count - 1} onClick={() => onMove(1)}><Icon name="down" /></button>
        <button type="button" className="btn btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Collapse' : 'Edit'}</button>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Remove section" onClick={onRemove}><Icon name="trash" /></button>
      </div>
      {open && (
        <div className="body">
          <div className="form-grid two">
            <TextField label="Heading" value={section.heading} onChange={(v) => onChange({ heading: v })} maxLength={200} />
            <SelectField label="Layout" value={section.layout} onChange={(v) => onChange({ layout: v })} options={LAYOUTS} />
            <TextField label="Anchor (optional)" value={section.anchor} onChange={(v) => onChange({ anchor: v.toLowerCase() })}
              error={errors[`sections.${index}.anchor`]} hint="Used for links like /about#history" maxLength={60} />
            <div className="field" style={{ alignSelf: 'end' }}>
              <Checkbox label="Visible on the public page" checked={section.is_visible} onChange={(v) => onChange({ is_visible: v })} />
            </div>
          </div>
          <MarkdownEditor label={hasItems ? 'Introduction (optional)' : 'Text'} compact value={section.body_md}
            onChange={(v) => onChange({ body_md: v })} mediaCategory={pageKey === 'join' ? 'join-us' : 'pages'} />
          {hasItems && (
            <div className="field">
              <span className="label">Items</span>
              {section.items.map((it, i) => (
                <div className="item-editor" key={i}>
                  <div className="head">
                    <span>Item {i + 1}</span>
                    <span>
                      <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => onChange({ items: move(section.items, i, -1) })}><Icon name="up" /></button>
                      <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Move item ${i + 1} down`} disabled={i === section.items.length - 1} onClick={() => onChange({ items: move(section.items, i, 1) })}><Icon name="down" /></button>
                      <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove item ${i + 1}`} onClick={() => onChange({ items: section.items.filter((_, j) => j !== i) })}><Icon name="trash" /></button>
                    </span>
                  </div>
                  <div className="form-grid two">
                    <TextField label={section.layout === 'stats' ? 'Value' : 'Title'} value={it.title} onChange={(v) => setItem(i, { title: v })} maxLength={200} />
                    <TextField label={section.layout === 'awards' ? 'Year' : section.layout === 'stats' ? 'Label' : 'Subtitle'} value={it.subtitle} onChange={(v) => setItem(i, { subtitle: v })} maxLength={200} />
                  </div>
                  {['cards', 'features', 'links'].includes(section.layout) && (
                    <TextField label="Link (optional)" value={it.url} onChange={(v) => setItem(i, { url: v })} maxLength={500}
                      placeholder="/meetups or https://…" error={errors[`sections.${index}.items.${i}.url`]} />
                  )}
                  {section.layout !== 'links' && <TextArea label="Text (Markdown)" value={it.body_md} onChange={(v) => setItem(i, { body_md: v })} className="" style={{ minHeight: 70 }} maxLength={5000} />}
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange({ items: [...section.items, { title: '', subtitle: '', body_md: '', url: '' }] })}>
                <Icon name="plus" /> Add item
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PageEditor() {
  const { key } = useParams()
  const info = PAGE_INFO[key]
  const confirm = useConfirm()
  const [load, setLoad] = useState({ loading: true, error: null })
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState('')
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState({ error: null, success: null })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!info) return
    api.get(`/api/admin/pages/${key}`)
      .then((res) => {
        const f = toForm(res.data)
        setForm(f)
        setSaved(JSON.stringify(strip(f)))
        setLoad({ loading: false, error: null })
      })
      .catch((err) => setLoad({ loading: false, error: err }))
  }, [key, info])

  const dirty = form && JSON.stringify(strip(form)) !== saved
  useUnsavedChanges(Boolean(dirty) && !busy)

  if (!info) return <div className="admin-body"><ErrorState error={{ message: 'Unknown page.' }} /></div>
  if (load.loading) return <div className="admin-body"><Loading /></div>
  if (load.error) return <div className="admin-body"><ErrorState error={load.error} /></div>

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setSection = (i, patch) => setForm((f) => ({ ...f, sections: f.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  const save = async (status = form.status) => {
    const e = {}
    if (!form.title.trim()) e.title = 'A title is required.'
    if (form.cta_url && !/^(https?:\/\/\S+|mailto:\S+|\/[\w\-./#]*)$/i.test(form.cta_url)) e.cta_url = 'Use https://…, mailto:… or a site path like /meetups.'
    if (form.cta_url && !form.cta_label.trim()) e.cta_label = 'Add a button label.'
    setErrors(e)
    if (Object.keys(e).length) {
      setNotice({ error: { message: 'Please correct the highlighted fields.' }, success: null })
      return
    }
    setBusy(true)
    try {
      const res = await api.put(`/api/admin/pages/${key}`, { ...strip(form), status })
      const f = toForm(res.data)
      setForm(f)
      setSaved(JSON.stringify(strip(f)))
      const msg = status === 'published' ? (form.status === 'published' ? 'Saved — changes are live.' : 'Published.') : 'Saved as draft.'
      setNotice({ error: null, success: msg })
      showToast(msg)
    } catch (err) {
      setErrors(err.fields || {})
      setNotice({ error: err, success: null })
    } finally {
      setBusy(false)
    }
  }

  const removeSection = async (i) => {
    const ok = await confirm({ title: 'Remove this section?', message: 'The section is removed when you save the page.', confirmLabel: 'Remove', danger: true })
    if (ok) set({ sections: form.sections.filter((_, j) => j !== i) })
  }

  return (
    <>
      <AdminHeader eyebrow={<Link to="/admin/pages" style={{ color: 'inherit' }}>Pages</Link>} title={`${info.label} page`}
        actions={form.status === 'published' && <a className="btn btn-outline" href={info.path} target="_blank" rel="noopener noreferrer"><Icon name="external" /> View live</a>} />
      <form className="admin-body" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        <p className="muted">{info.hint}</p>
        <FormNotice error={notice.error} success={notice.success} />
        <div className="panel">
          <div className="panel-head"><h2>Page header</h2><StatusBadge status={form.status} /></div>
          <div className="panel-body">
            <div className="form-grid two">
              <TextField label="Title" required value={form.title} onChange={(v) => set({ title: v })} error={errors.title} maxLength={200} />
              <TextField label="Eyebrow" value={form.eyebrow} onChange={(v) => set({ eyebrow: v })} maxLength={120} hint="Short label above the title." />
            </div>
            <MarkdownEditor label="Introduction" value={form.intro_md} onChange={(v) => set({ intro_md: v })} compact mediaCategory={key === 'join' ? 'join-us' : 'pages'} />
            <div className="form-grid two">
              <TextField label="Button label" value={form.cta_label} onChange={(v) => set({ cta_label: v })} error={errors.cta_label} maxLength={80}
                hint={key === 'join' ? 'e.g. “Apply to volunteer”. Leave empty if there is no application form.' : 'Optional call-to-action button.'} />
              <TextField label={key === 'join' ? 'Application / registration link' : 'Button link'} value={form.cta_url} onChange={(v) => set({ cta_url: v })} error={errors.cta_url}
                maxLength={500} placeholder="https://… or /meetups" hint="Only add a link the organisation has provided." />
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: '1.3rem', margin: 'var(--space-6) 0 var(--space-3)' }}>Sections</h2>
        {form.sections.map((s, i) => (
          <SectionEditor key={s._key} section={s} index={i} count={form.sections.length} errors={errors} pageKey={key}
            onChange={(patch) => setSection(i, patch)} onMove={(dir) => set({ sections: move(form.sections, i, dir) })} onRemove={() => removeSection(i)} />
        ))}
        <button type="button" className="btn btn-outline" onClick={() => set({
          sections: [...form.sections, { _key: `new-${Date.now()}`, anchor: '', layout: 'prose', heading: 'New section', body_md: '', is_visible: true, items: [] }],
        })}>
          <Icon name="plus" /> Add section
        </button>

        <div className="save-bar">
          <span className={`status${dirty ? ' dirty' : ''}`}>{busy ? 'Saving…' : dirty ? '● Unsaved changes' : 'All changes saved'}</span>
          <div className="buttons">
            {form.status === 'published' ? (
              <>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => save('draft')}>Unpublish</button>
                <button type="submit" className="btn" disabled={busy || !dirty}>Save changes</button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => save('draft')}>Save draft</button>
                <button type="button" className="btn" disabled={busy} onClick={() => save('published')}>Publish</button>
              </>
            )}
          </div>
        </div>
      </form>
    </>
  )
}
