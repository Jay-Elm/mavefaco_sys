import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import { redirectRoles } from "@/lib/serverSession";
import HomeHeroActions from "@/components/HomeHeroActions";
import HomeBottomCTAButtons from "@/components/HomeBottomCTAButtons";
import HarvestBoard from "@/components/HarvestBoard";
import { ArrowRight, Star } from "lucide-react";
import AnnouncementList from "@/components/AnnouncementList";
import { isSafeUrl } from "@/lib/url";
import { withComingSoon } from "@/lib/comingSoon";
import { bannerStyle } from "@/components/bannerStyles";
import { addDays, harvestBoard, toDateString, todayPH, weekStart } from "@/lib/planting";

const WRAP = "mx-auto max-w-[1200px] px-6";

async function getFeaturedProducts() {
  const products = await prisma.product.findMany({
    take: 6,
    where: { approved: true, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      farmer: { select: { id: true, name: true, email: true } },
    },
  });
  return withComingSoon(products.map((p) => ({ ...p, price: Number(p.price) })));
}

async function getBanners() {
  return prisma.banner.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });
}

async function getAnnouncements() {
  return prisma.announcement.findMany({
    where: { audience: { in: ["everyone", "customers"] } },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
}

async function getStats() {
  const [farmers, products, orders] = await Promise.all([
    prisma.user.count({ where: { role: "farmer", verified: true, deletedAt: null } }),
    prisma.product.count({ where: { approved: true, archivedAt: null } }),
    prisma.order.count({ where: { status: "delivered" } }),
  ]);
  return { farmers, products, orders };
}

async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { approved: true, archivedAt: null } } } } },
  });
}

// What member farms expect to harvest this week and next, from growing
// plantings. Only crop totals leave this function, never a farm.
async function getHarvestBoard() {
  const today = todayPH();
  const plantings = await prisma.planting.findMany({
    where: { status: "growing", farmer: { deletedAt: null } },
    select: {
      id: true,
      harvestStart: true,
      harvestEnd: true,
      expectedYield: true,
      farmerId: true,
      cropType: { select: { id: true, name: true } },
    },
  });
  const board = harvestBoard(
    plantings.map((p) => ({
      id: p.id,
      farmer: { id: p.farmerId, name: "" },
      cropType: p.cropType,
      harvestStart: toDateString(p.harvestStart),
      harvestEnd: toDateString(p.harvestEnd),
      expectedYield: p.expectedYield,
    })),
    today,
  );
  const start = weekStart(today);
  return { ...board, weekStart: start, weekEnd: addDays(start, 6) };
}

