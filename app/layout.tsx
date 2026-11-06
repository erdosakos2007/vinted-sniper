import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteShell from "./components/SiteShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vinted-sniper-6xb.pages.dev"),
  title: "Vinted Sniper — Find Vinted deals faster",
  description: "Discover fresh Vinted listings, save deals, track prices, and estimate potential resale value with Vinted Sniper.",
  applicationName: "Vinted Sniper",
  verification: {
    google: "jEgl0-AtM2JH7bDCTzDFdFWaiw_qvMr93ok1lqFFpKc",
  },
  openGraph: {
    type: "website",
    url: "https://vinted-sniper-6xb.pages.dev/",
    siteName: "Vinted Sniper",
    title: "Vinted Sniper — Find Vinted deals faster",
    description: "Discover fresh Vinted listings, save deals, track prices, and estimate potential resale value.",
  },
  twitter: {
    card: "summary",
    title: "Vinted Sniper — Find Vinted deals faster",
    description: "Discover fresh Vinted listings, save deals, track prices, and estimate potential resale value.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full"><SiteShell>{children}</SiteShell></body>
    </html>
  );
}
