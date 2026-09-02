import type { Metadata } from "next";
import { Lora, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Leaf, MapPin, Mail, Phone } from "lucide-react";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
      className={`${lora.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-white font-sans">
        <Providers>
          <Navbar />
          <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>

          {/* Footer */}
          <footer className="shrink-0 bg-green-900 text-white">
            <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

              {/* Brand */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Leaf size={20} className="text-green-400" />
                  <span className="font-serif font-bold text-xl tracking-tight">CoopMarket</span>
                </div>
                <p className="text-green-300 text-sm leading-relaxed">
                  Connecting local farmers with customers for a fresher, fairer food system — built for Filipino communities.
                </p>
                <div className="mt-5 flex items-center gap-2 text-green-400 text-sm">
                  <MapPin size={14} />
                  <span>Legazpi City, Albay</span>
                </div>
              </div>

              {/* Marketplace */}
              <div>
                <h4 className="font-semibold text-green-200 mb-4 text-sm uppercase tracking-wider">Marketplace</h4>
                <ul className="space-y-3 text-sm text-green-300">
                  <li>
                    <Link href="/products" className="hover:text-white transition-colors">
                      Browse Products
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="hover:text-white transition-colors">
                      About the Cooperative
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="hover:text-white transition-colors">
                      Create Account
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-white transition-colors">
                      Sign In
                    </Link>
                  </li>
                </ul>
              </div>

              {/* For Farmers */}
              <div>
                <h4 className="font-semibold text-green-200 mb-4 text-sm uppercase tracking-wider">For Farmers</h4>
                <ul className="space-y-3 text-sm text-green-300">
                  <li>
                    <Link href="/register" className="hover:text-white transition-colors">
                      Join as Farmer
                    </Link>
                  </li>
                  <li>
                    <Link href="/farmer" className="hover:text-white transition-colors">
                      Farmer Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/farmer/products/new" className="hover:text-white transition-colors">
                      List a Product
                    </Link>
                  </li>
                  <li>
                    <Link href="/farmer/crops" className="hover:text-white transition-colors">
                      Crop Monitoring
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h4 className="font-semibold text-green-200 mb-4 text-sm uppercase tracking-wider">Contact</h4>
                <ul className="space-y-3 text-sm text-green-300">
                  <li className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-green-500" />
                    <span>Legazpi City, Albay, Philippines 4500</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Mail size={14} className="shrink-0 text-green-500" />
                    <a href="mailto:info@coopmarket.ph" className="hover:text-white transition-colors">
                      info@coopmarket.ph
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone size={14} className="shrink-0 text-green-500" />
                    <span>+63 52 480 0000</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-green-800">
              <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-green-500">
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
