import Image from 'next/image'

// The drawing's own proportions (viewBox 1955 × 646), so it never stretches.
const RATIO = 1955 / 646

/**
 * The cooperative's logo: Mayon with furrows and the sun.
 * `light` has off-white furrows for the dark navbar, footer and sidebars.
 * Leave `alt` empty when the name is written right beside it.
 */
export default function Logo({
  variant = 'color',
  height,
  alt = '',
  className = '',
  priority = false,
}: {
  variant?: 'color' | 'light'
  height: number
  alt?: string
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={variant === 'light' ? '/logo-light.svg' : '/logo.svg'}
      alt={alt}
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      className={`shrink-0 ${className}`}
    />
  )
}
