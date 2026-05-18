# Where We Left Off

_Updated: 2026-05-18 (session 4)_

## Last completed task

**All 8 gap-analysis use cases implemented** — the project is feature-complete for the capstone scope.

Session 4 additions in order:
1. **Low/out-of-stock alerts** — `StockBadge` component + alert banner on farmer products page listing specific affected products by name
2. **Cancel order + Confirm Received** — customer can cancel pending orders (stock restored) and confirm receipt of shipped orders (`/api/customer/orders/[id]` PATCH)
3. **Farmer profile + ID verification** — password change on `/farmer/profile/page.tsx`; ID image URL field already existed
4. **Price filter + seller page** — price range inputs on `/products`; `/sellers/[id]` public page with verified badge, avg rating, product grid, "Message Farmer" button; ProductCard farmer name now links to seller page
5. **Ratings & reviews** — `Review` model; `ReviewForm` (interactive star picker) + `ReviewsSection` on product detail; POST requires delivered order containing product; one review per customer; delete for own reviews and admin/manager
6. **Homepage banners + Cooperative info page** — `Banner`/`Faq`/`SiteContent` models; `/api/admin/banners`, `/api/admin/site-content`, `/api/admin/faqs`; `/dashboard/site` 3-tab CMS (Banners / Info / FAQs); `/about` public page; banners on homepage
7. **Crop monitoring** — `CropLog` model + Product monitoring fields; `/farmer/crops` table + `/farmer/crops/[id]` detail with log entry (weather/pest/damage/note types); all crop API routes
8. **Chat + Weather + Advisory** — `Message` model; polling `MessageThread` component; farmer + customer inbox/thread pages; Open-Meteo weather widget (Legazpi City); `/api/farmer/advisory` (community pest/damage logs); advisory + weather shown on farmer overview

---

## Current project state

All use cases from the original gap analysis are now implemented. The only remaining items are in the "Out of Scope / Not Yet Built" list in `DEVELOPMENT_STATUS.md` — none are required for the capstone submission.

---

## File map (quick reference)

```
src/app/
  page.tsx                              ← home: hero + banners + announcements + featured products
  login/page.tsx
  register/page.tsx
  about/page.tsx                        ← cooperative info, FAQ accordion, contact (public)
  products/page.tsx                     ← listing with category/search/price filters
  products/[id]/page.tsx                ← detail + Add to Cart + ReviewsSection
  sellers/[id]/page.tsx                 ← public seller profile

  dashboard/                            ← admin + manager
    layout.tsx
    page.tsx                            ← stat cards + farmer performance (manager)
    users/page.tsx
    categories/page.tsx
    products/page.tsx                   ← approve/revoke/edit/delete + CSV export
    orders/page.tsx                     ← status management + CSV export
    audit-logs/page.tsx
    announcements/page.tsx
    reports/page.tsx                    ← sales/crop/user/farmer tabs + CSV + print
    site/page.tsx                       ← admin-only: banners / cooperative info / FAQs

  cart/page.tsx                         ← cart + checkout (payment/delivery method)

  customer/
    orders/page.tsx                     ← order history; Cancel (pending) + Confirm (shipped)
    profile/page.tsx                    ← edit name/email/password
    messages/page.tsx                   ← inbox with unread counts
    messages/[userId]/page.tsx          ← message thread

  farmer/
    layout.tsx                          ← green sidebar; Crop Monitor + Messages nav items added
    page.tsx                            ← overview: stats + stock alerts + weather + advisory
    products/page.tsx                   ← table with StockBadge + alert banner
    products/new/page.tsx
    products/[id]/edit/page.tsx
    orders/page.tsx
    crops/page.tsx                      ← crop monitor table
    crops/[id]/page.tsx                 ← crop detail + log entries
    messages/page.tsx                   ← farmer inbox
    messages/[userId]/page.tsx          ← message thread
    profile/page.tsx                    ← edit info + password change

  api/
    auth/login/route.ts
    auth/register/route.ts
    products/route.ts
    products/[id]/route.ts
    products/[id]/reviews/route.ts      ← GET (public), POST (delivered customer)
    products/[id]/reviews/[reviewId]/route.ts  ← DELETE
    categories/route.ts
    categories/[id]/route.ts
    users/me/route.ts
    orders/route.ts                     ← POST (place order)
    customer/orders/route.ts            ← GET
    customer/orders/[id]/route.ts       ← PATCH (cancel / confirm received)
    admin/stats/route.ts
    admin/users/route.ts
    admin/users/[id]/route.ts
    admin/orders/route.ts
    admin/orders/[id]/route.ts
    admin/products/route.ts
    admin/products/[id]/route.ts
    admin/audit-logs/route.ts
    admin/farmer-stats/route.ts
    admin/reports/route.ts
    admin/site-content/route.ts         ← GET + PUT (key-value CMS)
    admin/faqs/route.ts                 ← GET + POST
    admin/faqs/[id]/route.ts            ← DELETE
    admin/banners/route.ts              ← GET (all, for admin)
    banners/route.ts                    ← GET (active only, public)
    banners/[id]/route.ts               ← PUT + DELETE
    site-content/route.ts               ← GET (public: SiteContent + FAQs)
    announcements/route.ts
    announcements/[id]/route.ts
    farmer/orders/route.ts
    farmer/orders/[id]/route.ts
    farmer/crops/route.ts
    farmer/crops/[id]/route.ts
    farmer/crops/[id]/logs/route.ts
    farmer/crops/[id]/logs/[logId]/route.ts
    farmer/advisory/route.ts            ← pest/damage/weather logs from all farmers (30 days)
    messages/route.ts                   ← conversation list with unread counts
    messages/[userId]/route.ts          ← GET thread (marks read) + POST send

src/components/
  Navbar.tsx                            ← About link, Messages link (customer), cart badge
  ProductCard.tsx                       ← farmer name links to /sellers/[id]
  ReviewForm.tsx                        ← interactive star picker + comment textarea
  ReviewsSection.tsx                    ← avg rating + form + review cards
  WeatherWidget.tsx                     ← Open-Meteo, Legazpi City (lat=13.1391, lon=123.7438)
  MessageThread.tsx                     ← shared inbox/thread component (8s polling)
  AddToCartButton.tsx
  QuantityModal.tsx

src/contexts/
  AuthContext.tsx
  CartContext.tsx                       ← cart_${user.id} localStorage key

src/lib/
  auth.ts
  authorize.ts
  getActiveAuthUser.ts                  ← JWT verify + DB suspended check
  prisma.ts
  roles.ts

prisma/
  schema.prisma                         ← 13 models; generated/prisma custom output
  migrations/ (7 applied)
    20260511155826_add_user_suspended
    20260512105820_add_product_approval
    20260518052947_add_announcements
    20260518063921_add_site_content
    20260518075152_add_reviews
    20260518075751_add_crop_monitoring
    20260518080321_add_messages
```

---

## Critical reminder

After any `npx prisma migrate dev`, always run `npx prisma generate` separately — the custom output path (`generated/prisma`) means the client never auto-updates. Use **Bash tool** (not PowerShell) for all Prisma CLI commands.
