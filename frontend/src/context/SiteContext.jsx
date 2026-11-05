import { createContext, useContext } from 'react'
import { useApi } from '../hooks/useApi'

const SiteContext = createContext(null)

export function SiteProvider({ children }) {
  const site = useApi('/api/site')
  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
