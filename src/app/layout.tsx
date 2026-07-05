import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SessionProvider } from "@/components/useSession";

const tajawal = Tajawal({
  weight: ["400", "500", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "سهم سكرينر — منصة الفرز الشرعي والفني",
    template: "%s | سهم سكرينر",
  },
  description:
    "منصة فحص الأسهم الأمريكية والسعودية بالعربية: الفحص الشرعي ونسبة التطهير، فلاتر المضاربة والزخم والاستثمار، والأهداف والتوقعات الفنية.",
  appleWebApp: {
    capable: true,
    title: "سهم سكرينر",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#15855c" },
    { media: "(prefers-color-scheme: dark)", color: "#0e4534" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <SessionProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
