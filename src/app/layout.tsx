import type { Metadata, Viewport } from "next";
import { productBrand } from "@/lib/admissions/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${productBrand.assistantName} - поступление за границу`,
  description: productBrand.description,
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
      <body className="min-h-full bg-[#f7f8f4] text-[#14213d]">
        {children}
      </body>
    </html>
  );
}
