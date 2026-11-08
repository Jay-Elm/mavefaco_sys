# Where We Left Off

_Updated: 2026-11-08 (last commit 0e52ef2; everything pushed and deployed)_

## Current state

Feature-complete for the capstone scope and through three structured hardening passes. Everything is merged to `master` and deployed to production; nothing is mid-flight.

1. **Phase 1–3 security review** (completed 2026-09-08, `SECURITY_REVIEW.md`): cookie-based sessions, admin-route guard, private ID storage, password reset, shared validators, email verification.
2. **10-item gap list** (completed 2026-09-21): Next.js CVE patches, JWT secret validation, `Decimal` money, connection pooling, Dependabot + CI audit, mandatory TOTP MFA for staff, ID-image auto-purge, no email enumeration.
3. **Whole-project review and fixes** (2026-10-03 to 2026-10-05, `PROJECT_REVIEW.md`): every finding fixed (L4 on 2026-11-07). Highlights:
   - **Integration tests** against a real Postgres database (`npm run test:integration`, now 383 tests; plus 139 unit and 10 Playwright end-to-end tests) covering orders, auth, MFA, products, reviews, messages, admin users, content, reports, cron, crop monitoring, announcements, FAQ/banner order; now 84 unit tests. Both suites run in CI. The tests found and drove fixes for 10+ real bugs (stock double-restock, MFA code reuse under concurrency, products with history undeletable, …).
   - **MFA encryption key** separated from `JWT_SECRET` (`TOTP_ENCRYPTION_KEY`); all staff migrated.
   - **Preview deployments** have their own Supabase database and keys; Preview builds migrate only that database (`PREVIEW_DATABASE_ISOLATED`).
   - **Product archiving** (and staff restore) instead of deleting products with history.
   - **Account deletion anonymizes** instead of erasing orders and audit history.
   - **Email changes** must be confirmed from the new address; old address notified.
   - **Email bodies HTML-escape** user values (`emailHtml`).
   - **Enforced nonce-based Content-Security-Policy** (`src/proxy.ts`, `src/lib/csp.ts`); every page renders per request.
   - Input length limits, audit logging of content changes with paging, report accuracy, 16 database indexes, single-use reset/verification links.
   - Rebranded to **Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo)**; README rewritten at the repo root; brand colors across all portals; lint at 0 errors and 0 warnings.
4. **Changes 2026-10-14 to 2026-10-15** (all deployed):
   - Audit log is admin-only; messaging is customer↔farmer only (both enforced on the server).
   - **Listing suspension** replaces staff edit/revoke/delete: staff View, Approve, Suspend with reasons, and Delete only a suspended listing. The farmer gets a one-way notice in Messages and an email; editing resubmits; the daily cron removes listings not resubmitted within 7 days. Notices show their outcome once resolved.
   - **Only customers buy**: no cart or ordering for farmers and staff; staff don't see the storefront.
   - In-page dialogs replace every browser `confirm()`/`alert()`; red count badges on the farmer and staff sidebars; sidebars narrowed to 184px.
   - Message threads open at the first unread message (or the latest).
   - No signed-out flash on refresh: the session is read on the server and role redirects happen there.
