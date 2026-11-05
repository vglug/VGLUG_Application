import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { Loading, NotFoundState } from '../../components/States'
import { useDocumentTitle } from '../../hooks/useApi'

function TokenAction({ endpoint, title, doneTitle }) {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState({ status: token ? 'busy' : 'error', message: 'This link is incomplete.' })
  const sent = useRef(false)
  useDocumentTitle(title)

  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    api
      .post(endpoint, { token })
      .then((res) => setState({ status: 'done', message: res.data.message }))
      .catch((err) => setState({ status: 'error', message: err.message }))
  }, [endpoint, token])

  return (
    <div className="container status-page">
      {state.status === 'busy' ? (
        <Loading label="Processing your request…" />
      ) : (
        <div className="state" role={state.status === 'error' ? 'alert' : 'status'}>
          <div className="state-glyph" aria-hidden="true">{state.status === 'done' ? '[✓]' : '[ ! ]'}</div>
          <h1 style={{ fontSize: '2rem' }}>{state.status === 'done' ? doneTitle : 'Link not valid'}</h1>
          <p>{state.message}</p>
          <Link to="/" className="btn">Go to the home page</Link>
        </div>
      )}
    </div>
  )
}

export function ConfirmSubscription() {
  return <TokenAction endpoint="/api/subscriptions/confirm" title="Confirm subscription" doneTitle="Subscription confirmed" />
}

export function Unsubscribe() {
  return <TokenAction endpoint="/api/subscriptions/unsubscribe" title="Unsubscribe" doneTitle="You are unsubscribed" />
}

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return <div className="container status-page"><NotFoundState /></div>
}
