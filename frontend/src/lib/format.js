export const TYPE_META = {
  blog: { path: 'blogs', label: 'Blog', plural: 'Blogs', glyph: '{ }' },
  event: { path: 'events', label: 'Event', plural: 'Events', glyph: '[#]' },
  meetup: { path: 'meetups', label: 'Meetup', plural: 'Meetups', glyph: '>_' },
}

export const EVENT_STATUS_LABEL = {
  scheduled: 'Scheduled',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

function safeDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(iso, opts = {}) {
  const d = safeDate(iso)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...opts }).format(d)
}

export function formatDateTime(iso, timeZone) {
  const d = safeDate(iso)
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone,
    }).format(d)
  } catch {
    return formatDate(iso)
  }
}

export function formatTime(iso, timeZone) {
  const d = safeDate(iso)
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone }).format(d)
  } catch {
    return ''
  }
}

export function dateParts(iso, timeZone) {
  const d = safeDate(iso)
  if (!d) return null
  try {
    const fmt = (o) => new Intl.DateTimeFormat('en-IN', { ...o, timeZone }).format(d)
    return { day: fmt({ day: 'numeric' }), month: fmt({ month: 'short' }) }
  } catch {
    return null
  }
}

export function eventRange(event) {
  if (!event) return ''
  const tz = event.timezone
  const start = formatDateTime(event.starts_at, tz)
  if (!event.ends_at) return start
  const sameDay = formatDate(event.starts_at, { timeZone: tz }) === formatDate(event.ends_at, { timeZone: tz })
  return sameDay ? `${start} – ${formatTime(event.ends_at, tz)}` : `${start} – ${formatDateTime(event.ends_at, tz)}`
}

export function isPast(event) {
  if (!event) return false
  const end = safeDate(event.ends_at || event.starts_at)
  return end ? end.getTime() < Date.now() : false
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function isExternal(url) {
  return /^(https?:)?\/\//i.test(url || '') || /^mailto:/i.test(url || '')
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
