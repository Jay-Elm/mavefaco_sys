import { prisma } from "@/lib/prisma";
import { Mail, Phone, MapPin, Globe, ChevronDown } from "lucide-react";
import { isSafeUrl } from "@/lib/url";

async function getSiteData() {
  const [rows, faqs] = await Promise.all([
    prisma.siteContent.findMany(),
    prisma.faq.findMany({ orderBy: { displayOrder: "asc" } }),
  ]);
  const content = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { content, faqs };
}

export default async function AboutPage() {
  const { content, faqs } = await getSiteData();

  const name    = content.cooperative_name || "Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo)";
  const about   = content.about_text || "We connect local farmers with customers — fresh produce, fair prices, and a stronger community.";
  const mission = content.mission || "";
  const vision  = content.vision || "";
  const email   = content.contact_email || "";
  const phone   = content.contact_phone || "";
  const address = content.contact_address || "";
  const fbUrl   = content.facebook_url || "";

  return (
    <div className="bg-white">
      <section className="bg-soil text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-14 lg:py-20">
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[0.95] max-w-[18ch]">{name}</h1>
          <p className="mt-6 text-lg leading-relaxed text-white/80 max-w-[60ch] whitespace-pre-wrap">{about}</p>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6 py-14 space-y-14">
        {(mission || vision) && (
          <section className="grid gap-10 md:grid-cols-2">
            {mission && (
              <div className="border-t-2 border-paddy pt-4">
                <h2 className="font-display text-4xl font-bold">Mission</h2>
                <p className="mt-3 text-[1.05rem] leading-relaxed text-gray-700 max-w-[60ch] whitespace-pre-wrap">{mission}</p>
              </div>
            )}
            {vision && (
              <div className="border-t-2 border-paddy pt-4">
                <h2 className="font-display text-4xl font-bold">Vision</h2>
                <p className="mt-3 text-[1.05rem] leading-relaxed text-gray-700 max-w-[60ch] whitespace-pre-wrap">{vision}</p>
              </div>
            )}
          </section>
        )}

        {faqs.length > 0 && (
          <section className="max-w-3xl">
            <h2 className="font-display text-4xl font-bold">Questions people ask</h2>
            <div className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
              {faqs.map((faq) => (
                <details key={faq.id} className="group">
                  <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer font-semibold list-none">
                    {faq.question}
                    <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-gray-500 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="pb-5 text-gray-700 leading-relaxed whitespace-pre-wrap max-w-[65ch]">{faq.answer}</div>
                </details>
              ))}
            </div>
          </section>
        )}

        {(email || phone || address || fbUrl) && (
          <section>
            <h2 className="font-display text-4xl font-bold">Contact the cooperative</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-[0.95rem]">
              {address && (
                <li className="flex items-start gap-3">
                  <MapPin size={18} aria-hidden="true" className="text-paddy shrink-0 mt-0.5" />
                  <span>{address}</span>
                </li>
              )}
              {email && (
                <li className="flex items-start gap-3">
                  <Mail size={18} aria-hidden="true" className="text-paddy shrink-0 mt-0.5" />
                  <a href={`mailto:${email}`} className="text-paddy hover:underline break-all">{email}</a>
                </li>
              )}
              {phone && (
                <li className="flex items-start gap-3">
                  <Phone size={18} aria-hidden="true" className="text-paddy shrink-0 mt-0.5" />
                  <span>{phone}</span>
                </li>
              )}
              {fbUrl && isSafeUrl(fbUrl) && (
                <li className="flex items-start gap-3">
                  <Globe size={18} aria-hidden="true" className="text-paddy shrink-0 mt-0.5" />
                  <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="text-paddy hover:underline break-all">Facebook page</a>
                </li>
              )}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
