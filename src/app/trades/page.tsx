import type { Metadata } from "next";
import { TradesClient } from "@/components/TradesClient";

export const metadata: Metadata = { title: "سجل صفقاتي" };

export default function TradesPage() {
  return <TradesClient />;
}
