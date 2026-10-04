# Scope and Delimitations

**System:** MaVeFaCo Marketplace — the online marketplace of the Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo)
**As of:** 2026-10-05 · deployed at https://mavefaco-sys.vercel.app

This document states what the system covers (**scope**) and the boundaries it deliberately stays within (**delimitations**). The scope is measured against the four use-case documents written at the start of the project — [`ADMIN_USE_CASE.md`](ADMIN_USE_CASE.md), [`MANAGER_USE_CASE.md`](MANAGER_USE_CASE.md), [`FARMER_USE_CASE.md`](FARMER_USE_CASE.md) and [`CUSTOMER_USE_CASE.md`](CUSTOMER_USE_CASE.md) — which describe the full long-term vision. The implemented system covers the core marketplace workflow end to end; the remaining items are documented below as outside the current scope.

## Contents

1. [Summary](#1-summary)
2. [Scope by role](#2-scope-by-role)
3. [Delimitations](#3-delimitations)
4. [Outside the current scope](#4-outside-the-current-scope)

**Status key:** **Implemented** — available in the system. **Partial** — the need is met in a narrower form than the use case describes (the note says how). **Not implemented** — outside the current scope.

---

## 1. Summary

| Role | Use-case items | Implemented | Partial | Not implemented |
|---|---|---|---|---|
| Customer | 32 | 23 | 3 | 6 |
| Farmer | 51 | 31 | 7 | 13 |
| Manager | 17 | 5 | 5 | 7 |
| Administrator | 29 | 21 | 4 | 4 |
| **Total** | **129** | **80** | **19** | **30** |

The system fully supports the cooperative's core workflow: farmers list produce, staff review it, customers buy it, farmers and staff fulfil orders, and staff monitor the cooperative through reports and an audit log. The items outside the scope cluster in four areas: **online payments**, **market intelligence** (prices, forecasts, recommendations), **planning tools** for managers, and **convenience features** (favorites, invoices, notification settings, translation).

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
| Update profile | Implemented | Name, password, and email (the new address must confirm the change) |
| **Marketplace** | | |
| Browse products | Implemented | Only staff-approved products are shown |
| Search products | Implemented | By product name |
| Filter by crop type | Implemented | By category |
| Filter by price | Implemented | Minimum and maximum price |
| View seller details | Implemented | Public seller page with the farmer's products and ratings |
| View product photos | Implemented | One photo per product |
| Compare products | Not implemented | |
| **Ordering** | | |
| Add to cart | Implemented | Cart is saved per account |
| Place order | Implemented | Stock is checked and reserved at checkout |
| Reserve products | Not implemented | No pre-orders for products not yet in stock |
| Cancel order | Implemented | While the order is still pending; stock is returned |
| Modify quantity | Implemented | In the cart, before checkout |
| Choose payment method | Implemented | Cash on delivery, GCash or bank transfer, recorded on the order; see [delimitations](#32-transactions-and-payments) |
| Choose pickup/delivery | Implemented | |
| **Tracking** | | |
| View order history | Implemented | |
| Track order status | Implemented | Pending → confirmed → shipped → delivered (or cancelled) |
| Confirm received order | Implemented | Marks a shipped order delivered |
| **Communication** | | |
| Chat with farmer | Implemented | In-app messages with unread counts |
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
| Upload valid ID | Implemented | Stored privately; staff verify it before the farmer can list products |
| **Crop/product management** | | |
| Add crop listing | Implemented | Reviewed by staff before going live |
| Edit crop listing | Implemented | Changing what customers see sends the listing back for review |
| Delete crop listing | Implemented | Listings with sales history are archived instead, preserving order records |
| Upload crop images | Implemented | PNG, JPEG or WEBP, up to 4 MB |
| Set price per kilo/unit | Implemented | Price per chosen unit (piece, kg, gram, bundle, pack, bag, tray, dozen, liter, sack, bottle) |
| Set available quantity | Implemented | |
| Set harvest date for "coming soon" products | Partial | The expected harvest date is recorded in the crop monitor but not shown to customers as "coming soon" |
| Set crop category | Implemented | |
| Spoilage alerts | Not implemented | |
| Low stock alerts | Implemented | Warning on the farmer dashboard |
| Out of stock alerts | Implemented | Warning on the farmer dashboard |
| **Crop monitoring** | | |
| Update crop growth stage | Implemented | Seedling → vegetative → flowering → fruiting → harvest-ready → harvested |
| Input planting date | Implemented | |
| Input expected harvest date | Implemented | |
| Record weather impact | Implemented | Crop log entry |
| Record pest/disease issues | Implemented | Crop log entry |
| Record damaged crops | Implemented | Crop log entry |
| Mark ready for harvest | Implemented | |
| Local pest/disease advisory, AI-translated from members' records | Partial | A shared advisory lists the last 30 days of pest, weather and damage logs from all members' approved products, as written; no AI translation or summarization |
| Weather alerts API (Albay) | Partial | Current conditions for Albay from Open-Meteo on the farmer dashboard; no alerts or forecasts |
| **Market features** | | |
| View current market prices (Albay) | Not implemented | No external market-price data source |
| View price trends (Albay) | Not implemented | |
| Receive high-demand alerts (Albay) | Not implemented | |
| Receive low-supply alerts (Albay) | Not implemented | |
| Receive recommended crops to plant (Albay) | Not implemented | |
| **Orders** | | |
| Receive orders | Implemented | |
| Accept order | Implemented | Pending → confirmed |
| Reject order | Implemented | Cancelling a pending order; stock is returned |
| Confirm stock availability | Partial | Stock is checked automatically at checkout; accepting the order is the farmer's confirmation |
| Update order status | Implemented | Forward-only: pending → confirmed → shipped → delivered |
| Mark ready for pickup | Partial | No separate "ready for pickup" status; "shipped" is used for both pickup and delivery |
| Mark delivered | Implemented | |
| **Communication** | | |
| Chat with buyer | Implemented | |
| Chat with admin | Not implemented | Staff have no message inbox |
| Receive announcements | Partial | Shown on the public home page, not in the farmer portal or as notifications |
| **Reports** | | |
| View sales history | Implemented | Orders list for the farmer's products |
| View earnings summary | Implemented | Total revenue from delivered orders on the dashboard |
| View sold crop reports | Partial | Order history and CSV export; no per-crop summary |
| **Minor actions** | | |
| Search buyers | Not implemented | |
| Filter order history | Not implemented | |
| Print sales receipt | Not implemented | |
| Download reports | Implemented | Orders as CSV |
| Enable notifications | Not implemented | |
| Disable notifications | Not implemented | |
| Change language | Not implemented | English only |

### 2.3 Manager

| Use-case item | Status | How it is covered |
|---|---|---|
| **Strategic monitoring** | | |
| View farmer performance | Implemented | Products, orders and revenue per farmer |
| View crop supply forecast | Not implemented | |
| View total cooperative sales | Implemented | Reports page |
| View seasonal demand trends | Partial | Sales by month and by category; no forecasting |
| **Decision making** | | |
| Recommend crops to farmers | Not implemented | |
| Set pricing guidance | Not implemented | |
| Plan harvest scheduling | Not implemented | |
| Approve farmer membership | Implemented | Managers verify farmers' submitted IDs |
| **Reports** | | |
| Print executive reports | Implemented | Print view of the reports page |
| Export annual analytics | Partial | Full report as CSV (all time, with monthly breakdown); not per year |
| Compare yearly growth | Not implemented | |
| **Communication** | | |
| Broadcast meetings | Partial | Announcements can announce a meeting; no scheduling or RSVP |
| Send urgent notices | Implemented | "Alert" announcements |
| Schedule trainings | Partial | Announcements can announce a training; no scheduling or RSVP |
| **Minor actions** | | |
| Approve promotions | Not implemented | Homepage banners are administrator-managed; no approval workflow |
| View regional statistics | Not implemented | |
| Evaluate inactive members | Partial | Farmer performance shows activity per farmer; inactive members aren't flagged |

Managers can also approve and reject product listings, restore archived products, manage orders, categories and announcements, and suspend customers and farmers.

### 2.4 Administrator

| Use-case item | Status | How it is covered |
|---|---|---|
| **User management** | | |
| Approve farmer registrations | Implemented | Farmer ID verification gates product listing |
| Approve buyer registrations | Not implemented | Customers are verified by email only |
| Suspend accounts | Implemented | |
| Delete fake users | Implemented | Accounts are anonymized; their order and audit history is kept |
| Reset user passwords | Implemented | Also resetting a staff member's two-factor authentication after a lost device |
| **Product management** | | |
| Approve crop listings | Implemented | |
| Remove prohibited listings | Implemented | Reject or remove; listings with history are archived and can be restored |
| Edit incorrect listings | Implemented | |
| Verify crop authenticity | Partial | Manual staff review when approving a listing |
| **Order management** | | |
| Monitor transactions | Implemented | All orders, filterable by status |
| Resolve disputes | Not implemented | |
| Cancel fraudulent orders | Implemented | Staff can cancel; stock is returned |
| Review complaints | Not implemented | |
| **Content management** | | |
| Post announcements | Implemented | |
| Send alerts | Implemented | "Alert" announcements |
| Publish advisories | Implemented | "Advisory" announcements |
| Update homepage banners | Implemented | |
| **Reports** | | |
| Generate monthly reports | Implemented | Sales by month (Philippine time) |
| Generate user reports | Implemented | Users by role, user list export |
| Generate sales reports | Implemented | Revenue, top products, sales by category and farmer |
| Generate crop demand reports | Partial | Top products and sales by category; no demand forecasting |
| **Security** | | |
| Audit logs | Implemented | Product, order, user and content changes, with paging |
| Monitor suspicious activity | Partial | Audit log, security emails (MFA changes, email changes), rate limiting and CSP violation logs; no automated anomaly detection |
| Backup database | Not implemented | Relies on the database host (Supabase) backups |
| Restore records | Partial | Archived products can be restored; no general record restore |
| **Minor actions** | | |
| Manage FAQs | Implemented | |
| Manage contact page | Implemented | Contact details in Site Content, shown on the About page |
| Update cooperative info | Implemented | Name, about text, mission, vision |
| Export CSV reports | Implemented | |

## 3. Delimitations

### 3.1 Users and access

- The system serves **one cooperative, MaVeFaCo, and its customers**. It is not a multi-cooperative platform.
- **Four roles** with fixed permissions: Administrator, Manager, Farmer, Customer. Roles are not configurable.
- Sign-up is open to **customers and farmers only**. Staff accounts are created by promoting an existing account in the database (see the README).
- A farmer can list products only after staff **verify the farmer's government ID**. Customers need only a verified email address.
- **Two-factor authentication** (authenticator app) is mandatory for staff and not offered to customers or farmers.

### 3.2 Transactions and payments

- **No online payment processing.** Customers choose cash on delivery, GCash or bank transfer, and the choice is recorded on the order; payment itself happens outside the system and is not confirmed by it.
- Prices are in **Philippine pesos**; there are no taxes, fees, discounts or vouchers.
- **One farmer per order.** A cart can only hold products from one farmer.
- Order statuses are fixed: pending → confirmed → shipped → delivered, or cancelled. **Pickup and delivery are arranged outside the system**; there is no courier integration, delivery scheduling or location tracking.
- Customers can cancel only while an order is pending.

### 3.3 Products and inventory

- Every product needs **staff approval** before it is visible to customers.
- **One photo per product**: PNG, JPEG or WEBP, up to 4 MB.
- Stock is a single quantity per product in its selling unit; there are no variants, batches or expiry tracking.
- Products with any order, review or crop-log history are **archived, never deleted**, so order records stay complete.

### 3.4 Geography, weather and market data

- The cooperative operates in **Albay, Philippines**. The weather widget shows current conditions for one fixed location in Albay (from Open-Meteo); it provides no alerts or forecasts.
- **No external agricultural data** is used: no market prices, price trends, supply or demand data. All reports are computed from the system's own orders, products and users.
- The pest and weather advisory shares members' own crop logs from the last 30 days, as written; it is not AI-generated or translated.

### 3.5 Communication and notifications

- **Email** (via Brevo) is used only for account and security events: verification, password reset, email change, two-factor changes.
- There are **no order-status notifications**, in-app notifications, SMS or push notifications, and no notification settings.
- Messaging is **one-to-one between customers and farmers**; staff have no inbox.
- The interface is **in English only**.

### 3.6 Platform

- A **responsive web application** used through a modern browser on desktop or mobile; there is no native mobile app and no offline mode.
- Hosted on **Vercel** (application) and **Supabase** (database and file storage); availability, capacity and backups depend on those services.
- Rate limits on sign-in and similar actions are tracked per server instance, so they are not strictly enforced across simultaneous instances.

### 3.7 Data and privacy

- Government ID images are kept in private storage, viewable by staff only through links that expire after 5 minutes, and **deleted automatically 30 days after verification** (Data Privacy Act of 2012, RA 10173).
- **Deleting an account anonymizes it**: name, email, password, two-factor setup, ID image, reviews and messages are removed; orders and audit-log entries remain, attributed to "Deleted user".
- Text fields have maximum lengths (for example 100 characters for names and 2,000 for messages).
- Reports count **delivered orders only** as sales and group months by **Philippine time**.

## 4. Outside the current scope

The following capabilities from the use-case documents are not implemented. They are candidates for future work.

| Area | Items |
|---|---|
| Payments | Online payment and payment confirmation, invoices and receipts |
| Market intelligence | Market prices and trends, demand and supply alerts, crop recommendations, supply and demand forecasting, regional statistics, yearly growth comparison |
| Planning | Pricing guidance, harvest scheduling, meeting and training scheduling, promotion approval |
| Customer convenience | Product comparison, pre-orders, favorites, reorder, problem reports, order notifications |
| Farmer convenience | Spoilage alerts, buyer search, order-history filters, sales receipts, notification settings, chat with staff |
| Administration | Dispute and complaint handling, buyer approval, automated anomaly detection, in-app database backup and restore |
| Localization | Languages other than English; AI translation of advisories |
