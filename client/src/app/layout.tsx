import type { Metadata } from "next";
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
          <ConditionalFooter />
        </Providers>
      </body>
    </html>
  );
}
