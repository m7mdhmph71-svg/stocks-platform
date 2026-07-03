import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

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
    "منصة فحص أسهم أمريكية بالعربية: الفحص الشرعي ونسبة التطهير، فلاتر المضاربة والزخم والاستثمار، والأهداف والتوقعات الفنية.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
