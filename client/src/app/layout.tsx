import type { Metadata } from "next";
import { connection } from "next/server";
import { Big_Shoulders, Big_Shoulders_Stencil, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import ConditionalFooter from "@/components/ConditionalFooter";
import Footer from "@/components/Footer";
import { getSessionUser } from "@/lib/serverSession";

// Headlines: a condensed signage face, after the hand-lettered price boards
// of the palengke. Its stencil cut is kept for crate-style product labels.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  axes: ["opsz"],
});

const bigShouldersStencil = Big_Shoulders_Stencil({
  variable: "--font-big-shoulders-stencil",
  subsets: ["latin"],
  weight: ["700"],
});

// Body and interface text, with figures that line up in price columns.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
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
  // Who's signed in, so the first paint is already theirs (no signed-out flash).
  const user = await getSessionUser();

  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${bigShouldersStencil.variable} ${hanken.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-white font-sans text-soil">
        <Providers initialUser={user}>
          <Navbar />
          <main className="flex-1">{children}</main>
          <ConditionalFooter>
            <Footer />
          </ConditionalFooter>
        </Providers>
      </body>
    </html>
  );
}
