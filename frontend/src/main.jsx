import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/source-sans-3'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import './styles/tokens.css'
import './styles/base.css'
import './styles/public.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
