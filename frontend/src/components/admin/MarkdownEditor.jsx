import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../api/client'
import { useDebounced } from '../../hooks/useApi'
import Html from '../Html'
import Icon from '../Icon'
import MediaPicker from './MediaPicker'

const TOOLS = [
  { key: 'h2', label: 'H2', title: 'Heading', apply: () => ({ before: '## ', after: '', placeholder: 'Heading', line: true }) },
  { key: 'h3', label: 'H3', title: 'Subheading', apply: () => ({ before: '### ', after: '', placeholder: 'Subheading', line: true }) },
  { key: 'bold', label: 'B', title: 'Bold', apply: () => ({ before: '**', after: '**', placeholder: 'bold text' }) },
  { key: 'italic', label: 'I', title: 'Italic', apply: () => ({ before: '_', after: '_', placeholder: 'italic text' }) },
  { key: 'link', label: 'Link', title: 'Link', apply: () => ({ before: '[', after: '](https://)', placeholder: 'link text' }) },
  { key: 'ul', label: '• List', title: 'Bulleted list', apply: () => ({ before: '- ', after: '', placeholder: 'List item', line: true }) },
  { key: 'ol', label: '1. List', title: 'Numbered list', apply: () => ({ before: '1. ', after: '', placeholder: 'List item', line: true }) },
  { key: 'quote', label: '“ ”', title: 'Quote', apply: () => ({ before: '> ', after: '', placeholder: 'Quote', line: true }) },
  { key: 'code', label: '</>', title: 'Code block', apply: () => ({ before: '```\n', after: '\n```', placeholder: 'code', block: true }) },
]

/**
 * Markdown editor with live preview. The preview is rendered by the same server-side
 * sanitising renderer that produces public pages, so what admins see is what visitors get.
 */
export default function MarkdownEditor({ label, value, onChange, error, hint, compact = false, mediaCategory = 'blogs', required }) {
  const id = useId()
  const textarea = useRef(null)
  const [mode, setMode] = useState(compact ? 'write' : 'split')
  const [preview, setPreview] = useState({ html: '', loading: false, error: null })
  const [picker, setPicker] = useState(false)
  const debounced = useDebounced(value, 350)
  const showPreview = mode !== 'write'

  useEffect(() => {
    if (!showPreview) return undefined
    let cancelled = false
    const controller = new AbortController()
    setPreview((p) => ({ ...p, loading: true }))
    api
      .post('/api/admin/markdown/preview', { markdown: debounced || '' }, { signal: controller.signal })
      .then((res) => !cancelled && setPreview({ html: res.data.html, loading: false, error: null }))
      .catch((err) => !cancelled && err.name !== 'AbortError' && setPreview((p) => ({ ...p, loading: false, error: err })))
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debounced, showPreview])

  const insert = ({ before, after, placeholder, line, block }) => {
    const el = textarea.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || placeholder
    let prefix = value.slice(0, start)
    if ((line || block) && prefix && !prefix.endsWith('\n')) prefix += block ? '\n\n' : '\n'
    const next = prefix + before + selected + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el?.focus()
      const s = prefix.length + before.length
      el?.setSelectionRange(s, s + selected.length)
    })
  }

  const insertMedia = (items) => {
    const list = Array.isArray(items) ? items : [items]
    const md = list.map((m) => `![${(m.alt_text || m.caption || '').replace(/[[\]]/g, '')}](${m.url})`).join('\n\n')
    insert({ before: '', after: '', placeholder: md, block: true })
    setPicker(false)
  }

  const words = (value || '').trim() ? value.trim().split(/\s+/).length : 0

  return (
    <div className="field">
      <label htmlFor={id} id={`${id}-label`}>
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--accent-text)' }}> *</span>}
      </label>
      <div className={`md-editor${error ? ' invalid' : ''}`}>
        <div className="md-toolbar" role="toolbar" aria-label={`${label} formatting`}>
          {TOOLS.map((t) => (
            <button key={t.key} type="button" title={t.title} aria-label={t.title} onClick={() => insert(t.apply())} disabled={mode === 'preview'}>
              {t.label}
            </button>
          ))}
          <button type="button" title="Insert image or video" aria-label="Insert image or video" onClick={() => setPicker(true)} disabled={mode === 'preview'}>
            <Icon name="image" />
          </button>
          <span className="grow" />
          <span className="sep" aria-hidden="true" />
          {[['write', 'Write'], ['split', 'Split'], ['preview', 'Preview']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        <div className={`md-panes${mode === 'split' ? ' split' : ''}${compact ? ' compact' : ''}`}>
          {mode !== 'preview' && (
            <textarea
              ref={textarea}
              id={id}
              className="textarea code"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={[hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined}
              spellCheck
            />
          )}
          {showPreview && (
            <div className="md-preview" aria-live="polite" aria-busy={preview.loading} aria-label={`${label} preview`} role="region">
              <div className="preview-label">
                <span>Live preview</span>
                {preview.loading && <span>updating…</span>}
              </div>
              {preview.error ? (
                <p className="error">Preview unavailable: {preview.error.message}</p>
              ) : preview.html ? (
                <Html html={preview.html} />
              ) : (
                <p className="muted">Nothing to preview yet.</p>
              )}
            </div>
          )}
        </div>
        <div className="md-footer">
          <span>Markdown · raw HTML is not allowed</span>
          <span>{words} words</span>
        </div>
      </div>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="error" id={`${id}-err`}>{error}</p>}
      {picker && <MediaPicker title="Insert media" category={mediaCategory} multiple onClose={() => setPicker(false)} onSelect={insertMedia} />}
    </div>
  )
}
