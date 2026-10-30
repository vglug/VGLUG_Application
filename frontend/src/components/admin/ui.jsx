import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import Icon from '../Icon'

export function Field({ label, hint, error, children, className = '', required }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden="true" style={{ color: 'var(--accent-text)' }}> *</span>}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && <p className="hint" id={hintId}>{hint}</p>}
      {error && <p className="error" id={errId}>{error}</p>}
    </div>
  )
}

export function TextField({ label, hint, error, value, onChange, className, required, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className} required={required}>
      {(p) => <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} {...rest} />}
    </Field>
  )
}

export function TextArea({ label, hint, error, value, onChange, className, required, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className} required={required}>
      {(p) => <textarea className="textarea" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} {...rest} />}
    </Field>
  )
}

export function SelectField({ label, hint, error, value, onChange, options, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => (
        <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function Checkbox({ label, checked, onChange, ...rest }) {
  return (
    <label className="check">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} {...rest} />
      {label}
    </label>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

export function AdminHeader({ eyebrow, title, actions }) {
  return (
    <div className="admin-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, size = '' }) {
  const ref = useRef(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement
    const node = ref.current
    const focusable = () =>
      Array.from(node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(
        (el) => !el.disabled && el.offsetParent !== null,
      )
    ;(focusable()[0] || node).focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      } else if (e.key === 'Tab') {
        const items = focusable()
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    node.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      node.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

const ConfirmContext = createContext(() => Promise.resolve(false))

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)
  const confirm = useCallback(
    (opts) => new Promise((resolve) => setRequest({ ...opts, resolve })),
    [],
  )
  const close = (result) => {
    request?.resolve(result)
    setRequest(null)
  }
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Modal
          title={request.title || 'Are you sure?'}
          size="small"
          onClose={() => close(false)}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => close(false)}>Cancel</button>
              <button type="button" className={`btn ${request.danger ? 'btn-danger' : ''}`} onClick={() => close(true)}>
                {request.confirmLabel || 'Confirm'}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{request.message}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)

/** Warn before leaving a form with unsaved changes (in-app navigation and tab close). */
export function useUnsavedChanges(dirty) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return undefined
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('You have unsaved changes. Leave this page and discard them?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
}

export function FormNotice({ error, success }) {
  return (
    <div role="status" aria-live="polite">
      {error && (
        <div className="notice notice-error">
          <p><strong>{error.message}</strong></p>
          {error.fields && Object.keys(error.fields).length > 0 && (
            <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: '1.2em' }}>
              {Object.entries(error.fields)
                .filter(([, v]) => typeof v === 'string')
                .map(([k, v]) => <li key={k}><span className="mono">{k}</span>: {v}</li>)}
            </ul>
          )}
        </div>
      )}
      {success && <div className="notice notice-success"><p>{success}</p></div>}
    </div>
  )
}