5. **Changes 2026-10-26:**
   - Next.js 16.4.3 (critical advisory) and `npm audit fix`: `npm audit` reports 0 vulnerabilities.
   - Weather widget moved to Tabaco City.
   - **Crop monitoring redesign**: plantings are their own records (`Planting`, one per season) instead of fields on products; a staff-managed `CropType` list with approximate growing times drives computed growth stages and harvest windows; "Needs attention" view, record harvest (adds to the linked listing's stock), structured crop logs (pest from a list, severity, date seen); the advisory names crops, not listings; Dashboard → **Supply** shows expected kg per crop per week for 8 weeks with oversupply flags; Dashboard → **Crop Types**. Migration `add_plantings` carries existing crop data over. Then: the community advisory groups reports by crop and problem (`/farmer/advisory`), and out-of-stock listings with a growing linked planting show **Coming soon** with the expected harvest window to customers.
6. **Changes 2026-10-26 — stronger ID verification:** farmers choose one of 10 ID types and take the front, back and a selfie holding the ID with the in-app camera (ID-shaped frame, blur/lighting checks; upload only without a camera, tagged for staff); the ID number is kept as an HMAC fingerprint + last 4, and one ID can't verify two accounts; staff review the photos side by side and approve or reject with reasons (notice + email), or mark a farmer verified in person. New `IdSubmission` model (migration `add_id_submissions` moves existing uploads over). **Needs `ID_NUMBER_HASH_KEY` in Vercel** (Production and Preview, separate values).
7. **Changes 2026-10-26 to 2026-10-27:** staff can delete reviews from the staff product page (audited as DELETE_REVIEW); farmers see announcements on their overview; order audit entries all use entity type `ORDER` (migration `normalize_order_audit_names`); managers no longer see Suspend on other managers.
8. **Redesign 2026-10-28 ("palengke slate"):** fonts Big Shoulders (headlines, stencil cut for crate labels) and Hanken Grotesk (body); palette tokens soil, paddy, paddy-deep, shoot, calamansi, field in `globals.css` with shared `.btn` styles; home page "This week's harvest" board (`harvestBoard()` in `src/lib/planting.ts`, totals only, no farm names) and real 4–5 star reviews; product cards with a stencilled crate label when there's no photo; one account menu in the navbar; dashboards and farmer portal on soil-coloured sidebars; accessibility pass (contrast, a name on every field and icon button).
9. **Changes 2026-10-29 to 2026-10-31:**
   - **Brand:** the cooperative's own logo (Mayon, furrows, sun) in `public/logo.svg` and `public/logo-light.svg`, shown through `src/components/Logo.tsx` in the navbar (with the full name), footer, sidebars, auth and error pages. Favicon and home-screen icon (`src/app/icon.svg`, `favicon.ico`, `apple-icon.png`) are a simplified square version. Unused Next.js starter SVGs deleted.
   - **Emails** carry a letterhead: `emailLayout()` in `src/lib/email.ts` wraps every body (logo PNG at `public/email/logo.png`, loaded from the production URL because email clients block SVG; name; footer). If the logo changes, re-export that PNG (480×159).
   - **Verifying a farmer in person** also approves their pending ID submission, so the Users badge clears (migration closes the ones already stuck).
   - **Announcements have an audience:** everyone, farmers or customers (`Announcement.audience`); `GET /api/announcements` filters by the viewer's role.
   - **FAQ and banner order** uses move up/down buttons (`PUT /api/admin/faqs/order`, `/api/admin/banners/order`, `src/lib/reorder.ts`); new items go to the end; existing orders renumbered 1, 2, 3….
   - **Home page:** a hero photo of Mayon with a farmer ploughing a paddy, the harvest board laid over its sky on wide screens (33% tint), and a horizontal **shelf per category** (`src/components/ProductShelf.tsx`) whose "See all" opens `/products?categoryId=…` titled with that category. The photo is a **temporary** Wikimedia image (“Mount Mayon 2016” by Gcabig2024, CC BY-SA 4.0): its on-photo credit (`HERO_PHOTO` in `src/app/page.tsx`) is a licence condition and stays until the cooperative's own photos replace it.
10. **Changes 2026-11-03:**
   - **Pages update by themselves:** open pages re-load when something the viewer can see changed (`src/contexts/LiveUpdatesContext.tsx`, `GET /api/live`). Every database write sends an empty signal over Supabase Realtime (`src/lib/liveSignal.ts`), so it takes about a second; without `SUPABASE_ANON_KEY` pages fall back to checking every 15 s. `Order.updatedAt` added for it.
   - **Quantities follow the unit** (`src/lib/units.ts`): kg and liter in steps of 0.25, everything else whole; enforced by the order API, and counted units need whole-number stock. Farmer price/stock are plain text boxes; no number box changes on scroll.
   - Hold-to-show eye on every password box (`src/components/PasswordInput.tsx`); cream background with a sand grain; navbar "All Products"; farmers get My Farm, My Products, About.
   - **Announcements** (`src/components/AnnouncementList.tsx`): gradient cards by type (advisory green, alert red, info blue), two columns, newest 4 on the home page (2 on phones and the farmer overview), "Read more" and "View all" windows with search, type filter and sort.
   - **Farmer portal:** logo only in the navbar; weather as a see-through card beside the welcome line with announcements under it; search/filter/sort on My Products, Orders and Crop Monitor (`src/components/ListToolbar.tsx`); an opened order and its items read as one block; the timeline's "Today" label stays inside its card.
   - **Terms of Service and Privacy Policy (2026-11-09):** public pages `/terms` and `/privacy` (`src/components/LegalPage.tsx`; text kept in step with the Claude Doc "MaVeFaCo Marketplace — Terms of Service and Privacy Policy", https://claude.ai/artifact/2cPtpmrbYSuK38TWAL9zkL), linked from the registration form and the footer, not from login. Registration needs the box "I am 18 or older and agree to the Terms of Service and Privacy Policy" (`registerSchema.acceptTerms`, stored as `User.termsAcceptedAt`, migration `terms_accepted`). Effective date in `LEGAL_EFFECTIVE_DATE`; update it, both pages and the Claude Doc together when the site moves to its own domain.
   - **Round 3: GCash made easier, photos in Messages (2026-11-09):** the customer's GCash panel has numbered steps, the farmer's QR in a viewer (full screen, "Save QR image": a phone can't scan its own screen, GCash uploads a QR from the gallery), copy buttons for number and amount (`src/components/PayHelpers.tsx`), and one reference box (the account paid from comes from saved GCash details; the first payment saves them). Photos in Messages (`POST /api/messages/[userId]/image`) and a customer's optional GCash QR (`/api/users/me/gcash-qr`) live in the private `private-images` bucket (`src/lib/privateImages.ts`; created on first use; 1-hour signed links; deleted with the account). Farmers get a refund panel while a refund is due (`refundTo` on `GET /api/farmer/orders`) and can add the refund's reference (`Order.refundReference`, shown to the customer). CSP connect-src allows the Supabase host for "Save QR image". Migration `images_and_refunds`.
   - **Round 2: customer notifications (2026-11-09):** every status or payment change made by the farmer or staff sends the customer an automatic message from the order's farmer (`Message.kind = "order_update"`, `Message.orderId`; text in `src/lib/orderUpdates.ts`, written in the same transaction as the change), with an optional farmer note (≤300, a box in the farmer's expanded order). The customer gets badges in the navbar account menu (`/api/nav-badges` customer branch: orders with `customerNotifiedAt > customerSeenAt`, unread messages); My Orders marks updated orders and calls `POST /api/customer/orders/seen`. Chat shows updates as "Order update" cards with View order. `useNavBadges` also refreshes on live updates. Migration `order_updates`.
   - **Round 1 of the owner's findings (2026-11-09):** profile email/password/delete forms fold behind a button (`RevealForm`) and their boxes refuse autofill (`useNoAutofill` in `PasswordInput.tsx`: read-only until touched, since browsers ignore `autocomplete="off"` on passwords); the Add/Edit Product crop guess keeps following the name until the farmer picks one (`CropTypeSelect`: a guessed value no longer counts as a hand pick); "Update PSA figures now" and the weekly job put back any catalogue crop missing from Crop Types (`restoreCatalogueCrops()` in `src/lib/psa.ts`; staff edits kept, renamed crops not doubled) and say which; Garlic added (migration `add_garlic`); staff Products table Status/Actions as icons with hover labels (`src/components/Tip.tsx`); price reference under the price box; delivery map zooms with wheel and pinch, bigger buttons, full screen, Street/Satellite (Esri World Imagery). E2E test `e2e/productForm.e2e.ts`.
   - **Crop catalogue (2026-11-08):** Crop Types now hold every crop PSA records in Bicol: all vegetables/root crops and fruits with 2025 Region V production, palay and corn, and plantation food crops (143 with "Other vegetable"; `src/lib/cropCatalogue.json`, built by migration `crop_catalogue`). Each crop has a category, other names (`aliases`, editable; drive the listing-name guess, most specific wins) and its PSA series stored in the row (`psaProductionTable/psaProduction`, `psaPriceTable/psaPrice`), so the PSA sync covers every crop (all 142 have production; 93 have Bicol/Albay farmgate prices). Growing times are optional: 19 crops have DA figures; the rest ask the farmer for harvest dates on Record a Planting. Listings can be "Not a farm crop" (`Product.notACrop`); a searchable `CropPicker` replaces the dropdowns; My Products reminds farmers of unlinked listings; staff link listings on Products (column, "not linked" chip and filter) and the review page (`PATCH /api/admin/products/[id]/crop`, audit `LINK_PRODUCT_CROP`). Migration `link_listings_by_name` re-matched unlinked listings. Market page: search, category filter, "Show all".
   - **Market signals (2026-11-07, Round A of "market-driven"):** listings carry an optional crop (`Product.cropTypeId`, picked on Add/Edit Product and suggested from the name by `src/lib/cropKeywords.ts`; a planting linked to a listing with none fills it in). `GET /api/market` (staff and farmers) compares each crop's last-8-week kilo sales with members' next-8-week planned harvest: demand above supply (<75%), balanced, possible oversupply (>150%), little recent demand, sold by bundle or piece, or not enough sales. Market pages at `/dashboard/market` and `/farmer/market` show alerts (low supply; rising demand = last 4 weeks ≥1.5× the 4 before), crops worth planting with the harvest window if planted today, and the marketplace price per kg by month (`components/market/PriceTrend.tsx`). The New Planting form shows the chosen crop's market reading; the farmer overview shows the top 3 alerts; staff can turn alerts into a draft advisory. Round B (same day): PSA OpenSTAT farmgate prices (monthly, tables `2M/NFG/0032M4AFN03`-`06`) and production volumes (quarterly, `2E/CS/0082E4EVCP3`) for Albay and Region V, looked up by name each run (`src/lib/psa.ts`, `PSA_SERIES` maps all 13 crops), copied weekly by `/api/cron/psa-market` into `MarketPrice` / `MarketProduction`, or on demand by staff ("Update PSA figures now"). The Market table shows the Albay farmgate price; each crop's chart has three lines (marketplace, Albay, Bicol; palette validated); production in the detail; a price reference on Add/Edit Product; PSA lines on the planting card. PSA runs about two months behind; `..` and `0.00` mean no figure.
   - **GCash and delivery (2026-11-06):** Bank Transfer removed (old orders keep the label). GCash goes straight to the farmer: farmers add their GCash name, number and optional QR in Profile; checkout greys GCash out when the farmer hasn't; the customer pays and enters the 13-digit reference; the farmer confirms or rejects it; a GCash order ships only once confirmed; cancelling after paying makes a refund due, which the farmer marks sent (`src/lib/payment.ts`, `Order.paymentStatus`). Delivery only within Tabaco City, Malinao, Malilipot, Ligao City and Oas (the towns sharing a land border with Tabaco in NAMRIA/PSA boundaries, `src/lib/deliveryArea.ts` + `deliveryArea.json`); the customer pins a spot on a Leaflet + OpenStreetMap map or uses their phone's location (Permissions-Policy now allows geolocation for the site itself); outside spots can be saved but checkout allows pickup only. The spot is copied onto the order; only that order's farmer sees the pin and address (staff see the town).
   - **Fixes 2026-11-05:** cart badge counts different products, not quantities; staff sidebar grouped (Store, Crops, People, Content, Records), one logo, no "v0.1"; navbar puts Dashboard / My Farm first; profiles show the current email partly hidden (`maskEmail`), the New Email box starts empty and current-password boxes don't invite autofill; every text box, dropdown and text area is white at 85% (`globals.css`); farmer overview shows announcements under the stat cards; farmer Messages search sits above the notices; a Message button next to each customer on farmer Orders; stock can be changed in place on My Products (`StockQuickEdit`, goes live without review).
   - **Crop monitoring simplified (2026-11-04):** crop types hold only a name and harvest range (growth stages removed); crop logs are type + note + date seen (severity and the pest list removed); the advisory groups by crop and kind of problem; "Needs attention" flags any pest, weather or damage report from the last 14 days; area and expected yield sit under "Optional details" when recording a planting. Migration `simplify_crop_monitoring`. Scope 81/21/27 ("Update crop growth stage" is now Partial). Staff get the same advisory at Dashboard → **Crop Advisory** (`/api/admin/advisory`); open pages now follow everyone's crop reports. **AI crop report** (`src/lib/aiReport.ts`, `/api/admin/advisory/report`, model `AiReport`, migration `ai_report`): Google Gemini's free tier (`GEMINI_API_KEY`, default model `gemini-3.5-flash-lite`) writes an overview, per-problem reading, suggested actions, a draft advisory and English versions of non-English notes; only crop, kind, date, note and anonymous farm labels are sent, phones/emails masked; farmers are told on the crop log form.
   - **Messages (customers and farmers):** date lines in threads; search over names and message text; delete a conversation for yourself only (`ConversationHide`; the other side keeps theirs, a new message brings it back). Notices stay first and can't be deleted.
11. **Scope** is documented item by item in `SCOPE_AND_DELIMITATIONS.md` (129 use-case items: 81 implemented, 21 partial, 27 not implemented).

---

## Open items

**Owner's findings (2026-11-08):** manual checks 1-27, the PSA update and the unlinked listings all passed, apart from the findings below. Round 1 fixes them; Rounds 2 and 3 are planned.

**Round 1 (2026-11-09), to check after deploying:**
1. Profile (customer and farmer): the email, password and delete forms stay folded until "Change email" / "Change password" / "Delete my account…" is pressed, and the browser doesn't fill a saved password into them.
2. Add Product: typing "Patola" picks the Patola crop; changing the name to "Upo" switches it; clearing the name clears it; a crop picked by hand stays.
3. Delete a crop on Crop Types (e.g. Ampalaya), then press "Update PSA figures now": the message says it was put back, and it is on Crop Types again with its PSA figures. Garlic is on the list.
4. Staff Products table: Status and Actions are icons, each named on hover; the table fits without scrolling sideways on a laptop.
5. Add/Edit Product: the price reference sits right under the price box (after a crop is chosen).
6. Delivery map (cart and profile): the mouse wheel and a pinch zoom the map, not the page; bigger +/- buttons; the full-screen button and Esc; Street/Satellite (the delivery area turns yellow on the photos).

**Round 2 (2026-11-09), to check after deploying:**
1. As a farmer, open an order, type a note for the customer, press Accept: the note box empties.
2. As that customer: a red dot on the account menu (and the phone menu button); inside, counts on My Orders and Messages.
3. My Orders shows the order with a red "Updated" mark; the My Orders count clears, and leaving and coming back removes the mark.
4. Messages, the chat with that farmer: an "Order update" card ("Order #N was accepted. The farmer is getting it ready." plus the note) with View order; reading it clears the Messages count.
5. Ship, deliver, payment received, not received, refund sent, and a staff cancel each send their own update (a staff cancel says "by the cooperative").

**Round 3 (2026-11-09), to check after deploying** (a payment company such as PayMongo was ruled out; no "Open GCash" link):
1. Pay a GCash order as a customer: numbered steps; the farmer's QR opens full screen and "Save QR image" saves it on a phone (then GCash → Scan QR → Upload QR); "Copy number" and "Copy amount" paste into GCash; only the reference box is needed once GCash details are saved (the first payment saves them).
2. Messages: the photo button sends a picture (try a QR screenshot) with an optional caption; it opens full screen with Save photo; the conversation list says "📷 Photo". The first photo creates the private storage bucket by itself; check it appears in Supabase → Storage as `private-images` (private).
3. Customer Profile → GCash: after saving a name and number, upload a QR code; it shows and can be taken off.
4. Cancel a paid GCash order: the farmer's expanded order shows the refund panel (customer's name, number, amount, their QR if added, copy buttons and a reference box); "Refund sent" with a reference shows it in the customer's update message and in My Orders.

**Waiting on the project owner:** the cooperative's own photos to replace the temporary hero photo (then remove its credit line); real announcements to replace the lorem-ipsum "Title #2"/"Title #3" posts; which crops Tabaco farmers actually grow (cooperative or Tabaco City Agriculturist's Office), for the thesis; growing times for the 124 crops without a DA figure (and a farmer's confirmation of upo's 90-100 days); real orders, so the market signals have data.

