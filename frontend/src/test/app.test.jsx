import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Comments from '../components/Comments'
import Header from '../components/Header'
import ThemeToggle from '../components/ThemeToggle'
import { ThemeProvider, THEME_KEY } from '../context/ThemeContext'
import { SiteProvider } from '../context/SiteContext'

function mockFetch(routes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    const key = `${opts.method || 'GET'} ${url}`
    const match = Object.entries(routes).find(([k]) => key.startsWith(k))
    const [status, body] = match ? match[1] : [404, { error: { code: 'not_found', message: 'Not found' } }]
    return { ok: status < 400, status, json: async () => body }
  })
}

const SITE = {
  data: {
    nav: [
      { id: 1, system_key: 'home', label: 'Home', url: '/', children: [] },
      { id: 2, system_key: 'explore', label: 'Explore', url: '', children: [
        { id: 3, system_key: 'meetups', label: 'Meetups', url: '/meetups', children: [] },
        { id: 4, system_key: 'events', label: 'Events', url: '/events', children: [] },
        { id: 5, system_key: 'blogs', label: 'Blogs', url: '/blogs', children: [] },
      ] },
      { id: 6, system_key: 'about', label: 'About Us', url: '/about', children: [] },
      { id: 7, system_key: 'join', label: 'Join Us', url: '/join', children: [] },
      { id: 8, system_key: 'contact', label: 'Contact Us', url: '/contact', children: [] },
    ],
    footer_links: [],
    footer: {},
    features: { subscriptions: false, comments_require_approval: true, comment_max_length: 2000 },
  },
}

function renderHeader() {
  mockFetch({ 'GET /api/site': [200, SITE] })
  return render(
    <ThemeProvider>
      <SiteProvider>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </SiteProvider>
    </ThemeProvider>,
  )
}

describe('theme', () => {
  it('toggles and persists the theme preference', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    expect(document.documentElement.dataset.theme).toBe('light')
    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    unmount()
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument()
  })
})

describe('navigation', () => {
  it('renders items in the required order', async () => {
    renderHeader()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const top = within(nav).getAllByRole('listitem').filter((li) => li.parentElement.parentElement === nav)
    expect(top.map((li) => li.querySelector('a,button').textContent.trim())).toEqual(['Home', 'Explore', 'About Us', 'Join Us', 'Contact Us'])
    expect(within(nav).getByRole('link', { name: 'Join Us' })).toHaveAttribute('href', '/join')
  })

  it('Explore dropdown works with keyboard and click', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: /explore/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    button.focus()
    await act(async () => {
      fireEvent.keyDown(button, { key: 'ArrowDown' })
      await new Promise((r) => requestAnimationFrame(r))
    })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const links = screen.getAllByRole('link').filter((a) => ['/meetups', '/events', '/blogs'].includes(a.getAttribute('href')))
    expect(links.map((a) => a.textContent)).toEqual(['Meetups', 'Events', 'Blogs'])
    expect(document.activeElement).toBe(links[0])

    fireEvent.keyDown(links[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(links[1])
    fireEvent.keyDown(links[1], { key: 'Escape' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(button)

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('mobile menu toggle exposes its state', async () => {
    const user = userEvent.setup()
    renderHeader()
    const toggle = screen.getByRole('button', { name: /open menu/i })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveClass('is-open')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('comments', () => {
  it('renders visitor text as text, never HTML, and submits anonymously', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({
      'GET /api/site': [200, SITE],
      'GET /api/content/7/comments': [200, { data: [{ id: 1, author_name: 'Eve', body: '<img src=x onerror=alert(1)>', created_at: '2026-01-01T00:00:00Z' }], meta: { total: 1, pages: 1 } }],
      'POST /api/content/7/comments': [201, { data: { status: 'pending', message: 'Thanks! Your comment will appear after a moderator approves it.' } }],
    })
    const { container } = render(<SiteProvider><MemoryRouter><Comments contentId={7} /></MemoryRouter></SiteProvider>)
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('.comment-list img')).toBeNull()

    await user.type(screen.getByLabelText('Comment'), 'Lovely meetup')
    await user.click(screen.getByRole('button', { name: /post comment/i }))
    expect(await screen.findByText(/after a moderator approves/i)).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST')
    expect(post[1].headers['X-Requested-With']).toBe('fetch')
    expect(JSON.parse(post[1].body)).toMatchObject({ body: 'Lovely meetup', website: '' })
  })
})
