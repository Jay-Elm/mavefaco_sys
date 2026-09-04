import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import HomeRedirect from "@/components/HomeRedirect";
import HomeHeroActions from "@/components/HomeHeroActions";
import HomeBottomCTAButtons from "@/components/HomeBottomCTAButtons";
import { ShoppingBag, Leaf, ArrowRight, Info, AlertTriangle, Package, Users, CheckCircle, Star } from "lucide-react";

async function getFeaturedProducts() {
  return prisma.product.findMany({
    take: 6,
    where: { approved: true },
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      farmer: { select: { id: true, name: true, email: true } },
    },
  });
}

async function getBanners() {
  return prisma.banner.findMany({
    where: { active: true },
    orderBy: { displayOrder: "asc" },
  });
}

async function getAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
}

async function getStats() {
  const [farmers, products, orders] = await Promise.all([
    prisma.user.count({ where: { role: "farmer", verified: true } }),
    prisma.product.count({ where: { approved: true } }),
    prisma.order.count({ where: { status: "delivered" } }),
  ]);
  return { farmers, products, orders };
}

async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { approved: true } } } } },
  });
}

const BANNER_BG: Record<string, string> = {
  green:  "bg-gradient-to-r from-green-600 to-green-800",
  orange: "bg-gradient-to-r from-orange-500 to-orange-700",
  blue:   "bg-gradient-to-r from-blue-600 to-blue-800",
  purple: "bg-gradient-to-r from-purple-600 to-purple-800",
  teal:   "bg-gradient-to-r from-teal-600 to-teal-800",
};

