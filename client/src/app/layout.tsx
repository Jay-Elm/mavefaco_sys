import type { Metadata } from "next";
import { connection } from "next/server";
import { Fraunces, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import ConditionalFooter from "@/components/ConditionalFooter";

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
  title: "MaVeFaCo — Mayon Vegetable Farmers Agriculture Cooperative",
  description: "The Mayon Vegetable Farmers Agriculture Cooperative marketplace: fresh produce straight from member farmers in Albay. Buy fresh, support local, and grow together.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render every page per request. The Content-Security-Policy (src/proxy.ts)
  // carries a fresh nonce each time, and Next.js can only stamp it on its
  // scripts while rendering a request; a page prerendered at build time
  // would ship scripts without it, and the browser would block them.
  await connection();

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plusJakarta.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-white font-sans">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </Providers>
      </body>
    </html>
  );
}
