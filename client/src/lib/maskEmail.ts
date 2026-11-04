/**
 * An email address with most of its name hidden, for showing someone their
 * own address without spelling it out on screen: "jayelmeneses@gmail.com"
 * becomes "ja••••••••es@gmail.com". The domain stays readable.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '•'.repeat(Math.max(email.length, 3))
  const name = email.slice(0, at)
  const domain = email.slice(at)
  if (name.length <= 2) return `${name[0]}•${domain}`
  if (name.length <= 4) return `${name[0]}${'•'.repeat(name.length - 1)}${domain}`
  return `${name.slice(0, 2)}${'•'.repeat(name.length - 4)}${name.slice(-2)}${domain}`
}
