import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useOnClickOutside } from '../hooks/useApi'
import Icon, { SocialIcon } from './Icon'

let toastTimer
export function showToast(message) {
  let el = document.getElementById('vglug-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'vglug-toast'
    el.className = 'toast'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  el.textContent = message
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    el.hidden = true
  }, 3200)
}

export function LikeButton({ contentId, initialCount = 0, initialLiked = false, compact = false }) {
  const [state, setState] = useState({ count: initialCount, liked: initialLiked })
  const [busy, setBusy] = useState(false)

  useEffect(() => setState({ count: initialCount, liked: initialLiked }), [initialCount, initialLiked])

  const toggle = async () => {
    if (busy) return
    const prev = state
    const next = { liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) }
    setState(next) // optimistic
    setBusy(true)
    try {
      const url = `/api/content/${contentId}/like`
      const res = prev.liked ? await api.del(url) : await api.post(url)
      setState({ count: res.data.like_count, liked: res.data.liked })
    } catch (err) {
      setState(prev)
      showToast(err.status === 429 ? 'You are doing that too often. Please wait a moment.' : 'Could not update your like. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`action-btn${busy ? ' is-busy' : ''}`}
      aria-pressed={state.liked}
      onClick={toggle}
      aria-label={`${state.liked ? 'Unlike' : 'Like'} (${state.count} ${state.count === 1 ? 'like' : 'likes'})`}
    >
      <Icon name="heart" />
      <span className="count" aria-hidden="true">{state.count}</span>
      {!compact && <span aria-hidden="true">{state.liked ? 'Liked' : 'Like'}</span>}
    </button>
  )
}

export function ShareButton({ path, title, placement = 'above', compact = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOnClickOutside(ref, () => setOpen(false), open)
  const url = `${window.location.origin}${path}`
  const enc = encodeURIComponent

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied to clipboard')
    } catch {
      window.prompt('Copy this link:', url)
    }
    setOpen(false)
  }

  const onClick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    setOpen((o) => !o)
  }

  const targets = [
    { name: 'X', platform: 'x', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { name: 'Facebook', platform: 'facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { name: 'LinkedIn', platform: 'linkedin', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { name: 'WhatsApp', platform: 'whatsapp', href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { name: 'Telegram', platform: 'telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}` },
  ]

  return (
    <div className="share-menu" ref={ref} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button type="button" className="action-btn" aria-expanded={open} aria-haspopup="true" onClick={onClick} aria-label={`Share “${title}”`}>
        <Icon name="share" />
        {!compact && <span>Share</span>}
      </button>
      {open && (
        <div className={`share-panel${placement === 'below' ? ' below' : ''}`}>
          <button type="button" onClick={copy}>
            <Icon name="link" /> Copy link
          </button>
          {targets.map((t) => (
            <a key={t.name} href={t.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <SocialIcon platform={t.platform} /> {t.name}
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          ))}
          <a href={`mailto:?subject=${enc(title)}&body=${enc(url)}`} onClick={() => setOpen(false)}>
            <Icon name="mail" /> Email
          </a>
        </div>
      )}
    </div>
  )
}
