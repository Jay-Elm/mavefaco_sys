import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Leaf, MapPin, Mail, Phone } from "lucide-react";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CoopMarket — Fresh from the Farm",
  description: "A cooperative marketplace connecting local farmers with customers. Buy fresh, support local, and grow together.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plusJakarta.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-white font-sans">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>

          <footer className="shrink-0 bg-[#1B3A2D] text-white">
            <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Leaf size={18} className="text-green-400" />
                  <span className="font-serif text-lg font-bold">CoopMarket</span>
                </div>
                <p className="text-green-300 text-sm leading-relaxed">
                  Connecting local farmers with customers for a fresher, fairer food system — built for Filipino communities.
                </p>
                <div className="mt-5 flex items-center gap-2 text-green-400 text-sm">
                  <MapPin size={13} />
                  <span>Tabaco City, Albay</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-green-200 mb-4 text-sm">Marketplace</h4>
                <ul className="space-y-3 text-sm text-green-300">
                  <li><Link href="/products" className="hover:text-white transition-colors">Browse products</Link></li>
                  <li><Link href="/about" className="hover:text-white transition-colors">About the cooperative</Link></li>
                  <li><Link href="/register" className="hover:text-white transition-colors">Create account</Link></li>
                  <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-green-200 mb-4 text-sm">For farmers</h4>
                <ul className="space-y-3 text-sm text-green-300">
                  <li><Link href="/register" className="hover:text-white transition-colors">Join as farmer</Link></li>
                  <li><Link href="/farmer" className="hover:text-white transition-colors">Farmer dashboard</Link></li>
                  <li><Link href="/farmer/products/new" className="hover:text-white transition-colors">List a product</Link></li>
                  <li><Link href="/farmer/crops" className="hover:text-white transition-colors">Crop monitoring</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-green-200 mb-4 text-sm">Contact</h4>
                <ul className="space-y-3 text-sm text-green-300">
                  <li className="flex items-start gap-2">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-green-500" />
                    <span>Tabaco City, Albay, Philippines 4511</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Mail size={13} className="shrink-0 text-green-500" />
                    <a href="mailto:info@coopmarket.ph" className="hover:text-white transition-colors">info@coopmarket.ph</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone size={13} className="shrink-0 text-green-500" />
                    <span>0993-465-6269</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-green-900">
              <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-green-600">
                <span>© 2026 CoopMarket — Connecting farmers and communities.</span>
                <span>Built with care for Filipino farmers.</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
