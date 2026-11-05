// Thin fetch wrapper. All calls are same-origin; the backend requires the
// X-Requested-With header on unsafe methods, and admin calls also send the CSRF token.

let csrfToken = null

export function setCsrfToken(token) {
  csrfToken = token || null
}

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields || {}
  }
}

async function request(method, url, { body, form, signal } = {}) {
  const headers = { Accept: 'application/json', 'X-Requested-With': 'fetch' }
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken
  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(url, { method, headers, body: payload, signal, credentials: 'same-origin' })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection and try again.')
  }
  let json = null
  try {
    json = await res.json()
  } catch {
    // Non-JSON responses (e.g. proxy errors) fall through to a generic error.
  }
  if (!res.ok) {
    const err = json?.error
    throw new ApiError(res.status, err?.code || 'http_error', err?.message || `Request failed (${res.status}).`, err?.fields)
  }
  return json ?? { data: null }
}

export const api = {
  get: (url, opts) => request('GET', url, opts),
  post: (url, body, opts) => request('POST', url, { ...opts, body }),
  put: (url, body, opts) => request('PUT', url, { ...opts, body }),
  patch: (url, body, opts) => request('PATCH', url, { ...opts, body }),
  del: (url, opts) => request('DELETE', url, opts),
  upload: (url, form, opts) => request('POST', url, { ...opts, form }),
}

export function qs(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, v)
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}
