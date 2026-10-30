import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export const THEME_KEY = 'vglug-theme'
const ThemeContext = createContext({ theme: 'light', toggle: () => {}, setTheme: () => {} })

function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage may be unavailable (private mode); fall back to the system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#170a0c' : '#46050d')
  }, [theme])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Ignore storage failures; the theme still applies for this visit.
    }
  }, [])

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])
  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