**Decisions the owner may revisit:** the delivery area (Tabaco City, Malinao, Malilipot, Ligao City, Oas) and the market thresholds (75% / 150%, 8 weeks, rising at 1.5x).

**Remaining debt** (see `DEVELOPMENT_STATUS.md` → Known Technical Debt): Prisma 8 upgrade once it is out of release candidate (still 8.0.0-rc.33 on 2026-11-09); end-to-end tests cover a few flows (see DEVELOPMENT_STATUS). Done 2026-11-09: the conversation list is grouped by the database (`GET /api/messages`: one row per conversation with its latest message and unread count, instead of loading every message); end-to-end tests for staff Crop Types, Products and the Market pages. Done 2026-11-07: rate limits counted in Postgres (L4, no Upstash needed); Playwright end-to-end tests (`npm run test:e2e`); DA growing times with sources on all 13 crop types.

**Optional:** staff can rename their authenticator entry from "CoopMarket" to "MaVeFaCo"; Vercel's Preview toolbar can be turned off if its CSP violations clutter the logs.

---

## File map (quick reference)

```
src/app/
  page.tsx                              ← home: photo hero + harvest board, banners, announcements, category shelves, reviews
  login/page.tsx                        ← handles MFA branching (mfaRequired / mfaSetupRequired)
  register/page.tsx
  verify-email/page.tsx                 ← confirms emailVerifiedAt via emailed link
  confirm-email-change/page.tsx         ← applies an email change from the link sent to the new address
  forgot-password/page.tsx
  reset-password/page.tsx
  about/page.tsx                        ← cooperative info, FAQ accordion, contact (public)
  products/page.tsx                     ← listing with category/search/price filters; titled by category from a shelf
  products/[id]/page.tsx                ← detail + Add to Cart + ReviewsSection
  sellers/[id]/page.tsx                 ← public seller profile

  dashboard/                            ← admin + manager
    layout.tsx
    page.tsx                            ← stat cards + farmer performance (manager)
    users/page.tsx                      ← ID review panel, verified in person, suspend, reset, delete
    categories/page.tsx
    products/page.tsx                   ← approve/view/suspend/delete-suspended/restore + CSV export
    products/[id]/page.tsx              ← read-only listing view (staff don't edit)
    orders/page.tsx                     ← status management + CSV export
    audit-logs/page.tsx
    announcements/page.tsx
    reports/page.tsx                    ← sales/crop/user/farmer tabs + CSV + print
    crop-types/page.tsx                 ← crop list + approximate growing times
    supply/page.tsx                     ← upcoming supply by crop and week
    site/page.tsx                       ← admin-only: banners / cooperative info / FAQs

  cart/page.tsx                         ← cart + checkout (payment/delivery method)

  customer/
    orders/page.tsx                     ← order history; Cancel (pending) + Confirm (shipped)
    profile/page.tsx                    ← edit name/email/password + self-delete
    messages/page.tsx                   ← inbox with unread counts
    messages/[userId]/page.tsx          ← message thread

  farmer/
    layout.tsx                          ← green sidebar
    page.tsx                            ← overview: stats + stock alerts + weather + advisory
    products/page.tsx                   ← table with StockBadge + alert banner
    products/new/page.tsx
    products/[id]/edit/page.tsx
    orders/page.tsx
    crops/page.tsx                      ← crop monitor: needs attention, growing, past seasons
    crops/new/page.tsx                  ← record a planting
    crops/[id]/page.tsx                 ← planting: timeline, harvest, details, crop log
    advisory/page.tsx                   ← community advisory, grouped by crop and problem
    messages/page.tsx                   ← farmer inbox
    messages/[userId]/page.tsx          ← message thread
    profile/page.tsx                    ← edit info + ID verification (camera flow) + password change

  api/
    auth/login/route.ts                 ← branches into MFA pending-cookie flow for admin/manager
    auth/logout/route.ts
    auth/register/route.ts              ← anti-enumeration, sends verification email
    auth/verify-email/route.ts
    auth/resend-verification/route.ts
    auth/forgot-password/route.ts
    auth/reset-password/route.ts
    auth/mfa/setup/route.ts
    auth/mfa/confirm/route.ts
    auth/mfa/verify/route.ts
    auth/confirm-email-change/route.ts  ← single-use token; switches email, logs out everywhere
    csp-report/route.ts                 ← logs CSP violation reports (rate-limited)
    products/route.ts
    products/[id]/route.ts
    products/[id]/reviews/route.ts      ← GET (public), POST (delivered customer)
    products/[id]/reviews/[reviewId]/route.ts  ← DELETE
    categories/route.ts
    categories/[id]/route.ts
    users/me/route.ts                   ← GET, PATCH, DELETE (self-service account deletion)
    users/me/id-submission/route.ts     ← POST (ID type, number, front/back/selfie), DELETE (withdraw)
    upload/route.ts                     ← shared image-upload endpoint
    orders/route.ts                     ← POST (place order)
    customer/orders/route.ts            ← GET
    customer/orders/[id]/route.ts       ← PATCH (cancel / confirm received)
    admin/stats/route.ts
    admin/users/route.ts
    admin/users/[id]/route.ts
    admin/users/[id]/id-submission/route.ts ← staff view: signed photo URLs, same-number accounts
    admin/id-submissions/[id]/review/route.ts ← approve / reject with reasons
    admin/orders/route.ts
    admin/orders/[id]/route.ts
    admin/products/route.ts
    admin/products/[id]/route.ts
    admin/products/[id]/restore/route.ts ← un-archive a product (staff)
    admin/products/[id]/suspend/route.ts ← suspend with reasons; notice + email to the farmer
    admin/audit-logs/route.ts
    admin/farmer-stats/route.ts
    admin/reports/route.ts
    admin/site-content/route.ts         ← GET + PUT (key-value CMS)
    admin/faqs/route.ts                 ← GET + POST
    admin/faqs/[id]/route.ts            ← DELETE
    admin/faqs/order/route.ts           ← PUT (save the order from the move buttons)
    admin/banners/order/route.ts        ← PUT (same, for banners)
    admin/banners/route.ts              ← GET (all, for admin)
    banners/route.ts                    ← GET (active only, public)
    banners/[id]/route.ts               ← PUT + DELETE
    site-content/route.ts               ← GET (public: SiteContent + FAQs)
    announcements/route.ts              ← GET filtered by audience for the viewer; POST (staff)
    announcements/[id]/route.ts
    farmer/orders/route.ts
    farmer/orders/[id]/route.ts
    farmer/plantings/route.ts           ← GET own plantings, POST record one
    farmer/plantings/[id]/route.ts      ← GET, PATCH, DELETE
    farmer/plantings/[id]/harvest/route.ts ← record harvest (+ optional stock)
    farmer/plantings/[id]/logs/route.ts
    farmer/plantings/[id]/logs/[logId]/route.ts
    farmer/advisory/route.ts            ← pest/damage/weather reports from all farmers (30 days)
    crop-types/route.ts                 ← GET (farmer/staff), POST (staff)
    crop-types/[id]/route.ts            ← PUT, DELETE (staff)
    admin/supply/route.ts               ← expected supply by crop and week
    messages/route.ts                   ← conversation list with unread counts
    messages/[userId]/route.ts          ← GET thread (marks read) + POST send (customer↔farmer only)
    notices/route.ts, notices/read/route.ts ← the caller's system notices; mark read
    nav-badges/route.ts                 ← sidebar badge counts by role
    cron/purge-id-images/route.ts       ← CRON_SECRET-gated daily job
    cron/purge-suspended-products/route.ts ← removes listings suspended 7+ days

src/components/
  Navbar.tsx                            ← logo + full name, About link, account menu, cart badge
  Logo.tsx                              ← the cooperative's logo (dark or light variant)
  ProductShelf.tsx                      ← one category's newest products, scrolls sideways
  HarvestBoard.tsx                      ← "This week's harvest" (solid, or glass over the hero photo)
  ProductCard.tsx                       ← farmer name links to /sellers/[id]
  ReviewForm.tsx                        ← interactive star picker + comment textarea
  ReviewsSection.tsx                    ← avg rating + form + review cards
  WeatherWidget.tsx                     ← Open-Meteo, Tabaco City (lat=13.3594, lon=123.7331)
  MessageThread.tsx                     ← shared thread: opens at first unread, 8s polling
  AddToCartButton.tsx                   ← hidden for farmers and staff
  NavBadge.tsx                          ← useNavBadges(), NavBadge, refreshNavBadges()
  SuspendListingModal.tsx               ← staff pick suspension reasons
  MessageFarmerLink.tsx                 ← seller-page button, customers and guests only

src/contexts/
  AuthContext.tsx                       ← initialUser from the server (serverSession.ts), no token in JS
  CartContext.tsx                       ← cart_${user.id} localStorage key, customers only
  DialogContext.tsx                     ← useDialog(): in-page confirm/alert

src/lib/
  auth.ts                               ← getJwtSecret, verifyToken
  authorize.ts
  session.ts                            ← issueSessionResponse (shared by login + MFA completion)
  getActiveAuthUser.ts                  ← JWT verify + DB suspended/tokenVersion check
  serverSession.ts                      ← getSessionUser() for server-rendered pages, redirectRoles()
  productRemoval.ts                     ← removeListing(): delete or archive, resolves notices
  mfaToken.ts / totp.ts / totpCrypto.ts / backupCodes.ts
  deleteAccount.ts                      ← anonymizes accounts (self-delete + admin-delete), keeps order/audit history
  idImageStorage.ts                     ← upload, sign, confirmed deletes in the private ID bucket
  idVerification.ts                     ← ID types, number formats, rejection reasons
  idNumberHash.ts                       ← HMAC fingerprint of ID numbers (ID_NUMBER_HASH_KEY)
  photoQuality.ts                       ← blur / brightness checks for ID photos
  audit.ts                              ← logAudit()
  csp.ts                                ← the Content-Security-Policy (nonce per request)
  email.ts                              ← Brevo wrapper (fails soft), emailHtml escaping template, emailLayout letterhead
  reorder.ts                            ← saveOrder() / nextDisplayOrder() for FAQs and banners
  imageSniff.ts                         ← magic-byte checks for uploads
  rateLimit.ts
  url.ts                                ← isSafeUrl XSS guard
  prisma.ts
  roles.ts

src/validators/                          ← shared Zod schemas (client + server)
  auth.ts, order.ts, profile.ts, adminUser.ts, banner.ts, siteContent.ts,
  category.ts, product.ts, review.ts, message.ts, faq.ts, crop.ts, mfa.ts, helpers.ts,
  limits.ts                             ← maximum lengths (MAX, tooLong)
  productSuspension.ts                  ← suspension reasons, SUSPENSION_DAYS, deadline
  announcement.ts, reorder.ts           ← announcement audiences; move-button id lists

prisma/
  schema.prisma                         ← 26 models; generated/prisma custom output
  migrations/ (44 applied — see DEVELOPMENT_STATUS.md for the full list)

public/logo.svg, logo-light.svg         ← the logo; public/email/logo.png is its PNG copy for emails
public/photos/mount-mayon-2016.webp     ← TEMPORARY hero photo (CC BY-SA 4.0, credit required)
src/app/icon.svg, favicon.ico, apple-icon.png ← browser and home-screen icons
src/proxy.ts                            ← per-request CSP nonce + /api/admin guard
src/test-utils/integration/             ← integration-test helpers (test DB guard, factories, withRowLocked, fakeStorage)
scripts/migrate.mjs                     ← build-time migrations (skipped on Preview unless isolated)
```

