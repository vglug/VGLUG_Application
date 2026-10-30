import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import { useOnClickOutside } from '../hooks/useApi'
import { isExternal } from '../lib/format'
import Icon from './Icon'
import ThemeToggle from './ThemeToggle'

// Used until /api/site responds (or if it fails), so navigation always works.
export const DEFAULT_NAV = [
  { id: 'home', system_key: 'home', label: 'Home', url: '/', children: [] },
  {
    id: 'explore',
    system_key: 'explore',
    label: 'Explore',
    url: '',
    children: [
      { id: 'meetups', system_key: 'meetups', label: 'Meetups', url: '/meetups', children: [] },
      { id: 'events', system_key: 'events', label: 'Events', url: '/events', children: [] },
      { id: 'blogs', system_key: 'blogs', label: 'Blogs', url: '/blogs', children: [] },
    ],
  },
  { id: 'about', system_key: 'about', label: 'About Us', url: '/about', children: [] },
  { id: 'join', system_key: 'join', label: 'Join Us', url: '/join', children: [] },
  { id: 'contact', system_key: 'contact', label: 'Contact Us', url: '/contact', children: [] },
]

export function SmartLink({ item, className, onClick, children, ...rest }) {
  if (isExternal(item.url)) {
    const newTab = item.open_in_new_tab
    return (
      <a href={item.url} className={className} onClick={onClick} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
        {children}
        {newTab && <span className="visually-hidden"> (opens in a new tab)</span>}
      </a>
    )
  }
  return (
    <NavLink to={item.url} end={item.url === '/'} className={className} onClick={onClick} {...rest}>
      {children}
    </NavLink>
  )
}

function Dropdown({ item, onNavigate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const panelId = useId()
  const location = useLocation()
  const hoverTimer = useRef(null)
  const childActive = item.children.some((c) => !isExternal(c.url) && location.pathname.startsWith(c.url))

  useOnClickOutside(ref, () => setOpen(false), open)
  useEffect(() => setOpen(false), [location.pathname])

  const links = () => Array.from(ref.current?.querySelectorAll('.dropdown-panel a') || [])
  const focusItem = (index) => {
    const items = links()
    if (items.length) items[(index + items.length) % items.length].focus()
  }

  const onButtonKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      requestAnimationFrame(() => focusItem(e.key === 'ArrowDown' ? 0 : -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const onPanelKey = (e) => {
    const items = links()
    const index = items.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusItem(index + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusItem(index - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusItem(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusItem(-1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  // Hover opens on devices with a fine pointer; touch and keyboard use the button.
  const canHover = () => window.matchMedia?.('(hover: hover) and (min-width: 960px)').matches
  const onEnter = () => {
    if (!canHover()) return
    clearTimeout(hoverTimer.current)
    setOpen(true)
  }
  const onLeave = () => {
    if (!canHover()) return
    hoverTimer.current = setTimeout(() => setOpen(false), 180)
  }

  return (
    <li
      className="nav-dropdown"
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`nav-link${childActive ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
      >
        {item.label}
        <Icon name="chevron" className="chev" />
      </button>
      <div id={panelId} className="dropdown-panel" hidden={!open} onKeyDown={onPanelKey}>
        <ul>
          {item.children.map((child) => (
            <li key={child.system_key ?? child.id}>
              <SmartLink item={child} onClick={onNavigate}>
                <span>{child.label}</span>
                <Icon name="arrow" className="dd-hint" />
              </SmartLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}

export default function Header() {
  const site = useSite()
  const nav = site?.data?.nav?.length ? site.data.nav : DEFAULT_NAV
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const toggleRef = useRef(null)

  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('nav-locked', menuOpen)
    if (!menuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('nav-locked')
    }
  }, [menuOpen])

  const close = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand" aria-label="VGLUG Foundation home">
          <img className="brand-logo" src="/vglug-logo-128.png" alt="" width="48" height="48" />
          <span className="brand-text">
            <span className="brand-name">VGLUG Foundation</span>
            <span className="brand-sub">Viluppuram GNU/Linux Users Group</span>
          </span>
        </Link>

        <nav aria-label="Main" className={`main-nav${menuOpen ? ' is-open' : ''}`} id="main-nav">
          <ul>
            {nav.map((item) =>
              item.children?.length ? (
                <Dropdown key={item.system_key ?? item.id} item={item} onNavigate={close} />
              ) : (
                <li key={item.system_key ?? item.id}>
                  <SmartLink item={item} className={`nav-link${item.system_key === 'join' ? ' nav-cta' : ''}`} onClick={close}>
                    {item.label}
                  </SmartLink>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <button
            ref={toggleRef}
            type="button"
            className="btn btn-outline btn-icon menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  )
}
