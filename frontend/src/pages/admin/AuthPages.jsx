import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AdminHeader, FormNotice, TextField } from '../../components/admin/ui'
import { useAuth } from '../../context/AuthContext'
import '../../styles/admin.css'

export function LoginPage() {
  const { admin, status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [state, setState] = useState({ busy: false, error: null })
  useEffect(() => {
    document.title = 'Admin sign in · VGLUG'
  }, [])

  if (status === 'ready' && admin) return <Navigate to={admin.must_change_password ? '/admin/password' : '/admin'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setState({ busy: true, error: null })
    try {
      const a = await login(form.username.trim(), form.password)
      navigate(a.must_change_password ? '/admin/password' : location.state?.from || '/admin', { replace: true })
    } catch (err) {
      setState({ busy: false, error: err })
    }
  }

  return (
    <div className="login-page">
      <main className="login-card">
        <div className="head">
          <img src="/vglug-logo-128.png" alt="VGLUG Foundation logo" width="64" height="64" style={{ marginBottom: 'var(--space-3)' }} />
          <h1>Administrator sign in</h1>
          <p>For site administrators only. Visitors do not need an account.</p>
        </div>
        <form className="body" onSubmit={submit} noValidate>
          <FormNotice error={state.error} />
          <TextField label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} autoComplete="username" required autoFocus />
          <TextField label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="current-password" required />
          <button className="btn" type="submit" style={{ width: '100%' }} disabled={state.busy || !form.username || !form.password}>
            {state.busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  )
}

const RULES = [
  { test: (p) => p.length >= 12, label: 'At least 12 characters' },
  {
    test: (p) => [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length >= 3,
    label: 'At least three of: lowercase, uppercase, digits, symbols',
  },
]

export function ChangePasswordPage() {
  const { admin, changePassword } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [state, setState] = useState({ busy: false, error: null, success: null })
  const forced = admin?.must_change_password
  const mismatch = form.confirm && form.confirm !== form.new_password

  const submit = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) return
    setState({ busy: true, error: null, success: null })
    try {
      await changePassword({ current_password: form.current_password, new_password: form.new_password })
      setForm({ current_password: '', new_password: '', confirm: '' })
      if (forced) navigate('/admin', { replace: true })
      else setState({ busy: false, error: null, success: 'Password changed. Other sessions have been signed out.' })
    } catch (err) {
      setState({ busy: false, error: err, success: null })
    }
  }

  return (
    <>
      <AdminHeader eyebrow="Account" title="Change password" />
      <div className="admin-body">
        <div className="panel" style={{ maxWidth: 560 }}>
          <form className="panel-body" onSubmit={submit} noValidate>
            {forced && (
              <div className="notice notice-warning">
                <p><strong>Set a new password to continue.</strong> The initial bootstrap password must be replaced before you can manage the site.</p>
              </div>
            )}
            <FormNotice error={state.error} success={state.success} />
            <TextField label="Current password" type="password" autoComplete="current-password" required
              value={form.current_password} onChange={(v) => setForm({ ...form, current_password: v })} error={state.error?.fields?.current_password} />
            <TextField label="New password" type="password" autoComplete="new-password" required
              value={form.new_password} onChange={(v) => setForm({ ...form, new_password: v })} error={state.error?.fields?.new_password} />
            <ul className="pw-rules" aria-label="Password requirements">
              {RULES.map((r) => <li key={r.label} className={r.test(form.new_password) ? 'ok' : ''}>{r.label}</li>)}
              <li>Must not contain the username or reuse the initial password</li>
            </ul>
            <TextField label="Confirm new password" type="password" autoComplete="new-password" required
              value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} error={mismatch ? 'Passwords do not match.' : undefined} />
            <button className="btn" type="submit" disabled={state.busy || !form.current_password || !form.new_password || mismatch || !form.confirm}>
              {state.busy ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
