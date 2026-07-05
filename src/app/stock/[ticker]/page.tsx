import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StockDetail } from "@/components/StockDetail";
import { getStockDetail } from "@/lib/stockDetail";
import { currencyFor, fmtPrice } from "@/lib/format";

// صفحة السهم مُصيَّرة خادمياً: العنوان والوصف والمعاينات (OG) تُبنى من
// بيانات السهم الفعلية، والمحتوى الكامل يصل للزاحف في أول استجابة.
// البيانات تُبنى مرة واحدة للطلب (React cache) وتُمرَّر للمكوّن التفاعلي.

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ ticker: string }>;
}

function publicBase(): string | null {
  const u = process.env.PUBLIC_SITE_URL;
  return u && u.length > 0 ? u.replace(/\/$/, "") : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const t = decodeURIComponent(ticker).trim().toUpperCase();

  const generic: Metadata = {
    title: `${t} — الفحص الشرعي والأهداف`,
    description:
      "الفحص الشرعي ونسبة التطهير والأهداف والأوقاف الفنية — سهم سكرينر.",
  };

  const result = await getStockDetail(t);
  if (!result.ok) return generic;

  const { row } = result.data;
  const sh = row.shariah;
  const bits: string[] = [`السعر ${fmtPrice(row.price, currencyFor(t))}`];
  if (sh && sh.verdict !== "UNKNOWN") {
    bits.push(`الحكم الشرعي: ${sh.verdictAr}`);
    if (sh.purificationRatio !== null && sh.purificationRatio > 0) {
      bits.push(`نسبة التطهير ${sh.purificationRatio}%`);
    }
  }
  const title = `${row.name} (${t}) — الفحص الشرعي والأهداف`;
  const description =
    `${bits.join(" · ")} — أهداف وأوقاف فنية مختبرة تاريخياً وشموع بكل الفترات. ` +
    "فرز آلي، ليس توصية استثمارية.";

  const base = publicBase();
  return {
    title,
    description,
    alternates: base ? { canonical: `${base}/stock/${t}` } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "سهم سكرينر",
      locale: "ar",
      ...(base ? { url: `${base}/stock/${t}` } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function StockPage({ params }: Props) {
  const { ticker } = await params;
  const t = decodeURIComponent(ticker).trim().toUpperCase();

  // نفس نتيجة generateMetadata (مخبأة بالطلب) — بلا بناء مزدوج.
  const result = await getStockDetail(t);

  // رمز غير موجود/غير صالح → 404 حقيقية كي لا تُفهرس صفحات وهمية
  if (!result.ok && (result.status === 404 || result.status === 400)) {
    notFound();
  }

  // فشل مصدر عابر (502): نسلّم للمكوّن التفاعلي (رسالة خطأ + زر إعادة)
  return <StockDetail ticker={t} initial={result.ok ? result.data : undefined} />;
}
