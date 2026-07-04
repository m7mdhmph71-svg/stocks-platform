import type { MetadataRoute } from "next";

// بيان تطبيق الويب (PWA): يتيح «إضافة إلى الشاشة الرئيسية» على الجوال
// فيعمل الموقع كتطبيق مستقل بأيقونته واسمه.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "سهم سكرينر — منصة الفرز الشرعي والفني",
    short_name: "سهم سكرينر",
    description:
      "فحص شرعي ونسبة تطهير، فلاتر مضاربة وزخم واستثمار، وأهداف وتوقعات فنية للأسهم الأمريكية.",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#ffffff",
    theme_color: "#15855c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
