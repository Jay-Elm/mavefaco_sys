import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CoopMarket - Cooperative Marketplace",
  description: "A marketplace connecting farmers and customers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-gray-50">
        <Providers>
          <Navbar />
          <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
          <footer className="shrink-0 bg-green-800 text-green-200 text-center py-4 text-sm">
            © 2026 CoopMarket — Connecting farmers and communities.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
