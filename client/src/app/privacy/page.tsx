import type { Metadata } from 'next'
import LegalPage, { COOPERATIVE_EMAIL, LEGAL_EFFECTIVE_DATE, LegalTable, type LegalSection } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy — MaVeFaCo Marketplace',
  description: 'How the MaVeFaCo Marketplace collects, uses and protects personal information under the Data Privacy Act of 2012.',
}

// Kept in step with the "Privacy Policy" tab of the project's Claude Doc.
const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>The Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo), Tabaco City, Albay, decides how personal information in the marketplace is used: it is the personal information controller under the Data Privacy Act of 2012 (Republic Act No. 10173). This policy covers everyone who uses the marketplace: visitors, customers, farmers and cooperative staff.</p>
        <p><strong>Data Protection Officer.</strong> Questions and requests about personal information go to the cooperative&apos;s Data Protection Officer at <a href={`mailto:${COOPERATIVE_EMAIL}`}>{COOPERATIVE_EMAIL}</a>.</p>
        <p><strong>Age.</strong> The marketplace is for people aged 18 and over; we do not knowingly collect information about anyone younger. If you believe a minor has registered, tell us and we will delete the account.</p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect and why',
    body: (
      <>
        <p>We collect only what the marketplace needs to work; browsing products needs no account and collects nothing about you.</p>
        <LegalTable
          head={['Information', 'Whose', 'Why']}
          rows={[
            ['Name, email address, password (stored only as a one-way hash), role', 'Everyone with an account', 'Sign-in, and messages about your account'],
            ['Authenticator secret (encrypted) and backup codes (hashed)', 'Staff', 'Two-step sign-in'],
            ["ID type, photos of the ID's front and back and a selfie holding it, the ID number's last four characters and a keyed fingerprint of it, the review result and reasons", 'Farmers', 'Confirm a farmer is a real member; stop one ID verifying two accounts'],
            ['GCash name, number and optional QR code', 'Farmers and customers', 'Farmers: to be paid. Customers: to fill in payments and to receive refunds'],
            ['GCash reference, the name and number paid from, refund reference', "Customers' orders", 'Let the farmer find the payment or refund'],
            ['Delivery map pin, address details and town', 'Customers', 'Deliver orders; check the delivery area'],
            ['Orders: items, amounts, statuses, dates', 'Customers and farmers', 'Fulfil and record each sale; sales reports'],
            ['Messages, photos sent in them, reviews', 'Customers and farmers', 'Talk about orders; product reviews'],
            ['Plantings, harvests and crop-log notes', 'Farmers', 'Expected supply, the Market page and the community advisory'],
            ['Activity log (who did what, when)', 'Staff, farmers, customers', 'Accountability for actions such as approvals, suspensions and order changes'],
            ['IP address', 'Everyone', 'Limit repeated sign-in, sign-up and other attempts, to stop abuse'],
          ]}
        />
        <ul>
          <li><strong>Your phone&apos;s location</strong> is read only when you press &ldquo;Use my location&rdquo; on the delivery map, to place the pin. Only the pin you save is kept.</li>
          <li><strong>The camera</strong> is used only while you take your ID photos; nothing is recorded outside those photos.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'who-sees-it',
    title: 'Who sees it',
    body: (
      <>
        <p>Each person sees only what their part in a sale needs; we do not sell or rent personal information, or use it for advertising.</p>
        <LegalTable
          head={['Who', 'What they see']}
          rows={[
            ['Anyone, signed in or not', "A farmer's name, public seller page and products; reviewers' names with their reviews; harvest totals and crop advisories with no farm named"],
            ['A customer paying by GCash', "That farmer's GCash name, number and QR code"],
            ['The farmer of an order', "The customer's name and email, the delivery pin and address, and the GCash account paid from; while a refund is owed, the customer's GCash details and QR code"],
            ['The two people in a conversation', 'Its messages and photos (photos through links that stop working after an hour)'],
            ['Managers and administrators', 'Account names, emails and roles; ID photos through links that stop working after five minutes; orders with the delivery town only, not the address or GCash details; listings, reviews, crop records and the activity log. Staff cannot read messages'],
          ]}
        />
        <p><strong>Outside services</strong> that handle data for us, only to run the marketplace:</p>
        <LegalTable
          head={['Service', 'What it does', 'Data it handles']}
          rows={[
            ['Supabase', 'Database, private file storage and live page updates', 'Everything listed in section 2; servers in Tokyo, Japan'],
            ['Vercel', 'Hosts the website', 'Requests to the site, including IP addresses; runs in Tokyo, Japan'],
            ['Brevo', 'Sends account and listing emails', 'Your name and email address, and the message'],
            ['Google Gemini', 'Writes the staff AI crop report', "Crop-log notes only, with farms as anonymous labels and phone numbers and emails masked. On Gemini's free tier, Google may keep and review what is sent"],
            ['OpenStreetMap and Esri', 'Map and satellite pictures on the delivery map', 'Your browser asks them for map tiles, so they see your IP address, not your pin'],
            ['Open-Meteo', 'Weather on the farmer dashboard', "Only the request for Tabaco City's weather"],
          ]}
        />
        <p>Payments themselves happen in the GCash app, under GCash&apos;s own privacy notice. Data stored in Japan is protected under this policy and Philippine law. We disclose information to authorities only when the law requires it.</p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <>
        <p>We keep personal information only as long as its purpose needs it; sales records stay longest because both sides of a sale rely on them.</p>
        <LegalTable
          head={['Information', 'Kept until']}
          rows={[
            ['ID photos and selfies', 'Deleted automatically 30 days after staff review them; photos of a replaced submission are deleted at once'],
            ['ID number (last four characters and fingerprint)', 'You delete your account'],
            ['Account, GCash details, delivery spot, plantings and crop logs', 'You delete your account (or remove them yourself in Profile)'],
            ['Messages and their photos', 'Either person in the conversation deletes their account. Removing a conversation only hides it from your list'],
            ['Orders and the activity log', 'Kept as the marketplace\'s records; after account deletion they show "Deleted user" and lose the delivery address and GCash details'],
            ['IP addresses used for attempt limits', "Cleared about a day after the limit's time window ends"],
          ]}
        />
        <p><strong>Deleting your account</strong> (Profile → Delete my account) removes your name, email, password, two-step sign-in, ID submissions and photos, reviews, messages and their photos, notices, GCash details and QR code, delivery spots, and a farmer&apos;s plantings and crop logs; a farmer&apos;s products are archived. It is blocked while you have an active order or, for a farmer, while a customer is owed a refund. Accounts are not deleted automatically for being inactive.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <>
        <ul>
          <li>All traffic to the marketplace is encrypted (HTTPS).</li>
          <li>Passwords are stored only as one-way hashes; nobody, staff included, can read them.</li>
          <li>Staff sign in with a password and an authenticator code; the authenticator secret is stored encrypted.</li>
          <li>ID photos, chat photos and customers&apos; QR codes are kept in private storage and shown only through links that expire (five minutes for ID photos, one hour for the others).</li>
          <li>ID numbers are never stored whole: only a keyed fingerprint and the last four characters.</li>
          <li>Each role sees only what it needs (section 3); staff cannot see delivery addresses, GCash account details or messages.</li>
          <li>Repeated sign-in and sign-up attempts are limited, and important staff actions are written to an activity log.</li>
        </ul>
        <p>No system is perfectly secure. If a breach puts your personal information at risk, we will notify you and the National Privacy Commission as the Data Privacy Act requires.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and your browser',
    body: (
      <>
        <p>The marketplace uses one cookie and a little browser storage, all needed for it to work; there are no advertising or analytics cookies.</p>
        <LegalTable
          head={['Name', 'Kind', 'What it is for', 'How long']}
          rows={[
            [<code key="t">token</code>, 'Cookie (not readable by page scripts)', 'Keeps you signed in', '7 days, or until you log out'],
            [<code key="c">cart_&lt;your id&gt;</code>, 'Browser storage', 'Your cart (it stays on that device)', 'Until you order or clear it'],
            [<code key="p">products_card_size</code>, 'Browser storage', 'How large product cards appear', 'Until you clear it'],
            ['Announcement draft', 'Browser storage for the tab (staff only)', 'Carries an AI or market draft into the announcement form', 'Until the tab is closed'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights and how to reach us',
    body: (
      <>
        <p>Under the Data Privacy Act you have the right to be informed, to access your information, to have it corrected, to object, to have it erased or blocked, to get a copy of it, to claim damages, and to complain to the National Privacy Commission.</p>
        <ul>
          <li><strong>Do it yourself in Profile:</strong> correct your name, change your email, update or remove GCash details and your QR code, change or remove your delivery spot, and delete your account.</li>
          <li><strong>Ask us</strong> for a copy of your information, a correction you can&apos;t make yourself, or anything else in this policy. We answer within a reasonable time and may ask you to prove the account is yours.</li>
          <li><strong>Complain to the National Privacy Commission</strong> at <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">privacy.gov.ph</a> if you think we have misused your information.</li>
          <li><strong>Contact:</strong> Data Protection Officer, Mayon Vegetable Farmers Agriculture Cooperative, Tabaco City, Albay. Email: <a href={`mailto:${COOPERATIVE_EMAIL}`}>{COOPERATIVE_EMAIL}</a>.</li>
          <li><strong>Changes.</strong> We post any update here with its date and announce important changes in the marketplace.</li>
        </ul>
      </>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={<p>Effective {LEGAL_EFFECTIVE_DATE}. This policy explains what personal information the MaVeFaCo Marketplace collects, why, who sees it, how long it is kept, and your rights over it.</p>}
      sections={sections}
      other={{ href: '/terms', label: 'Terms of Service' }}
    />
  )
}
