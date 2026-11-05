import { Link } from 'react-router-dom'

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p style={{ marginTop: 'var(--space-3)' }}>{label}</p>
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="state" role="alert">
      <div className="state-glyph" aria-hidden="true">[ ! ]</div>
      <h2>{title}</h2>
      <p>{error?.message || 'Please try again in a moment.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children, glyph = '[ ]' }) {
  return (
    <div className="state">
      <div className="state-glyph" aria-hidden="true">{glyph}</div>
      <h2>{title}</h2>
      {children}
    </div>
  )
}

export function NotFoundState({ title = 'Page not found', message = 'The page you are looking for does not exist or is no longer available.' }) {
  return (
    <div className="state">
      <div className="state-glyph" aria-hidden="true">404</div>
      <h1 style={{ fontSize: '2rem' }}>{title}</h1>
      <p>{message}</p>
      <Link to="/" className="btn">Go to the home page</Link>
    </div>
  )
}

export function CardSkeletons({ count = 3 }) {
  return (
    <div className="content-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="sk-media skeleton" />
          <div className="sk-line short skeleton" />
          <div className="sk-line title skeleton" />
          <div className="sk-line skeleton" />
          <div className="sk-line skeleton" />
          <div className="sk-pad" />
        </div>
      ))}
    </div>
  )
}
