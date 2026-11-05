import { useState } from 'react'
import { api } from '../api/client'
import { useSite } from '../context/SiteContext'
import { useApi } from '../hooks/useApi'
import { formatDate } from '../lib/format'
import { ErrorState } from './States'

export default function Comments({ contentId, onPosted }) {
  const site = useSite()
  const maxLength = site?.data?.features?.comment_max_length || 2000
  const [page, setPage] = useState(1)
  const list = useApi(`/api/content/${contentId}/comments?page=${page}`)
  const [form, setForm] = useState({ author_name: '', body: '', website: '' })
  const [state, setState] = useState({ status: 'idle', message: '', fields: {} })

  const submit = async (e) => {
    e.preventDefault()
    setState({ status: 'busy', message: '', fields: {} })
    try {
      const res = await api.post(`/api/content/${contentId}/comments`, form)
      setState({ status: 'done', message: res.data.message, fields: {} })
      setForm({ author_name: '', body: '', website: '' })
      if (res.data.status === 'approved') {
        list.reload()
        onPosted?.()
      }
    } catch (err) {
      setState({ status: 'error', message: err.message, fields: err.fields })
    }
  }

  const comments = list.data || []
  const total = list.meta?.total ?? 0

  return (
    <section className="comments" aria-labelledby="comments-title">
      <h2 id="comments-title">
        Comments <span className="muted mono" style={{ fontSize: '1rem' }}>({total})</span>
      </h2>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} title="Comments could not be loaded" />
      ) : comments.length === 0 && !list.loading ? (
        <p className="muted">No comments yet. Start the conversation.</p>
      ) : (
        <ol className="comment-list">
          {comments.map((c) => (
            <li className="comment" key={c.id}>
              <div className="comment-head">
                <span className="comment-author">{c.author_name}</span>
                <time className="comment-date" dateTime={c.created_at}>{formatDate(c.created_at)}</time>
              </div>
              {/* Visitor text is rendered as plain text (React escapes it). */}
              <p className="comment-body">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      {list.meta?.pages > 1 && (
        <div className="pagination" style={{ marginTop: 0, marginBottom: 'var(--space-5)' }}>
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="page-info">{page} / {list.meta.pages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= list.meta.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <form className="comment-form" onSubmit={submit} noValidate>
        <h3>Leave a comment</h3>
        <p className="muted" style={{ fontSize: '0.92rem' }}>
          No account needed. {site?.data?.features?.comments_require_approval && 'Comments appear after moderation. '}
          Please be respectful.
        </p>
        <div className="field">
          <label htmlFor="c-name">Name <span className="muted">(optional)</span></label>
          <input id="c-name" className="input" maxLength={80} autoComplete="name" value={form.author_name}
            onChange={(e) => setForm({ ...form, author_name: e.target.value })}
            aria-invalid={Boolean(state.fields.author_name)} aria-describedby={state.fields.author_name ? 'c-name-err' : undefined} />
          {state.fields.author_name && <p className="error" id="c-name-err">{state.fields.author_name}</p>}
        </div>
        <div className="field">
          <label htmlFor="c-body">Comment</label>
          <textarea id="c-body" className="textarea" required maxLength={maxLength} value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            aria-invalid={Boolean(state.fields.body)} aria-describedby={`c-count${state.fields.body ? ' c-body-err' : ''}`} />
          <div className="char-count" id="c-count">{form.body.length} / {maxLength}</div>
          {state.fields.body && <p className="error" id="c-body-err">{state.fields.body}</p>}
        </div>
        <div className="hp-field" aria-hidden="true">
          <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
        </div>
        <div role="status" aria-live="polite">
          {state.status === 'done' && <div className="notice notice-success"><p>{state.message}</p></div>}
          {state.status === 'error' && <div className="notice notice-error"><p>{state.message}</p></div>}
        </div>
        <button className="btn" type="submit" disabled={state.status === 'busy' || form.body.trim().length < 2}>
          {state.status === 'busy' ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </section>
  )
}