const ANNOUNCEMENT_STYLES = {
  info:     { bar: "bg-blue-500",   bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800",   icon: Info },
  alert:    { bar: "bg-amber-500",  bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  icon: AlertTriangle },
  advisory: { bar: "bg-green-600",  bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800",  icon: Leaf },
} as const;

const CATEGORY_COLORS = [
  "bg-green-50 text-green-800 border border-green-200 hover:bg-green-100",
  "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100",
  "bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100",
  "bg-lime-50 text-lime-800 border border-lime-200 hover:bg-lime-100",
  "bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100",
  "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100",
  "bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100",
  "bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100",
];

const TESTIMONIALS = [
  {
    name: "Maria Santos",
    role: "Customer, Legazpi City",
    quote: "I used to drive to the market every weekend. Now the same vegetables — fresher — show up at my door. The farmers are real people I can message directly.",
    rating: 5,
    initials: "MS",
  },
  {
    name: "Jose Reyes",
    role: "Farmer, Daraga, Albay",
    quote: "Before this, I sold at 30% of what I should because of middlemen. Now I set my own price and know exactly who's buying.",
    rating: 5,
    initials: "JR",
  },
  {
    name: "Ana Cruz",
    role: "Customer, Tabaco City",
    quote: "I can see which farm my kangkong came from and when it was harvested. That matters to me.",
    rating: 5,
    initials: "AC",
  },
];

export default async function HomePage() {
  const [featuredProducts, announcements, banners, stats, categories] = await Promise.all([
    getFeaturedProducts(),
    getAnnouncements(),
    getBanners(),
    getStats(),
    getCategories(),
  ]);

  const hasStats = stats.farmers > 0 || stats.products > 0 || stats.orders > 0;

  return (
    <div className="bg-white">
      <HomeRedirect />

      {/* ── HERO — split layout ──────────────────────────── */}
      <section className="flex flex-col lg:flex-row" style={{ minHeight: "580px" }}>

        {/* Left: text panel */}
        <div
          className="flex flex-col justify-center px-8 sm:px-14 lg:px-16 py-16 lg:py-0 lg:w-[56%]"
          style={{ backgroundColor: "#1B3A2D" }}
        >
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight hero-line-1">
            Buy fresh<br />
            from Albay<br />
            farmers.
          </h1>

          <p className="mt-6 text-green-200 text-lg leading-relaxed max-w-md hero-line-2">
            CoopMarket cuts out the middlemen. Order directly from verified local farmers and get produce harvested within the day.
          </p>

          <HomeHeroActions />

          {hasStats && (
            <div className="mt-12 pt-8 border-t border-white/10 flex gap-8 hero-line-3">
              {stats.farmers > 0 && (
                <div>
                  <div className="font-serif text-2xl font-bold text-white">{stats.farmers}+</div>
                  <div className="text-green-400 text-xs mt-0.5">Verified farmers</div>
                </div>
              )}
              {stats.products > 0 && (
                <div>
                  <div className="font-serif text-2xl font-bold text-white">{stats.products}+</div>
                  <div className="text-green-400 text-xs mt-0.5">Fresh products</div>
                </div>
              )}
              {stats.orders > 0 && (
                <div>
                  <div className="font-serif text-2xl font-bold text-white">{stats.orders}+</div>
                  <div className="text-green-400 text-xs mt-0.5">Orders delivered</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: photo panel */}
        <div
          className="w-full lg:w-[44%] h-56 sm:h-72 lg:h-auto relative overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url('https://images.unsplash.com/photo-1542838132-92c53300491e?w=1080&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </div>
      </section>

      {/* ── BANNERS ───────────────────────────────────────── */}
      {banners.length > 0 && (
        <section className="py-8 px-6 bg-[#F3F7F4]">
          <div className="max-w-5xl mx-auto space-y-4">
            {banners.map((b) => (
              <div key={b.id} className={`rounded-xl overflow-hidden text-white ${BANNER_BG[b.color] ?? BANNER_BG.green}`}>
                <div className="px-7 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-lg font-semibold">{b.title}</h3>
                    {b.subtitle && <p className="text-white/75 text-sm mt-0.5">{b.subtitle}</p>}
                  </div>
                  {b.ctaText && b.ctaLink && (
                    <Link href={b.ctaLink} className="shrink-0 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm">
                      {b.ctaText} <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── ANNOUNCEMENTS ─────────────────────────────────── */}
      {announcements.length > 0 && (
        <section className="py-6 px-6 bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto space-y-3">
            {announcements.map((a) => {
              const style = ANNOUNCEMENT_STYLES[a.type as keyof typeof ANNOUNCEMENT_STYLES] ?? ANNOUNCEMENT_STYLES.info;
              const Icon = style.icon;
              return (
                <div key={a.id} className={`flex rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
                  <div className={`w-1 shrink-0 ${style.bar}`} />
                  <div className="py-3 px-4">
                    <div className={`flex items-center gap-2 font-semibold text-sm ${style.text} mb-0.5`}>
                      <Icon size={13} />
                      {a.title}
                    </div>
                    <p className={`text-sm ${style.text} opacity-90`}>{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(a.createdAt).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mb-14">
            How it works
          </h2>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6">
            {/* Connecting line — only on sm+ */}
            <div className="hidden sm:block absolute top-6 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-gray-200" />

            {[
              {
                n: "1",
                icon: <Users size={20} className="text-[#1B3A2D]" />,
                title: "Farmers list products",
                desc: "Verified Albay farmers post their harvest directly — what was picked this morning can be on sale by noon.",
              },
              {
                n: "2",
                icon: <ShoppingBag size={20} className="text-[#1B3A2D]" />,
                title: "Customers order directly",
                desc: "Browse by category, read what the farmer wrote about their produce, and place an order in minutes.",
              },
              {
                n: "3",
                icon: <CheckCircle size={20} className="text-[#1B3A2D]" />,
                title: "Fresh, fair, and local",
                desc: "Shorter supply chains mean better prices for both sides — and you always know exactly where your food came from.",
              },
            ].map((step) => (
              <div key={step.n} className="relative flex flex-col items-start sm:items-center sm:text-center">
                <div className="w-12 h-12 rounded-full border-2 border-[#1B3A2D] bg-white flex items-center justify-center mb-5 relative z-10">
                  <span className="font-serif text-lg font-bold text-[#1B3A2D]">{step.n}</span>
                </div>
                <h3 className="font-serif font-semibold text-gray-900 text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[240px]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ────────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="py-16 px-6 bg-[#F3F7F4]">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
              Shop by category
            </h2>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat, i) => (
                <Link
                  key={cat.id}
                  href={`/products?categoryId=${cat.id}`}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                >
                  {cat.name}
                  {cat._count.products > 0 && (
                    <span className="opacity-50 text-xs">({cat._count.products})</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURED PRODUCTS ─────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900">
              Latest products
            </h2>
            <Link href="/products" className="hidden sm:inline-flex items-center gap-1.5 text-[#1B3A2D] hover:underline text-sm font-medium">
              View all <ArrowRight size={15} />
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-20 bg-[#F3F7F4] rounded-2xl border border-dashed border-green-200">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={28} className="text-green-400" />
              </div>
              <p className="text-gray-600 font-medium mb-1">No products yet</p>
              <p className="text-gray-400 text-sm mb-6">Be the first farmer to list fresh produce.</p>
              <Link href="/register" className="inline-flex items-center gap-2 bg-[#1B3A2D] hover:bg-[#2E6649] text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm">
                Register as a farmer <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="sm:hidden text-center mt-8">
                <Link href="/products" className="inline-flex items-center gap-2 text-[#1B3A2D] font-medium hover:underline text-sm">
                  View all products <ArrowRight size={15} />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── TESTIMONIALS — asymmetric layout ──────────────── */}
      <section className="py-20 px-6 bg-[#F3F7F4]">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mb-10">
            What farmers and customers say
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Featured testimonial */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex gap-0.5 mb-6">
                  {Array.from({ length: TESTIMONIALS[0].rating }).map((_, i) => (
                    <Star key={i} size={15} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="font-serif text-xl text-gray-800 leading-relaxed">
                  &ldquo;{TESTIMONIALS[0].quote}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
                <div className="w-10 h-10 rounded-full bg-[#1B3A2D] text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {TESTIMONIALS[0].initials}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{TESTIMONIALS[0].name}</div>
                  <div className="text-gray-400 text-xs">{TESTIMONIALS[0].role}</div>
                </div>
              </div>
            </div>

            {/* Two stacked testimonials */}
            <div className="flex flex-col gap-5">
              {TESTIMONIALS.slice(1).map((t) => (
                <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100 flex-1">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-2.5 mt-5">
                    <div className="w-8 h-8 rounded-full bg-[#2E6649] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-xs">{t.name}</div>
                      <div className="text-gray-400 text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────── */}
      <section
        className="relative py-24 px-6 text-white overflow-hidden"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1920&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(27, 58, 45, 0.85)" }} />
        <div className="relative max-w-2xl">
          <h2 className="font-serif text-4xl sm:text-5xl font-bold leading-tight mb-5">
            Ready to grow together?
          </h2>
          <p className="text-green-200 text-lg mb-9 leading-relaxed">
            Whether you grow food or buy it — CoopMarket is your direct line to Albay&apos;s farming community.
          </p>
          <HomeBottomCTAButtons />
        </div>
      </section>

    </div>
  );
}
