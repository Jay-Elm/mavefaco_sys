import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import {
  ShoppingBag, Users, Leaf, ArrowRight, Info, AlertTriangle,
  CheckCircle, Star, TrendingUp, Package,
} from "lucide-react";

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
  info:     { bar: "bg-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800",   icon: Info },
  alert:    { bar: "bg-amber-500",  bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  icon: AlertTriangle },
  advisory: { bar: "bg-green-600",  bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800",  icon: Leaf },
} as const;

const CATEGORY_COLORS = [
  "bg-green-100 text-green-800 hover:bg-green-200",
  "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
  "bg-teal-100 text-teal-800 hover:bg-teal-200",
  "bg-lime-100 text-lime-800 hover:bg-lime-200",
  "bg-orange-100 text-orange-800 hover:bg-orange-200",
  "bg-amber-100 text-amber-800 hover:bg-amber-200",
  "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  "bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
];

const TESTIMONIALS = [
  {
    name: "Maria Santos",
    role: "Customer, Legazpi City",
    quote: "Finally, I can get fresh vegetables straight from the farm! The quality is amazing and I love knowing exactly who grew my food.",
    rating: 5,
    initials: "MS",
    color: "bg-orange-500",
  },
  {
    name: "Jose Reyes",
    role: "Farmer, Daraga, Albay",
    quote: "CoopMarket has transformed how I sell my harvest. I reach more customers and get fair prices — without middlemen taking a cut.",
    rating: 5,
    initials: "JR",
    color: "bg-green-600",
  },
  {
    name: "Ana Cruz",
    role: "Customer, Tabaco City",
    quote: "Ordering is simple and the products arrive fresh. I've switched to buying all my produce here. Highly recommend!",
    rating: 5,
    initials: "AC",
    color: "bg-teal-600",
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

  return (
    <div className="bg-white">

      {/* ── HERO ──────────────────────────────────────────── */}
      <section
        className="relative text-white overflow-hidden"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1920&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: "540px",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/85 via-green-800/80 to-green-700/70" />

        {/* Decorative leaf pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="leaf-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
          </svg>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-28 text-center">
          <div className="flex justify-center mb-5 animate-fade-in-up animate-delay-100">
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm text-green-200 text-sm font-medium px-4 py-1.5 rounded-full">
              <Leaf size={14} />
              Supporting Filipino Farmers
            </span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight animate-fade-in-up animate-delay-200">
            Fresh from the Farm,
            <br />
            <span className="text-orange-400">Straight to You</span>
          </h1>

          <p className="text-green-100 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animate-delay-300">
            CoopMarket connects local farmers with customers — buy fresh, support local, and grow together as a community.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animate-delay-400">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-orange-500/30 hover:-translate-y-0.5"
            >
              <ShoppingBag size={20} />
              Shop Fresh Produce
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 backdrop-blur-sm hover:-translate-y-0.5"
            >
              Join as a Farmer
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────── */}
      <section className="bg-green-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-3 divide-x divide-green-600">
          {[
            { icon: <Users size={22} />, value: stats.farmers, label: "Verified Farmers" },
            { icon: <Package size={22} />, value: stats.products, label: "Fresh Products" },
            { icon: <CheckCircle size={22} />, value: stats.orders, label: "Orders Delivered" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-2">
              <div className="text-green-300">{stat.icon}</div>
              <div className="text-center sm:text-left">
                <div className="text-2xl sm:text-3xl font-bold font-serif">{stat.value}+</div>
                <div className="text-green-300 text-xs sm:text-sm">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BANNERS ───────────────────────────────────────── */}
      {banners.length > 0 && (
        <section className="py-8 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto space-y-4">
            {banners.map((b) => (
              <div
                key={b.id}
                className={`rounded-2xl overflow-hidden text-white shadow-md ${BANNER_BG[b.color] ?? BANNER_BG.green}`}
              >
                <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold font-serif">{b.title}</h3>
                    {b.subtitle && <p className="text-white/80 text-sm mt-0.5">{b.subtitle}</p>}
                  </div>
                  {b.ctaText && b.ctaLink && (
                    <Link
                      href={b.ctaLink}
                      className="shrink-0 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
                    >
                      {b.ctaText} <ArrowRight size={15} />
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
        <section className="py-6 px-4 bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto space-y-3">
            {announcements.map((a) => {
              const style = ANNOUNCEMENT_STYLES[a.type as keyof typeof ANNOUNCEMENT_STYLES] ?? ANNOUNCEMENT_STYLES.info;
              const Icon = style.icon;
              return (
                <div
                  key={a.id}
                  className={`flex gap-0 rounded-xl border ${style.border} ${style.bg} overflow-hidden shadow-sm`}
                >
                  <div className={`w-1 shrink-0 ${style.bar}`} />
                  <div className="py-3 px-4">
                    <div className={`flex items-center gap-2 font-semibold text-sm ${style.text} mb-0.5`}>
                      <Icon size={14} />
                      {a.title}
                    </div>
                    <p className={`text-sm ${style.text} opacity-90`}>{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(a.createdAt).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                      {a.author?.name && ` · Posted by ${a.author.name}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-green-600 text-sm font-semibold uppercase tracking-widest">Simple & Transparent</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: <Users size={28} className="text-green-600" />,
                title: "Farmers List Products",
                desc: "Verified farmers post their fresh harvest directly to the marketplace — no middlemen, no markups.",
              },
              {
                step: "02",
                icon: <ShoppingBag size={28} className="text-green-600" />,
                title: "Customers Browse & Buy",
                desc: "Browse products by category and place an order directly from the farmer who grew it.",
              },
              {
                step: "03",
                icon: <Leaf size={28} className="text-green-600" />,
                title: "Fresh & Fair for All",
                desc: "Shorter supply chains mean fresher produce, better prices, and stronger local communities.",
              },
            ].map((step) => (
              <div
                key={step.step}
                className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 p-8 group hover:-translate-y-1"
              >
                <span className="absolute top-6 right-6 font-serif text-5xl font-bold text-gray-50 group-hover:text-green-50 transition-colors select-none">
                  {step.step}
                </span>
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-100 transition-colors">
                  {step.icon}
                </div>
                <h3 className="font-serif font-semibold text-gray-900 text-lg mb-3">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ────────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-green-600 text-sm font-semibold uppercase tracking-widest">Shop by Type</span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
                Browse Categories
              </h2>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((cat, i) => (
                <Link
                  key={cat.id}
                  href={`/products?categoryId=${cat.id}`}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                >
                  {cat.name}
                  {cat._count.products > 0 && (
                    <span className="text-xs opacity-60">({cat._count.products})</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURED PRODUCTS ─────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-green-600 text-sm font-semibold uppercase tracking-widest">Just In</span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mt-1">
                Latest Products
              </h2>
            </div>
            <Link
              href="/products"
              className="hidden sm:flex items-center gap-1.5 text-green-700 hover:text-green-800 text-sm font-semibold transition-colors group"
            >
              View all
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={36} className="text-green-300" />
              </div>
              <p className="text-gray-500 text-lg font-medium mb-1">No products yet</p>
              <p className="text-gray-400 text-sm mb-6">Be the first farmer to list fresh produce!</p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Register as a Farmer <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="text-center mt-10 sm:hidden">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 text-green-700 font-semibold hover:underline"
                >
                  View all products <ArrowRight size={16} />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────── */}
      <section className="py-20 px-4 bg-green-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-green-600 text-sm font-semibold uppercase tracking-widest">What People Say</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
              Trusted by Farmers & Customers
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl shadow-sm border border-green-100 p-7 hover:shadow-md transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} className="fill-orange-400 text-orange-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${t.color} text-white flex items-center justify-center text-sm font-bold shrink-0`}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                    <div className="text-gray-400 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────── */}
      <section
        className="relative py-24 px-4 text-white overflow-hidden"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1920&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-green-900/80" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <TrendingUp size={36} className="text-orange-400" />
          </div>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Ready to Grow Together?
          </h2>
          <p className="text-green-200 text-lg mb-10 max-w-xl mx-auto">
            Whether you&apos;re a farmer looking to sell your harvest or a customer looking for fresh produce — CoopMarket is your community marketplace.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg hover:-translate-y-0.5"
            >
              Join as a Farmer
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              <ShoppingBag size={18} />
              Browse Products
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
