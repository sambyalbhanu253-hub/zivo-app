export type IconName =
  | 'home'
  | 'shorts'
  | 'create'
  | 'discover'
  | 'profile'
  | 'sparkles'
  | 'play'
  | 'arrow'
  | 'heart'
  | 'volumeOn'
  | 'volumeOff'
  | 'share'
  | 'messages'

type IconProps = {
  name: IconName
  size?: number
}

export default function Icon({ name, size = 20 }: IconProps) {
  const shared = {
    'aria-hidden': true as const,
    fill: 'none',
    height: size,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    width: size,
  }

  switch (name) {
    case 'home':
      return <svg {...shared}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>
    case 'shorts':
      return <svg {...shared}><rect x="4" y="3" width="16" height="18" rx="4" /><path d="m10 8 5 4-5 4z" /></svg>
    case 'create':
      return <svg {...shared}><path d="M12 5v14M5 12h14" /></svg>
    case 'discover':
      return <svg {...shared}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5M8.5 13l1.4-3.2 3.2-1.4-1.4 3.2z" /></svg>
    case 'profile':
      return <svg {...shared}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
    case 'sparkles':
      return <svg {...shared}><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2zM19 14l1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1z" /></svg>
    case 'play':
      return <svg {...shared}><path d="m9 6 10 6-10 6z" /></svg>
    case 'arrow':
      return <svg {...shared}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
    case 'heart':
      return <svg {...shared}><path d="M20.8 8.8c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z" /></svg>
    case 'volumeOn':
      return <svg {...shared}><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" /></svg>
    case 'volumeOff':
      return <svg {...shared}><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6" /></svg>
    case 'share':
      return <svg {...shared}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.5 6.6-4m-6.6 7 6.6 4" /></svg>
    case 'messages':
      return <svg {...shared}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></svg>
  }
}
