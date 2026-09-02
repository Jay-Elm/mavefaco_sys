import { prisma } from "@/lib/prisma";
import { Leaf, Mail, Phone, MapPin, Globe, HelpCircle, Target, Eye } from "lucide-react";

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

  const name    = content.cooperative_name || "CoopMarket Farmers Cooperative";
  const about   = content.about_text || "We connect local farmers with customers — fresh produce, fair prices, and a stronger community.";
  const mission = content.mission || "";
  const vision  = content.vision || "";
  const email   = content.contact_email || "";
  const phone   = content.contact_phone || "";
  const address = content.contact_address || "";
  const fbUrl   = content.facebook_url || "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-700 to-green-900 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <Leaf size={44} className="text-green-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{name}</h1>
          <p className="text-green-200 text-lg max-w-xl mx-auto">{about}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        {/* Mission & Vision */}
        {(mission || vision) && (
          <section className="grid sm:grid-cols-2 gap-6">
            {mission && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 text-green-700 font-semibold mb-3">
                  <Target size={18} /> Mission
                </div>
                <p className="text-gray-600 text-sm whitespace-pre-wrap">{mission}</p>
              </div>
            )}
            {vision && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 text-green-700 font-semibold mb-3">
                  <Eye size={18} /> Vision
                </div>
                <p className="text-gray-600 text-sm whitespace-pre-wrap">{vision}</p>
              </div>
            )}
          </section>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
              <HelpCircle size={20} className="text-green-600" />
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm group"
                >
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-medium text-gray-900 text-sm list-none">
                    {faq.question}
                    <span className="text-gray-400 group-open:rotate-180 transition-transform ml-4">▾</span>
                  </summary>
                  <div className="px-5 pb-4 text-sm text-gray-600 whitespace-pre-wrap border-t border-gray-100 pt-3">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Contact */}
        {(email || phone || address || fbUrl) && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-5">Contact Us</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              {email && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Mail size={16} className="text-green-600 shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-green-700">{email}</a>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Phone size={16} className="text-green-600 shrink-0" />
                  <span>{phone}</span>
                </div>
              )}
              {address && (
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <MapPin size={16} className="text-green-600 shrink-0 mt-0.5" />
                  <span>{address}</span>
                </div>
              )}
              {fbUrl && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Globe size={16} className="text-green-600 shrink-0" />
                  <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="hover:text-green-700 break-all">{fbUrl}</a>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