---

## Critical reminders

- After any `npx prisma migrate dev`, always run `npx prisma generate` separately — the custom output path (`generated/prisma`) means the client never auto-updates. Use **Bash tool** (not PowerShell) for all Prisma CLI commands.
- `DIRECT_URL` must point at Supabase's **Session pooler**, not the true direct-connection endpoint (unreachable, IPv6-only) or the Transaction pooler `DATABASE_URL` uses (can't hold `prisma migrate deploy`'s advisory lock).
- `.github/dependabot.yml` has permanent `ignore` rules for major bumps of `otplib` (breaks the TOTP code) and `eslint` (crashes `eslint-config-next`'s bundled plugin) — don't lift without re-verifying upstream first.
- `.github/dependabot.yml` also ignores major bumps of `typescript` (TS 7 crashes typescript-eslint) and `@types/node` (keep it on the Node 24 runtime), and groups lockstep packages (prisma, react, next, tailwind) into single PRs.
- Every page renders per request because of the CSP nonce (root layout awaits `connection()`). A new third-party script needs the nonce from `(await headers()).get('x-nonce')`.
- Any new query listing live products must filter `archivedAt: null`; any new user listing must filter `deletedAt: null`.
- Build new email bodies with the `emailHtml` template so user values are escaped; `sendEmail` adds the letterhead, so bodies stay plain paragraphs.
- Before using any third-party image, confirm its source and licence; keep any required credit on the page.
- FAQ/banner order changes go through `saveOrder()` (all ids in one transaction); don't reintroduce a free-number order input.
- Confirmations and alerts go through `useDialog()`, never the browser's `confirm()`/`alert()`.
- Role-based redirects belong on the server (`redirectRoles()`); client-side ones flash the wrong page first.
- Don't run `npx prisma format`; it reformats the whole schema. Use `npx prisma validate`.
- If this file goes stale, `git log` is the source of truth.
