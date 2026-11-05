import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import Icon, { PLATFORM_LABELS } from '../../components/Icon'
import { showToast } from '../../components/Interactions'
import { ErrorState, Loading } from '../../components/States'
import { MediaField } from '../../components/admin/MediaPicker'
import { AdminHeader, Checkbox, FormNotice, SelectField, TextArea, TextField, useUnsavedChanges } from '../../components/admin/ui'

const ALWAYS_VISIBLE = new Set(['home', 'join'])
const LINK_RE = /^(https?:\/\/\S+|mailto:\S+@\S+|\/[A-Za-z0-9\-._~/]*(#[\w-]+)?)$/

let keySeq = 0
const withKeys = (items) => items.map((i) => ({ ...i, _key: `k${keySeq++}`, children: withKeys(i.children || []) }))
const strip = (items) =>
  items.map(({ _key, id: _id, ...i }) => ({
    label: i.label, url: i.system_key ? '' : i.url, system_key: i.system_key || null,
    is_visible: i.is_visible, open_in_new_tab: Boolean(i.open_in_new_tab), children: strip(i.children || []),
  }))

function move(list, i, dir) {
  const next = [...list]
  const j = i + dir
  if (j < 0 || j >= next.length) return list
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function NavRow({ item, index, count, onChange, onMove, onRemove, systemRoutes, errors, path }) {
  const locked = Boolean(item.system_key)
  const dest = locked ? systemRoutes[item.system_key] || '(dropdown)' : item.url
  return (
    <div className="nav-row">
      <TextField label="Label" value={item.label} onChange={(v) => onChange({ label: v })} maxLength={60} error={errors[`${path}.label`]} />
      {locked ? (
        <div className="field">
          <span className="label">Destination</span>
          <span className="lock"><Icon name="lock" /> {dest} · required route</span>
        </div>
      ) : (
        <TextField label="Destination" value={item.url} onChange={(v) => onChange({ url: v })} placeholder="/about or https://…" maxLength={500}
          error={errors[`${path}.url`]} hint={item.children?.length ? 'Optional for dropdown parents.' : undefined} />
      )}
      <div style={{ display: 'grid', gap: 4 }}>
        <Checkbox label="Visible" checked={item.is_visible} onChange={(v) => onChange({ is_visible: v })}
          disabled={ALWAYS_VISIBLE.has(item.system_key)} title={ALWAYS_VISIBLE.has(item.system_key) ? 'This link must stay visible' : undefined} />
        {!locked && <Checkbox label="New tab" checked={item.open_in_new_tab} onChange={(v) => onChange({ open_in_new_tab: v })} />}
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Move ${item.label} up`} disabled={index === 0} onClick={() => onMove(-1)}><Icon name="up" /></button>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Move ${item.label} down`} disabled={index === count - 1} onClick={() => onMove(1)}><Icon name="down" /></button>
        {!locked && <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove ${item.label}`} onClick={onRemove}><Icon name="trash" /></button>}
      </div>
    </div>
  )
}

function MenuEditor({ menu, title, initial, systemRoutes, onDirtyChange }) {
  const [items, setItems] = useState(() => withKeys(initial))
  const [saved, setSaved] = useState(() => JSON.stringify(strip(withKeys(initial))))
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState({})
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(strip(items)) !== saved
  useEffect(() => onDirtyChange(menu, dirty && !busy), [menu, dirty, busy, onDirtyChange])

  const update = (i, patch, parent) => {
    if (parent === undefined) setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)))
    else setItems((list) => list.map((it, j) => (j === parent ? { ...it, children: it.children.map((c, k) => (k === i ? { ...c, ...patch } : c)) } : it)))
  }
  const blank = () => ({ _key: `k${keySeq++}`, label: 'New link', url: '/', is_visible: true, open_in_new_tab: false, children: [] })

  const save = async () => {
    const e = {}
    const check = (it, p) => {
      if (!it.label.trim()) e[`${p}.label`] = 'Label required.'
      if (!it.system_key && !(it.children?.length && !it.url) && !LINK_RE.test(it.url.trim())) e[`${p}.url`] = 'Use /path, https://… or mailto:…'
    }
    items.forEach((it, i) => { check(it, `items.${i}`); it.children.forEach((c, k) => check(c, `items.${i}.children.${k}`)) })
    setErrors(e)
    if (Object.keys(e).length) { setNotice({ error: { message: 'Please correct the highlighted links.' } }); return }
    setBusy(true)
    try {
      const res = await api.put(`/api/admin/navigation/${menu}`, { items: strip(items) })
      const next = withKeys(res.data[menu])
      setItems(next)
      setSaved(JSON.stringify(strip(next)))
      setNotice({ success: `${title} saved. Changes are live.` })
      showToast(`${title} saved.`)
    } catch (err) {
      setErrors(err.fields || {})
      setNotice({ error: err })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <div className="row-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setItems([...items, blank()])}><Icon name="plus" /> Add link</button>
          <button type="button" className="btn btn-sm" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div className="panel-body">
        <FormNotice error={notice.error} success={notice.success} />
        <ul className="nav-tree">
          {items.map((it, i) => (
            <li key={it._key}>
              <NavRow item={it} index={i} count={items.length} systemRoutes={systemRoutes} errors={errors} path={`items.${i}`}
                onChange={(p) => update(i, p)} onMove={(d) => setItems(move(items, i, d))} onRemove={() => setItems(items.filter((_, j) => j !== i))} />
              {menu === 'main' && (it.children.length > 0 || !it.system_key) && (
                <ul className="nav-children">
                  {it.children.map((c, k) => (
                    <li key={c._key}>
                      <NavRow item={c} index={k} count={it.children.length} systemRoutes={systemRoutes} errors={errors} path={`items.${i}.children.${k}`}
                        onChange={(p) => update(k, p, i)}
                        onMove={(d) => update(i, { children: move(it.children, k, d) })}
                        onRemove={() => update(i, { children: it.children.filter((_, j) => j !== k) })} />
                    </li>
                  ))}
                  <li>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(i, { children: [...it.children, blank()] })}>
                      <Icon name="plus" /> Add dropdown link under “{it.label}”
                    </button>
                  </li>
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function NavigationSettings() {
  const [state, setState] = useState({ loading: true })
  const [dirtyMenus, setDirtyMenus] = useState({})
  const onDirtyChange = useCallback((menu, dirty) => setDirtyMenus((d) => (d[menu] === dirty ? d : { ...d, [menu]: dirty })), [])
  useUnsavedChanges(Object.values(dirtyMenus).some(Boolean))
  useEffect(() => {
    api.get('/api/admin/navigation').then((r) => setState({ data: r.data })).catch((error) => setState({ error }))
  }, [])
  return (
    <>
      <AdminHeader eyebrow="Site" title="Navigation" />
      <div className="admin-body">
        <div className="notice notice-info">
          <p>Required routes (Home, Explore with Meetups/Events/Blogs, About Us, Join Us, Contact Us) can be renamed and reordered but not removed or re-pointed. Home and Join Us always stay visible.</p>
        </div>
        {state.loading ? <Loading /> : state.error ? <ErrorState error={state.error} /> : (
          <>
            <MenuEditor menu="main" title="Main navigation" initial={state.data.main} systemRoutes={state.data.system_routes} onDirtyChange={onDirtyChange} />
            <MenuEditor menu="footer" title="Footer links" initial={state.data.footer} systemRoutes={state.data.system_routes} onDirtyChange={onDirtyChange} />
          </>
        )}
      </div>
    </>
  )
}

const FOOTER_FIELDS = ['org_name', 'short_name', 'description', 'email', 'phone', 'address', 'registration_id', 'donation_text', 'donation_qr_alt', 'copyright_text']

export function FooterSettings() {
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState('')
  const [load, setLoad] = useState({ loading: true })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState({})
  const [busy, setBusy] = useState(false)

  const toForm = (d) => ({ ...Object.fromEntries(FOOTER_FIELDS.map((f) => [f, d[f] || ''])), donation_qr: d.donation_qr, social_links: d.social_links.map((s) => ({ ...s })) })
  const payload = (f) => ({
    ...Object.fromEntries(FOOTER_FIELDS.map((k) => [k, f[k]])),
    donation_qr_media_id: f.donation_qr?.id ?? null,
    social_links: f.social_links.map(({ platform, url, label }) => ({ platform, url, label })),
  })

  useEffect(() => {
    api.get('/api/admin/footer').then((r) => {
      const f = toForm(r.data)
      setForm(f)
      setSaved(JSON.stringify(payload(f)))
      setLoad({})
    }).catch((error) => setLoad({ error }))
  }, [])

  const dirty = form && JSON.stringify(payload(form)) !== saved
  useUnsavedChanges(Boolean(dirty) && !busy)

  if (load.loading) return <><AdminHeader eyebrow="Site" title="Footer" /><div className="admin-body"><Loading /></div></>
  if (load.error) return <><AdminHeader eyebrow="Site" title="Footer" /><div className="admin-body"><ErrorState error={load.error} /></div></>

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setSocial = (i, patch) => set({ social_links: form.social_links.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setNotice({})
    try {
      const res = await api.put('/api/admin/footer', payload(form))
      const f = toForm(res.data)
      setForm(f)
      setSaved(JSON.stringify(payload(f)))
      setErrors({})
      setNotice({ success: 'Footer saved. Changes are live.' })
      showToast('Footer saved.')
    } catch (err) {
      setErrors(err.fields || {})
      setNotice({ error: err })
    } finally {
      setBusy(false)
    }
  }

  const missing = (v) => (!v ? 'Not set — add the official value supplied by the organisation.' : undefined)

  return (
    <>
      <AdminHeader eyebrow="Site" title="Footer" />
      <form className="admin-body" onSubmit={save} noValidate>
        <FormNotice error={notice.error} success={notice.success} />
        <div className="panel">
          <div className="panel-head"><h2>Organisation</h2></div>
          <div className="panel-body form-grid two">
            <TextField label="Organisation name" value={form.org_name} onChange={(v) => set({ org_name: v })} maxLength={200} />
            <TextField label="Short name" value={form.short_name} onChange={(v) => set({ short_name: v })} maxLength={40} />
            <TextArea label="Description" className="span-2" value={form.description} onChange={(v) => set({ description: v })} maxLength={2000} style={{ minHeight: 80 }} />
            <TextField label="Registration / organisation ID" value={form.registration_id} onChange={(v) => set({ registration_id: v })} maxLength={120}
              hint={missing(form.registration_id) || 'Shown in the footer and on the Contact page.'} />
            <TextField label="Copyright text" value={form.copyright_text} onChange={(v) => set({ copyright_text: v })} maxLength={300} hint="Shown after “© <year>”." />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Contact details</h2></div>
          <div className="panel-body form-grid two">
            <TextField label="Email" type="email" value={form.email} onChange={(v) => set({ email: v })} error={errors.email} hint={missing(form.email)} maxLength={200} />
            <TextField label="Phone" type="tel" value={form.phone} onChange={(v) => set({ phone: v })} error={errors.phone} hint={missing(form.phone)} maxLength={60} />
            <TextArea label="Address" className="span-2" value={form.address} onChange={(v) => set({ address: v })} hint={missing(form.address)} maxLength={500} style={{ minHeight: 80 }} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Donations</h2></div>
          <div className="panel-body form-grid two">
            <MediaField label="Donation QR code" variant="qr" media={form.donation_qr} onChange={(m) => set({ donation_qr: m })} category="footer"
              error={errors.donation_qr_media_id} hint="Upload only a QR code provided by the organisation." />
            <div>
              <TextField label="QR code alt text" value={form.donation_qr_alt} onChange={(v) => set({ donation_qr_alt: v })} error={errors.donation_qr_alt} maxLength={300}
                hint="e.g. “UPI QR code to donate to VGLUG”." />
              <TextArea label="Donation text" value={form.donation_text} onChange={(v) => set({ donation_text: v })} maxLength={500} style={{ minHeight: 80 }} />
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Social media</h2>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => set({ social_links: [...form.social_links, { platform: 'github', url: '', label: '' }] })}>
              <Icon name="plus" /> Add link
            </button>
          </div>
          <div className="panel-body">
            {form.social_links.length === 0 && <p className="muted">No social links yet. Add the organisation’s official profiles.</p>}
            {form.social_links.map((s, i) => (
              <div className="nav-row" key={i}>
                <SelectField label="Platform" value={s.platform} onChange={(v) => setSocial(i, { platform: v })}
                  options={Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label }))} />
                <TextField label="Profile URL" type="url" value={s.url} onChange={(v) => setSocial(i, { url: v })} placeholder="https://" error={errors[`social_links.${i}.url`]} maxLength={500} />
                <TextField label="Accessible name (optional)" value={s.label} onChange={(v) => setSocial(i, { label: v })} maxLength={80} />
                <div className="row-actions">
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Move up" disabled={i === 0} onClick={() => set({ social_links: move(form.social_links, i, -1) })}><Icon name="up" /></button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Move down" disabled={i === form.social_links.length - 1} onClick={() => set({ social_links: move(form.social_links, i, 1) })}><Icon name="down" /></button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove ${PLATFORM_LABELS[s.platform]} link`} onClick={() => set({ social_links: form.social_links.filter((_, j) => j !== i) })}><Icon name="trash" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="save-bar">
          <span className={`status${dirty ? ' dirty' : ''}`}>{busy ? 'Saving…' : dirty ? '● Unsaved changes' : 'All changes saved'}</span>
          <div className="buttons"><button className="btn" type="submit" disabled={busy || !dirty}>Save footer</button></div>
        </div>
      </form>
    </>
  )
}
