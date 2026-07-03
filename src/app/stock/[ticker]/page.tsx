import type { Metadata } from "next";
import { StockDetail } from "@/components/StockDetail";

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const t = decodeURIComponent(ticker).trim().toUpperCase();
  return {
    title: `${t} — الفحص الشرعي والأهداف`,
  };
}

export default async function StockPage({ params }: Props) {
  const { ticker } = await params;
  const t = decodeURIComponent(ticker).trim().toUpperCase();
  return <StockDetail ticker={t} />;
}
