import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

/** Fetch a GET endpoint; re-runs when `url` changes. Pass null to skip. */
export function useApi(url) {
  const [state, setState] = useState({ data: null, meta: null, error: null, loading: Boolean(url) })
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!url) {
      setState({ data: null, meta: null, error: null, loading: false })
      return undefined
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    api
      .get(url, { signal: controller.signal })
      .then((res) => setState({ data: res.data, meta: res.meta || null, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, meta: null, error, loading: false })
      })
    return () => controller.abort()
  }, [url, version])

  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) }
}

export function useDocumentTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} · VGLUG`
  }, [title])
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function useOnClickOutside(ref, handler, active = true) {
  const saved = useRef(handler)
  saved.current = handler
  useEffect(() => {
    if (!active) return undefined
    const listener = (e) => {
      if (ref.current && !ref.current.contains(e.target)) saved.current(e)
    }
    document.addEventListener('pointerdown', listener)
    return () => document.removeEventListener('pointerdown', listener)
  }, [ref, active])
}
