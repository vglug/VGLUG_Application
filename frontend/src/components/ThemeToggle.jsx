import { useTheme } from '../context/ThemeContext'
import Icon from './Icon'

export default function ThemeToggle({ className = 'btn btn-ghost btn-icon' }) {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" className={className} onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}
