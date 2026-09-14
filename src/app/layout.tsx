import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "واژه‌سفر — سفری واژه‌به‌واژه در سرزمین قصه‌ها",
  description:
    "بازی پازل کلمات ایرانی‌الهام با ۱۰۰ مرحله در ۱۰ فصل؛ با یافتن واژه‌ها دنیای بازی زنده می‌شود. اورجینال، آفلاین و بدون نیاز به اینترنت.",
  keywords: ["بازی کلمات", "پازل فارسی", "واژه‌سفر", "word puzzle", "بازی ایرانی"],
  manifest: "/manifest.webmanifest",
  icons: { icon: "/assets/icons/icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1b2432",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">
        {/* critical first-screen images — fetched immediately, before JS boots */}
        <link rel="preload" as="image" href="/assets/bg/home3.webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/assets/img/grandpa.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/assets/img/logo_banner.png" fetchPriority="high" />
        {children}
      </body>
    </html>
  );
}
