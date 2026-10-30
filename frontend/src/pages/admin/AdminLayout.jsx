import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { Loading } from '../../components/States'
import ThemeToggle from '../../components/ThemeToggle'
import { ConfirmProvider } from '../../components/admin/ui'
import { useAuth } from '../../context/AuthContext'
import '../../styles/admin.css'

const NAV = [
  { group: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: 'home', end: true }] },
  {
    group: 'Content',
    items: [
      { to: '/admin/content/meetup', label: 'Meetups', icon: 'users' },
      { to: '/admin/content/event', label: 'Events', icon: 'calendar' },
      { to: '/admin/content/blog', label: 'Blogs', icon: 'file' },
      { to: '/admin/pages', label: 'Pages', icon: 'layout' },
      { to: '/admin/media', label: 'Media library', icon: 'image' },
    ],
  },
  {
    group: 'Community',
    items: [
      { to: '/admin/comments', label: 'Comments', icon: 'comment' },
      { to: '/admin/subscribers', label: 'Subscribers', icon: 'mail' },
    ],
  },
  {
    group: 'Site',
    items: [
      { to: '/admin/navigation', label: 'Navigation', icon: 'nav' },
      { to: '/admin/footer', label: 'Footer', icon: 'inbox' },
    ],
  },
]

export function RequireAdmin({ children }) {
  const { admin, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <div className="login-page"><Loading label="Checking your session…" /></div>
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (admin.must_change_password && location.pathname !== '/admin/password') return <Navigate to="/admin/password" replace />
  return children
}

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    document.title = 'Admin · VGLUG'
  }, [location.pathname])

  const signOut = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <RequireAdmin>
      <ConfirmProvider>
        <a href="#admin-main" className="skip-link">Skip to content</a>
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-topbar">
              <Link to="/admin" className="brand-name" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/vglug-logo-128.png" alt="" width="40" height="40" />
                <span>VGLUG<span className="tag">Admin panel</span></span>
              </Link>
              <div style={{ display: 'flex', gap: 4 }}>
                <ThemeToggle />
                <button type="button" className="btn btn-ghost btn-icon admin-menu-toggle" aria-expanded={open} aria-controls="admin-nav"
                  aria-label={open ? 'Close admin menu' : 'Open admin menu'} onClick={() => setOpen((o) => !o)}>
                  <Icon name={open ? 'close' : 'menu'} />
                </button>
              </div>
            </div>
            <nav id="admin-nav" className={`admin-nav${open ? ' is-open' : ''}`} aria-label="Admin">
              {!admin?.must_change_password &&
                NAV.map((g) => (
                  <div key={g.group}>
                    <div className="group-label">{g.group}</div>
                    {g.items.map((it) => (
                      <NavLink key={it.to} to={it.to} end={it.end}>
                        <Icon name={it.icon} /> {it.label}
                      </NavLink>
                    ))}
                  </div>
                ))}
              <div className="spacer" />
              <div className="group-label">Account · {admin?.username}</div>
              <NavLink to="/admin/password"><Icon name="lock" /> Change password</NavLink>
              <a href="/" target="_blank" rel="noopener noreferrer"><Icon name="external" /> View site</a>
              <button type="button" onClick={signOut}><Icon name="logout" /> Sign out</button>
            </nav>
          </aside>
          <main className="admin-main" id="admin-main" tabIndex={-1} style={{ outline: 'none' }}>
            <Outlet />
          </main>
        </div>
      </ConfirmProvider>
    </RequireAdmin>
  )
}
