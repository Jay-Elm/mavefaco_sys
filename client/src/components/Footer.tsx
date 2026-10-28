import Link from 'next/link'
import { MapPin, Mail, Phone } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import Logo from '@/components/Logo'

// Contact details come from the administrator's Coop Info settings, the
// same source as the About page, so the two never disagree.
async function getContact() {
  try {
    const rows = await prisma.siteContent.findMany({
      where: { key: { in: ['cooperative_name', 'contact_address', 'contact_email', 'contact_phone'] } },
    })
    return Object.fromEntries(rows.map((r) => [r.key, r.value.trim()])) as Record<string, string | undefined>
  } catch {
    return {}
  }
}

const linkCls = 'hover:text-white transition-colors'

export default async function Footer() {
  const contact = await getContact()
  const name = contact.cooperative_name || 'Mayon Vegetable Farmers Agriculture Cooperative'

  return (
    <footer className="shrink-0 bg-soil text-white/70">
      <div className="max-w-[1200px] mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 text-sm">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Logo variant="light" height={34} />
            <span className="font-display text-2xl font-extrabold leading-none">MaVeFaCo</span>
          </div>
          <p className="mt-4 leading-relaxed max-w-[32ch]">
            {name}. Member farmers in Albay selling their harvest directly to customers.
          </p>
        </div>

        <nav aria-label="Marketplace">
          <h2 className="font-semibold text-white mb-4">Marketplace</h2>
          <ul className="space-y-3">
            <li><Link href="/products" className={linkCls}>Browse products</Link></li>
            <li><Link href="/about" className={linkCls}>About the cooperative</Link></li>
            <li><Link href="/register" className={linkCls}>Create an account</Link></li>
            <li><Link href="/login" className={linkCls}>Log in</Link></li>
          </ul>
        </nav>

        <nav aria-label="For farmers">
          <h2 className="font-semibold text-white mb-4">For farmers</h2>
          <ul className="space-y-3">
            <li><Link href="/register" className={linkCls}>Join as a farmer</Link></li>
            <li><Link href="/farmer" className={linkCls}>Farmer dashboard</Link></li>
            <li><Link href="/farmer/products/new" className={linkCls}>List a product</Link></li>
            <li><Link href="/farmer/crops" className={linkCls}>Crop monitoring</Link></li>
          </ul>
        </nav>

        {(contact.contact_address || contact.contact_email || contact.contact_phone) && (
          <div>
            <h2 className="font-semibold text-white mb-4">Contact</h2>
            <ul className="space-y-3">
              {contact.contact_address && (
                <li className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{contact.contact_address}</span>
                </li>
              )}
              {contact.contact_email && (
                <li className="flex items-center gap-2">
                  <Mail size={14} className="shrink-0" aria-hidden="true" />
                  <a href={`mailto:${contact.contact_email}`} className={linkCls}>{contact.contact_email}</a>
                </li>
              )}
              {contact.contact_phone && (
                <li className="flex items-center gap-2">
                  <Phone size={14} className="shrink-0" aria-hidden="true" />
                  <span>{contact.contact_phone}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 py-5 text-sm text-white/50">
          © {new Date().getFullYear()} {name}
        </div>
      </div>
    </footer>
  )
}
