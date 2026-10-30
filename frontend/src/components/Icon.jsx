import {
  siFacebook, siGithub, siGitlab, siInstagram, siMastodon, siMatrix, siTelegram, siWhatsapp, siX, siYoutube,
} from 'simple-icons'

// Square-stroke line icons, 24×24. Decorative by default (aria-hidden); give the
// surrounding control an accessible name instead.
const PATHS = {
  sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M8 8h8v8H8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M5 5l14 14M19 5 5 19',
  chevron: 'M6 9l6 6 6-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  heart: 'M12 20s-7-4.4-9-9c-1.2-2.8.6-6 3.8-6 2 0 3.4 1.2 5.2 3 1.8-1.8 3.2-3 5.2-3 3.2 0 5 3.2 3.8 6-2 4.6-9 9-9 9z',
  comment: 'M4 4h16v12H9l-5 4z',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v8h14v-8',
  link: 'M10 14l4-4M8 11l-3 3a3 3 0 0 0 4 4l3-3M16 13l3-3a3 3 0 0 0-4-4l-3 3',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  clock: 'M12 7v5l3 3M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  pin: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  phone: 'M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14 7 22l5-3 5 3-1.5-8',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  check: 'M4 12l5 5L20 6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M18 13l-6 6-6-6',
  image: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  video: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 15v5h16v-5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  home: 'M3 11l9-8 9 8M5 9v12h14V9',
  layout: 'M3 3h18v18H3zM3 9h18M9 9v12',
  nav: 'M3 5h18M3 12h12M3 19h6',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 4h14l2 9v7H3v-7z',
  logout: 'M15 4h5v16h-5M10 8l-4 4 4 4M6 12h11',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M19 14a6 6 0 0 1 3 5v2',
  file: 'M6 3h9l5 5v13H6zM14 3v6h6',
  refresh: 'M20 11a8 8 0 0 0-14.7-4M4 4v4h4M4 13a8 8 0 0 0 14.7 4M20 20v-4h-4',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2',
}

export default function Icon({ name, className = '', title, ...rest }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name] || PATHS.link} />
    </svg>
  )
}

const BRANDS = {
  facebook: siFacebook,
  x: siX,
  instagram: siInstagram,
  youtube: siYoutube,
  github: siGithub,
  gitlab: siGitlab,
  mastodon: siMastodon,
  telegram: siTelegram,
  whatsapp: siWhatsapp,
  matrix: siMatrix,
}

export const PLATFORM_LABELS = {
  facebook: 'Facebook',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  github: 'GitHub',
  gitlab: 'GitLab',
  mastodon: 'Mastodon',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  matrix: 'Matrix',
  website: 'Website',
}

export function SocialIcon({ platform }) {
  const brand = BRANDS[platform]
  if (brand) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="icon-fill">
        <path d={brand.path} />
      </svg>
    )
  }
  if (platform === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="icon-fill">
        <path d="M3 3h18v18H3zM6.5 10v7.5h2.6V10zM7.8 5.8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM10.9 10v7.5h2.6v-4c0-1.1.7-1.6 1.5-1.6s1.3.5 1.3 1.6v4h2.6v-4.6c0-2.3-1.3-3.1-2.8-3.1-1.2 0-2 .6-2.6 1.3V10z" fillRule="evenodd" />
      </svg>
    )
  }
  return <Icon name="globe" />
}