// Customers' own words: recent four- and five-star reviews that say something.
async function getReviews() {
  return prisma.review.findMany({
    where: {
      rating: { gte: 4 },
      AND: [{ comment: { not: null } }, { comment: { not: "" } }],
      product: { approved: true, archivedAt: null },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      customer: { select: { name: true } },
      product: { select: { id: true, name: true } },
    },
  });
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-PH")} ${n === 1 ? one : many}`;

export default async function HomePage() {
  // The storefront home is for customers and guests; everyone else has a portal.
  await redirectRoles(["admin", "manager", "farmer"]);
  const [featuredProducts, announcements, banners, stats, categories, board, reviews] = await Promise.all([
    getFeaturedProducts(),
    getAnnouncements(),
    getBanners(),
    getStats(),
    getCategories(),
    getHarvestBoard(),
    getReviews(),
  ]);

  const hasStats = stats.farmers > 0 || stats.products > 0 || stats.orders > 0;

  return (
    <div className="bg-white">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="bg-soil text-white">
        <div className={`${WRAP} py-14 lg:py-20 grid gap-12 lg:grid-cols-[1fr_440px] lg:items-center`}>
          <div>
            <h1 className="font-display text-6xl sm:text-7xl lg:text-8xl font-extrabold leading-[0.92] max-w-[11ch]">
              Albay&apos;s harvest, sold by the people who grew it.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/80 max-w-[46ch]">
              Every listing comes from a verified MaVeFaCo member farmer. Order online, then pick it up or have it delivered.
            </p>

            <HomeHeroActions />

            {hasStats && (
              <p className="mt-10 text-sm text-white/60 tabular max-w-[50ch]">
                {count(stats.products, "product", "products")} listed by {count(stats.farmers, "verified farmer", "verified farmers")}.{" "}
                {stats.orders > 0 && `${count(stats.orders, "order", "orders")} delivered so far.`}
              </p>
            )}
          </div>

          <HarvestBoard {...board} />
        </div>
      </section>

      {/* ── BANNERS AND ANNOUNCEMENTS ────────────────────── */}
      {(banners.length > 0 || announcements.length > 0) && (
        <section className="py-8 border-b border-gray-100">
          <div className={`${WRAP} space-y-4`}>
            {banners.map((b) => {
              const style = bannerStyle(b.color);
              return (
                <div key={b.id} className={`rounded-card px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${style.surface}`}>
                  <div>
                    <h2 className="font-display text-2xl font-bold leading-tight">{b.title}</h2>
                    {b.subtitle && <p className={`text-sm mt-1 ${style.muted}`}>{b.subtitle}</p>}
                  </div>
                  {b.ctaText && b.ctaLink && isSafeUrl(b.ctaLink) && (
                    <Link href={b.ctaLink} className={`shrink-0 inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm ${style.action}`}>
                      {b.ctaText} <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              );
            })}
            {announcements.length > 0 && (
              <div className="max-w-3xl">
                <AnnouncementList announcements={announcements} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── CATEGORIES ───────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="pt-14">
          <div className={WRAP}>
            <h2 className="font-display text-4xl font-bold">Shop by category</h2>
            <div className="mt-5 -mx-6 px-6 flex gap-2 overflow-x-auto pb-2 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?categoryId=${cat.id}`}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-soil hover:border-paddy hover:text-paddy transition-colors"
                >
                  {cat.name}
                  {cat._count.products > 0 && <span className="text-xs text-gray-500 tabular">{cat._count.products}</span>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── LATEST PRODUCTS ──────────────────────────────── */}
      <section className="py-14">
        <div className={WRAP}>
          <div className="flex items-baseline justify-between gap-4 mb-6">
            <h2 className="font-display text-4xl font-bold">Just listed</h2>
            <Link href="/products" className="inline-flex items-center gap-1.5 text-paddy hover:underline text-sm font-semibold">
              All products <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="rounded-card border border-dashed border-gray-300 px-6 py-14 max-w-xl">
              <p className="font-display text-3xl font-bold">Nothing listed yet</p>
              <p className="mt-2 text-gray-600">Member farmers&apos; produce appears here once staff approve it.</p>
              <Link href="/register" className="btn btn-primary mt-6">Register as a farmer</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS (a real sequence, so numbered) ──── */}
      <section className="py-14 bg-field">
        <div className={WRAP}>
          <h2 className="font-display text-4xl font-bold">How ordering works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "Farmers list their produce",
                desc: "Verified member farmers post what they grow, priced per kilo, bundle or piece. Staff check every listing before it goes up.",
              },
              {
                title: "You order from one farm",
                desc: "Pick what you need from one farmer's listings, choose pickup or delivery, and say how you'll pay.",
              },
              {
                title: "The farmer gets it ready",
                desc: "They accept and send your order, and you confirm when it arrives. You can message them along the way.",
              },
            ].map((step, i) => (
              <li key={step.title} className="border-t-2 border-paddy pt-4">
                <span className="font-display text-5xl font-extrabold text-paddy leading-none tabular">{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-gray-600 max-w-[34ch]">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── REVIEWS (real ones, hidden when there are none) ─ */}
      {reviews.length > 0 && (
        <section className="py-14">
          <div className={WRAP}>
            <h2 className="font-display text-4xl font-bold">From customers&apos; reviews</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r.id} className="rounded-card border border-gray-200 p-6 flex flex-col">
                  <div className="flex gap-0.5" role="img" aria-label={`${r.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} aria-hidden="true" className={i < r.rating ? "fill-calamansi text-calamansi" : "text-gray-300"} />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-[1.05rem] leading-relaxed text-soil">
                    &ldquo;{r.comment}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 text-sm text-gray-600">
                    <span className="font-semibold text-soil">{r.customer.name}</span>, on{" "}
                    <Link href={`/products/${r.product.id}`} className="text-paddy hover:underline">{r.product.name}</Link>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA ───────────────────────────────────── */}
      <section className="bg-soil text-white py-16">
        <div className={WRAP}>
          <h2 className="font-display text-5xl sm:text-6xl font-extrabold leading-[0.95] max-w-[16ch]">
            Farming in Albay? Sell through the cooperative.
          </h2>
          <p className="mt-5 text-lg text-white/80 leading-relaxed max-w-[52ch]">
            Register as a farmer, verify your ID, and list your harvest for customers across the province.
          </p>
          <HomeBottomCTAButtons />
        </div>
      </section>
    </div>
  );
}
