import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import ProductShelf from "@/components/ProductShelf";
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

// CC BY-SA 4.0 requires the credit, a licence link and a note that it was cropped.
const HERO_PHOTO = {
  src: "/photos/mount-mayon-2016.webp",
  author: "Gcabig2024",
  page: "https://commons.wikimedia.org/wiki/File:Mount_Mayon_2016.jpg",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

// Card fields only, so the shelves (client components) get a small payload.
const SHELF_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  unit: true,
  imageUrl: true,
  category: { select: { id: true, name: true } },
  farmer: { select: { id: true, name: true, email: true } },
} as const;

const SHELF_SIZE = 10;

// One shelf per category that has products, fullest first; each holds its
// newest products.
async function getShelves() {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, _count: { select: { products: { where: { approved: true, archivedAt: null } } } } },
  });
  const stocked = categories
    .filter((c) => c._count.products > 0)
    .sort((a, b) => b._count.products - a._count.products || a.name.localeCompare(b.name));
  return Promise.all(
    stocked.map(async (c) => {
      const products = await prisma.product.findMany({
        where: { categoryId: c.id, approved: true, archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: SHELF_SIZE,
        select: SHELF_SELECT,
      });
      return {
        category: { id: c.id, name: c.name },
        total: c._count.products,
        products: await withComingSoon(products.map((p) => ({ ...p, price: Number(p.price) }))),
      };
    }),
  );
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
  const [shelves, announcements, banners, stats, board, reviews] = await Promise.all([
    getShelves(),
    getAnnouncements(),
    getBanners(),
    getStats(),
    getHarvestBoard(),
    getReviews(),
  ]);

  const hasStats = stats.farmers > 0 || stats.products > 0 || stats.orders > 0;

  return (
    <div className="bg-white">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-soil text-white">
        {/* Temporary photo until the cooperative has its own. Below xl it
            shows whole as a strip above the text. From xl it fills the hero:
            headline on the left, harvest board on the right in the sky, both
            clear of the farmer and carabao, who stay the subject. */}
        <div className="relative aspect-[16/10] xl:absolute xl:inset-0 xl:aspect-auto xl:-z-20">
          <Image
            src={HERO_PHOTO.src}
            alt="A farmer ploughs a flooded rice paddy with a carabao below Mayon Volcano, which is reflected in the water"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_45%]"
          />
          <p className="absolute bottom-2 right-3 text-[11px] text-white/85 bg-soil/55 rounded px-2 py-0.5">
            Photo: <a href={HERO_PHOTO.page} className="underline hover:text-white">{HERO_PHOTO.author}</a>,{" "}
            <a href={HERO_PHOTO.licenseUrl} className="underline hover:text-white">{HERO_PHOTO.license}</a>, cropped
          </p>
        </div>
        {/* Shade behind the headline only; the volcano and farmer stay bright. */}
        <div aria-hidden="true" className="hidden xl:block absolute inset-0 -z-10 bg-gradient-to-r from-soil/80 via-soil/30 via-45% to-transparent to-70%" />

        <div className={`${WRAP} pt-8 pb-12 xl:pt-16 xl:min-h-[min(780px,calc(100svh-4rem))] grid gap-10 xl:grid-cols-[1fr_380px] xl:items-start`}>
          <div>
            <h1 className="font-display text-6xl sm:text-7xl font-extrabold leading-[0.92] max-w-[11ch] xl:[text-shadow:0_2px_24px_rgb(43_38_34/0.5)]">
              Albay&apos;s harvest, sold by the people who grew it.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/90 max-w-[46ch] xl:[text-shadow:0_1px_12px_rgb(43_38_34/0.6)]">
              Every listing comes from a verified MaVeFaCo member farmer. Order online, then pick it up or have it delivered.
            </p>

            <HomeHeroActions />

            {hasStats && (
              <p className="mt-8 text-sm text-white/75 tabular max-w-[50ch] xl:[text-shadow:0_1px_8px_rgb(43_38_34/0.7)]">
                {count(stats.products, "product", "products")} listed by {count(stats.farmers, "verified farmer", "verified farmers")}.{" "}
                {stats.orders > 0 && `${count(stats.orders, "order", "orders")} delivered so far.`}
              </p>
            )}
          </div>

          <HarvestBoard {...board} look="glass" rows={2} />
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

      {/* ── SHELVES ─────────────────────────────────────── */}
      <section className="py-10">
        <div className={WRAP}>
          {shelves.length === 0 ? (
            <div className="rounded-card border border-dashed border-gray-300 px-6 py-14 max-w-xl">
              <p className="font-display text-3xl font-bold">Nothing listed yet</p>
              <p className="mt-2 text-gray-600">Member farmers&apos; produce appears here once staff approve it.</p>
              <Link href="/register" className="btn btn-primary mt-6">Register as a farmer</Link>
            </div>
          ) : (
            shelves.map((shelf) => (
              <ProductShelf
                key={shelf.category.id}
                id={`shelf-${shelf.category.id}`}
                title={shelf.category.name}
                total={shelf.total}
                href={`/products?categoryId=${shelf.category.id}`}
                products={shelf.products}
              />
            ))
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
