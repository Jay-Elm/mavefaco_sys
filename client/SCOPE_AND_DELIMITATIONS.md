# Scope and Delimitations

**System:** MaVeFaCo Marketplace — the online marketplace of the Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo)
**As of:** 2026-10-26 · checked against the code on `master`, including the crop monitoring redesign, grouped advisory and "coming soon" listings of 2026-10-26 and the stronger ID verification of 2026-10-26 · deployed at https://mavefaco-sys.vercel.app

This document states what the system covers (**scope**) and the boundaries it deliberately stays within (**delimitations**). The scope is measured against the four use-case documents written at the start of the project — [`ADMIN_USE_CASE.md`](ADMIN_USE_CASE.md), [`MANAGER_USE_CASE.md`](MANAGER_USE_CASE.md), [`FARMER_USE_CASE.md`](FARMER_USE_CASE.md) and [`CUSTOMER_USE_CASE.md`](CUSTOMER_USE_CASE.md) — which describe the full long-term vision. The implemented system covers the core marketplace workflow end to end; the remaining items are documented below as outside the current scope.

## Contents

1. [Summary](#1-summary)
2. [Scope by role](#2-scope-by-role)
3. [Delimitations](#3-delimitations)
4. [Outside the current scope](#4-outside-the-current-scope)
5. [Thesis text](#5-thesis-text) — sections 1–4 as prose for Chapter 1 of the IMRAD paper

**Status key:** **Implemented** — available in the system. **Partial** — the need is met in a narrower form than the use case describes (the note says how). **Not implemented** — outside the current scope.

---

## 1. Summary

| Role | Use-case items | Implemented | Partial | Not implemented |
|---|---|---|---|---|
| Customer | 32 | 23 | 3 | 6 |
| Farmer | 51 | 32 | 7 | 12 |
| Manager | 17 | 6 | 6 | 5 |
| Administrator | 29 | 20 | 5 | 4 |
| **Total** | **129** | **81** | **21** | **27** |

The system fully supports the cooperative's core workflow: farmers list produce, staff review it, customers buy it, farmers and staff fulfil orders, and staff monitor the cooperative through reports and an audit log. The 27 items outside the scope fall into seven areas (see [section 4](#4-outside-the-current-scope)): payments, market intelligence, planning, customer convenience, farmer convenience, administration and localization.

## 2. Scope by role

The system has four roles, from most to least privileged: Administrator, Manager, Farmer and Customer. Administrators and managers ("staff") must sign in with two-factor authentication.

### 2.1 Customer

| Use-case item | Status | How it is covered |
|---|---|---|
| **Account management** | | |
| Register | Implemented | Self-service sign-up with email verification |
| Login | Implemented | |
| Logout | Implemented | Ends every session for the account |
| Reset password | Implemented | Emailed single-use link, valid 30 minutes |
| Update profile | Implemented | Name, password, and email (the current address is shown partly hidden; the new address must confirm the change) |
| **Marketplace** | | |
| Browse products | Implemented | Only staff-approved, non-archived products are shown |
| Search products | Implemented | By product name |
| Filter by crop type | Implemented | By category |
| Filter by price | Implemented | Minimum and maximum price |
| View seller details | Implemented | Public seller page with the farmer's products and ratings |
| View product photos | Implemented | One photo per product |
| Compare products | Not implemented | |
| **Ordering** | | |
| Add to cart | Implemented | One cart per account, kept in that browser |
| Place order | Implemented | Stock is checked and reserved at checkout |
| Reserve products | Not implemented | No pre-orders for products not yet in stock |
| Cancel order | Implemented | While the order is still pending; stock is returned |
| Modify quantity | Implemented | In the cart, before checkout |
| Choose payment method | Implemented | Cash on delivery, or GCash paid straight to the farmer's own GCash; GCash is unavailable when the farmer hasn't set it up. See [delimitations](#32-transactions-and-payments) |
| Choose pickup/delivery | Implemented | Delivery to a spot pinned on a map (or found with the phone's location), only within Tabaco City and its four bordering towns (Malinao, Malilipot, Ligao City and Oas) |
| **Tracking** | | |
| View order history | Implemented | |
| Track order status | Implemented | Pending → confirmed → shipped → delivered (or cancelled) |
| Confirm received order | Implemented | Marks a shipped order delivered |
| **Communication** | | |
| Chat with farmer | Implemented | In-app messages with unread counts; conversations can be searched by name or message text, and removed from the customer's own list |
| Ask product questions | Implemented | "Message farmer" from the product page |
| Receive notifications | Partial | Emails for account and security events only; no order-status or in-app notifications |
| **Feedback** | | |
| Rate seller | Partial | The seller page shows the average of the farmer's product ratings; sellers aren't rated directly |
| Leave review | Implemented | One review per product, only after a delivered order |
| Report problem | Not implemented | |
| **Minor actions** | | |
| Save favorite sellers | Not implemented | |
| Reorder previous purchase | Not implemented | |
| Download invoice | Not implemented | |
| Share product link | Partial | Every product has a stable URL; no share button |

### 2.2 Farmer

| Use-case item | Status | How it is covered |
|---|---|---|
| **Account management** | | |
| Register account | Implemented | Self-service sign-up as a farmer |
| Login | Implemented | |
| Logout | Implemented | |
| Reset password | Implemented | |
| Update personal profile | Implemented | |
| Upload valid ID | Implemented | Choice of 10 government ID types (RSBSA listed first). Front, back (not for a passport) and a selfie holding the ID, taken with the in-app camera inside an ID-shaped frame, with blur and lighting checks; a photo is uploaded only when no camera is available. Stored privately; staff approve or reject it with reasons |
| **Crop/product management** | | |
| Add crop listing | Implemented | Reviewed by staff before going live |
| Edit crop listing | Implemented | Changing what customers see sends the listing back for review; stock-only changes don't, and stock can be changed in place from the product list |
| Delete crop listing | Implemented | Listings with order or review history are archived instead, preserving records |
| Upload crop images | Implemented | PNG, JPEG or WEBP, up to 4 MB |
| Set price per kilo/unit | Implemented | Price per chosen unit: piece, kg, gram, bundle, pack, bag, tray, dozen, liter, sack or bottle |
| Set available quantity | Implemented | |
| Set harvest date for "coming soon" products | Implemented | An out-of-stock listing linked to a growing planting shows "Coming soon" with the expected harvest window on the shop, seller and product pages |
| Set crop category | Implemented | |
| Spoilage alerts | Not implemented | |
| Low stock alerts | Implemented | Dashboard warning at 5 units or fewer |
| Out of stock alerts | Implemented | Dashboard warning at zero stock |
| **Crop monitoring** | | |
| Update crop growth stage | Partial | Each planting shows how far it is from its expected harvest window (growing, ready to harvest, or overdue), worked out from the planting date; growth stages such as flowering and fruiting are not tracked |
| Input planting date | Implemented | One record per planting, so each season is kept separately, with optional area and expected yield |
| Input expected harvest date | Implemented | Calculated from the crop type as a harvest window; the farmer can adjust it |
| Record weather impact | Implemented | Crop log entry with the date seen and a note |
| Record pest/disease issues | Implemented | Crop log entry with the date seen and a note naming the pest or disease |
| Record damaged crops | Implemented | Crop log entry with the date seen and a note |
| Mark ready for harvest | Implemented | Flagged automatically when the harvest window opens; recording the harvest saves the yield and can add it to the linked listing's stock |
| Local pest/disease advisory, AI-translated from members' records | Partial | A shared advisory groups the last 30 days of members' pest, weather and damage reports by crop and kind of problem (pest or disease, weather, damage), with how many farms reported it and the latest notes, for farmers and staff. Staff can also ask an AI (Google Gemini) for a written report: an overview, a reading of each problem, suggested actions, a draft advisory to edit and post, and English versions of notes written in Filipino or Bikol. Farmers see the grouped reports and any advisory staff post, not the AI's report or translations |
| Weather alerts API (Albay) | Partial | Current temperature, humidity and wind for Tabaco City from Open-Meteo; no alerts or forecasts |
| **Market features** | | |
| View current market prices (Albay) | Not implemented | No external market-price data source |
| View price trends (Albay) | Not implemented | |
| Receive high-demand alerts (Albay) | Not implemented | |
| Receive low-supply alerts (Albay) | Not implemented | |
| Receive recommended crops to plant (Albay) | Not implemented | |
| **Orders** | | |
| Receive orders | Implemented | |
| Accept order | Implemented | Pending → confirmed |
| Reject order | Implemented | Cancelling a pending or confirmed order; stock is returned |
| Confirm stock availability | Partial | Stock is checked automatically at checkout; accepting the order is the farmer's confirmation |
| Update order status | Implemented | Forward-only: pending → confirmed → shipped → delivered |
| Mark ready for pickup | Partial | No separate "ready for pickup" status; "shipped" is used for both pickup and delivery |
| Mark delivered | Implemented | |
| **Communication** | | |
| Chat with buyer | Implemented | Farmers can start a conversation from an order; conversations can be searched by name or message text, and removed from the farmer's own list |
| Chat with admin | Not implemented | Staff have no message inbox |
| Receive announcements | Partial | Shown on the farmer overview (announcements for everyone or for farmers only); no notifications |
| **Reports** | | |
| View sales history | Implemented | Orders list for the farmer's products |
| View earnings summary | Implemented | Total revenue from delivered orders on the dashboard |
| View sold crop reports | Partial | Order history and CSV export; no per-crop summary |
| **Minor actions** | | |
| Search buyers | Not implemented | |
| Filter order history | Implemented | Search by customer, product or order number; filter by status; sort by date or total |
| Print sales receipt | Not implemented | |
| Download reports | Implemented | Orders and products as CSV |
| Enable notifications | Not implemented | |
| Disable notifications | Not implemented | |
| Change language | Not implemented | English only |

### 2.3 Manager

| Use-case item | Status | How it is covered |
|---|---|---|
| **Strategic monitoring** | | |
| View farmer performance | Implemented | Products, orders and revenue per farmer |
| View crop supply forecast | Implemented | Upcoming Supply: expected harvest per crop for each of the next 8 weeks, from farmers' plantings and yield estimates |
| View total cooperative sales | Implemented | Reports page |
| View seasonal demand trends | Partial | Sales by month and by category; no forecasting |
| **Decision making** | | |
| Recommend crops to farmers | Not implemented | |
| Set pricing guidance | Not implemented | |
| Plan harvest scheduling | Partial | Upcoming Supply flags weeks when 3 or more farms harvest the same crop; nothing is scheduled |
| Approve farmer membership | Implemented | Managers review ID submissions (front, back and selfie side by side) and approve or reject them with reasons, or mark a farmer verified in person |
| **Reports** | | |
| Print executive reports | Implemented | Print view of the reports page |
| Export annual analytics | Partial | Full report as CSV (all time, with a monthly breakdown); not per year |
| Compare yearly growth | Not implemented | |
| **Communication** | | |
| Broadcast meetings | Partial | Announcements can announce a meeting; no scheduling or RSVP |
| Send urgent notices | Implemented | "Alert" announcements |
| Schedule trainings | Partial | Announcements can announce a training; no scheduling or RSVP |
| **Minor actions** | | |
| Approve promotions | Not implemented | Homepage banners are administrator-managed; no approval workflow |
| View regional statistics | Not implemented | |
| Evaluate inactive members | Partial | Farmer performance shows activity per farmer; inactive members aren't flagged |

Beyond the use cases, managers also approve, view and suspend product listings (and delete suspended ones early), restore archived products, delete product reviews, move orders through their lifecycle (including cancelling), manage categories, crop types and announcements, and suspend customers and farmers. Managers cannot act on admin or other manager accounts, reset passwords, delete accounts, or edit banners, FAQs and site content.

### 2.4 Administrator

| Use-case item | Status | How it is covered |
|---|---|---|
| **User management** | | |
| Approve farmer registrations | Implemented | An approved ID submission, or in-person verification at the cooperative office, gates product listing |
| Approve buyer registrations | Not implemented | Customers are verified by email only |
| Suspend accounts | Implemented | Customers, farmers and managers; not other administrators |
| Delete fake users | Implemented | Accounts are anonymized; their order and audit history is kept |
| Reset user passwords | Implemented | Also resets a staff member's two-factor authentication after a lost device |
| **Product management** | | |
| Approve crop listings | Implemented | |
| Remove prohibited listings | Implemented | Suspend with reasons: hidden from customers at once, the farmer gets a notice in Messages and an email, and it is deleted after 7 days unless resubmitted; staff can delete a suspended listing early. Listings with history are archived instead and can be restored |
| Edit incorrect listings | Partial | Staff don't edit listings; they suspend one with reasons and the farmer edits and resubmits it |
| Verify crop authenticity | Partial | Manual staff review when approving a listing |
| **Order management** | | |
| Monitor transactions | Implemented | All orders, filterable by status |
| Resolve disputes | Not implemented | |
| Cancel fraudulent orders | Implemented | Staff can cancel; stock is returned. Administrators can also override any status change |
| Review complaints | Not implemented | |
| **Content management** | | |
| Post announcements | Implemented | Each is shown to everyone, to farmers only (farmer overview) or to customers only (home page) |
| Send alerts | Implemented | "Alert" announcements |
| Publish advisories | Implemented | "Advisory" announcements |
| Update homepage banners | Implemented | |
| **Reports** | | |
| Generate monthly reports | Implemented | Sales by month (Philippine time) |
| Generate user reports | Implemented | Users by role, user list export |
| Generate sales reports | Implemented | Revenue, top products, sales by category and farmer |
| Generate crop demand reports | Partial | Top products and sales by category; no demand forecasting |
| **Security** | | |
| Audit logs | Implemented | Administrators only; product, order, user, review and content changes, searchable, with paging and CSV export |
| Monitor suspicious activity | Partial | Audit log, security emails (MFA and email changes), rate limiting and CSP violation logs; the same ID number can't verify two accounts and is flagged to staff; no automated anomaly detection |
| Backup database | Not implemented | Relies on the database host's (Supabase) backups |
| Restore records | Partial | Archived products can be restored; no general record restore |
| **Minor actions** | | |
| Manage FAQs | Implemented | Added, deleted and arranged with move up/down buttons |
| Manage contact page | Implemented | Contact details in Site Content, shown on the About page |
| Update cooperative info | Implemented | Name, about text, mission, vision |
| Export CSV reports | Implemented | |

## 3. Delimitations

### 3.1 Users and access

- The system serves **one cooperative, MaVeFaCo, and its customers**. It is not a multi-cooperative platform.
- **Four roles** with fixed permissions: Administrator, Manager, Farmer, Customer. Roles are not configurable.
- **Only customers buy.** Farmers, managers and administrators have no cart and cannot place orders; managers and administrators don't see the storefront.
- Sign-up is open to **customers and farmers only**. Staff accounts are created by promoting an existing account in the database (see the README).
- A farmer can list products only after staff **approve the farmer's ID submission** (front, back and a selfie holding the ID) or **verify them in person** at the cooperative office. Customers need only a verified email address.
- **IDs are checked by eye.** Staff compare the photos; the system doesn't check IDs against government records, read them automatically (OCR) or verify the PhilSys QR code, and its ID-number format checks are approximate. A photo is uploaded from the device only when no camera is available, and staff are shown that it was.
- **Two-factor authentication** (authenticator app) is mandatory for staff and not offered to customers or farmers.
- Passwords must be **12 to 128 characters**.

### 3.2 Transactions and payments

- **No online payment processing.** Customers pay cash on delivery or by **GCash straight to the farmer's own GCash account** (bank transfer is no longer offered). For GCash, the customer enters the 13-digit reference number and the farmer confirms or rejects it after checking their GCash; a GCash order can't be shipped until the farmer confirms it. The system never holds or moves money and does not check payments with GCash itself: it records what each side reports. When a paid order is cancelled, the system marks a refund as due and the farmer marks it sent; the refund itself happens in GCash.
- Prices are in **Philippine pesos**; there are no taxes, fees, discounts or vouchers.
- **One farmer per order.** A cart can only hold products from one farmer.
- Order statuses are fixed: pending → confirmed → shipped → delivered, or cancelled.
- **Delivery only within Tabaco City and its four bordering towns (Malinao, Malilipot, Ligao City and Oas).** The customer pins their spot on a map and adds house, street or landmark details; a spot outside the area can be saved, but orders to it are pickup only. Town lines come from NAMRIA and PSA boundary data, simplified, so a spot within a few hundred metres of a town line can be placed on the wrong side of it. The delivery itself is arranged by the farmer: there is no courier integration, delivery fee, scheduling or live tracking.
- Customers can cancel only while an order is pending.
- A "coming soon" listing can't be ordered or reserved until the farmer restocks it; the expected harvest window shown is an estimate.
- The cart is **stored in the browser** per account, so it does not follow the customer to another device.

### 3.3 Products and inventory

- Every product needs **staff approval** before it is visible to customers.
- **One photo per product**: PNG, JPEG or WEBP, up to 4 MB.
- Stock is a single quantity per product in its selling unit; there are no variants, batches or expiry tracking.
- Products with any order or review history are **archived, never deleted**, so order records stay complete.
- Staff **don't edit listings**. A listing that needs fixing is **suspended** with one or more reasons: it is hidden from customers at once, orders already placed carry on, and the farmer has **7 days** to edit and resubmit it before it is removed automatically (by a daily job, so up to a day later). A listing with an order still in progress is removed only once those orders finish.

### 3.4 Geography, weather and market data

- The cooperative operates in **Albay, Philippines**. The weather widget shows current conditions for one fixed location, **Tabaco City, Albay** (from Open-Meteo); it provides no alerts or forecasts.
- **No external agricultural data** is used: no market prices, price trends, supply or demand data. All reports are computed from the system's own orders, products and users.
- The pest and weather advisory groups members' crop reports from the last 30 days by crop and kind of problem, counting farms without naming them, and shows the farmers' notes as written. The AI crop report is written for staff on request; staff review it, and nothing it writes is posted automatically. It can be wrong, and it is labelled as AI-written.
- **The AI crop report uses Google Gemini's free tier.** Under its terms Google may keep the text sent and use it to improve its products, including review by people. Only the crop, the kind of report, the date and the note are sent, with farms as anonymous labels; phone numbers and email addresses in notes are masked, and farmers are asked not to put names in their notes. The free tier has a daily limit, and the report needs a Gemini API key to work.
- **Crop growing times are approximate.** Each crop type's days to harvest come from Department of Agriculture production guides: mainly DA Regional Field Office 5's *Guiya sa Pagtanom nin Gulay* (2021) for the Bicol region, with ATI Region 7 and DA Region 2 guides for crops it doesn't cover. The staff Crop Types page names each crop's source, and staff can correct the figures. Which of these crops Tabaco farmers grow still needs confirming with the cooperative. Harvest windows are calculated from these figures, not observed. Growth stages (such as flowering and fruiting) are not tracked.
  - DA Regional Field Office 5 (Bicol), [*Guiya sa Pagtanom nin Gulay* (2021)](https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/Guiya-sa-Gulay-2021.pdf) (in Bikol): pechay, mustasa, sitaw, okra, patola, upo, lettuce, ampalaya, eggplant
  - ATI Region 7, [Techno Guide on Organic Eggplant Production](https://ati2.da.gov.ph/ati-7/content/sites/default/files/users/user16/eggplant_final.pdf), [Kangkong](https://ati2.da.gov.ph/ati-7/content/sites/default/files/users/user16/kangkong_final%202020.pdf), [Organic Squash Production](https://ati2.da.gov.ph/ati-7/content/sites/default/files/users/user16/Organic%20Squash%20Production_final.pdf) and [Tomato](https://ati2.da.gov.ph/ati-7/content/sites/default/files/users/user16/Techno%20guide%20on%20Tomato_Final.pdf) guides
  - DA Regional Field Office 2, [Pepper Production Guide (2017)](https://cagayanvalley.da.gov.ph/wp-content/uploads/2018/02/Pepper.pdf): siling labuyo
- **Crop log entries are free text.** A report records its kind (pest or disease, weather, damage, or a note), the date seen and the farmer's note; it has no severity rating or list of named pests, so the advisory groups reports by crop and kind, not by pest.
- **Expected yields are farmers' own estimates**, in kilograms. Upcoming Supply spreads each planting's expected yield evenly across the rest of its harvest window and looks 8 weeks ahead; plantings without an estimate are counted as farms, not kilograms. It flags possible oversupply but doesn't schedule harvests or recommend what to plant.

### 3.5 Communication and notifications

- **Email** (via Brevo) is used only for account and security events (verification, password reset, email change, two-factor changes), to tell a farmer a listing was suspended, and to tell a farmer their ID was approved or rejected.
- There are **no order-status notifications**, in-app notifications, SMS or push notifications, and no notification settings.
- Messaging is **one-to-one between customers and farmers**; staff have no inbox. The system sends farmers one-way **notices** (listing suspensions), shown in Messages without a reply box.
- The interface is **in English only**.

### 3.6 Platform

- A **responsive web application** used through a modern browser on desktop or mobile; there is no native mobile app and no offline mode.
- Hosted on **Vercel** (application) and **Supabase** (database and file storage); availability, capacity and backups depend on those services.
- Rate limits on sign-in, registration, password reset, uploads and similar actions are fixed windows counted in the database, shared by every server instance. If the database can't be reached, each instance falls back to counting on its own.

### 3.7 Data and privacy

- Government ID photos and selfies are kept in private storage, viewable by staff only through links that expire after 5 minutes, and **deleted automatically 30 days after review** (a replaced submission's straight away) (Data Privacy Act of 2012, RA 10173). ID numbers are stored only as a keyed fingerprint and their last 4 characters.
- **Deleting an account anonymizes it**: name, email, password, two-factor setup, ID submissions and photos, reviews, messages, and a farmer's plantings and crop logs are removed; orders and audit-log entries remain, attributed to "Deleted user", and a farmer's products are archived. Deletion is blocked while the account has an active order.
- Text fields have maximum lengths (for example 100 characters for names, 2,000 for messages and product descriptions, and 1,000 for reviews).
- Reports count **delivered orders only** as sales and group months by **Philippine time**.

## 4. Outside the current scope

The following capabilities from the use-case documents are not implemented. They are candidates for future work.

| Area | Items |
|---|---|
| Payments | Online payment processing (a payment gateway that takes and verifies payments itself), invoices and receipts |
| Market intelligence | Market prices and trends, demand and supply alerts, crop recommendations, demand forecasting, regional statistics, yearly growth comparison |
| Planning | Pricing guidance, meeting and training scheduling, promotion approval |
| Customer convenience | Product comparison, pre-orders, favorites, reorder, problem reports, order notifications |
| Farmer convenience | Spoilage alerts, buyer search, sales receipts, notification settings, chat with staff |
| Administration | Dispute and complaint handling, buyer approval, automated anomaly detection, automatic ID checks (reading ID details, PhilSys QR verification), in-app database backup and restore |
| Localization | Languages other than English; AI translation of advisories |

## 5. Thesis text

The same scope and delimitations written as prose for Chapter 1 (Introduction) of the IMRAD thesis. Square brackets mark details to fill in or delete. Keep this section in step with sections 1–4 and with the "Thesis text" tab of the shared Claude Doc.

### Scope and Delimitations of the Study

#### Scope

This study covers the design, development, and deployment of the MaVeFaCo Marketplace, a web-based online marketplace for the Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo) in Albay, Philippines. The system lets the cooperative's member farmers sell fresh produce directly to customers. Cooperative staff use it to oversee product listings, orders, membership, and site content. It was developed during [School Year 2026–2027] and is accessible online through a web browser.

The system has four user roles, listed from most to least privileged: Administrator, Manager, Farmer, and Customer. Each role has its own set of functions.

**Customer.** Customers can register with email verification, log in, reset their password, and update their profile. They can browse staff-approved products, which the home page arranges on a shelf for each category, search by product name, and filter by category and price range. Out-of-stock produce with a harvest on the way is marked "coming soon" with its expected harvest dates, and the home page shows which crops member farms expect to harvest that week. They can view each farmer's public seller page and keep a cart stored in their browser. At checkout, customers choose cash on delivery or GCash, and pickup or delivery. GCash is offered only when the farmer has set it up; the customer pays the farmer's GCash directly and enters the reference number for the farmer to confirm. Delivery is available only within Tabaco City and its four bordering towns (Malinao, Malilipot, Ligao City and Oas), to a spot the customer pins on a map or finds with their phone's location and saves in their profile with their GCash details. They can track an order through its statuses and cancel it while it is still pending. They can also confirm receipt of a shipped order, review products from delivered orders, and message farmers within the system, search their conversations by name or message content, and remove a conversation from their own list.

**Farmer.** Farmers can register and manage their profile, and verify their identity with one of ten accepted government IDs, such as the RSBSA ID. They take photos of the front and back of the ID and a selfie holding it with the in-app camera, which checks each photo for blur and lighting before it is sent. The ID number is kept only as a fingerprint and its last four characters, so the same ID cannot verify two accounts. Once verified, they can create, edit, and delete product listings, and change a listing's stock directly from their product list without another review. Each listing has a photo, category, price per unit, and available quantity, and must be approved by staff before it goes live. The farmer dashboard warns when a product has five units or fewer left or is out of stock. Farmers can accept, reject, and update orders, see where a delivery order goes, confirm or reject GCash payments sent to their own GCash account, and mark refunds sent for cancelled paid orders. They can message customers, including starting a conversation from an order, search their conversations by name or message content, and remove a conversation from their own list. They can search, filter, and sort their orders, products, and plantings, view sales history and an earnings summary, and export their orders and products to CSV. Farmers record each planting of a crop as its own season, with the planting date and, optionally, the area planted and the expected yield. The system works out each planting's expected harvest window from the crop's typical growing time, flags plantings that are ready to harvest or overdue, and lets the farmer record the harvest and add it directly to a listing's stock. Farmers also log pest, disease, weather, and damage problems with a short note, and see a community advisory that groups members' reports by crop and kind of problem and shows how many farms reported each. Their dashboard also shows the cooperative's announcements for farmers. A widget shows the current weather in Tabaco City, Albay.

**Manager.** Managers review and approve product listings. They can suspend a listing with stated reasons, which notifies the farmer and gives them seven days to correct and resubmit it, and they can restore archived listings. Managers move orders through the order lifecycle. They review farmers' ID submissions, comparing the selfie with the ID, and approve them or reject them with stated reasons, which notifies the farmer; they can also mark a farmer as verified after checking the ID in person at the cooperative office. They also manage product categories and announcements, including alerts and advisories, each shown to everyone, to farmers only, or to customers only, remove inappropriate product reviews, and suspend customer and farmer accounts. They maintain the list of crop types and their typical growing times, and view the expected supply of each crop for the next eight weeks, with weeks flagged when many farms will harvest the same crop. They see the same community advisory as farmers and can ask an AI to write a report on it, with suggested actions, English versions of notes written in Filipino or Bikol, and a draft advisory they can edit and post as an announcement. They can view and print sales reports, farmer-performance summaries, and sales by month and by category, and export the reports to CSV.

**Administrator.** Administrators have all manager functions. They can also delete user accounts, reset users' passwords and two-factor authentication, and override order statuses. They have access to the audit log of product, order, user, review, and content changes. They also manage homepage banners, frequently asked questions, contact details, and the cooperative's profile information.

The system includes several security measures:

- mandatory two-factor authentication for administrators and managers
- email verification and time-limited password-reset links
- role-based access control enforced on the server
- rate limiting on sign-in and similar actions
- private storage of ID photos and selfies, viewable by staff only through short-lived links
- an audit trail of administrative actions

Measured against the use-case requirements gathered at the start of the project, the system covers 129 use-case items. Eighty-one (81) are fully implemented, twenty-one (21) are partially implemented, and twenty-seven (27) are outside the scope of the current version.

[The study also covers the evaluation of the system by [respondents, e.g., cooperative officers, member farmers, customers, and IT experts] using [evaluation instrument, e.g., the ISO/IEC 25010 software quality model] in terms of [criteria, e.g., functional suitability, usability, reliability, and security].]

#### Delimitations

The study is limited to the following boundaries.

**Users and access.** The system serves only one cooperative, MaVeFaCo, and its customers. It is not a multi-cooperative or general-purpose marketplace. The four roles have fixed permissions that cannot be reconfigured. Only customers can place orders. Public sign-up is limited to customers and farmers. Staff accounts are created by promoting an existing account. Two-factor authentication is required for staff only; customers and farmers are not offered it. Passwords must be 12 to 128 characters. Farmers' IDs are checked by staff from the photos; the system does not confirm them against government records, read them automatically, or verify the PhilSys QR code. A photo is uploaded from the device only when no camera is available, and staff are told when this happens.

**Transactions and payments.** The system does not process online payments. Customers pay cash on delivery or by GCash straight to the farmer's own GCash account; bank transfer is not offered. For GCash, the customer enters the payment's reference number and the farmer confirms it after checking their own GCash. The system does not hold money or verify payments with GCash: it records what the customer and the farmer report, including refunds owed on cancelled orders. Prices are in Philippine pesos only. The system does not handle taxes, service fees, discounts, or vouchers. Each order can contain products from only one farmer. The cart is stored in the customer's browser, so it does not carry over to another device. Delivery is limited to Tabaco City and its four bordering towns (Malinao, Malilipot, Ligao City and Oas), based on simplified NAMRIA and PSA municipal boundaries; customers outside the area can choose pickup only. The farmer arranges the delivery itself. There is no courier integration, delivery fee, delivery scheduling, or live tracking. Order statuses are fixed: pending, confirmed, shipped, delivered, and cancelled. Customers can cancel an order only while it is pending. A "coming soon" product cannot be ordered or reserved until the farmer restocks it.

**Products and inventory.** Each product has one photo (PNG, JPEG, or WEBP, up to 4 MB) and one stock quantity in its selling unit. The system does not track product variants, batches, or expiry dates. Staff do not edit farmers' listings directly. A listing that needs correcting is suspended with reasons and must be fixed by the farmer within seven days, or it is removed automatically. Products with existing order or review history are archived rather than deleted so that transaction records stay complete.

**Geographic, weather, and market data.** The study is limited to the cooperative's area of operation in Albay. The weather widget shows current conditions for one fixed location, Tabaco City, from the Open-Meteo service. It gives no forecasts or weather alerts. The system does not use external agricultural market data such as market prices, price trends, or supply and demand figures. All reports are computed only from the system's own records. The community advisory groups members' reports from the last 30 days by crop and problem, without naming farms, and shows the farmers' notes as they were written, without AI-based summarization or translation.

**Crop monitoring.** Harvest windows are estimated from each crop's typical growing time, taken from Department of Agriculture production guides (mainly DA Regional Field Office 5's guide for the Bicol region), not observed in the field, and staff can correct those times. The system does not track growth stages such as flowering or fruiting, and crop problems are recorded as short notes without a severity rating. Expected yields are the farmers' own estimates in kilograms, and the expected harvest dates and weekly harvest totals shown to customers are estimates. The supply outlook covers only the next eight weeks and only the plantings farmers have recorded. It flags possible oversupply but does not schedule harvests or recommend what to plant. The AI crop report summarizes only what farmers wrote in their crop logs; it is not expert agronomic advice and does not recommend pesticides or doses.

**Communication and notifications.** Email is used only for account and security events (account verification, password reset, email change, and two-factor authentication changes) and for notifying farmers of suspended listings and of the outcome of their ID review. The system has no order-status notifications, in-app or push notifications, SMS, or notification settings. In-system messaging is limited to one-to-one conversations between customers and farmers, and staff have no messaging inbox. Open pages update by themselves within about a second of a change (every 15 seconds if the live connection is unavailable), but this is not a notification: nothing is shown on a page that is not open. The interface is in English only.

**Platform.** The system is a responsive web application used through a modern web browser on desktop or mobile devices. It has no native mobile application and no offline mode. It is hosted on Vercel (application) and Supabase (database and file storage), so its availability, capacity, and data backups depend on those providers. Rate limits on sign-in, registration, password reset, and uploads are counted in fixed time windows.

**Data privacy.** Following the Data Privacy Act of 2012 (Republic Act No. 10173), farmers' ID photos and selfies are visible to staff only through links that expire after five minutes, and are deleted automatically 30 days after they are reviewed. ID numbers are stored only as a keyed fingerprint and their last four characters. Deleting an account anonymizes the user's personal information, while order and audit records are kept for accountability. When a farmer's account is deleted, their products are archived and their plantings, crop logs, and ID submissions are deleted. A customer's delivery spot and address are shown only to the farmer of that order, and staff see only the town. Deleting an account also removes the user's GCash details and saved and past delivery addresses. An account cannot be deleted while it has an active order, or, for a farmer, while a customer is owed a GCash refund. Sales reports count only delivered orders and group monthly figures by Philippine Standard Time.

**Features outside the current scope.** The following features appeared in the initial use-case requirements but are not part of this study. They are recommended for future development:

- online payment processing and invoice generation
- market intelligence, such as market prices, price trends, demand and supply alerts, crop recommendations, and demand forecasting
- managerial planning tools, such as pricing guidance, automated harvest scheduling, and meeting and training scheduling
- customer and farmer conveniences, such as product comparison, pre-orders, favorite sellers, reordering, and notification settings
- dispute and complaint handling
- automated detection of suspicious activity
- automatic reading of ID details and checking IDs against government records, such as the PhilSys QR code
- in-system database backup and restore
- languages other than English
