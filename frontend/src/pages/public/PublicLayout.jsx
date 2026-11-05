import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Footer, { NewsletterBand } from '../../components/Footer'
import Header from '../../components/Header'

export default function PublicLayout() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (target) {
        target.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
        <Outlet />
      </main>
      <NewsletterBand />
      <Footer />
    </>
  )
}
