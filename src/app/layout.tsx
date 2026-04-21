import type { Metadata, Viewport } from "next";
import { productBrand } from "@/lib/admissions/brand";
import {
  getSiteUrl,
  siteDescription,
  siteKeywords,
  siteTitle,
} from "@/lib/admissions/site-metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: productBrand.assistantName,
  title: {
    default: siteTitle,
    template: `%s | ${productBrand.assistantName}`,
  },
  description: siteDescription,
  keywords: siteKeywords,
  authors: [{ name: productBrand.companyName }],
  creator: productBrand.companyName,
  publisher: productBrand.companyName,
  category: "education",
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: productBrand.companyName,
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: productBrand.assistantName,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f7f8f4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full bg-[var(--app-bg)] text-[var(--text)]">
        {children}
      </body>
    </html>
  );
}
