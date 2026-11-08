import type { Metadata } from 'next'
import LegalPage, { COOPERATIVE_EMAIL, LEGAL_EFFECTIVE_DATE, LegalTable, type LegalSection } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service — MaVeFaCo Marketplace',
  description: 'The terms for using the MaVeFaCo Marketplace of the Mayon Vegetable Farmers Agriculture Cooperative.',
}

// Kept in step with the "Terms of Service" tab of the project's Claude Doc.
const sections: LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    body: (
      <>
        <p>By creating an account or placing an order, you agree to these terms and to the Privacy Policy. If you do not agree, do not use the marketplace.</p>
        <ul>
          <li><strong>Who runs it.</strong> The Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo), Tabaco City, Albay (&ldquo;the cooperative&rdquo;, &ldquo;we&rdquo;) runs the marketplace website, currently at mavefaco-sys.vercel.app.</li>
          <li><strong>What it is.</strong> A place where member farmers list their produce, customers order it, and the cooperative reviews listings, follows orders and shares market and crop information with its members.</li>
          <li><strong>What it is not.</strong> The cooperative does not sell the produce itself and does not handle payments. Each sale is between the customer and the member farmer whose product it is.</li>
          <li><strong>Age.</strong> You must be at least 18 years old to create an account. By registering, you confirm that you are.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts and roles',
    body: (
      <>
        <p>You need an account to order, sell or message. Browsing products is open to everyone.</p>
        <LegalTable
          head={['Role', 'Who', 'What they can do']}
          rows={[
            ['Customer', 'Anyone who registers to buy', 'Order produce, pay, message farmers, review products from delivered orders'],
            ['Farmer', 'A cooperative member whose ID staff have verified', 'List produce, handle orders and payments, record plantings and crop problems, see the Market page'],
            ['Manager', 'Cooperative staff', 'Review listings and farmer IDs, follow orders, manage crop types, content and announcements'],
            ['Administrator', 'Cooperative staff', 'Everything a manager can do, plus manage staff accounts'],
          ]}
        />
        <ul>
          <li><strong>Your details must be true.</strong> Register with your real name and an email address you can receive mail at; you confirm it through a link we send.</li>
          <li><strong>Keep your password to yourself.</strong> It must be at least 12 characters. You are responsible for what is done with your account. Tell the cooperative at once if you think someone else has used it.</li>
          <li><strong>Staff sign in with two steps:</strong> a password and a code from an authenticator app.</li>
          <li><strong>Changing your email</strong> needs your current password and a confirmation link sent to the new address; the old address is told about the change.</li>
          <li><strong>One account per person.</strong> Farmers cannot verify two accounts with the same ID.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'farmers',
    title: 'Farmers: verification and listings',
    body: (
      <>
        <p>Farmers sell only after staff verify their identity, and every listing is reviewed before customers see it.</p>
        <ol>
          <li><strong>Verify your identity.</strong> Choose one of ten accepted government IDs (RSBSA ID, PhilSys, driver&apos;s license, UMID, passport, PRC, postal, voter&apos;s, senior citizen or PWD ID). Take photos of the front and back (not for a passport) and a selfie holding the ID. Staff approve or reject it with reasons, or verify you in person at the cooperative office.</li>
          <li><strong>List what you grow.</strong> Each listing needs a true name, category, unit, price per unit, available stock and, ideally, a photo of the actual produce. Link it to its crop so its sales count on the Market page.</li>
          <li><strong>Wait for review.</strong> A listing goes live once staff approve it. Changing a listing&apos;s details sends it back for review; changing only the stock does not.</li>
          <li><strong>Keep stock and prices honest.</strong> Sell only produce you have or will have, at the price shown. Produce marked &ldquo;coming soon&rdquo; cannot be ordered until you restock it.</li>
        </ol>
        <p><strong>Suspension.</strong> Staff may suspend a listing for an incorrect price, an unclear or missing photo, an inaccurate name or description, the wrong category or unit, a prohibited or non-agricultural item, a duplicate, or another stated reason. You are told by notice and email. Fix and resubmit it within 7 days, or it is deleted; a listing with past orders is archived instead.</p>
        <p><strong>Not allowed:</strong> items that are not farm produce of the cooperative&apos;s members, anything illegal to sell in the Philippines, and listings that copy another farmer&apos;s photos or descriptions.</p>
      </>
    ),
  },
  {
    id: 'orders',
    title: 'Orders, payment and delivery',
    body: (
      <>
        <p>An order is an agreement between you and one farmer; the cooperative records it but never holds or moves the money.</p>
        <ul>
          <li><strong>One farmer per order.</strong> Prices are in Philippine pesos, with no service fees, taxes added, discounts or vouchers. Produce sold by the kilo or liter is bought in steps of 0.25; other units in whole numbers.</li>
          <li><strong>Cash on delivery,</strong> paid to the farmer on delivery or pickup.</li>
          <li><strong>GCash, paid straight to the farmer&apos;s own GCash account.</strong> Pay the exact amount, then enter the 13-digit reference number. The farmer checks their GCash and confirms or rejects it, and a GCash order is not shipped until the farmer confirms the money arrived. Entering a reference for a payment you did not make is fraud and ends your account.</li>
          <li><strong>Delivery or pickup.</strong> Delivery is only within Tabaco City, Malinao, Malilipot, Ligao City and Oas, to the spot you save on the map; elsewhere, choose pickup. The farmer arranges the delivery. There is no courier, delivery fee, schedule or live tracking.</li>
          <li><strong>Order statuses:</strong> pending, confirmed, shipped, delivered and cancelled. You are told of each change by a message from the farmer in the app.</li>
          <li><strong>Cancelling.</strong> You can cancel while the order is pending. The farmer can cancel a pending or confirmed order. Stock goes back to the listing.</li>
          <li><strong>Refunds.</strong> If a paid GCash order is cancelled, the farmer must send the money back to your GCash and mark the refund sent. Refunds happen in GCash, between you and the farmer; the cooperative can help resolve disputes but does not pay refunds itself.</li>
          <li><strong>Receiving.</strong> Confirm receipt in My Orders once a shipped order arrives. You can then review its products.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'messages',
    title: 'Messages, photos and reviews',
    body: (
      <>
        <p>Messages are for buying and selling between a customer and a farmer; staff have no inbox.</p>
        <ul>
          <li><strong>Be truthful and respectful.</strong> No harassment, threats, hate, spam, scams, or attempts to move a sale off the marketplace to avoid its records.</li>
          <li><strong>Photos</strong> (PNG, JPEG or WEBP, up to 4 MB) are for things like a GCash QR code, a receipt or the produce. Do not send other people&apos;s IDs, private pictures, or anything illegal.</li>
          <li><strong>Limits:</strong> up to 120 messages and 30 photos per hour per person, to stop flooding.</li>
          <li><strong>Removing a conversation</strong> hides it from your own list only; the other person keeps their copy.</li>
          <li><strong>Reviews</strong> are for products from your delivered orders and must describe your own experience. Staff may remove a review that is abusive, off-topic or misleading.</li>
          <li><strong>What you post stays yours.</strong> You let the cooperative store and show it in the marketplace for as long as it is there.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'market',
    title: 'Market information, estimates and AI reports',
    body: (
      <>
        <p>The marketplace&apos;s market and crop information is a guide for planning, not advice you can rely on as certain.</p>
        <ul>
          <li><strong>Expected harvests and &ldquo;coming soon&rdquo; dates</strong> are estimates from farmers&apos; own records and typical growing times taken from Department of Agriculture guides.</li>
          <li><strong>Market signals</strong> (demand against planned supply, alerts, crops worth planting) are calculated from the marketplace&apos;s own sales of the last eight weeks and the plantings members recorded. They cover only this marketplace.</li>
          <li><strong>Farmgate prices and production volumes</strong> come from the Philippine Statistics Authority&apos;s OpenSTAT, which runs about two months behind. They are a reference; each farmer sets their own price.</li>
          <li><strong>The AI crop report</strong> for staff is written by Google Gemini from farmers&apos; crop-log notes. It is not expert agronomic advice and does not recommend pesticides or doses; staff review it before posting anything.</li>
          <li><strong>Weather</strong> on the farmer dashboard comes from Open-Meteo for Tabaco City.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension and deleting your account',
    body: (
      <ul>
        <li><strong>Suspension.</strong> Staff may suspend an account that breaks these terms, for example for fraud, false ID details, abuse in messages or repeated prohibited listings. A suspended account cannot sign in.</li>
        <li><strong>Deleting your account.</strong> You can delete it yourself in Profile with your password. It is blocked while you have an active order (pending, confirmed or shipped) and, for a farmer, while a customer is owed a GCash refund.</li>
        <li><strong>What deletion removes:</strong> your name, email, password, ID submissions and photos, reviews, messages and the photos in them, GCash details and QR code, delivery spots and, for a farmer, plantings and crop logs. Your products are archived. Orders and the activity log stay, attributed to &ldquo;Deleted user&rdquo;, because both sides of a sale need the record. See the <a href="/privacy">Privacy Policy</a> for details.</li>
        <li><strong>This cannot be undone.</strong></li>
      </ul>
    ),
  },
  {
    id: 'responsibility',
    title: 'Responsibility, disputes, changes and contact',
    body: (
      <ul>
        <li><strong>Who answers for what.</strong> The farmer answers for the produce, its quantity and quality, delivery, and any refund. The customer answers for paying and for being at the delivery spot or pickup. The cooperative answers for running the marketplace with reasonable care: reviewing listings and IDs, keeping records and protecting personal data.</li>
        <li><strong>The marketplace is provided as it is.</strong> It may be unavailable at times for maintenance or faults. The cooperative is not responsible for losses caused by a sale between a customer and a farmer, by GCash, or by estimates and market information turning out wrong, except where Philippine law says otherwise.</li>
        <li><strong>Disputes.</strong> Raise a problem with the other person through Messages first. If that fails, contact the cooperative, which will look at the order&apos;s records and help settle it.</li>
        <li><strong>Law.</strong> These terms follow the laws of the Republic of the Philippines, including the Consumer Act (Republic Act No. 7394) and the Data Privacy Act of 2012 (Republic Act No. 10173).</li>
        <li><strong>Changes.</strong> We may update these terms. The new version is posted with its date; using the marketplace after that means you accept it. Important changes are announced in the marketplace first.</li>
        <li><strong>Contact.</strong> Mayon Vegetable Farmers Agriculture Cooperative, Tabaco City, Albay. Email: <a href={`mailto:${COOPERATIVE_EMAIL}`}>{COOPERATIVE_EMAIL}</a>.</li>
      </ul>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={<p>Effective {LEGAL_EFFECTIVE_DATE}. These terms govern the MaVeFaCo Marketplace, the online marketplace and crop-monitoring system of the Mayon Vegetable Farmers Agriculture Cooperative in Tabaco City, Albay.</p>}
      sections={sections}
      other={{ href: '/privacy', label: 'Privacy Policy' }}
    />
  )
}
