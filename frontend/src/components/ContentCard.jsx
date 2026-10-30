import { Link } from 'react-router-dom'
import { EVENT_STATUS_LABEL, TYPE_META, dateParts, eventRange, formatDate } from '../lib/format'
import Icon from './Icon'
import { LikeButton, ShareButton } from './Interactions'

export default function ContentCard({ item, headingLevel = 3 }) {
  const meta = TYPE_META[item.type]
  const H = `h${headingLevel}`
  const ev = item.event
  const chip = ev ? dateParts(ev.starts_at, ev.timezone) : null

  return (
    <article className="content-card">
      <div className="card-media">
        {item.cover ? (
          <img src={item.cover.thumb_url} alt={item.cover.alt_text || ''} loading="lazy" decoding="async"
            width={item.cover.width || 800} height={item.cover.height || 450} />
        ) : (
          <div className="card-media-fallback" aria-hidden="true"><span>{meta.glyph}</span></div>
        )}
        {chip && (
          <div className="card-date-chip" aria-hidden="true">
            <strong>{chip.day}</strong>
            <span>{chip.month}</span>
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span className="type">{meta.label}</span>
          {ev && ev.event_status !== 'scheduled' && <span className={`badge badge-${ev.event_status}`}>{EVENT_STATUS_LABEL[ev.event_status]}</span>}
          {!ev && item.published_at && <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>}
        </div>
        <H className="card-title">
          <Link to={item.path}>{item.title}</Link>
        </H>
        {ev && (
          <div className="card-meta" style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem' }}>
            <span><Icon name="clock" />{eventRange(ev)}</span>
            {(ev.location_name || ev.is_online) && (
              <span><Icon name={ev.is_online ? 'globe' : 'pin'} />{ev.location_name || 'Online'}</span>
            )}
          </div>
        )}
        {item.summary && <p className="card-summary">{item.summary}</p>}
        <div className="card-footer">
          <div className="card-actions">
            <LikeButton contentId={item.id} initialCount={item.like_count} initialLiked={item.liked} compact />
            <Link to={`${item.path}#comments-title`} className="action-btn" aria-label={`${item.comment_count} comments on ${item.title}`}>
              <Icon name="comment" />
              <span className="count" aria-hidden="true">{item.comment_count}</span>
            </Link>
            <ShareButton path={item.path} title={item.title} compact />
          </div>
        </div>
      </div>
    </article>
  )
}
