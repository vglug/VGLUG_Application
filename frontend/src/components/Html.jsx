import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Renders HTML that was produced and sanitised by the backend's Markdown boundary
 * (raw HTML disabled + nh3 allow-list). Visitor-submitted text is never passed here.
 * Internal links are routed client-side; broken media get a readable fallback.
 */
export default function Html({ html, className = 'prose', as: Tag = 'div' }) {
  const navigate = useNavigate()
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    // Media "error" events do not bubble, so listen in the capture phase.
    const onError = (e) => {
      const media = e.target
      if ((media.tagName === 'IMG' || media.tagName === 'VIDEO') && !media.dataset.failed) {
        media.dataset.failed = '1'
        const note = document.createElement('p')
        note.className = 'media-fallback'
        const alt = media.getAttribute('alt') || media.getAttribute('title')
        note.textContent = alt ? `Media unavailable: ${alt}` : 'This media could not be loaded.'
        media.replaceWith(note)
      }
    }
    el.addEventListener('error', onError, true)
    return () => el.removeEventListener('error', onError, true)
  }, [html])

  if (!html) return null

  const onClick = (e) => {
    const a = e.target.closest?.('a')
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/media/')) {
      e.preventDefault()
      navigate(href)
    }
  }

  return <Tag ref={ref} className={className} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
